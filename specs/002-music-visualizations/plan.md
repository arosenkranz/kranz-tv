# Implementation Plan: Music Channel Visualizations

**Branch**: `002-music-visualizations` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-music-visualizations/spec.md`

## Summary

Wire the orphaned `MusicVisualizerCanvas` component into `MusicChannelView` (it was built in the 001 sprint but never imported), author 5 additional GLSL fragment shaders to reach ≥6 visually distinct styles, expose a global visualization picker in the info panel and via a keybind, and extend music-channel support to mobile (which currently renders a broken YouTube TvPlayer for SoundCloud channels). Visuals are driven entirely by elapsed playback time and widget-reported position; no audio FFT is attempted (SoundCloud's widget iframe is cross-origin; spectral data is unavailable).

## Technical Context

**Language/Version**: TypeScript 5.x / React 18 (RSC-capable via TanStack Start)
**Primary Dependencies**: Vitest + Testing Library (tests), TanStack Router (routing), Tailwind CSS (utility classes), `@datadog/browser-rum` (telemetry)
**Graphics**: Raw WebGL2 via existing `ShaderQuadRenderer` base class (`src/lib/overlays/shader-quad-renderer.ts`); no new library dependencies required. GLSL ES 3.00 fragment shaders.
**Storage**: `localStorage` (existing `resolvePreset`/`savePreset` in `src/lib/visualizers/preset.ts`); no server storage.
**Testing**: Vitest + happy-dom; WebGL2 mocked (pattern established in `tests/unit/lib/visualizers/renderer.test.ts`)
**Target Platform**: Browser (desktop + mobile); Cloudflare Workers edge runtime for SSR shell only (canvas rendering is client-only)
**Performance Goals**: ≤4ms GPU frame time on desktop; ≤4ms at 0.5× DPR on mobile (0.5× scale already applied in `ShaderQuadRenderer.applyResize()`)
**Constraints**: No Node-only APIs in client code; no server-side prerendering of canvas; must respect `prefers-reduced-motion`; WebGL2 context loss must be handled gracefully
**Scale/Scope**: 6 SoundCloud presets, ≥6 visualization styles, 1 global picker, mobile + desktop surfaces

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Deterministic Scheduling** — This feature does NOT touch `src/lib/scheduling/algorithm.ts`. The visualization layer reads `position.seekSeconds` and `trackElapsed` as inputs but never writes back to the schedule. Invariant preserved.
- [x] **II. Client-Side Data Fetching** — No new YouTube API calls. All visualization computation is client-side (WebGL). No server functions are added. `resolvePreset` reads `localStorage` and `URLSearchParams` — both client-only.
- [x] **III. Test-First** — Pure functions to expand: `isVisualizerPreset` + `resolvePreset` in `preset.ts`; the style registry lookup (new `getShaderForPreset()` helper). Tests MUST be written before adding new preset names or shaders. Renderer tests already exist; extend them for new `setPreset` branches.
- [x] **IV. Observability** — Two new RUM events: `music_visualizer_start` (fires when WebGL canvas mounts successfully, with preset name and platform) and `music_visualizer_fallback` (fires when WebGL2 init fails, with reason). `trackMusicBackdropSelected` is already defined in `rum.ts:331` — wire it to the picker's `onChange`. Constitution satisfied.
- [x] **V. Immutability & File Size** — `MusicVisualizerCanvas.tsx` is 62 lines (canvas wrapper; stays small). New shaders are pure GLSL string exports — no mutation. `MusicChannelView.tsx` is 200 lines and will grow by ~40 lines to add canvas import + picker prop; still under 400. `mobile-player-area.tsx` grows by ~25 lines; stays under 150. `renderer.ts` stays at 152 lines — no additions needed there.
- [x] **Deployment Constraints** — Canvas rendering is client-only. No `require()`. No new runtime env vars. No static prerendering of canvas output. New shader files (`*.glsl.ts`) are ESM string exports — compatible with Workers bundler.

## Project Structure

### Documentation (this feature)

```text
specs/002-music-visualizations/
├── plan.md              # This file
├── research.md          # Phase 0 output (below)
├── data-model.md        # Phase 1 output (below)
├── contracts/           # Phase 1 output (below)
│   └── visualization-picker.md
└── tasks.md             # Phase 2 output (/speckit-tasks command — not created here)
```

### Source Code layout for this feature

```text
src/
├── lib/
│   ├── visualizers/
│   │   ├── types.ts                     # MODIFY: expand VisualizerPreset union + add display metadata
│   │   ├── preset.ts                    # MODIFY: update isVisualizerPreset to match new union
│   │   ├── renderer.ts                  # MODIFY: populate SHADER_SOURCES with real shaders
│   │   └── shaders/
│   │       ├── spectrum.glsl.ts         # existing — no change
│   │       ├── kaleidoscope.glsl.ts     # NEW
│   │       ├── plasma.glsl.ts           # NEW
│   │       ├── starfield.glsl.ts        # NEW
│   │       ├── retrowave.glsl.ts        # NEW
│   │       └── sacred-geometry.glsl.ts  # NEW (oscilloscope slot repurposed)
│   └── datadog/
│       └── rum.ts                       # MODIFY: add trackMusicVisualizerStart, trackMusicVisualizerFallback
├── components/
│   ├── music-visualizer-canvas.tsx      # MODIFY: add onStart/onFallback callbacks for RUM; context-loss recovery signal
│   ├── music-channel-view.tsx           # MODIFY: import + mount MusicVisualizerCanvas; accept activePreset prop
│   └── mobile/
│       ├── mobile-player-area.tsx       # MODIFY: branch on channel.kind === 'music' → render MusicChannelView
│       └── mobile-music-player-area.tsx # NEW (optional extract; may inline in mobile-player-area)
│
└── [picker UI — see contracts/visualization-picker.md for surface options]

tests/unit/
├── lib/
│   └── visualizers/
│       ├── renderer.test.ts             # MODIFY: add setPreset tests for each new preset
│       └── preset.test.ts              # NEW: resolvePreset / savePreset / isVisualizerPreset coverage
└── components/
    ├── music-channel-view.test.tsx      # MODIFY: update ambient-background test (radial-gradient → canvas)
    └── mobile-player-area.test.tsx     # NEW: music kind renders MusicChannelView not TvPlayer
```

---

## Phase 0: Research

### R-001: Visualization style selection — 6 styles from the design

Based on external research and the existing 4 named slots, the 6 styles for launch are:

| Preset ID            | Display Name       | Description                                      | Replaces / New           |
| -------------------- | ------------------ | ------------------------------------------------ | ------------------------ |
| `spectrum`           | Spectrum           | Faked EQ bars (existing, keep unchanged)         | existing                 |
| `kaleidoscope`       | Kaleidoscope       | 6-fold mirrored fractal, slow rotation           | was: fallback to spectrum |
| `plasma`             | Plasma             | Curl-noise blobs, lava-lamp, soft bloom          | was: `particles` slot repurposed |
| `starfield`          | Starfield          | Hyperspace flythrough, receding stars            | NEW slot                 |
| `retrowave`          | Retrowave Grid     | Receding chrome grid + synthwave sun             | NEW slot                 |
| `sacred-geometry`    | Sacred Geometry    | Rotating Platonic wireframes, gold-on-black      | was: `oscilloscope` slot repurposed |

**Decision**: Retire the names `particles` and `oscilloscope` (they never had real shaders; only spectrum-fallbacks). Replace with `plasma` and `sacred-geometry`. Keep `spectrum` as the default (cheapest to render, most compatible with mobile). Add `starfield` and `retrowave` as two genuinely new preset slots, bringing the total to 6.

**Rationale**: 6 is the minimum from FR-003. Each style covers a distinct visual vocabulary (EQ bars, fractal mirror, fluid sim, space, retro-grid, geometry). All are fragment-shader-only (no geometry, no Three.js, no p5.js dependency), keeping the existing `ShaderQuadRenderer` base class sufficient and avoiding any npm additions.

**Alternatives considered**:
- p5.js or Three.js: Would require new npm dependencies, Worker bundle size increase, and complex lifecycle integration with the existing canvas system. Rejected — raw GLSL via existing base class achieves the same visuals with zero new deps.
- Butterchurn / ProjectM port: Heavy library (~500KB gzipped), requires FFT audio data. Rejected for this feature scope.
- Per-channel locked styles: User chose global preference model. Styles are viewer-personalized, not channel-branded.

---

### R-002: Picker surface — where does the user change styles?

**Decision**: Add a visualization section to the existing **info panel** (desktop right panel) and expose a **keybind `Z`** to cycle through styles. For mobile, integrate into the existing mobile toolbar or a small overlay button.

**Rationale**: The info panel (`src/components/info-panel/`) already exists and is visible whenever a music channel is active. Adding a 6-option picker there (radio buttons or a compact grid of labeled swatches) requires minimal new UI surface. The `Z` keybind (mnemonic: "visualiZation") does not conflict with any existing bindings listed in `use-keyboard-controls.ts`.

**Alternatives considered**:
- URL-only: Already supported via `?viz=` but no UI. Insufficient for discoverability.
- Dedicated modal: Heavier UI lift than a panel section; unnecessary given the info panel already exists.
- EPG grid or nav overlay: Out of scope per spec.

---

### R-003: Mobile fix approach

**Decision**: In `mobile-player-area.tsx`, branch on `channel.kind === 'music'` before rendering `TvPlayer`. When `kind === 'music'`, render `MusicChannelView` directly (same component as desktop). Pass `isMuted` / `volume` / `onUnmute` through the existing `MobilePlayerAreaProps`.

**Rationale**: `MusicChannelView` is already a pure view component. Reusing it on mobile avoids code duplication. The mobile layout's `flex-1` region is already sized appropriately. The current `getThumbnailUrl(position.item as Video)` cast on line 36 of `mobile-player-area.tsx` crashes for music channels (a `Track` has no `thumbnailUrl`); branching before this line fixes the cast issue cleanly.

`MobilePlayerAreaProps` needs a minor signature addition: `onUnmute: () => void` is not currently a prop (it was specific to desktop). The caller (`mobile-view.tsx`) already has access to the unmute handler — threading it through is a small change.

**Alternatives considered**:
- New `MobileMusicPlayerArea` component: Acceptable but unnecessary — `MusicChannelView` already handles its own layout, unmute button, and canvas. Splitting creates two components for the same view.
- Adding `kind` check in `mobile-view.tsx` before passing to `MobilePlayerArea`: Possible but leaks channel-type branching one layer higher than needed.

---

### R-004: Audio input to shaders

**Decision**: All shaders receive only `u_time` (seconds since canvas mount), `u_trackElapsed` (seconds within current track from widget progress callback), and `u_trackProgress` (0–1 normalized). Shaders MUST NOT attempt to read audio frequency data.

**Rationale**: SoundCloud's `<audio>` element lives in a cross-origin iframe; `AnalyserNode` cannot reach it. The existing `spectrum.glsl.ts` already demonstrates the approach: `fakeAmplitude()` synthesizes beat-like motion from `sin/cos` of `u_trackElapsed`. All 5 new shaders follow the same contract.

---

### R-005: Picker preview thumbnails (US5, P3)

**Decision**: Preview thumbnails are **CSS gradient static frames per preset**, generated at build time as inline `background` values (one CSS string per preset). No live canvas previews in the picker.

**Rationale**: Running 6 WebGL canvases simultaneously for picker thumbnails would be prohibitively expensive on mobile. Static gradient approximations ("neon retrowave" → `linear-gradient(to bottom, #ff69b4 0%, #1a0a2e 60%, #00c8ff 100%)`) are sufficient to convey style identity and match the CLAUDE.md visual-tuning mandate of scaffolding presets behind a dev toggle first. True animated thumbnails can be a future enhancement.

---

## Phase 1: Design & Contracts

### Data model (`data-model.md` — inline below)

**VisualizerPreset** (expanded type union in `src/lib/visualizers/types.ts`):

```typescript
export type VisualizerPreset =
  | 'spectrum'
  | 'kaleidoscope'
  | 'plasma'
  | 'starfield'
  | 'retrowave'
  | 'sacred-geometry'
```

**VisualizerStyleMeta** (new registry entry — pure data, no class):

```typescript
export interface VisualizerStyleMeta {
  readonly id: VisualizerPreset
  readonly displayName: string
  readonly previewGradient: string   // CSS background value for picker thumbnail
}

export const VISUALIZER_STYLES: readonly VisualizerStyleMeta[] = [
  { id: 'spectrum',         displayName: 'Spectrum',        previewGradient: '...' },
  { id: 'kaleidoscope',     displayName: 'Kaleidoscope',    previewGradient: '...' },
  { id: 'plasma',           displayName: 'Plasma',          previewGradient: '...' },
  { id: 'starfield',        displayName: 'Starfield',       previewGradient: '...' },
  { id: 'retrowave',        displayName: 'Retrowave Grid',  previewGradient: '...' },
  { id: 'sacred-geometry',  displayName: 'Sacred Geometry', previewGradient: '...' },
]
```

**Active selection** — no new model entity. Stored as a `VisualizerPreset` string in `localStorage[VISUALIZER_STORAGE_KEY]`. URL override via `?viz=<id>` does not write to storage (existing behavior in `resolvePreset`).

**VisualizerRendererCallbacks** (extend existing interface):

```typescript
export type VisualizerRendererCallbacks = ShaderQuadCallbacks & {
  onStart?: (preset: VisualizerPreset) => void
  onFallback?: (reason: 'webgl2-unavailable' | 'context-lost') => void
}
```

### Contracts (`contracts/visualization-picker.md` — inline below)

**Interface**: Visualization style picker

**Consumer**: Viewer (end user) on desktop (info panel) and mobile (toolbar or overlay button)

**Contract**:

| Action | Input | Output |
| ------ | ----- | ------ |
| List styles | (open picker) | Display names + preview gradient for each of the 6 styles; active style indicated |
| Select style | Click/tap on a style entry | Visualization switches within ≤2 seconds; selection persisted to localStorage; `trackMusicBackdropSelected(id)` RUM event emitted |
| Cycle via keybind `Z` | Press `Z` on desktop | Next style in `VISUALIZER_PRESETS` order selected; same effects as picker selection |
| Deep-link override | `?viz=<id>` in URL | Active style is `<id>` for session; localStorage not overwritten |
| Invalid style ID | `?viz=invalid` or stale localStorage | Falls back to `DEFAULT_VISUALIZER`; no error thrown |

**Invariants**:
- Picker is only visible / keybind only active when the active channel is `kind === 'music'`
- YouTube channels are never affected by the visualization state
- Only one WebGL canvas exists at a time; switching styles calls `renderer.setPreset(id)` (no canvas teardown)

### Quickstart (for `/speckit-tasks` and future implementers)

**Where to start**: Run `pnpm test -- --run tests/unit/lib/visualizers/preset.test.ts` (this file does not yet exist — create it first as the TDD red step for `isVisualizerPreset` with the new preset names).

**Key integration points**:
1. `src/lib/visualizers/types.ts` — expand the union and add `VISUALIZER_STYLES` registry
2. `src/lib/visualizers/shaders/` — add 5 new `*.glsl.ts` files (pure GLSL string exports)
3. `src/lib/visualizers/renderer.ts` — populate `SHADER_SOURCES` with real imports
4. `src/components/music-visualizer-canvas.tsx` — add `onStart`/`onFallback` callback props; call them at mount and on context error
5. `src/components/music-channel-view.tsx` — import `MusicVisualizerCanvas`, pass `activePreset` from parent (or resolve locally from URL params)
6. `src/components/mobile/mobile-player-area.tsx` — add `kind === 'music'` branch before `getThumbnailUrl` cast
7. `src/lib/datadog/rum.ts` — add `trackMusicVisualizerStart` and `trackMusicVisualizerFallback`
8. Picker UI — implement in info panel + keybind `Z` in `use-keyboard-controls.ts`

**TDD sequence** (follow this order exactly, per Constitution Principle III):
1. `tests/unit/lib/visualizers/preset.test.ts` — NEW: tests for `isVisualizerPreset` with all 6 names; `resolvePreset` URL-param priority; `resolvePreset` localStorage fallback; invalid-ID fallback
2. Implement new types + expand `VISUALIZER_PRESETS` → make tests pass
3. Write one new shader file (start with `kaleidoscope.glsl.ts`) — no unit test for GLSL itself (it's pure GPU code), but verify via manual dev-server check
4. `tests/unit/lib/visualizers/renderer.test.ts` (MODIFY) — add `setPreset('kaleidoscope')` and `setPreset('retrowave')` tests (verify `gl.useProgram` is called with correct program)
5. Populate `SHADER_SOURCES` with kaleidoscope import → make renderer tests pass
6. Repeat steps 3–5 for each remaining shader
7. `tests/unit/components/music-channel-view.test.tsx` (MODIFY) — update ambient-background test: replace `radial-gradient` query with `data-testid="music-visualizer-canvas"` presence check
8. Wire `MusicVisualizerCanvas` into `MusicChannelView` → make component tests pass
9. `tests/unit/components/mobile-player-area.test.tsx` — NEW: `kind === 'music'` renders canvas not TvPlayer
10. Implement mobile branch in `mobile-player-area.tsx` → make mobile test pass
11. Implement picker UI (info panel section + Z keybind); no unit test (pure UI); verify via dev server

**Version bump**: Increment `version` in `package.json` before opening the PR (1.7.0 → 1.8.0). Update `CLAUDE.md` Active Feature block to point at this plan.

---

## Agent context update

<!-- SPECKIT START -->
Active feature plan: `specs/002-music-visualizations/plan.md` (branch: `002-music-visualizations`)
<!-- SPECKIT END -->
