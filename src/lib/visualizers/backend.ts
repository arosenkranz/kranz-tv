import type {
  VisualizerPreset,
  IntensityLevel,
  DeviceTier,
  VisualizerFallbackReason,
} from './types'
import { VisualizerRenderer } from './renderer'

// Backend-agnostic callbacks — only what three/p5 + shader-quad all need.
// Context-loss is shader-quad-internal and surfaces here as onFallback.
export interface BackendCallbacks {
  onStart?: (preset: VisualizerPreset) => void
  onFallback?: (reason: VisualizerFallbackReason) => void
}

export interface BackendMountOpts {
  preset: VisualizerPreset
  intensity: IntensityLevel
  tier: DeviceTier
  callbacks?: BackendCallbacks
}

// The contract every visualizer engine implements. The host (Task 6) owns
// exactly one live backend and enforces dispose-then-mount when switching
// across backends — so no two GPU contexts are ever alive at once.
export interface VisualizerBackend {
  mount: (canvas: HTMLCanvasElement, opts: BackendMountOpts) => Promise<void>
  setPreset: (preset: VisualizerPreset) => void
  setTrackPosition: (elapsed: number, progress: number) => void
  setIntensity: (level: IntensityLevel) => void
  setVisible: (visible: boolean) => void
  dispose: () => void
}

// The WebGL2 fragment-quad backend — adapts the existing VisualizerRenderer.
// This is the only backend in PR 1; three.js and p5 backends arrive in PR 3.
export class ShaderQuadBackend implements VisualizerBackend {
  private renderer: VisualizerRenderer | null = null

  mount(canvas: HTMLCanvasElement, opts: BackendMountOpts): Promise<void> {
    const cb = opts.callbacks ?? {}
    const r = new VisualizerRenderer(canvas, {
      onStart: cb.onStart,
      onFallback: cb.onFallback,
      // Context-loss is shader-quad-internal; ShaderQuadRenderer self-restores
      // via handleContextRestored. We do NOT route context-lost to a permanent
      // fallback — only surface it as telemetry-grade onFallback if a consumer
      // wants it. Restore keeps the visual alive.
      onContextLost: () => cb.onFallback?.('context-lost'),
    })
    r.setPreset(opts.preset)
    r.setIntensityLevel(opts.intensity)
    r.start()
    this.renderer = r
    return Promise.resolve()
  }

  setPreset(preset: VisualizerPreset): void {
    this.renderer?.setPreset(preset)
  }

  setTrackPosition(elapsed: number, progress: number): void {
    this.renderer?.setTrackPosition(elapsed, progress)
  }

  setIntensity(level: IntensityLevel): void {
    this.renderer?.setIntensityLevel(level)
  }

  setVisible(visible: boolean): void {
    if (!this.renderer) return
    if (visible) this.renderer.start()
    else this.renderer.stop()
  }

  dispose(): void {
    this.renderer?.dispose()
    this.renderer = null
  }
}
