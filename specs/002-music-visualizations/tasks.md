# Tasks: Music Channel Visualizations

**Input**: Design documents from `specs/002-music-visualizations/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/visualization-picker.md ✅

**TDD**: Constitution Principle III is in effect. All pure-function tasks (preset resolution, type guards, style registry) MUST have test tasks completed and FAILING before their implementation tasks begin.

**Organization**: Tasks grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- All file paths are project-relative from repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the new shader files, test file, and RUM telemetry scaffolding that all phases depend on.

- [X] T001 [P] Create `tests/unit/lib/visualizers/preset.test.ts` — write tests for `isVisualizerPreset` (expect all 6 preset IDs to pass, `'particles'`/`'oscilloscope'` to fail), `resolvePreset` URL-param priority, `resolvePreset` localStorage fallback, and invalid-ID fallback to `DEFAULT_VISUALIZER`. Run: confirm they FAIL (red step — new preset names not yet in union).
- [X] T002 [P] Create `src/lib/visualizers/shaders/kaleidoscope.glsl.ts` — export `KALEIDOSCOPE_SHADER` as a GLSL ES 3.00 fragment shader string. 6-fold mirror fractal using polar coordinates and `u_time` for rotation. Uniforms: `u_time`, `u_resolution`, `u_trackElapsed`, `u_trackProgress`. Visually distinct from `spectrum`.
- [X] T003 [P] Create `src/lib/visualizers/shaders/plasma.glsl.ts` — export `PLASMA_SHADER`. Curl-noise lava-lamp blobs with slow color-cycle. Use `u_time` + `u_trackElapsed` for drift. No audio FFT.
- [X] T004 [P] Create `src/lib/visualizers/shaders/starfield.glsl.ts` — export `STARFIELD_SHADER`. Hyperspace flythrough — receding dots on black, speed driven by `u_time`. Add subtle color shift from `u_trackProgress`.
- [X] T005 [P] Create `src/lib/visualizers/shaders/retrowave.glsl.ts` — export `RETROWAVE_SHADER`. Receding chrome grid + synthwave sun. Use `u_time` for grid scroll speed, pink/cyan/purple palette.
- [X] T006 [P] Create `src/lib/visualizers/shaders/sacred-geometry.glsl.ts` — export `SACRED_GEOMETRY_SHADER`. Rotating wireframe geometry (hexagonal / flower-of-life pattern). Gold-on-black palette, slow rotation from `u_time`.
- [X] T007 [P] Add `trackMusicVisualizerStart` and `trackMusicVisualizerFallback` functions to `src/lib/datadog/rum.ts` — follow the existing helper pattern. `trackMusicVisualizerStart(preset, platform)` emits `'music_visualizer_start'`; `trackMusicVisualizerFallback(reason)` emits `'music_visualizer_fallback'`.

**Checkpoint**: 6 new GLSL files exist and compile (TypeScript sees them as string exports); 2 new RUM helpers defined; preset unit tests exist and fail.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Expand the type union, wire shaders into renderer, and update the resolver — these are shared across US1, US2, and US3.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Phase 1 T001 tests must be FAILING before T008 is started (TDD red step).

- [X] T008 Expand `VisualizerPreset` type union and `VISUALIZER_PRESETS` array in `src/lib/visualizers/types.ts` — add `'kaleidoscope'`, `'plasma'`, `'starfield'`, `'retrowave'`, `'sacred-geometry'`; remove `'particles'` and `'oscilloscope'`; add `VisualizerStyleMeta` interface and `VISUALIZER_STYLES` array (6 entries with `id`, `displayName`, `previewGradient` per `data-model.md`). Run T001 tests: confirm they now PASS (green step).
- [X] T009 Import all 5 new shaders and populate `SHADER_SOURCES` record in `src/lib/visualizers/renderer.ts` — replace the 3 spectrum-fallback entries with real imports; add 2 new preset entries. Also extend `VisualizerRendererCallbacks` type to include `onStart?: (preset: VisualizerPreset) => void` and `onFallback?: (reason: 'webgl2-unavailable' | 'context-lost') => void`.
- [X] T010 Extend `tests/unit/lib/visualizers/renderer.test.ts` — add `setPreset('kaleidoscope')`, `setPreset('plasma')`, `setPreset('retrowave')` tests (verify `gl.useProgram` called with the program bound for that preset); add test for `onStart` callback firing on successful init; add test for `onFallback` callback path when `getContext('webgl2')` returns null. Run: confirm new tests PASS.
- [X] T011 [P] Run `pnpm test -- --run tests/unit/lib/visualizers/` to confirm all visualizer unit tests pass at this foundational baseline. Fix any regressions before proceeding to user story phases.

**Checkpoint**: Type union expanded, all 6 shaders wired, renderer tests green, `onStart`/`onFallback` callbacks typed.

---

## Phase 3: User Story 1 — Trippy Visuals on Every Music Channel (P1) 🎯 MVP

**Goal**: Animated WebGL visualization renders in place of the static gradient on every SoundCloud channel on desktop. The orphaned `MusicVisualizerCanvas` component is wired into `MusicChannelView`.

**Independent Test**: Start `pnpm dev`. Navigate to any SoundCloud channel (channel 16–21). Confirm: (a) an animated visualization fills the player area, (b) audio continues uninterrupted, (c) leave for 5 minutes and confirm no freeze. Check browser console for no errors.

### Tests for US1 (TDD — write FIRST)

- [X] T012 Update `tests/unit/components/music-channel-view.test.tsx` — replace the `it('renders the ambient background')` test (queries `div[style*="radial-gradient"]`) with a test that checks for `data-testid="music-visualizer-canvas"` presence. Add a test that mocks `VisualizerRenderer` (or uses the existing WebGL mock) and confirms the canvas is mounted when `isMuted=false`. Confirm these tests FAIL before T013.

### Implementation for US1

- [X] T013 [US1] Add `onStart` and `onFallback` callback props to `MusicVisualizerCanvas` in `src/components/music-visualizer-canvas.tsx` — call `onStart(preset)` inside the `try` block after `renderer.start()`; call `onFallback('webgl2-unavailable')` in the `catch` block. Pass callbacks down to `VisualizerRenderer` constructor. Wire the `onContextRestored` failure path to call `onFallback('context-lost')` via the existing `ShaderQuadCallbacks`.
- [X] T014 [US1] Import and mount `MusicVisualizerCanvas` inside `MusicChannelView` in `src/components/music-channel-view.tsx` — replace the `position: absolute; inset: 0; background: radial-gradient(...)` div (lines ~112–119) with `<MusicVisualizerCanvas preset={activePreset} trackElapsed={trackElapsed} trackProgress={trackElapsed / durationSeconds} onStart={handleVizStart} onFallback={handleVizFallback} />`. Keep the gradient as a CSS `background` on the outer container as the static fallback (visible when `hasFallback` state is true or `isMuted` during loading). Accept `activePreset: VisualizerPreset` as a prop (callers will pass it; default to `'spectrum'`).
- [X] T015 [US1] Wire `trackMusicVisualizerStart` and `trackMusicVisualizerFallback` from `src/lib/datadog/rum.ts` into `MusicChannelView` — call from `handleVizStart` and `handleVizFallback` callbacks. Include `platform: isMobile ? 'mobile' : 'desktop'` in the start event (derive from the existing `useIsDesktop` hook or pass as a prop from the route).
- [X] T016 [US1] Update `_tv.channel.$channelId.tsx` to pass `activePreset` to `MusicChannelView` — resolve the active preset using `resolvePreset(useSearch())` (TanStack Router's `useSearch()` provides URL search params as an object; convert to `URLSearchParams` for `resolvePreset`). Pass the resolved value as the `activePreset` prop.
- [X] T017 [US1] Run T012 tests: confirm they now PASS. Run `pnpm test -- --run tests/unit/components/music-channel-view.test.tsx`.

**Checkpoint**: Navigate to `http://localhost:3000/channel/sc-calming` in `pnpm dev`. Animated visualization renders in the player area. No console errors. Audio plays. US1 independently complete.

---

## Phase 4: User Story 2 — Multiple Visualization Styles (P1)

**Goal**: Viewer can choose from ≥6 visually distinct styles via a picker in the info panel; selection is persisted; Z keybind cycles styles.

**Independent Test**: Open info panel on a music channel. Confirm 6 style names appear. Click each — visualization switches within 2 seconds, no audio interruption. Reload page — same style is active. Press `Z` — cycles to next style. Open YouTube channel — picker hidden, YouTube plays normally.

### Tests for US2 (TDD — write FIRST)

- [X] T018 [P] [US2] Create `tests/unit/lib/visualizers/preset.test.ts` additions — extend the file from T001 with `savePreset` tests: confirm `localStorage.setItem` called with correct key/value; confirm `resolvePreset` picks up the saved value on next call. Add test for `cyclePreset(current, presets)` helper (new pure function) — confirm it wraps around at the end of the array. Confirm new tests FAIL before T020.
- [X] T019 [P] [US2] Create `tests/unit/components/visualizer-picker.test.tsx` — render `<VisualizerPicker>` (component from T021), confirm 6 style entries are rendered with display names from `VISUALIZER_STYLES`, confirm `onChange` is called when a style button is clicked, confirm the active style is visually indicated. Mock `VISUALIZER_STYLES` constant. Confirm tests FAIL before T021.

### Implementation for US2

- [X] T020 [US2] Add `cyclePreset(current: VisualizerPreset, presets: readonly VisualizerPreset[]): VisualizerPreset` pure helper to `src/lib/visualizers/preset.ts` — returns the next preset in array order, wrapping around. Run T018 tests: confirm `cyclePreset` tests PASS.
- [X] T021 [P] [US2] Create `src/components/visualizer-picker.tsx` — compact picker component. Props: `activePreset: VisualizerPreset`, `styles: readonly VisualizerStyleMeta[]`, `onChange: (preset: VisualizerPreset) => void`. Render a grid of 6 `<button>` elements, each with a gradient thumbnail (`style={{ background: meta.previewGradient }}`), the `displayName` label, and an active-style indicator. No animation in the thumbnails. Follow CLAUDE.md UI guardrails: `text-base` or larger labels, bold contrast. Run T019 tests: confirm they PASS.
- [X] T022 [US2] Add visualization section to the info panel — in `src/components/info-panel/` (identify the correct file, likely `info-panel.tsx` or `info-panel-content.tsx`), mount `<VisualizerPicker>` when `channel.kind === 'music'`. Pass `activePreset` and an `onChange` handler that calls both `savePreset(id)` and the route-level `setActivePreset(id)` state setter. Import `VISUALIZER_STYLES` from types.
- [X] T023 [US2] Add route-level `activePreset` state and `setActivePreset` setter in `src/routes/_tv.channel.$channelId.tsx` — initialize from `resolvePreset(searchParams)` on mount. Pass `activePreset` down to `MusicChannelView` (already wired in T016) and to the info panel. On `setActivePreset`: call `savePreset`, call `trackMusicBackdropSelected` from `rum.ts`.
- [X] T024 [US2] Add `Z` keybind to `src/lib/hooks/use-keyboard-controls.ts` — only active when `channel?.kind === 'music'`. On press: call `cyclePreset(activePreset, VISUALIZER_PRESETS)` and `setActivePreset` with the result. Also call `trackKeyboardShortcut('z')`. Verify no conflict with existing keybind list in the file.
- [X] T025 [US2] Run T018 + T019 tests to confirm all US2 unit tests pass. Smoke test: open music channel, cycle styles with `Z`, confirm each switches. Reload — confirm style persisted. Open YouTube channel — confirm `Z` does nothing, picker hidden.

**Checkpoint**: All 6 styles selectable, persisted, picker visible in info panel, Z keybind works. US2 independently complete.

---

## Phase 5: User Story 3 — Mobile Music Channels (P1)

**Goal**: SoundCloud channels render correctly on mobile — no broken YouTube embed, audio works, visualization fills player area.

**Independent Test**: Open DevTools mobile emulation (or real phone). Navigate to any SoundCloud channel. Confirm: audio starts after unmute tap, visualization renders in player area, no YouTube embed error shown, page doesn't overheat after 5 minutes.

### Tests for US3 (TDD — write FIRST)

- [X] T026 [US3] Create `tests/unit/components/mobile-player-area.test.tsx` — render `<MobilePlayerArea>` with a `MusicChannel` (kind='music') and confirm: (a) `TvPlayer` is NOT rendered, (b) `MusicChannelView` (or element with `data-testid="music-visualizer-canvas"`) IS rendered, (c) the unmute button is present when `isMuted=true`. Also test with a `VideoChannel` (kind='video') — confirm `TvPlayer` IS rendered and `MusicChannelView` is NOT. Mock `ScWidgetProvider` and `VisualizerRenderer`. Confirm tests FAIL before T028.

### Implementation for US3

- [X] T027 [US3] Add `onUnmute: () => void` to `MobilePlayerAreaProps` in `src/components/mobile/mobile-player-area.tsx` — this prop is needed to wire through to `MusicChannelView`. Update the caller in `mobile-view.tsx` to pass the correct handler (the mute-toggle callback that already exists in the mobile view).
- [X] T028 [US3] Add `channel.kind === 'music'` branch in `src/components/mobile/mobile-player-area.tsx` — BEFORE the `getThumbnailUrl(position.item as Video)` cast on line 36. When `kind === 'music'`: render `<MusicChannelView channel={channel as MusicChannel} position={position} isMuted={isMuted} volume={volume} onUnmute={onUnmute} />` inside the existing container div. Wrap in `<ScWidgetProvider>` if not already provided by the parent. Existing `TvPlayer` branch remains unchanged for video channels. Import `MusicChannelView` and `MusicChannel` type.
- [X] T029 [US3] Verify the `activePreset` is resolved and passed to `MusicChannelView` on mobile — in `mobile-view.tsx` or `_tv.channel.$channelId.tsx`, ensure the same `resolvePreset(searchParams)` logic used on desktop is available and threaded through to `MobilePlayerArea` → `MusicChannelView`. The mobile path should share the same `activePreset` state as desktop.
- [X] T030 [US3] Run T026 tests: confirm they PASS. Dev server smoke test with DevTools mobile emulation: navigate to `sc-deeply-disco`, confirm visualization renders, audio starts after tap.

**Checkpoint**: Mobile SoundCloud channels work end-to-end with visualization. US3 independently complete.

---

## Phase 6: User Story 4 — Fallbacks (P2)

**Goal**: Reduced-motion shows a held still frame; no-WebGL shows the gradient backdrop; context loss recovers gracefully.

**Independent Test**: (a) Enable OS reduced-motion — navigate to music channel — confirm no animation, static visual present. (b) In DevTools console: `canvas.getContext('webgl2', ...)` → monkeypatch to throw → reload page → confirm static gradient shows, audio plays, no console error. (c) DevTools `WEBGL_lose_context` → `loseContext()` → confirm page recovers.

### Implementation for US4

- [X] T031 [US4] Verify `hasFallback` state branch in `MusicChannelView` (from T014) — when `hasFallback === true`, the canvas is hidden and the static `radial-gradient` backdrop is shown instead. Write a component test in `tests/unit/components/music-channel-view.test.tsx`: render with `VisualizerRenderer` constructor mocked to throw → confirm canvas is absent and gradient container is present.
- [X] T032 [US4] Verify reduced-motion path in `VisualizerRenderer` (already in `renderer.ts:43-53`) — existing behavior stops `requestAnimationFrame` when `prefers-reduced-motion` fires. Write test in `tests/unit/lib/visualizers/renderer.test.ts`: mock `window.matchMedia` to return `matches: true` → confirm `renderer.start()` does not initiate the rAF loop (`rafId` remains null). This is an existing test gap; fill it.
- [X] T033 [US4] Add context-loss recovery → `onFallback('context-lost')` path — in `src/lib/overlays/shader-quad-renderer.ts` `handleContextRestored` (line ~169), if `getContext('webgl2')` returns null, call `callbacks.onContextRestored?.()` is already wired — but the canvas wrapper needs to signal fallback. In `MusicVisualizerCanvas`, add a `ShaderQuadCallbacks.onContextLost` handler that sets a `hasFallback` state to true (matching the outer component's fallback display logic).

**Checkpoint**: Reduced-motion static frame verified in test; WebGL-unavailable gradient fallback tested; context-loss path covered.

---

## Phase 7: User Story 5 — Style Preview Thumbnails (P3)

**Goal**: Each entry in the visualization picker shows a gradient thumbnail preview, not just a name.

**Independent Test**: Open picker on desktop music channel — each of the 6 entries has a visually distinct colored thumbnail. On a slow device in DevTools throttling, thumbnails still render (they're CSS gradients, not WebGL).

### Implementation for US5

- [X] T034 [US5] Verify `VisualizerPicker` already renders gradient thumbnails — the `<button>` elements in `src/components/visualizer-picker.tsx` (from T021) already include `style={{ background: meta.previewGradient }}`. Review the 6 `previewGradient` values in `src/lib/visualizers/types.ts` and tune them so each is visually distinct and representative of its shader's aesthetic. No code change may be needed; this is a visual QA task.
- [X] T035 [US5] If thumbnails need tuning: update `previewGradient` values in `VISUALIZER_STYLES` in `src/lib/visualizers/types.ts` — verify visually in `pnpm dev`. Aim for: `spectrum` (cyan/green bars), `kaleidoscope` (conic rainbow), `plasma` (red→purple), `starfield` (white dots on deep blue), `retrowave` (pink/cyan horizontal bands), `sacred-geometry` (gold/black radial).

**Checkpoint**: Open picker — 6 entries each have a colored gradient thumbnail distinct from each other.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Version bump, CLAUDE.md update, coverage check, and final validation.

- [X] T036 [P] Bump `version` in `package.json` from `1.7.0` to `1.8.0` — required by Constitution (version must be bumped in every user-facing PR); `DD_VERSION` depends on it for deploy correlation.
- [X] T037 [P] Run `pnpm test -- --coverage` and confirm overall coverage is ≥80% across all four metrics (lines, functions, branches, statements). Fix any regressions caused by new uncovered code paths.
- [X] T038 [P] Run `pnpm lint` and `pnpm check` — fix any ESLint or TypeScript errors introduced by this feature. Strict mode (`noUnusedLocals`, `noUnusedParameters`) is enforced; ensure no unused imports remain in modified files.
- [X] T039 Smoke test full golden path on desktop: open each of the 6 SoundCloud channels (16–21), cycle through all 6 visualization styles, verify audio + visual continuity, confirm no console errors. Check RUM events appear in Datadog if configured.
- [X] T040 Smoke test mobile golden path: DevTools mobile emulation → open `sc-calming` → tap unmute → confirm audio + visualization → switch to YouTube channel → confirm YouTube video plays and no visualization shown → switch back to music channel → confirm visualization resumes.
- [X] T041 Accessibility smoke test: enable OS reduced-motion → open music channel → confirm still-frame, no animation → open picker → confirm styles still selectable.
- [X] T042 [P] Update `specs/002-music-visualizations/checklists/requirements.md` — mark any remaining items complete after implementation. Add implementation notes if the final approach differed from the spec in any way worth documenting.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. T001–T007 are all parallelizable.
- **Phase 2 (Foundational)**: Depends on Phase 1 complete. **BLOCKS all user stories.**
- **Phase 3 (US1)**: Depends on Phase 2. First to implement — establishes the canvas mounting pattern.
- **Phase 4 (US2)**: Depends on Phase 2. Can start in parallel with Phase 3 after T008–T011; picker component (T021) has no dependency on T013–T014.
- **Phase 5 (US3)**: Depends on Phase 3 complete (reuses `MusicChannelView` pattern established there).
- **Phase 6 (US4)**: Depends on Phase 3 (T014 establishes `hasFallback` state). Can overlap with Phase 4/5.
- **Phase 7 (US5)**: Depends on Phase 4 T021 (picker component must exist). Purely visual; can be done last.
- **Phase 8 (Polish)**: Depends on all desired phases complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on other stories.
- **US2 (P1)**: After Foundational — `VisualizerPicker` component (T021) independent of US1; route state (T023) builds on T016 from US1.
- **US3 (P1)**: After US1 — directly reuses `MusicChannelView` wired in T014.
- **US4 (P2)**: After US1 T014 — `hasFallback` state established there.
- **US5 (P3)**: After US2 T021 — picker must exist for thumbnails to be visible.

### Within Each Phase

1. Test tasks are written first and confirmed FAILING (TDD red step)
2. Implementation tasks make tests pass (TDD green step)
3. Each phase ends with a checkpoint: run targeted test suite + dev server smoke test

### Parallel Opportunities

- Phase 1: All of T001–T007 can be written in parallel (6 separate new files + rum.ts)
- Phase 2: T008 → T009 sequential (T009 needs the new type union); T010 runs after T009; T011 last
- Phase 4: T021 (`VisualizerPicker` component) can start the moment T008 is done (needs `VisualizerStyleMeta`)
- Phase 6: T031–T033 can be worked independently (different code paths)
- Phase 8: T036, T037, T038, T042 all in parallel

---

## Parallel Example: Phase 1

```bash
# All setup tasks can run simultaneously (all are new files):
Task: "Create tests/unit/lib/visualizers/preset.test.ts (T001)"
Task: "Create src/lib/visualizers/shaders/kaleidoscope.glsl.ts (T002)"
Task: "Create src/lib/visualizers/shaders/plasma.glsl.ts (T003)"
Task: "Create src/lib/visualizers/shaders/starfield.glsl.ts (T004)"
Task: "Create src/lib/visualizers/shaders/retrowave.glsl.ts (T005)"
Task: "Create src/lib/visualizers/shaders/sacred-geometry.glsl.ts (T006)"
Task: "Add RUM helpers to src/lib/datadog/rum.ts (T007)"
```

## Parallel Example: Phase 3 (US1) + Phase 4 (US2) simultaneous

```bash
# Once Phase 2 is complete, these can run at the same time:

# Stream A — US1 (wiring canvas into MusicChannelView):
Task: "T012 — Update music-channel-view tests"
Task: "T013 — Add callbacks to MusicVisualizerCanvas"
Task: "T014 — Mount canvas in MusicChannelView"

# Stream B — US2 (picker component, independent of canvas wiring):
Task: "T018 — Extend preset.test.ts for US2"
Task: "T019 — Create visualizer-picker.test.tsx"
Task: "T021 — Create VisualizerPicker component"
```

---

## Implementation Strategy

### MVP (User Stories 1 only — ~3 hours)

1. Complete Phase 1 (T001–T007) — parallel, ~30 min
2. Complete Phase 2 (T008–T011) — sequential, ~45 min
3. Complete Phase 3 (T012–T017) — sequential with TDD, ~1 hour
4. **STOP and VALIDATE**: Navigate to `http://localhost:3000/channel/sc-calming` → confirm animated visualization. US1 done.
5. If the animated spectrum visualizer is running, the core infrastructure works. Other styles and the picker can be added incrementally.

### Full Feature Delivery Order

1. Phase 1 + 2 (foundation) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5) → Phase 8 (polish)
2. Each phase is independently shippable from the user-story phases onward

---

## Notes

- `[P]` tasks modify different files with no cross-task dependency — safe to parallelize
- GLSL shaders (T002–T006) cannot be unit-tested directly (GPU execution) — verify visually via `pnpm dev`
- The `spectrum` preset/shader is NOT modified — existing behavior and tests must remain green throughout
- `'particles'` and `'oscilloscope'` are removed from the type union; any stale localStorage values fall back gracefully via `resolvePreset`
- Run `pnpm test` after each phase to catch regressions before moving forward
- Total task count: **42 tasks** (T001–T042)
- Task count per phase: Phase 1: 7 | Phase 2: 4 | Phase 3 (US1): 6 | Phase 4 (US2): 8 | Phase 5 (US3): 5 | Phase 6 (US4): 3 | Phase 7 (US5): 2 | Phase 8: 7
