# Tasks: Fix Mobile Playback Bugs

**Input**: Design documents from `specs/003-fix-mobile-playback/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story (P1 → P2 → P3) with a security foundational phase that must ship first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths included in all task descriptions

---

## Phase 1: Foundational — Security & Schema (BLOCKS all user stories)

**Purpose**: The `embedUrl` security fix and `allow-popups-to-escape-sandbox` removal must land before the provider hoist, because hoisting extends the SC iframe's session lifetime. These changes are purely additive (schema tightening + iframe attribute removal) and have zero UX impact on their own.

**⚠️ CRITICAL**: FR-009, FR-010 from spec. Per Boris's finding: the hoist (Phase 2) must not deploy without this.

- [X] T001 [P] Add `isSoundCloudUrl` refine to `TrackSchema.embedUrl` in `src/lib/import/schema.ts` — change `z.string().url()` to `z.string().url().refine(isSoundCloudUrl, { message: 'embedUrl must be a valid SoundCloud URL' })`
- [X] T002 [P] Extend `revalidateChannel` in `src/lib/storage/local-channels.ts` to reject music channels where any track fails `isSoundCloudUrl(t.embedUrl)` — add guard after the existing `startsWith('https://w.soundcloud.com')` check
- [X] T003 [P] Remove `allow-popups-to-escape-sandbox` from SC iframe sandbox attribute in `src/lib/sources/soundcloud/sc-widget-context.tsx` — keep `allow-scripts allow-same-origin allow-popups`
- [X] T004 [P] Write unit tests for `TrackSchema.embedUrl` allow-list in `tests/unit/schema.test.ts` — cases: valid SC URL passes, `https://evil.com/track` rejected, `http://soundcloud.com/track` rejected (wrong scheme), `javascript:alert(1)` rejected
- [X] T005 [P] Write unit tests for `revalidateChannel` with invalid per-track `embedUrl` in `tests/unit/local-channels.test.ts` — cases: channel with one bad `embedUrl` returns null, channel with all valid URLs passes through

**Checkpoint**: `pnpm test -- --run tests/unit/schema.test.ts tests/unit/local-channels.test.ts` — all pass. Security fix is complete.

---

## Phase 2: Foundational — SC Provider Hoist Fix

**Purpose**: Remove the duplicate nested `ScWidgetProvider` from `MobilePlayerArea`. This is the single root cause of all SoundCloud mobile bugs. Everything in Phase 3 (auto-play, loading state) depends on mobile reading the correct hoisted provider.

**⚠️ CRITICAL**: Must complete Phase 1 first (per spec FR-001 + FR-009 coupling).

- [X] T006 Remove the `<ScWidgetProvider>` wrapper (lines 55 and 65) from `src/components/mobile/mobile-player-area.tsx` — the `import { ScWidgetProvider }` at the top of the file should also be removed since it will no longer be used
- [X] T007 Remove `document.body.click()` from `doSeek()` in `src/lib/sources/soundcloud/sc-widget-context.tsx` (line ~124) — replace with a comment explaining that `navigator.userActivation` is checked in `MusicChannelView` for auto-play instead
- [X] T008 Add finite error-retry bound to `ScWidgetProvider` in `src/lib/sources/soundcloud/sc-widget-context.tsx` — add `retryCountRef = useRef(0)`, increment on `error` event, if `retryCount >= Math.max(activeChannelRef.current?.tracks?.length ?? 1, 1)` set status to `'error'` and return without advancing; reset `retryCountRef.current = 0` at the top of `setActiveChannel`

**Checkpoint**: Open a music channel on mobile emulation in Chrome DevTools. Status badge should transition from `● mounting` → `● ready` → `● playing` within ~6s. The button should read "TAP TO UNMUTE" (no "LOADING…" prefix).

---

## Phase 3: User Story 1 — SoundCloud Auto-Play & Unmute Fallback (Priority: P1) 🎯 MVP

**Goal**: Audio plays automatically on music channels when any prior page interaction exists; unmute button is a single-tap fallback otherwise.

**Independent Test**: Open a music channel in mobile emulation after tapping anything else on the page first. Audio should start automatically. In a fresh incognito tab, the unmute button appears immediately (no "LOADING…") and one tap starts audio.

### Implementation

- [X] T009 [US1] Wire auto-play logic in `src/components/music-channel-view.tsx` — in the `useEffect` that subscribes to `widget`, after `setActiveChannel` resolves, check `navigator.userActivation?.isActive`. If `true`, call `widget.setVolume(volume)` and `widget.play()` synchronously. Add `trackMobileScAutoplay` RUM call (see T011).
- [X] T010 [US1] Add `FR-005` timeout fallback in `src/components/music-channel-view.tsx` — if `activeChannelId` has not resolved within 6000ms of mount, force `isLoading` to `false` via a local `useState` flag (e.g. `loadingTimedOut`) so the unmute button is always reachable
- [X] T011 [P] [US1] Add `trackMobileScAutoplay(success: boolean)` to `src/lib/datadog/rum.ts` — emits RUM action `mobile_sc_autoplay` with `{ success }` where `true` = auto-played, `false` = fell back to unmute button

**Checkpoint**: US1 fully functional per quickstart.md Test 1 and Test 2. Channel navigation test (quickstart Test 4) also passes — no "LOADING…" on channel switch.

---

## Phase 4: User Story 2 — YouTube Single-Tap Playback (Priority: P2)

**Goal**: Tapping the poster play button on a YouTube channel starts video immediately — no second tap required.

**Independent Test**: Open a YouTube channel on mobile emulation, tap the green play button once. Video starts.

### Implementation

- [X] T012 [US2] Add `onPlayerReady?: (player: YT.Player) => void` callback prop to `TvPlayerProps` interface and pass it from `onReady` inside `createPlayer` callback in `src/components/tv-player.tsx` — call `onPlayerReady(player)` immediately after `playerRef.current = player`
- [X] T013 [US2] Refactor `MobilePlayerArea`'s YouTube branch in `src/components/mobile/mobile-player-area.tsx` — always render `TvPlayer` (remove the `isPlaying` gate for YouTube channels); store the `YT.Player` instance in a local `playerRef` via the `onPlayerReady` callback; conditionally render the poster overlay on top when `!isPlaying`
- [X] T014 [US2] Update the poster play button handler in `src/components/mobile/mobile-player-area.tsx` — on tap: call `playerRef.current?.playVideo()`, call `onPlay()` (for parent's first-play tracking), call `setIsPlaying(true)` — all in the same synchronous click handler
- [X] T015 [P] [US2] Add `trackMobileYtOneTap()` to `src/lib/datadog/rum.ts` — emits RUM action `mobile_yt_one_tap` — call it from the poster button handler in `MobilePlayerArea` after `playVideo()`
- [X] T016 [US2] Verify desktop regression: confirm `TvPlayer` receives `allowInteraction={false}` (default) on desktop paths — `pointer-events: none` must remain on desktop. The pre-mount only applies to the `MobilePlayerArea` branch; desktop `TvPlayer` usage in `_tv.tsx` is unchanged.

**Checkpoint**: quickstart.md Test 3 passes (single-tap YouTube). Desktop keyboard navigation still works — arrow keys change channels without the iframe stealing focus.

---

## Phase 5: User Story 3 — Visualizer Mobile Rendering (Priority: P3)

**Goal**: The WebGL visualizer fills the 40dvh mobile player area without overflow or layout shift.

**Independent Test**: Open a music channel on mobile portrait emulation (375px wide). Visualizer fills the player container; the now-next bar is not pushed off-screen.

### Implementation

- [X] T017 [US3] Audit `MusicVisualizerCanvas` canvas sizing in `src/components/music-visualizer-canvas.tsx` — check whether `width`/`height` are set from `window.innerWidth`/`window.innerHeight` or from the container element. If using `window`, switch to a `ResizeObserver` on the canvas container ref to get measured dimensions.
- [X] T018 [US3] If T017 finds a `window`-based sizing path: update `src/components/music-visualizer-canvas.tsx` to use `ResizeObserver` — set canvas `width`/`height` from the observed `contentRect` on mount and on resize. If T017 finds it already uses container dimensions, mark T018 done with no change.
- [X] T019 [US3] Verify fullscreen landscape visualizer fills the viewport in `src/components/mobile/mobile-player-area.tsx` — the `fillHeight` prop path uses `flex-1` which should cover this; test with Chrome DevTools landscape emulation and confirm.

**Checkpoint**: quickstart.md visualizer scenarios pass. No layout shift on portrait/landscape toggle.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Version bump, final coverage check, lint.

- [X] T020 [P] Bump `version` in `package.json` from `1.9.0` to `2.0.0` (mobile playback is a significant fix affecting core UX) — `DD_VERSION` uses this for deploy correlation
- [X] T021 Run `pnpm test -- --coverage` and confirm 80%+ thresholds across lines/functions/branches/statements — fix any regressions before commit
- [X] T022 Run `pnpm lint` and `pnpm check` — fix any TypeScript strict-mode warnings from new `onPlayerReady` prop or `navigator.userActivation` types (`lib.dom.d.ts` should have `UserActivation`)
- [X] T023 [P] Update `specs/003-fix-mobile-playback/checklists/requirements.md` — mark all items checked now that implementation is complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Security)**: No dependencies — start immediately
- **Phase 2 (Provider hoist)**: Depends on Phase 1 completion — the hoist amplifies the security surface
- **Phase 3 (SC auto-play)**: Depends on Phase 2 — needs hoisted provider working correctly
- **Phase 4 (YT single-tap)**: Depends on Phase 2 (shares `MobilePlayerArea`) but independent of Phase 3
- **Phase 5 (Visualizer)**: Depends on Phase 2 — needs SC working so visualizer is reachable
- **Phase 6 (Polish)**: Depends on all previous phases

### Parallel Opportunities Per Phase

- Phase 1: T001, T002, T003, T004, T005 all touch different files — fully parallel
- Phase 2: T006, T007, T008 are sequential (T006 removes provider, T007/T008 modify the same context file — do T007 then T008 in one pass)
- Phase 3 + Phase 4: Can run in parallel once Phase 2 is complete (different files)
- Phase 3: T009, T010 are in the same file (sequential); T011 is separate (parallel)
- Phase 4: T012 → T013 → T014 are sequential (each builds on the prior); T015 and T016 are parallel with each other

### Parallel Example: Phase 1

```bash
# All of these can run simultaneously:
Task: "T001 — Add isSoundCloudUrl refine to TrackSchema.embedUrl in src/lib/import/schema.ts"
Task: "T002 — Extend revalidateChannel in src/lib/storage/local-channels.ts"
Task: "T003 — Remove allow-popups-to-escape-sandbox from sc-widget-context.tsx"
Task: "T004 — Write unit tests for TrackSchema.embedUrl in tests/unit/schema.test.ts"
Task: "T005 — Write unit tests for revalidateChannel in tests/unit/local-channels.test.ts"
```

### Parallel Example: Phase 3 + Phase 4

```bash
# Once Phase 2 is done, start both simultaneously:
Thread A → Phase 3: T009 → T010 (parallel T011)
Thread B → Phase 4: T012 → T013 → T014 (parallel T015, T016)
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + Phase 3)

1. Complete Phase 1: Security — fast, isolated, schema-only changes
2. Complete Phase 2: Provider hoist — the 1-line delete + context.tsx cleanup
3. Complete Phase 3: SC auto-play — this alone fixes the primary mobile SC experience
4. **STOP and VALIDATE**: Test on mobile emulation per quickstart.md Tests 1, 2, 4
5. Everything after this (YouTube, visualizer) is additive

### Incremental Delivery

1. Phase 1 + 2 → SC mobile works (no more stuck loading, single-tap unmute)
2. + Phase 3 → SC auto-plays when session has prior interaction
3. + Phase 4 → YouTube single-tap
4. + Phase 5 → Visualizer sizing verified
5. + Phase 6 → PR-ready

---

## Notes

- `navigator.userActivation` is available in iOS Safari 16.4+ and Android Chrome 72+. On unsupported browsers, `navigator.userActivation` is `undefined` → treat `isActive` as `false` → show unmute button. Always guard with `?.isActive`.
- The `TvPlayer` pre-mount (T013) renders the iframe before the user taps. The YouTube API script is already loaded globally — pre-mounting only creates the `YT.Player` instance earlier. On slow connections the player may not be ready when the user taps; `playerRef.current?.playVideo()` guards with `?.` so this fails silently and the user can tap again.
- Version bump to `2.0.0` reflects that the SC mobile experience was non-functional — this is a significant UX restore, not a minor patch.
