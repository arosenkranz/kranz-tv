# Contract — Shares Server Functions

The shares feature exposes three server functions defined in `src/routes/api/shares.ts` using TanStack Start's `createServerFn`. These are RPC-style; clients call them via the auto-generated `createServerFn` wrappers. There are no REST endpoints — the contract is the function signature.

All payloads are validated server-side with Zod. Validation failure returns a typed error (see "Errors" section).

## Function 1 — `publishShare`

**Method**: `POST` (server function, body-bearing)

### Input

```ts
{
  channel: {
    kind: 'video' | 'music'
    sourceUrl: string          // raw URL from the sharer's local custom channel
    name: string               // 1-80 chars, trimmed
    description?: string       // 0-280 chars, trimmed; HTML-stripped server-side
  }
  credential: string           // base64url, 43 chars, from sharer's localStorage
}
```

### Success response

```ts
{
  shareId: string              // 8 chars, Crockford base32, uppercase
  shareUrl: string             // absolute https URL pointing at /s/<shareId>
  isNew: boolean               // true if just minted, false if returned from idempotency
}
```

### Behavior

1. Validate the payload with Zod. On failure → `invalid_payload`.
2. Hash the credential: `credentialHash = sha256_hex(credential)`.
3. Check rate limit at `ratelimit:<credentialHash>`. If over budget → `rate_limited`.
4. Compute `idempotencyKey = sha256(credential + ':' + normalizeSourceUrl(channel.sourceUrl))`. Read `idempotency:<idempotencyKey>`. If present → return the existing record (with `isNew: false`).
5. Mint a new `shareId`. Check `share:<shareId>` does not exist (collision check; retry with new id on collision, max 3 tries → `kv_unavailable`).
6. Write `share:<shareId>` and `idempotency:<idempotencyKey>` (and increment rate-limit counter). Return `{ shareId, shareUrl, isNew: true }`.

### Errors

| Error | When | HTTP analog |
|---|---|---|
| `invalid_payload` | Zod validation failed | 400 |
| `rate_limited` | More than 10 publishes/hour for this credential | 429 |
| `kv_unavailable` | KV write failed after retries | 503 |

---

## Function 2 — `resolveShare`

**Method**: `GET` (server function, query-string-bearing)

### Input

```ts
{
  shareId: string              // 8 chars, Crockford base32, case-insensitive
}
```

### Success response

```ts
{
  record: {
    shareId: string
    kind: 'video' | 'music'
    sourceUrl: string
    name: string
    description: string | null
    createdAt: number
    revokedAt: number | null
  }
}
```

Note: `credentialHash` is **never** returned. `revokedAt` is non-null when the record exists but has been revoked — the client uses this to render the "channel unavailable" message (per spec FR-009).

### Behavior

1. Validate `shareId` format. On failure → `invalid_payload`.
2. Normalize to canonical uppercase.
3. Read `share:<shareId>`. If absent → `not_found`.
4. Strip `credentialHash`. Return the record.
5. Caller decides what to do based on `revokedAt`. Server does not return an error for revoked records — the data IS the answer.

### Errors

| Error | When | HTTP analog |
|---|---|---|
| `invalid_payload` | shareId doesn't match the format | 400 |
| `not_found` | No KV entry for this shareId | 404 |
| `kv_unavailable` | KV read failed | 503 |

### Caching

The response includes a `Cache-Control: public, max-age=60, stale-while-revalidate=600` header. This serves two goals:
- Reduces KV reads on viral shares (a popular link gets resolved once per minute per edge).
- The 60s freshness aligns with KV's eventual-consistency window — a stale-but-recent response is acceptable.

After the **first** resolve, the recipient's client caches the record locally and never queries again (FR-008). The cache header is for the cold-start surge case.

---

## Function 3 — `revokeShare`

**Method**: `POST` (server function, body-bearing)

### Input

```ts
{
  shareId: string              // 8 chars, Crockford base32
  credential: string           // base64url, 43 chars
}
```

### Success response

```ts
{
  ok: true
  revokedAt: number            // Unix epoch ms, server-set
}
```

### Behavior

1. Validate payload.
2. Hash the supplied credential.
3. Read `share:<shareId>`. If absent → `not_found`.
4. Compare `record.credentialHash` to the supplied hash. Mismatch → `unauthorized`.
5. If already revoked → return success idempotently with the existing `revokedAt`.
6. Otherwise set `revokedAt = Date.now()` and write back to KV.

### Errors

| Error | When | HTTP analog |
|---|---|---|
| `invalid_payload` | Format mismatch | 400 |
| `not_found` | shareId doesn't exist | 404 |
| `unauthorized` | credentialHash mismatch | 403 |
| `kv_unavailable` | KV failure | 503 |

### Side effects

- The `idempotency:<key>` entry is **kept**. Re-publishing the same `(credential, sourceUrl)` after revoke returns the SAME shareId, but the record's `revokedAt` is reset to `null`. This is acceptable — the original recipients' local copies are unaffected, and the sharer gets back the URL they "owned."
- Rate-limit counter is **not** decremented.

---

## Common error envelope

All errors are returned as a typed result rather than a thrown HTTP error, so the client can pattern-match without try/catch on the wire shape:

```ts
type ShareErrorCode =
  | 'invalid_payload'
  | 'rate_limited'
  | 'not_found'
  | 'unauthorized'
  | 'kv_unavailable'

type ShareResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: ShareErrorCode
      message?: string
      // Present only on `rate_limited` — milliseconds until the caller can retry.
      // Computed server-side from the rate-limit window's expiry.
      retryAfterMs?: number
    }
```

The `message` field is human-readable English suitable for surfacing to the user (with i18n deferred to a future feature). Examples:
- `rate_limited`: "You've published too many shares in the last hour. Try again in <N> minutes." (UI formats `retryAfterMs`)
- `not_found`: "This channel is no longer available."
- `unauthorized`: "Only the original sharer can revoke this channel."
- `kv_unavailable`: "Couldn't reach the share registry — try again."

`retryAfterMs` MUST be present when `error === 'rate_limited'`. Other error codes MAY omit it.

---

## Headers and runtime

- All three functions run on Cloudflare Workers.
- `crypto.subtle.digest('SHA-256', ...)` is used for hashing — no Node imports.
- KV binding is `env.SHARED_CHANNELS_KV` (see `wrangler.jsonc` config).
- Each function emits a server metric (`kranz_tv.share.publish | resolve | revoke`) with an `outcome` tag matching the result.
- Latency histograms (`kranz_tv.share.<fn>_ms`) are recorded for each call.

---

## Out of scope (for v1)

- **Bulk operations** (e.g., revoke-all): not needed at expected scale.
- **List-my-shares endpoint**: client tracks its own published shares via the local `customChannels` `shareRef.role='sharer'` flag.
- **Edit a published share's name/description**: deferred. Sharer's workaround is revoke + re-publish (which produces the same shareId per idempotency).
- **Authentication on resolve**: shares are public-by-design (anyone with the URL can receive). If "private shares" are added later, that's a separate feature with a different contract.
