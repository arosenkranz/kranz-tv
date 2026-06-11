# Contract: ShaderQuadRenderer Base Class

**Feature**: 001-music-channels
**Type**: Internal class contract — shared between OverlayRenderer and VisualizerRenderer

This contract governs the `ShaderQuadRenderer` base class extracted from `src/lib/overlays/renderer.ts`. Both the existing `OverlayRenderer` and the new `VisualizerRenderer` extend it.

---

## Responsibilities (base class owns)

- WebGL2 context acquisition and context-loss recovery
- Fullscreen-quad vertex buffer setup (two triangles covering clip space)
- Vertex shader (passthrough UV coordinates)
- `ResizeObserver` setup and canvas DPR scaling
- `requestAnimationFrame` loop with frame-rate throttling
- `loseContext()` cleanup on `dispose()`

## Responsibilities (subclass owns)

- Shader program compilation and caching
- Uniform set declaration and per-frame upload
- Frame-rate policy (30fps for overlays, 60fps for visualizers)
- Shader registry / mode enum
- `prefers-reduced-motion` handling

---

## Abstract Interface

```typescript
abstract class ShaderQuadRenderer {
  protected gl: WebGL2RenderingContext
  protected canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement)

  /** Called once after WebGL context is acquired. Subclass compiles shaders here. */
  protected abstract onContextReady(): void

  /** Called each frame. Subclass uploads uniforms and calls gl.drawArrays. */
  protected abstract onFrame(timestampMs: number): void

  /** Subclass returns the desired frame interval in ms (e.g. 1000/30 or 1000/60). */
  protected abstract get frameIntervalMs(): number

  /** Start the RAF loop. */
  start(): void

  /** Stop the RAF loop. Does NOT release GL resources. */
  stop(): void

  /**
   * Release all GL resources, stop the RAF loop, disconnect the ResizeObserver.
   * Calls gl.getExtension('WEBGL_lose_context').loseContext() to free GPU memory.
   * MUST be idempotent.
   */
  dispose(): void
}
```

---

## Behavioral Contracts

- `dispose()` MUST be idempotent — safe to call multiple times.
- `dispose()` MUST call `gl.getExtension('WEBGL_lose_context')?.loseContext()` before returning.
- `onContextReady()` MUST be called again after context is restored (`webglcontextrestored` event).
- Canvas DPR is clamped: `Math.min(window.devicePixelRatio, 2)` on desktop; `0.5` on mobile (`window.innerWidth < 768`).
- The RAF loop MUST check `document.hidden` before each frame and skip rendering when the tab is hidden.
- `prefers-reduced-motion`: Subclasses check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and must either stop the loop or render a still frame. Base class provides the media query helper; subclass decides behavior.

---

## OverlayRenderer (existing, refactored)

- Extends `ShaderQuadRenderer`
- `frameIntervalMs`: `1000 / 30` (30fps, unchanged)
- Uniforms: `{u_time: float, u_resolution: vec2}`
- Shader registry: `OVERLAY_MODES` (existing)
- No change to public API — `OverlayRenderer` callers are unaffected

## VisualizerRenderer (new)

- Extends `ShaderQuadRenderer`
- `frameIntervalMs`: `1000 / 60` default; degrades to `1000 / 15` when overlay is also active on mobile
- Uniforms: `{u_time: float, u_resolution: vec2, u_trackElapsed: float, u_trackProgress: float}`
- `u_trackElapsed`: seconds into current track (from `SchedulePosition.seekSeconds`, updated each frame via `setTrackPosition(elapsed, progress)`)
- `u_trackProgress`: `elapsed / durationSeconds`, clamped 0..1
- Shader registry: `VISUALIZER_PRESETS` (`spectrum | particles | kaleidoscope | oscilloscope`)
- `prefers-reduced-motion`: renders a still gradient (`u_trackElapsed = 0`, loop stopped)
- Auto-downgrade: when both a `VisualizerRenderer` and an `OverlayRenderer` are active and GPU frame time exceeds 4ms (checked via `EXT_disjoint_timer_query_webgl2` if available), downgrade to `spectrum` preset
