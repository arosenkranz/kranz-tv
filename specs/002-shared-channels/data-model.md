# Phase 1 Data Model — Shared Channels

This document defines the entities introduced or modified by this feature, their fields, validation rules, and lifecycles. All schemas are expressed as Zod-validated TypeScript types; the source of truth in code will be `src/lib/shares/share-record.ts`.

## Entity 1 — `ShareRecord` (server-side, Cloudflare KV)

The canonical published representation of a shared channel. Stored in KV at key `share:<shareId>`.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `shareId` | `string` | yes | 8-char Crockford base32 (matches `/^[0-9A-HJKMNP-TV-Z]{8}$/`). Doubles as the KV key suffix. |
| `kind` | `'video' \| 'music'` | yes | Distinguishes YouTube playlists from SoundCloud playlists. |
| `sourceUrl` | `string` | yes | Original playlist URL, normalized: lowercase host, trimmed, trailing slash removed, only meaningful query params kept (`list=` for YouTube). Max 2048 chars. |
| `name` | `string` | yes | Display name. 1–80 chars (visible truncation point in EPG cells). |
| `description` | `string \| null` | no | 0–280 chars. |
| `createdAt` | `number` | yes | Unix epoch milliseconds (UTC). Set by server. |
| `revokedAt` | `number \| null` | yes | Unix epoch milliseconds when revoked, or `null` if active. Server-set. |
| `credentialHash` | `string` | yes | SHA-256(credential) hex-encoded. Used to authorize revoke. Never returned to clients. |

### Validation rules

- `shareId` must be a valid Crockford base32 string of exactly 8 chars (uppercase canonical). Lowercase input on resolve is normalized before lookup.
- `sourceUrl` must pass:
  - For `kind='video'`: a YouTube URL whose normalized form contains a `list=` query parameter, or a bare playlist ID. Reuses the existing `extractPlaylistId` helper from `src/lib/import/parser.ts`.
  - For `kind='music'`: must pass the existing SoundCloud URL detection (`isSoundCloudUrl` in `src/lib/sources/soundcloud/parser.ts`).
- `name` must not be empty after trimming whitespace.
- `description`, when present, is HTML-stripped to plain text before storage (defense in depth — display path also escapes).
- `credentialHash` must be a 64-char lowercase hex string.

### Server-side response shape

When a record is returned to a client (via `resolveShare`), `credentialHash` is **stripped**. The exposed shape is:

```ts
type PublicShareRecord = Omit<ShareRecord, 'credentialHash'>
```

### Lifecycle

```
[non-existent] ──publish──▶ [active] ──revoke──▶ [revoked] ──(KV TTL: never in v1)──▶ [deleted]
                              │
                              └─publish-same-(credential,sourceUrl)─▶ [active] (idempotent: same shareId returned)
```

- A revoked record is **kept** in KV (not deleted) so that resolveShare can return a clean "revoked" status rather than an ambiguous 404. This also prevents a revoked share-id from being re-issued to a different sharer.
- No automatic expiry in v1. Future: a TTL of N days since `createdAt` could be added without breaking compatibility.

### Auxiliary KV keys (not separate entities, just storage details)

- `idempotency:<sha256(credential || ':' || normalizedSourceUrl)>` → `<shareId>` — used to satisfy FR-003 (idempotent re-publish).
- `ratelimit:<credentialHash>` → `{ count: number, windowStart: number }` — token bucket for FR-005.

These keys have an explicit KV TTL: idempotency keys expire 30 days after their last write (refreshed on re-publish); rate-limit keys expire 1 hour after `windowStart`.

---

## Entity 2 — `SharerCredential` (client-side, localStorage)

A per-browser, anonymous credential proving "this browser created share X." Stored under `localStorage` key `kranz.tv.sharer.credential.v1`.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `token` | `string` | yes | 256-bit random value, base64url-encoded (43 chars). Generated via `crypto.getRandomValues`. |
| `createdAt` | `number` | yes | Unix epoch ms. Diagnostic only — not used for auth decisions. |

### Validation rules

- `token` must match `/^[A-Za-z0-9_-]{43}$/` (base64url 32 bytes, no padding).
- A browser has exactly one credential, lazily generated on first publish attempt.

### Lifecycle

```
[absent] ──first publishShare()──▶ [present] ──user clears localStorage──▶ [absent]
```

- The credential is **not transmitted** in resolve requests (resolves are unauthenticated reads).
- It IS transmitted in publish and revoke requests, in the request body. The server hashes it with SHA-256 before any storage or comparison.
- A lost credential cannot be recovered; the user can no longer revoke their existing shares (acceptable per spec assumptions).

---

## Entity 3 — `CustomChannel` (existing — extended)

Already defined in `src/lib/scheduling/types.ts` and persisted via `src/lib/storage/local-channels.ts`. This feature **adds one optional field**.

### New field

| Field | Type | Required | Notes |
|---|---|---|---|
| `shareRef` | `{ shareId: string; role: 'sharer' \| 'recipient' } \| undefined` | no | Present iff this channel is part of a share relationship. `role: 'sharer'` indicates this browser published the share; `role: 'recipient'` indicates this browser received it via a share URL. |

### Validation rules

- `shareRef.shareId`, when present, must match the same Crockford-base32 8-char pattern as `ShareRecord.shareId`.
- A single channel cannot have `role: 'sharer'` AND `role: 'recipient'` simultaneously. If a sharer opens their own share URL, the existing `'sharer'` entry takes precedence (the route's persistence step skips the write).

### Migration

Existing localStorage entries written before this feature have no `shareRef` field. The hydration code MUST treat `shareRef === undefined` as the default — no migration script needed.

### Lifecycle changes

```
                         [no change for non-shared custom channels]

[shared channel — sharer side]
[absent] ──user shares preset/custom channel──▶ [present, shareRef.role='sharer']
                                                         │
                                                         └─user revokes──▶ [present, shareRef removed]

[shared channel — recipient side]
[absent] ──user opens /s/<id>──▶ [present, shareRef.role='recipient']
                                          │
                                          └─user removes via UI──▶ [absent]  (no server effect)
```

---

## Cross-entity invariants

1. **Schedule authority**: For both `kind='video'` and `kind='music'` shared channels, the schedule is computed exclusively client-side via `getSchedulePosition(channel, now)`. The server-side `ShareRecord` does not contain video/track listings or durations — those are fetched client-side from YouTube/SoundCloud after resolution, identical to the existing import flow.

2. **Privacy**: `ShareRecord` MUST NOT contain any field derived from `SharerCredential` other than `credentialHash`. `credentialHash` MUST NOT be returned in any response. A casual leak of a KV value MUST NOT enable revoke.

3. **No drift**: A shared channel's identity is its `shareId`. The `name` and `description` MAY be edited in a future feature without breaking existing recipients (their local copy is independent), but for v1, edit-after-publish is not supported.

4. **Reverse lookup**: A `CustomChannel` with `shareRef.role='sharer'` MUST link to a `ShareRecord` whose `credentialHash` matches the local browser's credential. Otherwise the local UI MUST NOT offer a revoke option for that channel (defensive — handles cross-browser localStorage import).

---

## Storage size estimates

- `ShareRecord`: ~500 bytes JSON-serialized (well under KV's 25 MB limit).
- 10,000 active shares × 500 bytes = 5 MB total. Free tier headroom is ample.
- Idempotency + rate-limit aux keys: ~100 bytes × ~2× share count = additional ~1 MB.

No sharding or partitioning needed at v1 scale or any plausible v2 scale.
