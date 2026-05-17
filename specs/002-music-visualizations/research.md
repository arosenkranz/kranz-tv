# Research: Music Channel Visualizations

**Date**: 2026-05-17 | **Plan**: [plan.md](./plan.md)

## R-001: Visualization style selection

**Decision**: 6 styles for launch using only GLSL ES 3.00 fragment shaders, no new npm dependencies.

| Preset ID         | Display Name    | Replaces              |
| ----------------- | --------------- | --------------------- |
| `spectrum`        | Spectrum        | Existing (unchanged)  |
| `kaleidoscope`    | Kaleidoscope    | Was spectrum-fallback |
| `plasma`          | Plasma          | `particles` repurposed|
| `starfield`       | Starfield       | New slot              |
| `retrowave`       | Retrowave Grid  | New slot              |
| `sacred-geometry` | Sacred Geometry | `oscilloscope` repurposed |

**Rationale**: All 6 are fragment-shader-only (fullscreen quad, same pattern as `spectrum`). The existing `ShaderQuadRenderer` base class is sufficient. No Three.js, p5.js, or butterchurn needed — avoids bundle size increase and Worker compatibility concerns.

**Alternatives considered**: p5.js, Three.js, Butterchurn. All rejected: require new npm deps, significantly larger bundle, and/or depend on FFT audio data unavailable from SoundCloud's cross-origin widget.

## R-002: Picker surface

**Decision**: Visualization section added to the **info panel** (desktop right-panel); **`Z` keybind** to cycle styles; small **overlay button** for mobile. No dedicated modal.

**Rationale**: Info panel is already visible on music channels and has an established pattern for adding sections. `Z` (mnemonic: "visualiZation") does not conflict with any existing keybind.

## R-003: Mobile fix

**Decision**: Branch on `channel.kind === 'music'` in `mobile-player-area.tsx` before the `getThumbnailUrl` cast (line 36). Render `MusicChannelView` for music kind, existing `TvPlayer` branch for video kind. Add `onUnmute` to `MobilePlayerAreaProps`.

**Rationale**: `MusicChannelView` is already a layout-complete view component. Reuse avoids code duplication. The `getThumbnailUrl(position.item as Video)` cast is the immediate crash cause for music channels on mobile.

## R-004: Audio input to shaders

**Decision**: Time-based procedural only — `u_time`, `u_trackElapsed`, `u_trackProgress`. No FFT.

**Rationale**: SoundCloud `<audio>` is in a cross-origin iframe; `AnalyserNode` cannot access it. No CORS workaround without a same-origin audio proxy (out of scope). The `spectrum.glsl.ts` `fakeAmplitude()` pattern already demonstrates that convincing beat-like motion is achievable without real audio data.

## R-005: Picker preview thumbnails

**Decision**: Static CSS gradient thumbnails per preset (one `background` CSS value per style). No live canvas previews in the picker.

**Rationale**: 6 simultaneous WebGL canvases for thumbnails would be prohibitively expensive on mobile and would violate the visual-tuning protocol (scaffold first, then tune). Static gradients are sufficient to convey visual identity.

## R-006: Context loss and fallback

**Decision**: Extend `VisualizerRendererCallbacks` with `onStart` and `onFallback` callbacks. `MusicVisualizerCanvas` calls `onFallback('webgl2-unavailable')` in the catch block and `onFallback('context-lost')` via the context-restored callback failure path. When fallback is signaled, `MusicChannelView` shows the existing `radial-gradient` backdrop (already present) as the static fallback frame.

**Rationale**: `ShaderQuadRenderer` already handles `webglcontextlost` and `webglcontextrestored` events. Adding callbacks surfaces these lifecycle events to React without requiring any new WebGL logic.
