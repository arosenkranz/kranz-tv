# Phase 0 Research — Shared Channels

This document records the technical decisions needed before writing the data model and contracts. Each entry follows the format **Decision / Rationale / Alternatives considered**.

## R1. Storage primitive on Cloudflare

**Decision**: **Cloudflare KV** (workers KV namespace `SHARED_CHANNELS_KV`).

**Rationale**:

- Data shape is a pure key→value lookup (share-id → JSON record). KV is purpose-built for this.
- Free tier covers 100k reads/day and 1k writes/day — vastly above the projected v1 traffic.
- KV bindings are first-class on Cloudflare Workers; no extra infrastructure to provision.
- Eventual consistency (~60s global propagation on writes) is **acceptable** because:
  - The spec (FR-013, SC-005) explicitly tolerates brief outage and stale-revoke states.
  - Existing recipients keep working without registry calls (FR-008).
- KV scales automatically — no capacity planning needed at this scale.

**Alternatives considered**:

- **Cloudflare Durable Objects** — Strong consistency, but overkill for a non-coordinated data store. Higher cost, more complex programming model. Reasonable later if a feature needs strong consistency (e.g., live presence counts).
- **Cloudflare D1 (SQLite)** — Relational queries are unnecessary; we only do `get(id)` and `put(id, value)`. D1's strengths (joins, complex queries) are wasted here.
- **External managed DB (Supabase, Neon, etc.)** — Adds a runtime dependency, a cold-start penalty, and a billing relationship outside Cloudflare. Pure overhead for a sub-1KB key-value workload.
- **Embed records in Worker source via build-time bundling** — Was rejected immediately: shares are user-created at runtime; there's no build-time data.

## R2. Share-ID format

**Decision**: **8-character base32 (Crockford alphabet)** strings, generated client-side as the candidate ID and confirmed server-side.

**Rationale**:

- Crockford base32 (alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`) excludes ambiguous characters (`I`, `L`, `O`, `U`) and is case-insensitive on read — important for shares pasted from chat.
- 8 chars × 5 bits = 40 bits of entropy. With 1000 shares, collision probability is `~1000² / 2⁴¹ ≈ 5e-7` — well within "never happens." With 1M shares it's still under 1 in 2k, and we'll verify uniqueness at write time anyway.
- URL-safe: no encoding needed.
- Short enough to feel "linky," long enough to not be guessable.

**Alternatives considered**:

- **UUIDv4** — 36 chars, ugly in URLs, 122 bits is overkill for the threat model.
- **NanoID (21-char URL-safe)** — Reasonable, but 21 chars is still long and the alphabet includes ambiguous chars.
- **Hash of source URL** — Would lose the per-sharer separation that the spec requires (Edge Cases: two sharers of the same playlist get distinct URLs).
- **Sequential integer** — Enumerable, allows scraping the entire registry. Rejected.

**Generation**: client generates 8 random Crockford-base32 chars; server checks for collision and rejects with a special error (~1 in 10⁹ event); client retries with a new ID.

## R3. Sharer credential

**Decision**: **256-bit random token**, generated via `crypto.getRandomValues`, base64url-encoded, stored in `localStorage` under key `kranz.tv.sharer.credential` (lazy-created on first publish). The server stores only `SHA-256(credential)` to validate revoke requests.

**Rationale**:

- No accounts, no PII, fits the spec's "anonymous" model.
- 256 bits is unforgeable. SHA-256 storage means a leaked KV value cannot be replayed for revoke (the credential never leaves the sharer's browser).
- Reuses across all of a sharer's shares — one credential authorizes revoke for any share that browser created.
- localStorage is durable across reloads; clearing browser data drops the credential, which is consistent with the spec's "lost credential = lost revoke ability" assumption.

**Alternatives considered**:

- **JWT or signed token** — Adds key management. Unnecessary; we control both ends.
- **Per-share credential** — More secure but worse UX (revoke would need to track each share's credential separately). Single-credential is right for this scale.
- **IP-bound** — Cloudflare's `request.cf.ip` works, but punishes legitimate users on changing IPs (mobile, VPN). Rejected.

## R4. Idempotent publish

**Decision**: When publishing, compute `idempotencyKey = SHA-256(credential || ":" || normalizedSourceUrl)`. Maintain a secondary KV index: `idempotency:<idempotencyKey>` → `<shareId>`. On publish, first read this index; if present, return the existing share-id; if absent, mint a new share-id and write both keys atomically (KV doesn't have transactions; we accept the small race window — the worst case is a duplicate share, which is harmless and rate-limited).

**Rationale**:

- Satisfies FR-003 (idempotent re-publish from same browser).
- `normalizedSourceUrl` collapses trivial differences (trailing slashes, lowercased host, stripped query params except `list=` for YouTube).
- Different credentials → different `idempotencyKey` → distinct shares (matches Edge Cases).

**Alternatives considered**:

- **Hash share-id directly from `(credential, sourceUrl)`** — Deterministic but reveals sharer-specific info if the same credential is leaked alongside a share. Indirection via random share-id + idempotency index is the same UX with better abuse-resistance.
- **Skip idempotency, accept duplicates** — Bad UX (sharer sees a different URL each time, can't tell which is "the" link).

## R5. Rate limiting

**Decision**: **Token bucket per credential**, stored in KV at key `ratelimit:<credentialHash>` as `{ count: number, windowStart: number }`. Limit: **10 publishes per rolling hour**. Resolve and revoke are not rate-limited at v1.

**Rationale**:

- 10/hour is generous for legitimate use, prohibitive for scripted abuse.
- Per-credential rather than per-IP: avoids penalizing shared networks (offices, conferences). A determined abuser can mint fresh credentials, but that's a higher friction-cost than abusing an unlimited endpoint.
- KV writes for the counter are cheap; we can move to Durable Objects later if precise atomicity matters.

**Alternatives considered**:

- **Cloudflare Rate Limiting** (the platform feature) — Works on URL patterns, not on user-supplied identifiers. Doesn't fit the per-credential model.
- **No rate limiting in v1** — Tempting at this scale, but adding it later is harder than starting with it. Cheap insurance.

## R6. Routing

**Decision**: Recipient lands at **`/s/<shareId>`** (e.g., `/s/AB12CD34`). The route reads the share-id, calls `resolveShare`, persists into the local custom channels list, and **redirects** to the canonical `/channel/<id>` route. The redirect happens via TanStack Router's `redirect()` from the loader.

**Rationale**:

- Short URLs are user-visible product polish.
- Distinct prefix (`/s/`) avoids collision with any future `/channel/<slug>` schemes.
- The redirect funnels share-recipients into the same code path as preset/custom channels — only the resolution step is new.

**Alternatives considered**:

- **`/share/<id>`** — More verbose, no advantage.
- **`/channel/share/<id>`** — Couples share-handling with the channel route; adds branching where none is needed.
- **Query param on `/`** (e.g., `?share=...`) — Ugly, error-prone, breaks expected URL semantics.

## R7. Persistence model on the recipient

**Decision**: When a recipient resolves a share, write a new entry into the **existing** `customChannels` localStorage list (`src/lib/storage/local-channels.ts`), tagging it with `shareRef: { shareId, role: 'recipient' }`. Channel-id generation: hash the share-id into a stable client-side channel-id (e.g., `share-<shareId>` → no collision with preset IDs).

**Rationale**:

- Reuses 100% of the existing custom-channel hydration path. No new lifecycle, no new render path.
- The `shareRef` field opens the door for future UI ("this channel was shared by you / received from a friend").
- Stable channel-id means refreshing the page doesn't re-import; the existing localStorage hydration handles it.
- Recipients keep their channel even if the share is later revoked — the registry stops resolving for _new_ visitors, but existing local copies persist (matches FR-009 and Edge Cases).

**Alternatives considered**:

- **A new `sharedChannels` localStorage namespace** — Doubles the persistence surface for no benefit; the existing hydration code already handles "list of channels," and adding a parallel list would force every consumer to merge.
- **Server-rendered hydration on the share route** — Couples persistence to the server response and is harder to make offline-friendly.

## R8. Schedule authority (constitution gate)

**Decision**: **Unchanged from today**. `getSchedulePosition` remains the single source of truth. The registry never sees timestamps, never returns "what's playing," never participates in scheduling.

**Rationale**: Constitution Principle I; spec FR-016. This is non-negotiable.

**Alternatives considered**: None — this is the project's defining invariant.

## R9. Observability

**Decision**: New RUM custom actions and DogStatsD metrics, all added incrementally as each build step lands.

**Client (RUM)**:

- `share_publish_started` / `share_publish_completed` / `share_publish_failed { reason }`
- `share_resolve_started` / `share_resolve_completed` / `share_resolve_failed { reason }`
- `share_revoke_completed`

**Server (DogStatsD via existing `~/lib/datadog/server-metrics.ts`)**:

- `kranz_tv.share.publish` (counter, tagged `outcome:success|rate_limited|invalid|kv_error`)
- `kranz_tv.share.resolve` (counter, tagged `outcome:hit|miss|revoked|kv_error`)
- `kranz_tv.share.revoke` (counter, tagged `outcome:success|unauthorized|not_found`)
- `kranz_tv.share.publish_ms` / `kranz_tv.share.resolve_ms` (histograms)
- `kranz_tv.share.kv_size` (gauge, sampled hourly)

**Rationale**: Constitution Principle IV. Metric names follow the existing `kranz_tv.*` convention.

**Alternatives considered**:

- **Bolt-on observability after feature lands** — explicitly forbidden by the constitution.
- **Client-side only** — would lose visibility into KV failures and rate-limit decisions.

## R10. Testing strategy

**Decision**:

- **Unit tests** for every pure helper (`share-id`, `share-credential`, `share-url`, `share-record` schema). Vitest, written first.
- **Integration tests** for `api/shares.ts` server functions, using an **in-memory KV stub** that implements the same `get`/`put`/`delete` surface as the Cloudflare KV binding. Tests run without any network or Cloudflare runtime.
- **E2E test** (Playwright) covering the publish-then-receive loop end-to-end against a real wrangler-dev instance.
- **No coverage carve-out**: shares code is held to the project's 80% threshold.

**Rationale**: Mirrors the existing project pattern. Pure functions get cheap, fast unit tests; integration tests cover branching logic in handlers; one expensive E2E test guards the actual user flow.

**Alternatives considered**:

- **Hit a real KV namespace in CI** — Slower, requires Cloudflare credentials in CI, no benefit over a stub for the logic we're testing.
- **Skip integration, only unit + E2E** — Leaves handler branching un-tested in fast feedback loop. Rejected.

---

All NEEDS CLARIFICATION items from `plan.md` are resolved. Phase 1 can proceed.
