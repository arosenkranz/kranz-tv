# Audit Fixes — Security, Type-Safety, Perf, Quality

**Date:** 2026-06-12 · **Status:** Approved design (pending implementation plan)

Findings from a four-agent audit (boris/security, xenia/performance, trevelyan/adversarial,
general/quality). Grouped into shippable batches by risk and blast radius. Each batch is an
independent PR.

## Batch A — Security & production hygiene (ship first)

1. **SSRF in SoundCloud server function** (HIGH) — `src/routes/api/soundcloud.ts:168`.
   `fetchSoundCloudPlaylist` is a publicly reachable endpoint validated only by
   `z.string().url()`; the SoundCloud-host allowlist lives in callers, not the server fn.
   **Fix:** add `.refine(isSoundCloudUrl, …)` to the input schema so the allowlist is
   enforced server-side.
2. **`[SC-DIAG]` debug logging shipped to prod** (HIGH) — ~20 `console.*` calls in
   `soundcloud.ts` and `src/lib/sources/soundcloud/widget.ts`, including an env-key
   inventory and secret *lengths* (`env-probe`) and raw upstream response bodies on error.
   Flows into Datadog logs. **Fix:** delete the `[SC-DIAG]` block; delete
   `tests/e2e/sc-diag.spec.ts`. Model on `youtube.ts` (logs nothing).
3. **`.dockerignore` missing** (LOW) — `Dockerfile:11` `COPY . .` pulls the real `.env`
   (live keys) into the builder layer. **Fix:** add `.dockerignore`
   (`.env .git node_modules .output coverage`).
4. **Rotate working-tree secrets** (LOW, hygiene) — confirm `.env` keys are dev-scoped;
   rotate the SoundCloud secret + DD API key if they have any prod scope. Not committed /
   not in history (verified) — no active exposure.
5. **Rate limiting** (LOW) — no limits on the import endpoints; quota-amplification vector.
   **Fix:** Cloudflare edge rate-limit rule on the server-function routes.

## Batch B — Type safety & CI (high leverage)

6. **CI does not typecheck** (HIGH) — `.github/workflows/ci.yml` runs lint/test/build
   (esbuild, no types). Type errors ship silently. **Fix:** add `pnpm typecheck`
   (`tsc --noEmit`) script + CI step.
7. **`@types/youtube` silently disabled** (HIGH) — `tsconfig.json:20`
   `"types": ["vite/client"]` excludes all other `@types/*`, so the YT player wrapper
   (`youtube-iframe.ts`, `tv-player.tsx`, `mobile-player-area.tsx`) is unchecked. **Fix:**
   `"types": ["vite/client", "youtube"]`, then clear the resulting ~11 tsc errors (mostly
   trivial unused-import / `setQuotaExhausted` removals + test-fixture `kind` fields).
   Do this WITH #6 or CI goes red on first run.

## Batch C — Performance (fix before visuals work)

8. **Per-frame `getAttribLocation`** (HIGH-perf, trivial) —
   `src/lib/visualizers/renderer.ts:160` and `src/lib/overlays/renderer.ts:109` call it
   every frame (60 driver round-trips/s for a constant). **Fix:** cache at init alongside
   `timeLoc`. *(Also covered by the visualizer foundations PR.)*
9. **Dual 1s tick re-render cascade** (MEDIUM) — `_tv.tsx:327` and `use-current-program.ts`
   both tick every second; `currentPosition` `useMemo` at `_tv.tsx:667` recomputes on every
   `new Date()` so `InfoPanel`/EPG re-render each second. **Fix:** key the memo on
   `currentPosition?.item.id` so consumers re-render only on item change.
10. **Per-isolate token cache on Workers** (MONITOR) — module-scope `tokenCache` is
    per-isolate; under isolate churn the 50-token/12h budget can be hit. The SoundCloud
    playlist cache (separate spec) reduces `/resolve` frequency enough to defuse this;
    escalation path if it bites is CF KV with a ~55min TTL.

## Batch D — Test gaps & quality (steady-state)

11. **API token-cache untested AND coverage-excluded** (HIGH) — `src/routes/api/**` is in
    the vitest coverage exclude; the OAuth token cache / expiry-grace / `tokenInFlight`
    race-dedup is stateful and untested. **Fix:** extract token-cache logic to a pure
    module and unit-test with mocked `fetch`, or drop the exclude and test it.
12. **Pure SC helpers untested** (MEDIUM, quick win) — `buildWidgetSrc` and
    `soundDataToTrack` (`widget.ts:334,347`) are pure. Add unit tests.
13. **Coverage doc drift** (MEDIUM) — `AGENTS.md` claims 80%; `vitest.config.ts` is
    60/65/70/60. **Fix:** align doc to config (or raise config — pick one).
14. **`[`/`]` keybindings violate own guardrail** (HIGH-QoL) — `use-keyboard-controls.ts:144`
    binds dwell to `[`/`]`, which `AGENTS.md` explicitly forbids; surfaced in
    `keyboard-help.tsx:32`. **Fix:** rebind to non-conflicting keys (candidates: `,`/`.`).
15. **Telemetry-by-default gaps** (MEDIUM) — import-modal tab switch
    (`import-modal.tsx:95`) and in-modal import submit / source detection emit nothing;
    verify SC playback/error telemetry is actually wired from `sc-widget-context.tsx`.
16. **Oversized route files** (MEDIUM) — `_tv.tsx` (1067) and
    `_tv.channel.$channelId.tsx` (885) exceed the 800 cap; extract keyboard-control wiring
    and player-lifecycle effects into hooks.
17. **Doc rot** (LOW) — CLAUDE.md rotation prime documented as ×127; code uses ×7919/×3607
    (`time-utils.ts:80`). Fix the doc.
18. **Loose ends** (LOW) — `normalizeSoundCloudUrl` exported/tested but unused (wire in or
    drop); relocate stray `src/routes/-_tv.channel.$channelId.test.tsx` into `tests/`.

## Sequencing

A and B first (security + a CI gate that prevents regressions), then C (clears the path
for the visualizer work), then D opportunistically. Every PR bumps `package.json` version
per the house rule.
