# Tasks: Music Channels (001-music-channels)

**Input**: Design documents from `specs/001-music-channels/`
**Branch**: `001-music-channels`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)

**Tests**: Included per Constitution Principle III — new pure functions MUST have tests written first (Red → Green → Refactor). Test tasks are marked accordingly.

**Organization**: Tasks are grouped first by phase (foundational dependency graph), then by user story so each story can be independently verified.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (touches different files)
- **[Story]**: Which user story this task belongs to (US1–US4 match spec.md priority order)
- Exact file paths included in every task

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Directory scaffolding and shared type definitions that everything else depends on.
No user story work can begin until T001–T004 are complete.

- [ ] T001 Create `src/lib/sources/` directory with `soundcloud/` and `youtube/` subdirectories (no code yet — just empty dirs with `.gitkeep`)
- [ ] T002 Create `src/lib/visualizers/` directory with `shaders/` subdirectory (no code yet)
- [ ] T003 [P] Create `src/lib/storage/track-db.ts` — empty module with exported stubs `saveTracks`, `loadTracks`, `deleteTracks` (typed but unimplemented — returns `Promise.resolve()`)
- [ ] T004 [P] Create `src/lib/sources/types.ts` — `MediaSource`, `MediaSourcePlayer`, `ImportedPlaylist`, `ImportError`, `MediaSourceId`, `CreatePlayerArgs` type definitions per `contracts/media-source-adapter.md`

**Checkpoint**: Directory structure in place, type interfaces defined.

---

## Phase 2: Foundational (Type Migration — BLOCKS ALL USER STORIES)

**Purpose**: Generalize `Channel` to a discriminated union. Every consumer of `Channel`, `Video`, and `playlistId` must narrow correctly before new code is added. This is the highest-risk phase — touch-count is 15-25 sites.

**⚠️ CRITICAL**: No user story implementation can begin until T005–T019 are complete and all existing tests pass.

### Tests first

- [ ] T005 [P] Write tests in `tests/unit/lib/import/schema.test.ts` — discriminated union accepts VideoChannel shape; accepts MusicChannel shape; rejects mixed; `preprocess` injects `kind: 'video'` for legacy records without `kind` field
- [ ] T006 [P] Write tests in `tests/unit/lib/storage/local-channels.test.ts` — music channel metadata (without `tracks`) round-trips through localStorage; `dedupKey()` returns `playlistId` for video and `sourceUrl` for music; URL re-validation on hydrate rejects tampered `sourceUrl`
- [ ] T007 [P] Write tests in `tests/unit/lib/scheduling/algorithm.test.ts` — extend with `MusicChannel` fixture using real track durations; assert `getSchedulePosition` returns the correct track at specific deterministic timestamps; assert algorithm body is unchanged

### Type model

- [ ] T008 Modify `src/lib/scheduling/types.ts` — add `Track` interface; add `MusicChannel` interface; add `Schedulable` interface; rename existing `Channel` to `VideoChannel` (add `kind: 'video'`); redefine `Channel = VideoChannel | MusicChannel`; add `ScheduleItem` view-model interface and `toScheduleItem()` signature
- [ ] T009 Modify `src/lib/import/schema.ts` — add `MusicChannelSchema`; add `TrackSchema`; update `ChannelArraySchema` to `z.discriminatedUnion('kind', [...])` with back-compat preprocess; add `isSoundCloudUrl()` validator (exact-host allow-list from `data-model.md`)
- [ ] T010 Modify `src/lib/storage/local-channels.ts` — add `dedupKey(channel): string`; update dedup logic to use it; strip `tracks` from `MusicChannel` before `JSON.stringify`; add URL re-validation on hydrate; handle `QuotaExceededError` with distinct user-facing message

### Scheduler generalization

- [ ] T011 Modify `src/lib/scheduling/algorithm.ts` — add `toSchedulable(channel: Channel): Schedulable`; update `getSchedulePosition()` to call `toSchedulable()` before walking items. Algorithm body (the math) MUST NOT change.
- [ ] T012 Modify `src/lib/scheduling/epg-builder.ts` — add `toScheduleItem(channel: Channel, position: SchedulePosition): ScheduleItem`; update `buildEpgRow()` to emit `ScheduleItem` instead of `Video` directly

### Existing consumer audit (add `kind === 'video'` narrowing at each site)

- [ ] T013 [P] Audit and narrow `src/routes/_tv.channel.$channelId.tsx` — find all `channel.videos`, `channel.playlistId`, `loadedChannel.playlistId &&` usages; wrap each in `channel.kind === 'video'` guard
- [ ] T014 [P] Audit and narrow `src/components/info-panel/info-panel.tsx` and `src/components/mobile/mobile-now-playing.tsx` — replace direct `Video` field access with `ScheduleItem` view-model where applicable; add `kind` guards elsewhere
- [ ] T015 [P] Audit and narrow `src/components/epg-overlay/` and `src/components/tv-guide/` — update all EPG cells to consume `ScheduleItem.primaryLabel` + `ScheduleItem.secondaryLabel?` instead of `video.title` directly
- [ ] T016 [P] Audit and narrow remaining consumers — grep for `channel.videos`, `channel.playlistId`, `.playlistId` across all remaining files; add `kind` guards; verify TypeScript compiles with no new errors
- [ ] T017 Run `pnpm test -- --run` — all existing tests must pass before proceeding. Fix any regressions before moving to Phase 3.

**Checkpoint**: TypeScript compiles. `pnpm test` passes. `getSchedulePosition` works with `MusicChannel` fixtures. Foundation ready.

---

## Phase 3: User Story 1 — Watch a Music Channel (Priority: P1) 🎯 MVP

**Goal**: A viewer can navigate to a music channel and hear audio from SoundCloud with a backdrop rendering full-bleed in place of the video frame.

**Independent Test**: Import a hardcoded fixture `MusicChannel` (bypassing the import wizard), navigate to its route, verify the SoundCloud Widget iframe loads, audio plays from the deterministic seek position, and the backdrop canvas renders.

### Source adapter — SoundCloud parser + widget wrapper

- [ ] T018 [P] [US1] Write tests in `tests/unit/lib/sources/soundcloud/parser.test.ts` — exact-host match for `soundcloud.com`, `www.soundcloud.com`, `m.soundcloud.com`, `on.soundcloud.com`; negative cases: `soundcloud.com.attacker.com`, `javascript:`, `data:`, `blob:`, `http:` scheme, empty string, non-URL
- [ ] T019 [P] [US1] Write tests in `tests/unit/lib/sources/soundcloud/adapter.test.ts` — mock Widget iframe postMessage; assert `importPlaylist()` returns `ImportedPlaylist` with expected tracks; assert `event.origin` validation rejects spoofed messages; assert polling fires until all durations defined; assert timeout rejects; assert >50 tracks rejects with `EXCEEDS_TRACK_LIMIT`
- [ ] T020 [P] [US1] Write tests in `tests/unit/lib/sources/registry.test.ts` — `detectSource('https://soundcloud.com/...')` returns SC adapter; `detectSource('https://www.youtube.com/...')` returns YouTube adapter; unknown URL returns `null`; `sourceFor('soundcloud')` returns SC adapter

- [ ] T021 [US1] Create `src/lib/sources/soundcloud/parser.ts` — `isSoundCloudUrl(url: string): boolean` with exact-host allow-list and protocol check; `normalizeSoundCloudUrl(url: string): string`
- [ ] T022 [US1] Create `src/lib/sources/soundcloud/widget.ts` — `SoundCloudWidgetWrapper` class: creates/destroys iframe, validates `event.origin === 'https://w.soundcloud.com'` on ALL inbound messages, exposes `getSounds()`, `seekTo(ms)`, `play()`, `pause()`, `setVolume()`, postMessage debounce at 250ms. Sets `sandbox`, `allow`, `referrerpolicy` per FR-018.
- [ ] T023 [US1] Create `src/lib/sources/soundcloud/oembed.ts` — `fetchOEmbed(url: string): Promise<{title: string; author: string}>` — client-side only; URL re-validated before fetch
- [ ] T024 [US1] Create `src/lib/sources/soundcloud/adapter.ts` — `SoundCloudAdapter implements MediaSource`: `matchesUrl()` delegates to `isSoundCloudUrl`; `importPlaylist()` spins hidden iframe via `SoundCloudWidgetWrapper`, polls `getSounds()` until complete (250ms interval, 10s ceiling), rejects with `ImportError` on timeout/>50 tracks/private; `createPlayer()` returns a `SoundCloudWidgetWrapper`-backed `MediaSourcePlayer`
- [ ] T025 [US1] Create `src/lib/sources/youtube/adapter.ts` — `YoutubeAdapter implements MediaSource`: wraps existing `src/lib/channels/youtube-api.ts`; `matchesUrl()` uses existing YouTube host detection; `importPlaylist()` wraps `buildChannel()`; `createPlayer()` wraps existing `youtube-iframe.ts` pattern
- [ ] T026 [US1] Create `src/lib/sources/registry.ts` — `detectSource(url)`, `sourceFor(id)` with registered adapters (YouTube + SoundCloud)
- [ ] T027 [US1] Create `src/lib/sources/index.ts` — barrel export

### IndexedDB track storage

- [ ] T028 [US1] Write tests in `tests/unit/lib/storage/track-db.test.ts` — `saveTracks` + `loadTracks` round-trip; `deleteTracks` removes; `QuotaExceededError` propagates with distinct error type
- [ ] T029 [US1] Implement `src/lib/storage/track-db.ts` — `saveTracks(channelId, tracks)`, `loadTracks(channelId): Track[] | null`, `deleteTracks(channelId)` using IndexedDB store `channel-tracks` keyed by `channelId`

### Renderer base class extraction

- [ ] T030 [US1] Extract `src/lib/overlays/shader-quad-renderer.ts` — `ShaderQuadRenderer` abstract base class per `contracts/shader-quad-renderer.md`: vertex shader, fullscreen-quad buffer, context-loss recovery, resize observer, RAF loop, DPR scaling, `dispose()` with `loseContext()`
- [ ] T031 [US1] Modify `src/lib/overlays/renderer.ts` — `OverlayRenderer extends ShaderQuadRenderer`; remove duplicated base concerns; keep 30fps policy and existing uniform set; add `loseContext()` cleanup in `dispose()`; verify existing overlay modes still work
- [ ] T032 [US1] Write tests in `tests/unit/lib/visualizers/renderer.test.ts` — `VisualizerRenderer` instantiates; `setTrackPosition()` updates uniforms; `dispose()` calls `loseContext()`
- [ ] T033 [P] [US1] Create `src/lib/visualizers/types.ts` — `VisualizerPreset` enum; `VISUALIZER_PRESETS` array
- [ ] T034 [P] [US1] Create `src/lib/visualizers/preset.ts` — `resolvePreset(searchParams): VisualizerPreset`; URL param `?viz=` takes priority over localStorage `kranz-tv:music-visualizer`; default `'spectrum'`
- [ ] T035 [P] [US1] Create `src/lib/visualizers/shaders/spectrum.glsl.ts` — faked EQ bars driven by `sin/cos` of `u_trackElapsed`. Default, cheapest preset.
- [ ] T036 [US1] Create `src/lib/visualizers/renderer.ts` — `VisualizerRenderer extends ShaderQuadRenderer`: 60fps policy; `u_trackElapsed`, `u_trackProgress` uniforms; `setTrackPosition(elapsed, progress)` method; `prefers-reduced-motion` → still gradient (loop stopped); auto-downgrade to `spectrum` at 15fps when GPU frame time > 4ms (checked via `EXT_disjoint_timer_query_webgl2`)
- [ ] T037 [US1] Create `src/components/music-visualizer-canvas.tsx` — React component mounting `VisualizerRenderer` on a canvas; accepts `preset`, `trackElapsed`, `trackProgress`; `data-testid="music-visualizer-canvas"`; CSS: `position: absolute; inset: 0; z-index: 1`

### Music channel view and playback

- [ ] T038 [US1] Write tests in `tests/unit/components/music-channel-view.test.tsx` — render with fixture `MusicChannel`; mock SoundCloud Widget postMessage; assert visualizer canvas mounts; Now Playing card shows correct `title` and `artist`; rapid channel swap (mount → abort → new mount) does not bleed audio
- [ ] T039 [US1] Create `src/components/now-playing-card.tsx` — displays `primaryLabel`, `secondaryLabel?`, `thumbnailUrl?`, progress bar (elapsed / duration), optional `deepLinkUrl` + `deepLinkLabel`
- [ ] T040 [US1] Create `src/components/music-channel-view.tsx` — composes: hidden SoundCloud Widget iframe (audio-only, below viewport), `<MusicVisualizerCanvas>`, `<NowPlayingCard>`; implements `AbortController` per mount; seek-on-`READY`; drift-correction on first `PLAY_PROGRESS` (single correction if drift > 3s); `FINISH` → recompute `getSchedulePosition(now)` → seekTo + play; `ERROR` → mark slot unavailable + advance; `visibilitychange → visible` → resync; `play()` rejection → `onNeedsInteraction` callback
- [ ] T041 [US1] Modify `src/components/tv-player.tsx` — add `AbortController` mount discipline: create `mountToken` per mount; after every `await`, check `mountToken.signal.aborted` and return early if true; on unmount, call `mountToken.abort()`
- [ ] T042 [US1] Modify `src/hooks/use-channel-navigation.ts` — add 250ms debounce to `navigatePrev` and `navigateNext`
- [ ] T043 [US1] Extract `src/components/channel-info-overlay.tsx` — move channel info overlay currently inlined at `src/routes/_tv.channel.$channelId.tsx:638-700`; make deep link kind-aware ("WATCH ON YOUTUBE" vs "OPEN ON SOUNDCLOUD")
- [ ] T044 [US1] Modify `src/routes/_tv.channel.$channelId.tsx` — add `kind === 'music'` branch at ~line 608 (`<MusicChannelView>` vs `<TvPlayer>`); use extracted `<ChannelInfoOverlay>`; add feature-flag disabled placeholder when `VITE_ENABLE_MUSIC_CHANNELS === 'false'` and `channel.kind === 'music'`; load tracks from IndexedDB on channel resolve
- [ ] T045 [US1] Create Playwright smoke test in `tests/e2e/music-channel.spec.ts` — seed a fixture music channel in localStorage; navigate to its route; assert `[data-testid="music-visualizer-canvas"]` is present; assert SoundCloud Widget iframe loads with correct `sandbox` and `allow` attributes

**Checkpoint**: Navigate to a fixture music channel → backdrop renders + audio from SoundCloud plays from the correct deterministic seek position. All US1 tests pass.

---

## Phase 4: User Story 2 — Import SoundCloud Playlist (Priority: P1)

**Goal**: Pasting a SoundCloud playlist URL into the existing import wizard creates a working music channel.

**Independent Test**: Open import wizard, paste a real public SoundCloud playlist URL with ≤50 tracks, submit, verify channel appears in guide with correct name and track count.

- [ ] T046 [US2] Write tests in `tests/unit/components/import-wizard/import-modal.test.tsx` — extend existing test with: SoundCloud URL paste → "SoundCloud Playlist" badge appears; spoofed URL (`soundcloud.com.attacker.com`) → no badge; >50-track playlist → specific error message; import timeout → "Import timed out" message; valid SC URL → channel created with `kind: 'music'`
- [ ] T047 [US2] Modify `src/lib/import/import-channel.ts` — delegate to `detectSource(url) → adapter.importPlaylist()`; wrap result as `MusicChannel` metadata + call `saveTracks(channelId, tracks)`; assign channel number via existing `getNextChannelNumber()`; persist to localStorage via `saveCustomChannels()`
- [ ] T048 [US2] Modify `src/components/import-wizard/import-tab.tsx` — on URL input change, call `detectSource(url)` and display source badge ("SoundCloud Playlist" or "YouTube Playlist" or nothing); on submit, route to `adapter.importPlaylist()` (SoundCloud) or existing YouTube flow; show specific error messages from `ImportError.reason`; handle cancellation (abort import in-flight)

**Checkpoint**: Full import flow works end-to-end. Pasting a SoundCloud URL creates a navigable music channel.

---

## Phase 5: User Story 3 — EPG and Channel List (Priority: P2)

**Goal**: Music channels appear in the EPG grid with "Track Title — Artist" labels, alongside video channels, navigable via ↑/↓ keys.

**Independent Test**: With one video and one music channel imported, open EPG → verify music channel row shows "Track — Artist" format; press ↑/↓ → music channel loads.

- [ ] T049 [P] [US3] Modify `src/components/epg-overlay/epg-overlay-cell.tsx` — render `scheduleItem.primaryLabel` as the primary label; render `scheduleItem.secondaryLabel` (artist) below if present, smaller/muted styling
- [ ] T050 [P] [US3] Modify `src/components/tv-guide/guide-cell.tsx` — same: `primaryLabel` + optional `secondaryLabel`
- [ ] T051 [P] [US3] Modify `src/components/info-panel/info-panel.tsx` — consume `ScheduleItem`; show `secondaryLabel` (artist) when present; use `deepLinkUrl` + `deepLinkLabel` from `ScheduleItem` for the deep link button
- [ ] T052 [P] [US3] Modify `src/components/mobile/mobile-now-playing.tsx` — same `ScheduleItem` consumption; show artist; kind-aware deep link

**Checkpoint**: EPG shows "Track — Artist" for music channels and "Video Title" for video channels. ↑/↓ navigation cycles through both kinds in channel-number order.

---

## Phase 6: User Story 4 — Ambient Backdrop Variety (Priority: P3)

**Goal**: Four backdrop presets (spectrum, particles, kaleidoscope, oscilloscope) selectable via `?viz=` URL param, persisted to localStorage.

**Independent Test**: Append `?viz=kaleidoscope` to a music channel URL → kaleidoscope renders. Remove param, reload → previous choice from localStorage renders. Set `prefers-reduced-motion` → still gradient.

- [ ] T053 [P] [US4] Create `src/lib/visualizers/shaders/particles.glsl.ts` — drifting flow-field per-pixel noise with hue shift on `u_trackProgress`
- [ ] T054 [P] [US4] Create `src/lib/visualizers/shaders/kaleidoscope.glsl.ts` — radial symmetry on slow-moving noise, color rotating with `u_trackElapsed`
- [ ] T055 [P] [US4] Create `src/lib/visualizers/shaders/oscilloscope.glsl.ts` — Lissajous curves with frequencies drifting over track length
- [ ] T056 [US4] Register all four presets in `src/lib/visualizers/renderer.ts` shader registry; test each renders without WebGL errors (visually verify in browser — no automated shader correctness test)
- [ ] T057 [US4] Verify `?viz=particles`, `?viz=kaleidoscope`, `?viz=oscilloscope` URL params switch presets; localStorage persistence works; `prefers-reduced-motion` replaces all four with still gradient (manual + Playwright assertion)
- [ ] T058 [US4] Implement auto-downgrade in `src/lib/visualizers/renderer.ts` — when both a `VisualizerRenderer` and an `OverlayRenderer` are active, check GPU frame time via `EXT_disjoint_timer_query_webgl2`; if >4ms, switch to `spectrum` preset or 15fps cap

**Checkpoint**: All four presets render. Preset selection persists. Reduced-motion respected. Auto-downgrade fires on heavy preset + active overlay.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Observability, security hardening, and final validation.

### Observability

- [ ] T059 [P] Add `sha256Prefix(url: string, length?: number): string` helper to `src/lib/datadog/rum.ts` using `crypto.subtle.digest('SHA-256', ...)` (Web Platform API — Worker-safe)
- [ ] T060 [P] Add RUM actions to `src/lib/datadog/rum.ts`: `trackMusicChannelPlay(channelId, source, trackCount)`, `trackMusicChannelImportSuccess(source, trackCount, sourceUrlHash)`, `trackMusicChannelImportError(source, reason)`, `trackMusicBackdropSelected(preset)` — all redact raw URLs per FR-019
- [ ] T061 Instrument `src/components/music-channel-view.tsx` — call `trackMusicChannelPlay` on mount; call `trackMusicBackdropSelected` on preset change
- [ ] T062 Instrument `src/lib/import/import-channel.ts` — call `trackMusicChannelImportSuccess` / `trackMusicChannelImportError` after import resolves/rejects

### Security hardening

- [ ] T063 [P] Add CSP baseline to Cloudflare Worker response headers — `Content-Security-Policy: default-src 'self'; frame-src https://w.soundcloud.com https://www.youtube.com; script-src 'self' https://w.soundcloud.com https://www.youtube.com; img-src 'self' https: data:; connect-src 'self' https://*.datadoghq.com https://soundcloud.com; style-src 'self' 'unsafe-inline'` — wire in the appropriate Worker entry point or via `wrangler.toml` headers config

### Refresh playlist action

- [ ] T064 Add "Refresh playlist" button to `src/components/channel-info-overlay.tsx` for music channels — calls `adapter.importPlaylist(channel.sourceUrl)`; on success, replaces track array in IndexedDB and updates `totalDurationSeconds` + `trackCount` in localStorage; on failure, shows error toast; atomically replaces (not merge)

### Final validation

- [ ] T065 Run `pnpm lint && pnpm test -- --run --coverage` — verify ≥80% coverage threshold passes for all new files
- [ ] T066 Manual checklist verification:
  - [ ] All four backdrop presets render and animate
  - [ ] Tab-switch then return → audio resyncs; drift correction fires within 10s
  - [ ] Tap-to-unmute works on iOS Safari
  - [ ] WebGL2-unavailable fallback (force via DevTools GPU rasterization: software) shows still gradient with Now Playing card functional
  - [ ] `prefers-reduced-motion: reduce` (DevTools Rendering panel) → still gradient
  - [ ] EPG shows "Track — Artist" rows for music channels; "Title" rows for video channels
  - [ ] Rapid ↑/↓ mash through mixed channels → no audio bleed; no orphaned iframes (DevTools → Application → Frames)
  - [ ] Import a 60-track playlist → "Playlist exceeds 50-track limit" error; no partial channel created
  - [ ] Refresh playlist after adding a track → channel updates atomically with correct new count
- [ ] T067 Version bump: increment `package.json` `version` field (minor bump); update any `DD_VERSION` references

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Type Foundation) — BLOCKS ALL
        ├─► Phase 3 (US1: Watch) ─────────────────────────────────────┐
        │     ├─► Phase 4 (US2: Import) ─────────────────────────────►│
        │     └─► Phase 5 (US3: EPG) [can parallel with Phase 4] ────►│
        │                                                              │
        └─► Phase 6 (US4: Backdrops) [after Phase 3 renderer done] ──►┘
                                                                       │
                                                              Phase 7 (Polish)
```

### User Story Dependencies

- **US1 (Watch)**: After Phase 2 only — no other story dependency
- **US2 (Import)**: Requires US1 source adapter layer (T021–T027) — can start after T027
- **US3 (EPG)**: Requires `ScheduleItem` from Phase 2 (T008, T012) — can start after Phase 2
- **US4 (Backdrops)**: Requires renderer layer from US1 (T030–T037) — can start after T037

### Within Each Phase: Execution Order

```
Phase 2:
  T005, T006, T007 [parallel — write tests]
  → T008, T009, T010 [parallel — type changes, each different file]
  → T011 [after T008 — Schedulable needs Channel union]
  → T012 [after T008, T011 — ScheduleItem needs Video/Track union]
  → T013, T014, T015, T016 [parallel — audit + narrow different files]
  → T017 [after T016 — must all compile + pass]

Phase 3:
  T018, T019, T020 [parallel — write tests, different test files]
  → T021, T022, T023 [parallel — different source files]
  → T024 [after T021, T022, T023 — adapter uses parser + widget]
  → T025 [parallel with T024 — different adapter]
  → T026 [after T024, T025 — registry needs both adapters]
  → T027, T028 [parallel — barrel export + track-db tests]
  → T029 [after T028]
  → T030 [after T011 — base class needs nothing; extracts from OverlayRenderer]
  → T031 [after T030 — OverlayRenderer extends base]
  → T032, T033, T034, T035 [parallel — tests + types + preset + shader]
  → T036 [after T030, T033, T034, T035]
  → T037 [after T036]
  → T038 [write test — can start after T039, T040 stubs exist]
  → T039, T041, T042, T043 [parallel — different components]
  → T040 [after T037, T039, T043]
  → T044 [after T040, T041, T042, T043]
  → T045 [after T044]
```

### Parallel Opportunities

**Phase 3 parallel launch (after Phase 2 complete)**:

```
Parallel group A — source adapter tests:
  T018 parser.test.ts
  T019 adapter.test.ts
  T020 registry.test.ts

Parallel group B — renderer base + visualizer scaffolding:
  T030 ShaderQuadRenderer extraction
  T033 visualizer types
  T034 preset resolver
  T035 spectrum shader

Parallel group C — IndexedDB:
  T028 track-db tests
```

---

## Implementation Strategy

### MVP First (US1 + US2 = a working music channel you can import and watch)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Type Foundation (T005–T017) — **do not skip; every US depends on it**
3. Complete Phase 3: US1 Watch (T018–T045)
4. Complete Phase 4: US2 Import (T046–T048)
5. **STOP and VALIDATE**: Import a real SoundCloud playlist → navigate to it → hear audio + see backdrop
6. Deploy or demo

### Incremental Delivery

1. Setup + Type Foundation → Foundation ready (existing features unbroken)
2. US1 (Watch) → fixture channel is playable (can hardcode a test channel)
3. US2 (Import) → full import wizard flow
4. US3 (EPG) → music channels in the guide
5. US4 (Backdrops) → four preset visuals
6. Polish → observability, security, refresh, coverage

### Parallel Sub-Agent Strategy

With multiple implementation agents after Phase 2:

- **Agent A**: Phase 3 source adapter layer (T018–T029)
- **Agent B**: Phase 3 renderer layer (T030–T037)
- **Agent C**: Phase 5 EPG integration (T049–T052) — can start immediately after Phase 2

All three are independent (different file trees). Agent A and B results combine in T038–T045.

---

## Notes

- [P] tasks touch different files and can run in parallel within the same phase
- [Story] label maps each task to a specific user story for traceability
- **Tests MUST be written before implementation** (Red → Green → Refactor) — Constitution Principle III
- Commit after each logical group (e.g., after each adapter file, after tests pass)
- Stop at each **Checkpoint** to verify the story works independently before advancing
- Phase 2 consumer audit (T013–T016) is the most error-prone step — take it file by file, compile after each
- The SoundCloud Widget `getSounds()` polling (T024) is the most brittle integration — test it with a real public playlist before declaring Phase 3 done
