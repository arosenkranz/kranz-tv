# Psychedelic Visualizer Arsenal — 7 Presets Across 3 Backends

**Date:** 2026-06-12 · **Status:** Approved design (pending implementation plan)

## Problem

Music-channel visuals (6 procedural WebGL2 shader presets) are weak relative to the
ambition of the app. The user wants spectacular, trippy, creative visuals — 2D and 3D —
explicitly including three.js and p5.js territory.

## Constraint (hard)

Audio plays inside SoundCloud's cross-origin widget iframe: **no Web Audio
`AnalyserNode`, no FFT**. All visuals stay procedural, driven by `time`, `trackElapsed`,
`trackProgress`, `intensity`, and a **simulated beat** (deterministic pseudo-BPM derived
from a hash of the track id → pulse uniform). This keeps visuals schedule-pure and
identical for any viewer at the same track position.

## The lineup (user-selected)

| Preset | Backend | Description |
|---|---|---|
| Fractal Voyage | GLSL | Raymarched flight through evolving kaleidoscopic IFS/Mandelbulb-style fractal, palette cycling with track progress |
| Liquid Ink | GLSL | Marbled fluid melt; colors bleed and fold (60s liquid-light-show) |
| Acid Melt | GLSL + feedback FBO | Previous frame zoomed/rotated/hue-rotated and fed back; infinite trails |
| Warp Drive | GLSL | **Upgrades existing `starfield`**: relativistic streaks, chromatic aberration |
| Neon Tunnel | three.js (lazy) | True-3D pulsing tunnel fly-through with bloom post-processing |
| Particle Galaxy | three.js (lazy) | Tens of thousands of GPU particles orbiting/exploding/reforming |
| Flow-Field Organism | p5 (lazy) | Curl-noise flow fields growing organic drifting stroke structures |

Existing presets stay selectable; `starfield` is replaced by Warp Drive.

## Architecture

### Backend abstraction

```ts
interface VisualizerBackend {
  mount(canvasContainer: HTMLElement, opts: BackendOpts): Promise<void>
  setTrackPosition(elapsed: number, progress: number): void
  setIntensity(level: number): void
  setVisible(visible: boolean): void   // pause-on-hidden
  dispose(): void
}
```

Three implementations:
1. **shader-quad** — existing `VisualizerRenderer`, extended with optional ping-pong
   framebuffers (needed only by Acid Melt). New GLSL presets register in
   `SHADER_SOURCES` as today.
2. **three** — dynamic `import('three')` (~160KB gzip) only when a three.js preset is
   selected. One `WebGLRenderer`, scenes swap within it.
3. **p5** — dynamic `import('p5')` only when Flow-Field is selected; instance mode,
   WEBGL renderer where possible.

### Guardrails (hard requirements, from adversarial + perf review)

- **Single GPU owner.** A `VisualizerHost` component owns exactly one active backend;
  switching presets across backends is dispose-then-mount, never overlapping contexts.
  No crossfades across backends.
- **Lazy-load states are explicit.** A persisted/shared lazy preset must render a
  `LOADING VISUAL…` placeholder (distinct from the WebGL-unavailable gradient fallback),
  never a black frame. `resolvePreset` returning a preset whose module isn't loaded must
  be impossible to confuse with "ready". Dynamic-import failure → fall back to default
  GLSL preset + RUM error.
- **Mobile perf gates land FIRST (PR 1), before any expensive preset:**
  - DPR clamp (≤1.5, lower for raymarch-class presets via per-preset cost hints)
  - FPS cap (per-preset; 60 default, 30 for raymarch/feedback)
  - `visibilitychange` pause in the render loop (today it runs full-tilt hidden)
  - fix per-frame `gl.getAttribLocation` in `visualizers/renderer.ts:160` and
    `overlays/renderer.ts:109` (cache at init)
  - lazy shader compilation: compile active preset at mount, rest via
    `requestIdleCallback` (avoids 200–900ms mobile main-thread spike)
- **Reduced motion** renders a static frame per preset (existing behavior carried to all
  backends).
- **Preset persistence**: storage value space grows; key stays, `resolvePreset` already
  falls back safely on unknown values. Cycle order appends new presets at the end.

### Visual tuning protocol (house rule)

Every new preset ships with the existing intensity system (chill/normal/intense/max)
wired to meaningful parameters (speed, fold depth, feedback gain, particle count) — user
picks a level, then fine-tunes; no one-shot value tuning. Dev URL param `?viz=` already
exists for direct preset selection.

### Telemetry

RUM actions: `viz_preset_selected` (preset, backend), `viz_lazy_load` (duration,
success), `viz_fallback` (reason). DogStatsD counter for preset usage.

## Delivery plan (3 PRs)

1. **Foundations**: perf gates, backend interface, `VisualizerHost`, lazy-load states,
   attrib-location fix, feedback-FBO support in `ShaderQuadRenderer`.
2. **GLSL wave**: Fractal Voyage, Liquid Ink, Acid Melt, Warp Drive (+ tests, preset
   registry updates).
3. **Heavy backends**: three backend (Neon Tunnel, Particle Galaxy), p5 backend
   (Flow-Field Organism), bundle-size verification (lazy chunks only).

## Testing

- Unit: backend lifecycle (mount/dispose ordering, single-owner invariant), lazy-load
  state machine, preset registry/cycling, FBO ping-pong setup, FPS-cap logic.
- Browser verification on desktop + a mid-range phone: each preset at each intensity,
  preset switching across backends, hidden-tab pause, reduced-motion.
