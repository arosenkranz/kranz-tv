import type { VisualizerPreset, IntensityLevel } from './types'
import { VisualizerRenderer } from './renderer'
import type { VisualizerRendererCallbacks } from './renderer'

export interface BackendMountOpts {
  preset: VisualizerPreset
  intensity: IntensityLevel
  // ShaderQuad-specific callbacks for now; generalize to a backend-agnostic shape when the three/p5 backends land (PR 3).
  callbacks?: VisualizerRendererCallbacks
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
    const r = new VisualizerRenderer(canvas, opts.callbacks ?? {})
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
