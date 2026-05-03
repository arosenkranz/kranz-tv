# Research: Music Channels

**Feature**: 001-music-channels
**Status**: Complete — all unknowns resolved
**Sources**: Codebase exploration (Explore agents), specialist review (m / trevelyan / boris / xenia agents), browser API documentation

---

## Decision 1: Audio Source Strategy for v1

**Decision**: SoundCloud only, via the SoundCloud Widget API embedded as an iframe. Mixcloud deferred to v2.

**Rationale**: SoundCloud's Widget API (`w.soundcloud.com/player/api.js`) is publicly available, requires no API key for playback, and provides postMessage-based control (play/pause/seek/volume). This is the only viable no-registration path to SoundCloud playback.

**Alternatives considered**:
- *SoundCloud HTTP API*: Closed to new app registrations since 2021. Not viable without an existing client_id.
- *Mixcloud Widget API*: Available and similar in structure to SoundCloud's. Deferred to v2 — the `MediaSource` adapter interface is shaped to accommodate it without redesign.
- *Direct stream URLs*: SC stream URLs require OAuth access tokens. Not viable for public playlists.

**Fragility callout**: `getSounds()` is not officially documented as a stable API surface. If SoundCloud changes it, only new imports break — persisted track snapshots continue to play.

---

## Decision 2: Metadata Acquisition at Import Time

**Decision**: Spin up a hidden iframe pointing at `https://w.soundcloud.com/player/?url=<encodedPlaylistUrl>`, wait for `READY`, call `getSounds()`, poll until all entries have defined `duration` and `title` fields (250ms interval, 10-second ceiling), snapshot the result, then discard the iframe.

**Rationale**: This is the only path that yields per-track durations for a SoundCloud playlist without an API key. Durations are required for the deterministic scheduler.

**Key constraint discovered**: SoundCloud Widget lazy-hydrates tracks as playback progresses. `getSounds()` called immediately after `READY` returns only the first batch (~5 tracks) for large playlists; the rest have `duration: undefined`. The polling loop resolves this for playlists ≤50 tracks. Above 50 tracks, complete hydration is unreliable within a reasonable timeout.

**v1 ceiling**: 50 tracks. Import is rejected with an explicit error if the playlist exceeds this.

**Alternatives considered**:
- *oEmbed endpoint*: Returns iframe HTML, title, author, thumbnail — but NOT per-track durations or track list. Useful only for display metadata.
- *Widget pagination*: SC Widget has no documented API for forcing full hydration without playback. Polling is the only workaround.

---

## Decision 3: Audio Reactivity Approach

**Decision**: Procedural / time-driven visuals only. No Web Audio API. No FFT analysis.

**Rationale**: SoundCloud Widget iframes are cross-origin sandboxed. `createMediaElementSource()` from a cross-origin `<audio>` fails silently (produces zeroed analyser data) unless the CDN sends `Access-Control-Allow-Origin: *` AND the element has `crossorigin="anonymous"`. SC's CDN does not send permissive CORS headers for stream URLs. There is no workaround.

**v2 path preserved**: The `MediaSource` adapter interface is designed to accommodate a future `DirectMp3Source` adapter (Internet Archive, Bandcamp, podcast hosts) where CORS-friendly direct-stream URLs ARE available. That adapter can expose a `MediaElementSource` for an `AnalyserNode`. The visualizer shaders already accept `u_trackElapsed` + `u_trackProgress`; a future `u_fftTexture` uniform can layer in without changing the shader architecture.

**UI naming**: "Ambient backdrops" rather than "audio visualizers" to set honest user expectations that v1 visuals are time-driven, not beat-responsive.

---

## Decision 4: Visualizer / Backdrop Architecture

**Decision**: Extract a `ShaderQuadRenderer` base class from the existing `OverlayRenderer`. Both extend it. `VisualizerRenderer` uses 60fps and additional uniforms (`u_trackElapsed`, `u_trackProgress`). `OverlayRenderer` keeps its 30fps policy and existing uniform set.

**Rationale**: The existing `OverlayRenderer` (`src/lib/overlays/renderer.ts:197-198`) hard-codes 30fps frame-skipping. Music backdrops are the *primary* visual on a music channel — not a translucent overlay. 30fps would feel choppy. Additionally, the uniform sets genuinely diverge: overlay uses `{u_time, u_resolution}`; visualizer adds `{u_trackElapsed, u_trackProgress}`. Retrofitting one class to serve both blends two responsibilities.

`ShaderQuadRenderer` owns: vertex shader, fullscreen-quad buffer setup, context-loss handling, resize observer, RAF loop, DPR scaling, `loseContext()` dispose. This is ~180 lines shared across both renderers.

**Alternatives considered**:
- *Three.js*: Not a current dependency. Adds ~600 KB to the bundle for patterns achievable with raw WebGL2. Rejected.
- *Retrofit `OverlayRenderer`*: Would require changing framerate policy, uniform set, and shader registry — three concerns in one class. Rejected (per `m` agent review).
- *Separate full WebGL implementation*: Duplicates ~280 lines already in `renderer.ts`. Rejected.

---

## Decision 5: Storage Architecture

**Decision**: localStorage for channel metadata only; IndexedDB for track arrays.

**Rationale**: A Track object (`{id, title, artist, durationSeconds, embedUrl}`) is ~350-500 bytes JSON. 50 tracks × 10 playlists = ~250 KB of track data. Safari iOS limits localStorage per-origin to 5 MB and aggressively evicts under pressure. `JSON.stringify` of the full array on every save is also O(n) and blocks the main thread. IndexedDB handles medium-volume structured data with async reads and no blocking.

localStorage persists per music channel: `{id, number, name, kind, source, sourceUrl, totalDurationSeconds, trackCount}` — no track arrays. Stays well under 50 KB for dozens of channels.

**Quota handling**: `saveCustomChannels` catches `QuotaExceededError` distinctly and surfaces a human-readable "Storage full — delete a channel" message.

**Alternatives considered**:
- *All localStorage*: Viable for small playlists, hits quota ceiling at scale. Safari eviction risk. Rejected.
- *All IndexedDB*: Channel metadata lookup would be async on every page load. localStorage for metadata keeps the hot path synchronous. Split approach adopted.

---

## Decision 6: Discriminated Union Type Model

**Decision**: `Channel = VideoChannel | MusicChannel`, discriminated by `kind: 'video' | 'music'`.

**Rationale**: `VideoChannel` and `MusicChannel` have genuinely divergent shapes (`videos` vs `tracks`, `playlistId` vs `sourceUrl`). TypeScript narrows correctly on `channel.kind === 'music'`. A flat optional-field approach would require `?.` at every consumer and allow invalid states (e.g., a channel with both `videos` and `tracks`) to compile.

**Migration**: The Zod schema adds a `preprocess` step that injects `kind: 'video'` for persisted channels that predate this feature. Tested in `local-channels.test.ts`.

**Touch-count estimate** (per `m` agent): 15-25 sites consuming `channel.videos` or `channel.playlistId` need `kind === 'video'` narrowing added. This is a required migration step before the union is added.

---

## Decision 7: Synchronization Strategy

**Decision**: Same `getSchedulePosition()` algorithm. Initial seek on mount; single drift-correction seek on first `PLAY_PROGRESS` if drift > 3 seconds. Debounce postMessage commands at 250ms.

**Rationale**: The SoundCloud Widget's `seekTo(positionMs)` has latency: network segment re-request, decode, audio context prime. On warm cache: ~300-800ms. On cold mobile LTE: 2-5 seconds. The wall clock keeps moving during the seek. A single drift-correction seek (fire-and-forget, not a loop) accounts for in-flight latency without creating a seek loop.

**SLA**: p95 within 3 seconds of deterministic position; convergence within 1 second after at most one correction; correction fires within 10 seconds of initial resync.

**Alternatives considered**:
- *Continuous correction loop*: Risks seek thrashing if Widget buffering is slow. Rejected — single correction is sufficient.
- *Precise seek with offset*: Capture `t0 = performance.now()` before `seekTo`, apply `+ (performance.now() - t0) / 1000` to target. Included — this is part of the drift-correction implementation.

---

## Decision 8: Security Architecture

**Decision**: Strict origin validation on every `postMessage` handler, exact-host URL allow-list, localStorage re-validation on hydrate, iframe sandbox attributes, RUM URL hashing.

**Rationale** (per `boris` agent): SoundCloud Widget is a `postMessage`-based API. Without `event.origin` validation, any iframe on the page can spoof Widget events. SoundCloud URL detection using `host.includes('soundcloud.com')` would allow `soundcloud.com.attacker.com` to pass. localStorage data must be treated as untrusted (browser extensions, XSS from other vectors can rewrite it). No CSP exists today — this feature is the right time to add a baseline.

**Allow-list**: `{soundcloud.com, www.soundcloud.com, m.soundcloud.com, on.soundcloud.com}` + `https:` protocol only. `javascript:`, `data:`, `blob:`, `file:` schemes rejected at parse time.

**iframe sandbox**: `allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`. Explicitly NOT `allow-top-navigation`.

**RUM**: `source: 'soundcloud'`, `track_count: number`, `source_url_hash: sha256(sourceUrl).slice(0, 16)`. No raw URLs, titles, or artists.

---

## Decision 9: Race Condition Discipline

**Decision**: `AbortController` per player mount; explicit iframe teardown on unmount; 250ms navigation debounce.

**Rationale** (per `xenia` agent): Rapid ↑/↓ channel switching creates a sequence of async mount operations. Without a mount token, a slow-resolving mount from channel N can attach to the DOM after channel N+2 is already active. SoundCloud Widget autoplay fires as soon as it's `READY` — regardless of whether the user has navigated away. Audio bleed requires explicit `widget.pause()` + `iframe.src = 'about:blank'` before `removeChild`.

**Retrofit**: The same `AbortController` discipline is applied to `tv-player.tsx` (YouTube path), fixing a latent race condition that already exists but is benign at typical channel-switch speeds.

---

## Decision 10: Feature Availability and Scope

**Decision**: `VITE_ENABLE_MUSIC_CHANNELS` feature flag with an explicit disabled-state render path.

**Rationale**: SoundCloud Widget API is an undocumented dependency. If SoundCloud's widget changes in production, the flag allows disabling new imports without a revert. When `false`, persisted music channels still appear in the channel list but navigate to a "Music channels disabled" placeholder — the route never falls through to `<TvPlayer>` with a `MusicChannel` (which would crash on missing `videos`).

---

## Open Questions Resolved

| Question | Resolution |
|---|---|
| Can we get true audio reactivity with SoundCloud? | No — iframe sandboxing is a hard browser security boundary. Procedural-only for SoundCloud sources. |
| How do we get per-track durations without an API key? | Widget `getSounds()` at import time, with polling until complete or 10s timeout. |
| How do we handle large playlists? | Hard ceiling at 50 tracks. Above this, `getSounds()` hydration is unreliable. |
| Can `OverlayRenderer` be reused for the visualizer? | No — framerate (30 vs 60fps) and uniform sets diverge. Extract `ShaderQuadRenderer` base class. |
| Will localStorage handle many music channels? | No at scale — tracks move to IndexedDB. Metadata stays in localStorage. |
| Will existing channels break when we add `kind`? | Zod preprocess injects `kind: 'video'` for legacy records. Backward compatible. |
| What happens when the feature flag goes false post-import? | Explicit disabled placeholder on route render — no crash, no audio. |
