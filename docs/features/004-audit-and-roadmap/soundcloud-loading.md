# SoundCloud Channel Loading — "TUNING…" Overlay + Playlist Cache

**Date:** 2026-06-12 · **Status:** Approved design (pending implementation plan)

## Problem

SoundCloud channels take seconds to populate on every visit. The cold path is two serial
network hops inside the Cloudflare Worker (OAuth token grant + `/resolve`, ~400–1400ms),
then widget bootstrap in the browser. Resolved playlists are never cached — only the OAuth
token is, and that cache is per-isolate on Workers, so the 50-issuances/12h quota is a
structural risk under load. Meanwhile the loading UI is a generic blurred-poster spinner.

## Goals

1. Repeat visits to a music channel render near-instantly (client-side playlist cache).
2. First visits feel intentional: a diegetic retro "TUNING…" static overlay tied to the
   real pipeline stages, not an apologetic spinner.
3. Reduce Worker `/resolve` traffic (and token churn) by an order of magnitude.

## Explicit architectural decision (from adversarial review)

The "every viewer sees the same schedule" invariant is **already broken for music
channels**: the server filters tracks by SoundCloud's geo/time-dependent
`streamable`/`policy` flags before computing `totalDurationSeconds`
(`src/routes/api/soundcloud.ts:286-318`), so two viewers can resolve different lists and
therefore different schedules. You cannot have all three of {deterministic shared
schedule, no server state, live SoundCloud filtering}.

**Decision: music channels are allowed to be per-viewer divergent.** Video channels keep
the strict invariant. The cache freezes a per-viewer snapshot, which makes a *single
viewer's* schedule MORE stable across the TTL window. CLAUDE.md will be updated to state
this scoped invariant honestly.

## Design

### 1. Playlist cache — `src/lib/storage/sc-playlist-cache.ts`

- localStorage, keyed `kranztv.sc-playlist.v1:<sourceUrl>`; value
  `{ schemaVersion, title, tracks, totalDurationSeconds, cachedAt }`.
- TTL **12h**. Entries Zod-validated on read (same defensive pattern as
  `preset-channel-cache.ts`, including embedUrl-format checks — see commit `1c24f49`).
- `schemaVersion` field + a purge line in the existing `_tv.tsx` mount-time cache-purge
  effect (matching the v1→v2 pattern) so abandoned formats never orphan.
- Quota-exceeded: evict all `kranztv.sc-playlist.*` entries and retry once; if it still
  fails, proceed uncached and emit a RUM action (`sc_cache_write_failed`) — no silent
  swallow.

### 2. Stale-while-revalidate with a no-hot-swap rule

- Cache hit → serve immediately; kick off background refetch.
- **Fresh data is staged, never hot-swapped into a channel currently playing.** A
  mid-session `totalDurationSeconds` change shifts the schedule modulus and makes
  now-playing jump (the existing YouTube SWR path at `_tv.tsx:417-443` has this bug
  today — fix it for both kinds while we're here). Staged data applies on the next entry
  into the channel (navigation away+back, or next session).
- SSR note: localStorage is client-only, so first paint always shows the loader; the
  cache only accelerates client-side renders. Loader copy and metrics must not pretend
  otherwise.

### 3. Hardening the consumers of cached data

- `sc-widget-context.tsx` finish/error handlers assume duration data is accurate. With a
  cache, stale-duration states become common: add a shared retry budget + minimum-interval
  backoff to the `finish` handler (today it can loop `loadTrack` unboundedly on
  zero-duration entries) and bound the error path's retry budget by *distinct* tracks
  attempted, not raw list length.

### 4. "TUNING…" overlay — `src/components/tuning-overlay.tsx`

- Full-screen analog static: new small GLSL noise shader on the existing
  `ShaderQuadRenderer` (reuse `channel-surf-static.tsx` patterns if compatible);
  CSS-animated noise fallback when WebGL2 unavailable; static frame under
  `prefers-reduced-motion`.
- Channel number OSD (corner, existing OSD styling) + status line driven by a **single
  consolidated loading state machine**, not a new timer:
  `resolving → widget-mounting → widget-ready → playing | error`.
  This state derives from route `isLoading` + widget `status` only. No new timeouts; the
  existing 6s readiness failsafe remains the lone escape hatch.
- Status copy: `TUNING…` → `RESOLVING SIGNAL…` → `LOCKING AUDIO…`; on error,
  `NO SIGNAL` with retry hint.

### 5. Telemetry (house rule: telemetry by default)

- RUM actions: `sc_cache_hit`, `sc_cache_miss`, `sc_cache_write_failed`,
  `sc_channel_load` with duration + stage timings.

## Out of scope

- Server-side canonical track snapshots (would require server state).
- Fixing the SC widget timeout-stack consolidation beyond what the loader state machine
  requires (tracked as an audit follow-up).

## Testing

- Unit: cache module (TTL expiry, schema-version eviction, quota path, validation
  rejects), staged-apply logic, loading state machine transitions.
- Browser verification: cold load shows TUNING sequence; warm load is near-instant;
  background revalidation does not change now-playing mid-session.
