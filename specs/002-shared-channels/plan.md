# Implementation Plan: Shared Channels

**Branch**: `002-shared-channels` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-shared-channels/spec.md`

## Summary

Introduce a backend "share registry" that lets a viewer publish a custom channel and produce a short URL anyone can open to receive the same channel. The registry stores **only** the channel definition (source playlist URL + display metadata) and a per-share anonymous credential for revocation. **Schedule computation stays entirely client-side** — the registry never knows what is currently playing on any channel. Recipients fetch the registry exactly once per share URL, then the channel behaves identically to today's locally imported custom channels.

The registry is implemented as TanStack Start server functions backed by a Cloudflare KV namespace, reusing the existing pattern in `src/routes/api/channels.ts`. No new runtime dependency, no new deploy target.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, `noUnusedLocals`, `noUnusedParameters`)
**Primary Dependencies**: TanStack Start (server functions), Cloudflare Workers + KV, Zod (request/response validation), existing client stack (React 19, TanStack Router)
**Storage**:
- **Server**: Cloudflare KV namespace `SHARED_CHANNELS_KV` (key = share-id, value = JSON-serialized share record)
- **Client**: existing localStorage entry for custom channels (extended with optional `shareRef`); existing IndexedDB for music tracks (unchanged)
**Testing**: Vitest unit tests for pure helpers (id generation, validation, URL parsing); integration test against an in-memory KV stub for the server functions; Playwright E2E for the full publish-and-receive loop
**Target Platform**: Cloudflare Workers runtime (server side); modern desktop + mobile browsers (client side)
**Project Type**: Web application (single repo, single deploy target — no separate backend project introduced)
**Performance Goals**:
- Share publish: P95 < 500ms (one KV write + one read for idempotency check)
- Share resolve (first visit): P95 < 200ms (single KV read)
- Subsequent uses: 0 server calls (per FR-008)
**Constraints**:
- Cloudflare KV write rate limit: 1 write/sec/key — easily within target
- KV value size limit: 25 MB — share records are <1 KB, no concern
- KV consistency: eventually consistent globally; revoke may take up to ~60s to propagate to all edges (acceptable per spec, since existing recipients are unaffected)
- ESM-only, Web Platform APIs only (constitution constraint)
**Scale/Scope**:
- Estimated v1 traffic: <1000 shares total, <100 publishes/day (personal-project scale)
- Cloudflare Workers free tier covers 100k req/day; Workers KV free tier covers 100k reads + 1k writes/day. Headroom is enormous.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Deterministic Scheduling** — Does this feature touch `src/lib/scheduling/`? **No.** The scheduler is unchanged. The registry stores channel definitions only; `getSchedulePosition` is the sole authority for "what is playing." Pinned by FR-016.
- [x] **II. Client-Side Data Fetching** — Are any new YouTube API calls proxied server-side? **No.** Recipients still call the YouTube Data API client-side using their own `VITE_YOUTUBE_API_KEY` after the registry returns the source playlist URL. The registry never touches YouTube. Music channels work the same way for SoundCloud (the SC widget is loaded client-side).
- [x] **III. Test-First** — Pure functions in this feature: share-id generation, sharer-credential generation, share-URL parsing, share-record validation. All MUST have unit tests written before implementation per the constitution.
- [x] **IV. Observability** — New user flows: `share_publish_started`, `share_publish_completed`, `share_publish_failed`, `share_resolve_started`, `share_resolve_completed`, `share_resolve_failed`, `share_revoke_completed`. Server-side metrics: `kranz_tv.share.publish`, `kranz_tv.share.resolve`, `kranz_tv.share.revoke`, plus latency histograms. Recorded via existing `~/lib/datadog/rum.ts` and `~/lib/datadog/server-metrics.ts`.
- [x] **V. Immutability & File Size** — All client-side state transforms via spread/return-new. Projected file sizes: `share-id.ts` (~50 LOC), `share-credential.ts` (~80 LOC), `share-url.ts` (~60 LOC), `share-client.ts` (~200 LOC), server-side `api/shares.ts` (~250 LOC). All well under 800.
- [x] **Deployment Constraints** — Server code uses only `crypto.subtle`, `fetch`, KV bindings (no Node built-ins, no `require()`). Server function endpoints that read KV are NOT statically prerenderable — they call `KV.get()` at request time. New scripts (none planned) — no `tsconfig` updates needed.

**Result**: All gates pass. Constitution Check is GREEN.

## Project Structure

### Documentation (this feature)

```text
specs/002-shared-channels/
├── plan.md              # This file
├── research.md          # Phase 0 output (decisions + rationale)
├── data-model.md        # Phase 1 output (entities + validation rules)
├── quickstart.md        # Phase 1 output (developer-facing how-to-run)
├── contracts/
│   └── shares-api.md    # Server function contracts (publish/resolve/revoke)
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── shares/                          # NEW — pure helpers + client surface
│       ├── share-id.ts                  # Generate + validate short share IDs
│       ├── share-id.test.ts
│       ├── share-credential.ts          # Per-browser anon credential (localStorage)
│       ├── share-credential.test.ts
│       ├── share-url.ts                 # Build/parse /s/<id> URLs
│       ├── share-url.test.ts
│       ├── share-record.ts              # Zod schemas for share record + payloads
│       ├── share-record.test.ts
│       └── share-client.ts              # Client-side wrappers around server fns
│                                        # (publishShare, resolveShare, revokeShare)
├── lib/
│   └── storage/
│       └── local-channels.ts            # MODIFIED — extend with shareRef field
├── routes/
│   ├── api/
│   │   └── shares.ts                    # NEW — server functions: publish/resolve/revoke
│   └── s.$shareId.tsx                   # NEW — recipient landing route
│                                        # Calls resolveShare, persists locally,
│                                        # redirects to /channel/<id>
├── components/
│   └── share-button.tsx                 # NEW — share UI in channel controls
└── components/
    └── import-wizard/
        └── share-confirmation-toast.tsx # NEW — "link copied" toast variant

tests/
├── unit/
│   └── shares/                          # Mirrors src/lib/shares/
├── integration/
│   └── api/
│       └── shares.test.ts               # Hits the server functions w/ KV stub
└── e2e/
    └── shares.spec.ts                   # Playwright: full publish + receive loop

# Configuration
wrangler.jsonc                           # MODIFIED — add SHARED_CHANNELS_KV binding
.env.example                             # MODIFIED — note KV namespace ID for local dev
```

**Structure Decision**: Single project (no new sub-package). Server-side code lives in `src/routes/api/shares.ts` mirroring the existing `api/channels.ts` pattern. Client code lives under `src/lib/shares/` so the share helpers are colocated with their tests, consistent with `src/lib/scheduling/`. The recipient landing route uses a `s.$shareId.tsx` file to keep share URLs short (`/s/abc123` rather than `/share/abc123`).

## Phase 0 — Research & Decisions

See [research.md](./research.md) for the full document. Topline decisions:

| Decision | Choice | Why |
|---|---|---|
| Storage primitive | **Cloudflare KV** | Free-tier compatible, fits the data shape (key→JSON value), eventual consistency is fine for a revoke-tolerant feature. Durable Objects and D1 are more powerful but unnecessary here and would add complexity. |
| Share-ID format | **8-char base32 (Crockford alphabet)** | ~40 bits of entropy → collision-resistant for the projected scale; Crockford avoids ambiguous characters (0/O, 1/I); URL-safe without encoding. |
| Sharer credential | **Random 256-bit token, localStorage-only** | No accounts, no PII. Token stored under a fixed key per browser; included as `Authorization: Bearer <token>` on revoke. Lost token = lost ability to revoke (acceptable; existing recipients keep working). |
| Idempotency | **Hash of `{credential, normalizedSourceUrl}` is the KV key suffix** | Same browser sharing the same playlist twice produces the same share-id. Different browsers sharing the same playlist get distinct IDs (per FR per Edge Cases). |
| Rate limiting | **Per-credential token bucket in KV** | 10 publishes / hour / credential. Server-side enforcement; simple counter with TTL. |
| Recipient persistence | **Existing `customChannels` localStorage + new `shareRef` field** | Reuses the entire existing custom-channel hydration path. The `shareRef` is the only new addition. |
| Schedule authority | **Client-side only (unchanged)** | Constitution Principle I. Registry is data-only. |
| Routing | **`/s/<shareId>`** | Short, distinct from `/channel/<id>`. Resolves → persists → redirects to canonical `/channel/<id>`. |

## Phase 1 — Design Artifacts

### Data model — see [data-model.md](./data-model.md)

Three entities:

1. **ShareRecord** (server-side, Cloudflare KV) — id, sourceUrl, name, description, kind (`'video'` | `'music'`), createdAt, revokedAt (nullable), credentialHash
2. **SharerCredential** (client-side, localStorage) — token (256-bit random)
3. **CustomChannel** (existing, extended) — adds optional `shareRef: { shareId, role: 'sharer' | 'recipient' }`

### Contracts — see [contracts/shares-api.md](./contracts/shares-api.md)

Three server functions, all created via `createServerFn` to fit the existing TanStack Start pattern:

- `publishShare({ channel, credential })` → `{ shareId, shareUrl }` | error
- `resolveShare({ shareId })` → `{ record: ShareRecord }` | error
- `revokeShare({ shareId, credential })` → `{ ok: true }` | error

All payloads validated with Zod. Errors are typed (`'rate_limited'`, `'not_found'`, `'unauthorized'`, `'invalid_payload'`, `'kv_unavailable'`).

### Quickstart — see [quickstart.md](./quickstart.md)

Local dev: bind a local KV namespace via Wrangler, run `pnpm dev`. The recipient flow can be tested without anyone else by opening `/s/<id>` in an incognito window.

### Agent context update

The `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->` markers in `CLAUDE.md` will be updated to reference this plan once Phase 1 artifacts are written below.

## Build sequence (informs `/speckit-tasks`)

The plan is sequenced so each step is independently testable, leaning into the constitution's TDD rule:

1. **Pure helpers, tests-first** — `share-id`, `share-credential`, `share-url`, `share-record` (Zod schemas). Each lands as RED → GREEN → commit. No server, no React.
2. **Server functions with KV stub** — `api/shares.ts` with publish/resolve/revoke and an in-memory KV stub for tests. Integration test hits the handlers directly. Still no client UI.
3. **`SHARED_CHANNELS_KV` binding wired** — `wrangler.jsonc` updated, deploy to staging, smoke-test the endpoints. (Cannot fully test in unit/integration alone.)
4. **Recipient landing route** — `s.$shareId.tsx` resolves, persists into `customChannels`, redirects. E2E test covers receive flow. Sharer flow not yet exposed in UI.
5. **Sharer UI** — `share-button.tsx` in the channel controls. E2E test covers the full publish-then-receive loop in one browser context.
6. **Revoke UI** — surfaces in the same channel controls when the local browser is the sharer. Final E2E.
7. **Observability** — RUM events and DogStatsD metrics added incrementally with each step (not bolted on at the end). Constitution Principle IV.

## Constitution Re-Check (post-design)

Re-evaluating after the design is concrete:

- [x] **I. Deterministic Scheduling** — Verified: no changes to `src/lib/scheduling/`. The recipient landing route writes to `customChannels` and lets the existing channel-route's `getSchedulePosition` call do the rest.
- [x] **II. Client-Side Data Fetching** — Verified: server function returns `sourceUrl`, the client then calls YouTube/SoundCloud directly. No proxying.
- [x] **III. Test-First** — Build sequence step 1 is "pure helpers, tests-first." Server function tests use a stub KV; integration tests cover the handler logic.
- [x] **IV. Observability** — Seven new RUM events + three new server metrics defined in Constitution Check above.
- [x] **V. Immutability & File Size** — Sizes projected; immutability enforced via existing project conventions (Zod-parsed records are readonly types).
- [x] **Deployment Constraints** — KV is a Cloudflare-native binding; `crypto.subtle` for credential hashing; no Node built-ins. The `s.$shareId.tsx` route reads KV at request time, so it MUST NOT be prerendered (config check planned in build step 4).

**Result**: GREEN post-design. No complexity-tracking entries required.

## Risks & open questions

These are not blockers for `/speckit-tasks`, but are worth recording for the implementer:

- **KV eventual consistency on revoke**: A revoked share may continue to resolve at some edges for up to ~60s. The spec accepts this (FR-013 + SC-005 explicitly tolerate registry-side delay), but the user-visible "channel unavailable" message must be polite about edge-case race conditions ("this channel may still resolve briefly after revocation").
- **Lost sharer credential**: If a viewer clears localStorage, they lose the ability to revoke their published shares (the records remain). Acceptable for v1 since the only remedy in a post-account-required world would also fail. Documented in Assumptions.
- **Rate-limit accounting**: The token bucket is per-credential. A fresh browser instance is a fresh credential, so a determined abuser can sidestep this. Acceptable for personal-project scale; if abuse emerges, IP-based + credential-based dual-limit is the natural follow-up.
- **Share URL stability**: Once a share-id is issued, that URL must continue to resolve forever (or return a clean "unavailable" message). The KV records do not currently have a TTL — adding one later (e.g., 1 year of inactivity) would be a future refinement, not a v1 constraint.

## Next phase

`/speckit-tasks` will turn the build sequence above into a numbered, dependency-ordered tasks.md with one task per testable slice.
