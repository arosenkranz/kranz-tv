---
description: 'Task list for Shared Channels feature'
---

# Tasks: Shared Channels

**Input**: Design documents from `/specs/002-shared-channels/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/shares-api.md, quickstart.md

**Tests**: REQUIRED. KranzTV's constitution Principle III ("Test-First for Pure Logic") makes tests mandatory for all pure helpers, schemas, and server function handlers in this feature. UI components are exercised end-to-end via Playwright.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Each task references concrete file paths from `plan.md`'s Project Structure section.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story identifier from spec.md (US1, US2, US3, US4)
- All file paths are repository-root-relative

## Path Conventions

Paths follow the structure decision in plan.md:

- Server functions: `src/routes/api/`
- Recipient landing route: `src/routes/`
- Shared helpers (pure): `src/lib/shares/`
- React components: `src/components/`
- Storage extension: `src/lib/storage/local-channels.ts` (existing file, modified)
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Cloudflare config: `wrangler.jsonc` (root)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Provision Cloudflare KV namespace, wire the binding, and stub the directory layout. None of this code touches user stories yet — it makes the runtime ready.

- [x] T001 Create the `src/lib/shares/` directory and an empty `index.ts` barrel file so subsequent imports resolve cleanly
- [x] T002 Create the `tests/unit/shares/` and `tests/integration/api/` (if missing) directories
- [x] T003 Provision the Cloudflare KV namespace by running `pnpm wrangler kv namespace create SHARED_CHANNELS_KV` (production) and `pnpm wrangler kv namespace create SHARED_CHANNELS_KV --preview` (preview); record both namespace IDs in `1Password` or local notes
- [x] T004 Add the `kv_namespaces` binding to `wrangler.jsonc` with `binding: "SHARED_CHANNELS_KV"`, `id: <production-id>`, and `preview_id: <preview-id>` from T003
- [x] T005 [P] Add a brief "Shared Channels (KV)" section to `.env.example` documenting the dev workflow (no env vars needed; refer to wrangler config)
- [x] T006 [P] Verify `src/routes/s.$shareId.tsx` and `src/routes/api/shares.ts` are NOT statically prerendered — build-config integration test landed at `tests/integration/build-config.test.ts`. Per-file no-prerender comments will be added when each file is created in its phase (T021 for api/shares.ts, T036 for s.$shareId.tsx)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure helpers and schemas that BOTH the sharer flow (US1) and recipient flow (US2) depend on. Per constitution Principle III, tests are written first for every module in this phase.

**⚠️ CRITICAL**: User story phases cannot start until Phase 2 is fully green.

### Test-first: write FAILING tests for shared helpers

- [x] T007 [P] Write unit tests for share-id generation and validation in `tests/unit/shares/share-id.test.ts` — cover: returns 8 chars, only Crockford alphabet, deterministic format check, case-normalization on parse, rejects ambiguous chars `I`, `L`, `O`, `U`
- [x] T008 [P] Write unit tests for sharer-credential helpers in `tests/unit/shares/share-credential.test.ts` — cover: generates 256-bit base64url-encoded token (43 chars matching `/^[A-Za-z0-9_-]{43}$/`), persists to localStorage under key `kranz.tv.sharer.credential.v1`, idempotent re-read returns same token, hash function returns 64-char lowercase hex SHA-256
- [x] T009 [P] Write unit tests for share-URL parsing/building in `tests/unit/shares/share-url.test.ts` — cover: builds `https://<origin>/s/<shareId>`, parses `/s/<shareId>` correctly, rejects malformed paths, normalizes lowercase share-id to canonical uppercase
- [x] T010 [P] Write unit tests for the share-record Zod schema in `tests/unit/shares/share-record.test.ts` — cover: accepts valid records (both `kind: 'video'` and `kind: 'music'`), rejects oversize names (>80 chars), rejects oversize descriptions (>280 chars), rejects malformed shareId, rejects bad sourceUrl per kind, strips `credentialHash` from `PublicShareRecord` shape
- [x] T011 Write unit tests for source-URL normalization in `tests/unit/shares/share-record.test.ts` (same file as T010, additional `describe('normalizeSourceUrl', ...)` block) — cover: lowercase host, trailing slash stripped, only `list=` retained for YouTube, full canonical URL retained for SoundCloud. Sequenced after T010 to avoid merge conflicts on the same file

### Implement modules to make tests pass

- [x] T012 [P] Implement share-id generation + validation in `src/lib/shares/share-id.ts` — exports `generateShareId(): string`, `isValidShareId(s: string): boolean`, `normalizeShareId(s: string): string`. Uses `crypto.getRandomValues`, Crockford base32 alphabet (no I, L, O, U)
- [x] T013 [P] Implement sharer-credential helpers in `src/lib/shares/share-credential.ts` — exports `getOrCreateCredential(): string`, `hashCredential(token: string): Promise<string>`. Uses `crypto.subtle.digest('SHA-256', ...)` and `crypto.getRandomValues`. localStorage key `kranz.tv.sharer.credential.v1`
- [x] T014 [P] Implement share-URL helpers in `src/lib/shares/share-url.ts` — exports `buildShareUrl(shareId: string, origin?: string): string`, `parseShareUrl(path: string): string | null`
- [x] T015 [P] Implement Zod schemas + types in `src/lib/shares/share-record.ts` — exports `ShareRecordSchema`, `PublicShareRecordSchema`, `PublishPayloadSchema`, `RevokePayloadSchema`, `ResolvePayloadSchema`, `normalizeSourceUrl(url: string, kind: 'video' | 'music'): string`. Reuses existing `extractPlaylistId` and `isSoundCloudUrl` for kind-specific URL validation
- [x] T016 Run `pnpm test -- --run tests/unit/shares/` and confirm all Phase 2 tests pass; run `pnpm lint` and confirm clean

### Storage extension (used by both US1 and US2)

- [x] T017 Extend `src/lib/storage/local-channels.ts` to support the optional `shareRef: { shareId, role: 'sharer' | 'recipient' }` field on `Channel`. Update the Zod schema, the loader (default `shareRef === undefined` for legacy entries), and the saver. Export these new helpers consumed by US1/US2/US3 tasks: `setShareRef(channelId, shareRef)` (used by T028, T036), `clearShareRef(channelId)` (used by T048), `findChannelByShareId(shareId): Channel | undefined` (used by T038 idempotent receive). All helpers MUST follow the project's immutability convention (return new objects). No data migration required
- [x] T018 Update `src/lib/storage/local-channels.test.ts` to cover the new `shareRef` field — load old data without `shareRef` is unaffected; save+load roundtrip preserves `shareRef`

**Checkpoint**: Foundation ready — US1 and US2 can begin in parallel.

---

## Phase 3: User Story 1 — Sharer publishes (Priority: P1) 🎯 MVP slice 1 of 2

**Goal**: A viewer can publish any custom channel and receive a copyable share URL. Idempotent re-publish from the same browser returns the same URL. Rate limiting enforced.

**Independent Test**: Import a known YouTube playlist as a custom channel, click Share, inspect KV — a record exists with the expected fields, no `credentialHash` leaked in the response. Re-share the same channel and confirm the same URL is returned.

### Test-first: server function contract

- [x] T019 [P] [US1] Create an in-memory KV stub at `tests/integration/api/kv-stub.ts` exposing `get`, `put`, `delete`, `list`, and TTL semantics matching Cloudflare KV's API surface; tests will inject this in place of the real binding
- [x] T020 [P] [US1] Write integration tests for `publishShare` in `tests/integration/api/shares.test.ts` covering: success path (returns shareId + shareUrl + isNew=true), idempotent re-publish (returns same shareId, isNew=false), rate-limited after 10 publishes/hour (asserts response includes `retryAfterMs > 0`), invalid payload rejected, kv_unavailable surfaced as typed error, `credentialHash` is stored but never returned in any response shape

### Spike: confirm KV access pattern

- [x] T020.5 [US1] **Spike (~30 min)**: Verify the correct way to access the `SHARED_CHANNELS_KV` binding from a TanStack Start `createServerFn` handler in this project's TanStack Start version. Check if it is `getEvent().context.cloudflare.env.SHARED_CHANNELS_KV` (newer adapters), `getRequestEvent().platform.env.SHARED_CHANNELS_KV`, or another shape. Document the verified pattern as a comment at the top of `src/routes/api/shares.ts` so all subsequent server-function tasks (T022, T031, T043) use the same approach. Block T021 until this is confirmed

### Implement publishShare

- [x] T021 [US1] Create `src/routes/api/shares.ts` with the TanStack Start `createServerFn` scaffold mirroring `src/routes/api/channels.ts` (export a `Route` from `createFileRoute`, plus `publishShare` server function). Use the KV access pattern verified in T020.5
- [x] T022 [US1] Implement `publishShare` in `src/routes/api/shares.ts` per the contract in `contracts/shares-api.md` — Zod validation → credential hash → rate-limit check at `ratelimit:<credentialHash>` (when limit hit, compute `retryAfterMs = max(0, windowStart + 3_600_000 - now)` and include it on the returned `rate_limited` error) → idempotency lookup at `idempotency:<key>` → mint shareId with collision retry (max 3) → atomic-ish double-write of `share:<id>` and `idempotency:<key>` → return `{ shareId, shareUrl, isNew }`
- [x] T023 [US1] Add server-side observability in `publishShare` — emit `kranz_tv.share.publish` counter tagged with `outcome:success|rate_limited|invalid|kv_error`, plus `kranz_tv.share.publish_ms` histogram. Use existing `~/lib/datadog/server-metrics.ts` helpers
- [x] T024 [US1] Run `pnpm test -- --run tests/integration/api/shares.test.ts` and confirm all `publishShare` integration tests pass

### Sharer client surface

- [x] T025 [P] [US1] Create `src/lib/shares/share-client.ts` exporting `publishShare(channel: Channel): Promise<ShareResult<{ shareId, shareUrl, isNew }>>` that wraps the server function call, retrieves the local credential via `getOrCreateCredential`, and returns the typed result
- [x] T026 [P] [US1] Add RUM events in `src/lib/datadog/rum.ts` — `trackSharePublishStarted()`, `trackSharePublishCompleted({ isNew })`, `trackSharePublishFailed({ reason })`. Follow the existing `trackChannelSwitch`/`trackImportStarted` pattern

### Sharer UI

- [x] T027 [US1] Create `src/components/share-button.tsx` — a button that takes a `channel` prop, calls `publishShare`, copies the URL to clipboard via existing `~/lib/clipboard.ts`, shows a toast confirmation. Disabled while pending. Surfaces typed errors as user-friendly toasts. For `rate_limited` results, format `retryAfterMs` into a human duration ("Try again in 47 minutes") rather than showing the raw number
- [x] T028 [US1] Wire `<ShareButton>` into the channel controls in `src/routes/_tv.channel.$channelId.tsx` — visible only for custom channels (not preset channels); also writes `shareRef.role='sharer'` back into the `customChannels` localStorage entry on success so US3 can later offer revoke

### E2E for US1

- [x] T029 [US1] Create `tests/e2e/share-publish.spec.ts` (Playwright) — import a known public YouTube playlist, click Share, assert a share URL is in the clipboard and that re-clicking Share returns the same URL

**Checkpoint**: US1 is complete and independently testable. The recipient flow (US2) does not yet work — opening a share URL hits a not-yet-built route. This is expected at this checkpoint.

---

## Phase 4: User Story 2 — Recipient receives (Priority: P1) 🎯 MVP slice 2 of 2

**Goal**: Opening a share URL in any browser tunes the visitor in to the shared channel within ~5 seconds, persists it locally, and works offline thereafter.

**Independent Test**: Take a known share URL (produced manually or by US1), open in a fresh browser context, confirm channel loads and plays. Reload — no further `/api/shares` calls. Disconnect network — channel still works.

### Test-first: resolveShare contract

- [x] T030 [P] [US2] Add integration tests for `resolveShare` to `tests/integration/api/shares.test.ts` — cover: hit returns full record without `credentialHash`, miss returns `not_found`, revoked record returns the record with `revokedAt` non-null (NOT an error), invalid shareId format → `invalid_payload`, kv error → `kv_unavailable`, response includes `Cache-Control: public, max-age=60, stale-while-revalidate=600`

### Implement resolveShare

- [x] T031 [US2] Implement `resolveShare` in `src/routes/api/shares.ts` per `contracts/shares-api.md` — accept `{ shareId }`, normalize to uppercase, KV read at `share:<id>`, strip `credentialHash` before returning, set response header `Cache-Control: public, max-age=60, stale-while-revalidate=600`
- [x] T032 [US2] Add server-side observability in `resolveShare` — `kranz_tv.share.resolve` counter tagged `outcome:hit|miss|revoked|kv_error`, plus `kranz_tv.share.resolve_ms` histogram
- [ ] T033 [US2] Run `pnpm test -- --run tests/integration/api/shares.test.ts` and confirm all `resolveShare` tests pass

### Recipient client surface

- [x] T034 [P] [US2] Add `resolveShare(shareId: string): Promise<ShareResult<PublicShareRecord>>` to `src/lib/shares/share-client.ts`
- [x] T035 [P] [US2] Add RUM events to `src/lib/datadog/rum.ts` — `trackShareResolveStarted()`, `trackShareResolveCompleted()`, `trackShareResolveFailed({ reason })`

### Recipient route

- [x] T036 [US2] Create `src/routes/s.$shareId.tsx` — a TanStack Start file route whose loader: (1) validates `shareId`; (2) calls `resolveShare`; (3) on success, calls `getNextChannelNumber()` from `~/lib/import/schema.ts` to assign a non-colliding local channel number (the recipient's channel number need not match the sharer's — covers spec edge case "name collision"); (4) persists into `customChannels` with `shareRef.role='recipient'` and channel-id following the convention `share-<canonical-uppercase-shareId>` (per data-model.md R7); (5) `redirect()`s to `/channel/share-<shareId>`. The page UI is a brief "loading channel…" spinner during async resolution. Three distinct error states with copy: (a) `not_found` or revoked → "This channel is no longer available."; (b) `kv_unavailable` or network failure → "Couldn't load shared channel — try again." with a Retry button; (c) `invalid_payload` (malformed shareId) → "This link is invalid." All error UIs include a "back to home" link
- [x] T037 [US2] When the resolved record's `revokedAt !== null`, the loader's "channel unavailable" path takes precedence — recipient sees the same error UI as a `not_found` (per FR-009). Verify in unit/loader test
- [x] T038 [US2] Ensure idempotent receive: if the recipient's `customChannels` already has an entry with the same `shareRef.shareId`, skip the write and proceed to redirect (per spec US2 acceptance scenario 2)
- [x] T039 [US2] Verify the existing channel-route page (`src/routes/_tv.channel.$channelId.tsx`) handles a custom channel with `shareRef.role='recipient'` identically to a regular custom channel — there should be no branching needed because `shareRef` is metadata only. Add a regression test

### E2E for US2

- [x] T040 [US2] Create `tests/e2e/share-receive.spec.ts` — given a pre-published share URL (set up via fixture or by reusing US1's E2E machinery), open it in a fresh browser context, assert the channel appears in the list, the player shows the deterministic schedule's current item, reload triggers no further `/api/shares` calls (assert via Playwright network capture)

### MVP integration check

- [X] T041 [US2] Manually run the quickstart smoke-test from `quickstart.md` against `wrangler dev`: import → share → copy URL → open in incognito → tune in. Confirm SC-002 (recipient watching within 5s) and SC-004 (two viewers see the same content at the same moment). This is the MVP closing checkpoint — both US1 and US2 must work end-to-end

**Checkpoint**: 🎯 **MVP COMPLETE.** US1 + US2 together deliver the full share-and-receive loop. The feature is shippable here. US3 (revoke) and US4 (offline-first hardening) refine but are not strictly required for value.

---

## Phase 5: User Story 3 — Sharer revokes (Priority: P2)

**Goal**: A sharer can revoke any share they previously published. The share URL stops resolving for new recipients within ~60s. Existing recipient local copies are unaffected.

**Independent Test**: Publish a share, copy the URL, revoke it via the channel controls, then visit the URL from a new browser context — confirm the unavailable message. Verify the original recipient (who already imported the share) still sees the channel.

### Test-first: revokeShare contract

- [x] T042 [P] [US3] Add integration tests for `revokeShare` to `tests/integration/api/shares.test.ts` — cover: success path (sets `revokedAt`, returns ok+timestamp), unauthorized when credential mismatch, idempotent re-revoke (returns existing `revokedAt`), not_found for unknown shareId, kv_unavailable surfaced

### Implement revokeShare

- [x] T043 [US3] Implement `revokeShare` in `src/routes/api/shares.ts` per `contracts/shares-api.md` — Zod validation, credential hash compare, set `revokedAt = Date.now()`, write back. Re-revoke is idempotent
- [x] T044 [US3] Add server-side observability — `kranz_tv.share.revoke` counter tagged `outcome:success|unauthorized|not_found|kv_error`
- [ ] T045 [US3] Run `pnpm test -- --run tests/integration/api/shares.test.ts` and confirm `revokeShare` tests pass

### Revoke client + UI

- [x] T046 [P] [US3] Add `revokeShare(shareId: string): Promise<ShareResult<{ ok: true; revokedAt: number }>>` to `src/lib/shares/share-client.ts`
- [x] T047 [P] [US3] Add `trackShareRevokeCompleted()` RUM event in `src/lib/datadog/rum.ts`
- [x] T048 [US3] Extend `src/components/share-button.tsx` (or add a sibling `share-controls.tsx` if size warrants) to show a "Revoke" option when `channel.shareRef?.role === 'sharer'`. Confirm-dialog before revoking. On success, clear `shareRef` from the local entry
- [x] T049 [US3] Defensive guard: only render Revoke if the local credential's hash matches the record's stored hash. Per data-model.md cross-entity invariant, this protects against cross-browser localStorage import. Implement by reading the record once on mount via `resolveShare` and comparing; cache the result in component state

### E2E for US3

- [x] T050 [US3] Create `tests/e2e/share-revoke.spec.ts` — publish a share, revoke it, open the URL in a fresh context, confirm "channel unavailable" message; in the original sharer's tab, confirm the Revoke button is gone

**Checkpoint**: US3 complete. Revoke flow shipped.

---

## Phase 6: User Story 4 — Recipient retains shares offline-first (Priority: P2)

**Goal**: After a recipient opens a share URL once, all subsequent uses of the channel make zero registry calls. Reload, channel switch, guide rendering — everything offline-friendly.

**Independent Test**: Open a share URL, then disconnect the network, reload the page, navigate to the shared channel, confirm it plays and the EPG renders correctly. Open DevTools Network tab and confirm no `/api/shares` requests.

This is a verification + hardening story — most of the behavior should already exist after US2, because the recipient route only calls `resolveShare` on the `/s/<id>` path. This phase ensures no regression sneaks in.

### Verification tests

- [x] T051 [P] [US4] Add a Vitest unit test asserting the channel-route loader at `src/routes/_tv.channel.$channelId.tsx` does NOT call `resolveShare` for any channel kind — the route reads from `customChannels` only (mock the share-client and assert it is never invoked)
- [x] T052 [P] [US4] Add an E2E test in `tests/e2e/share-offline.spec.ts` — receive a share, then use Playwright's `context.setOffline(true)`, navigate to the channel, confirm playback proceeds and no network requests to `/api/shares` were made
- [x] T053 [P] [US4] Add a Vitest unit test for the EPG builder, info panel, and current-program hooks asserting none of them import from `~/lib/shares/share-client` (a static-import check, so refactors don't accidentally couple them)

### Documentation

- [X] T054 [US4] Update the developer doc in `quickstart.md`'s "Manual smoke test" to explicitly include the offline-after-receive verification step (it is in the spec but not yet in quickstart's checklist)

**Checkpoint**: All four user stories complete. Feature is fully shipped.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Production readiness — observability, docs, error UX, version bump.

- [X] T055 [P] Add a Datadog dashboard JSON snippet to `infra/dashboards/shares.json` (or wherever the project keeps dashboards) covering the four new metrics: publish/resolve/revoke counters and the latency histograms. Validate widgets render against staging data
- [X] T056 [P] Create `docs/SHARING.md` explaining what shared channels are, how to publish, how to revoke, and what happens when a share is revoked. Audience: end users. Link from `README.md` if a user-facing-docs index exists
- [X] T057 [P] Update the help overlay (`src/components/help-overlay/*` if it exists, otherwise the keyboard-shortcuts toast) to mention the share button and any new shortcut (none planned, but verify no conflict)
- [X] T058 Run `pnpm test -- --run --coverage` and confirm coverage of `src/lib/shares/` and `src/routes/api/shares.ts` ≥ 80% (constitution Principle III). Add tests if any branch is uncovered
- [X] T059 Run `pnpm lint` and `pnpm check` (Prettier write + ESLint fix) clean
- [X] T060 Bump `package.json` from `1.6.1` to `1.7.0` (minor bump for new user-facing feature). Update `CHANGELOG.md` if present. Per memory feedback: version bumps are required so `DD_VERSION` correlates the deploy in Datadog
- [X] T061 Update `CLAUDE.md` to remove the "Active Feature" SPECKIT block (or update it to point at the next feature) once the PR merges. Also remove `feature.json` reference if appropriate
- [ ] T062 Cut a PR via `gh pr create` against `main` with title `feat: shared channels via /s/<id> URLs`, body summarizing the four user stories, the constitution gates passed, and links to spec.md/plan.md/tasks.md. Per CLAUDE.md: do NOT include Claude/agent attribution in commits

### Success-criteria coverage (gap fixes from /speckit-analyze)

- [X] T063 [P] Add a perf assertion to `tests/e2e/share-publish.spec.ts` (extends T029) measuring publish round-trip latency. Fail the test if total time from button-click to URL-in-clipboard exceeds 5 seconds (covers SC-001)
- [x] T064 [P] Add an E2E "outage drill" test at `tests/e2e/share-outage.spec.ts` — receive a share, then point the share-client at an unreachable host (or use Playwright route-interception to return 503 for `/api/shares*`), reload the app, navigate to the shared channel, confirm playback proceeds and EPG renders normally (covers SC-005). Verifies that recipient hydration never depends on the registry once the share is local
- [X] T065 Add a Datadog monitor JSON snippet (alongside the dashboard from T055) that alerts when `kranz_tv.share.publish{outcome:success}` falls below 95% over a 1-hour rolling window (covers SC-006). Document the monitor's threshold and runbook in `docs/SHARING.md`
- [x] T066 [P] Add a Playwright test at `tests/e2e/share-recovery.spec.ts` — receive a share, clear browser storage (localStorage + IndexedDB) via `context.clearCookies()` and `page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase(...) })`, re-open the original share URL, confirm the channel reappears and tunes in (covers SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent. Can run as soon as the branch is checked out.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **US1 (Phase 3)**: Depends on Foundational. Independent of US2/US3/US4.
- **US2 (Phase 4)**: Depends on Foundational. Independent of US1 in design but the **MVP requires both US1 and US2** to be valuable.
- **US3 (Phase 5)**: Depends on Foundational and US1 (revoke applies to a published share). Reuses `share-client.ts` and KV from US1.
- **US4 (Phase 6)**: Depends on US2. Pure verification + hardening, no new feature surface.
- **Polish (Phase 7)**: Depends on all desired user stories.

### Critical-path tasks within Foundational

- T007–T010 (write failing tests) BEFORE T012–T015 (implement helpers).
- T016 (test-suite green) BEFORE any user story phase begins.
- T017 (storage extension) BEFORE US1's T028 (sharer UI writes `shareRef`) and US2's T036 (recipient route writes `shareRef`).

### Parallel Opportunities

- All Phase 1 tasks marked [P] (T005, T006) parallel.
- All Phase 2 test tasks (T007–T011) parallel — different files.
- All Phase 2 implementation tasks (T012–T015) parallel — different files, after their respective tests are red.
- Within US1: T019/T020 parallel; T025/T026 parallel after T024 green.
- Within US2: T030 alone for tests; T034/T035 parallel after T033 green.
- US1 and US2 implementation can be **fully parallelized across two developers** once Foundational completes — they share only `share-client.ts` and `shares.ts`, so coordinate file ownership.
- US3 and US4 can run after MVP, in parallel with each other (they touch different files).

---

## Parallel Example: Phase 2 Foundational

```bash
# Step A — write all 5 failing test files in parallel
Task: "Write share-id tests in tests/unit/shares/share-id.test.ts"             # T007
Task: "Write share-credential tests in tests/unit/shares/share-credential.test.ts"  # T008
Task: "Write share-url tests in tests/unit/shares/share-url.test.ts"           # T009
Task: "Write share-record schema tests in tests/unit/shares/share-record.test.ts"  # T010
Task: "Write source-URL normalization tests in tests/unit/shares/share-record.test.ts"  # T011

# Step B — confirm all RED (pnpm test must fail), then implement in parallel
Task: "Implement share-id in src/lib/shares/share-id.ts"           # T012
Task: "Implement share-credential in src/lib/shares/share-credential.ts"  # T013
Task: "Implement share-url in src/lib/shares/share-url.ts"         # T014
Task: "Implement share-record in src/lib/shares/share-record.ts"   # T015
```

## Parallel Example: After Foundational, US1 and US2 in two streams

```bash
# Developer A — User Story 1 (Sharer)
Task: "Build KV stub at tests/integration/api/kv-stub.ts"          # T019
Task: "Write publishShare integration tests"                       # T020
Task: "Implement publishShare server function"                     # T021/T022/T023
Task: "Build share-button.tsx and wire into channel route"         # T027/T028

# Developer B — User Story 2 (Recipient) — STARTS at T030 once T019 KV stub is shared
Task: "Write resolveShare integration tests"                       # T030
Task: "Implement resolveShare server function"                     # T031/T032
Task: "Build s.$shareId.tsx recipient route"                       # T036/T037/T038
```

---

## Implementation Strategy

### MVP scope — both US1 and US2 (Phases 1 → 4)

The KranzTV spec marks US1 and US2 as joint P1 because **neither delivers user value alone**. A sharer with no recipients to receive their link, or a recipient flow with no UI to publish, is half a feature. The recommended MVP path:

1. Phase 1 (Setup) — prepare KV namespace and bindings
2. Phase 2 (Foundational) — pure helpers + storage extension, all test-first
3. Phase 3 (US1, Sharer) AND Phase 4 (US2, Recipient) — preferably parallel if two developers; sequential is fine if solo
4. **STOP and VALIDATE**: run the manual smoke test from `quickstart.md` end-to-end (T041)
5. Ship MVP behind a feature flag if desired; otherwise deploy and observe.

### Post-MVP increments

After MVP ships:

- **US3 (Phase 5)** — revoke. Adds polish + trust. Recommended within a week of MVP.
- **US4 (Phase 6)** — offline-first verification. Largely a regression-prevention pass. Worth completing before declaring v1 done.

### Parallel team strategy

If two developers are available:

1. Both jointly complete Phase 1 (~30 min) and Phase 2 (~half a day).
2. Developer A takes Phase 3 (US1), Developer B takes Phase 4 (US2). Sync on T019 (KV stub) and T021 (server function file ownership).
3. Both jointly run T041 (MVP integration check).
4. Phase 5 and Phase 6 can be split between the two developers.

### Solo strategy

If working alone, follow the order strictly:

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → MVP smoke test → ship MVP.
2. Then Phase 5 → Phase 6 → Phase 7 → release v1.

---

## Notes

- Tasks marked [P] write to different files and have no dependency on incomplete tasks.
- Story labels [US1]–[US4] map back to spec.md acceptance scenarios for traceability.
- Test-first discipline applies to ALL helper modules and server functions per Constitution Principle III. UI components are exercised via E2E only — Vitest is not the right tool for them.
- Verify tests RED before each implementation task. A green test on first run means the test isn't testing what you think.
- Commit after each task or logical group. Avoid mega-commits that span phases.
- The constitution's Principle I ("Deterministic Scheduling") is the single most important invariant in this feature — every task that touches data flow MUST preserve "registry is data-only, never schedule data."
- Avoid: vague tasks, same-file conflicts (especially `src/routes/api/shares.ts` is shared between US1, US2, US3 — sequence by user story not parallelize within), cross-story dependencies that violate independent-test guarantees.
