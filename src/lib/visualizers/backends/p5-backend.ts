import P5 from 'p5'
import type { VisualizerPreset, IntensityLevel } from '../types'
import type { VisualizerBackend, BackendMountOpts } from '../backend'
import {
  makeFlowFieldSketch,
  FLOW_FIELD_INTENSITY,
  type FlowFieldParams,
} from './p5/flow-field'

class P5Backend implements VisualizerBackend {
  private instance: P5 | null = null
  private params: FlowFieldParams = FLOW_FIELD_INTENSITY.normal
  private elapsed = 0
  private reducedMotion = false

  mount(canvas: HTMLCanvasElement, opts: BackendMountOpts): Promise<void> {
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    this.params = FLOW_FIELD_INTENSITY[opts.intensity]
    const sketch = makeFlowFieldSketch(
      () => this.params,
      () => this.elapsed,
    )
    // p5 instance mode appends its own <canvas> to the parent element.
    // We mount into canvas.parentElement so the p5 canvas lands in the same
    // container as the host canvas. The p5 canvas is styled position:absolute,
    // inset:0, z-index:1 via windowResized to sit on top of the host canvas
    // (which keeps its data-testid and is not removed).
    const parent = canvas.parentElement ?? document.body
    this.instance = new P5(sketch, parent)

    // Style the p5-created canvas to cover the container.
    // p5 appends the canvas as the last child of parent; grab it after mount.
    const p5Canvas = parent.querySelector<HTMLCanvasElement>(
      'canvas:not([data-testid])',
    )
    if (p5Canvas) {
      p5Canvas.style.position = 'absolute'
      p5Canvas.style.inset = '0'
      p5Canvas.style.zIndex = '1'
      p5Canvas.style.width = '100%'
      p5Canvas.style.height = '100%'
    }

    if (this.reducedMotion) this.instance.noLoop()
    return Promise.resolve()
  }

  setPreset(_preset: VisualizerPreset): void {
    // Single p5 preset today; no-op.
  }

  setIntensity(level: IntensityLevel): void {
    this.params = FLOW_FIELD_INTENSITY[level]
    if (this.reducedMotion) this.instance?.redraw()
  }

  setTrackPosition(elapsed: number, _progress: number): void {
    this.elapsed = elapsed
  }

  setVisible(visible: boolean): void {
    if (!this.instance) return
    if (visible && !this.reducedMotion) this.instance.loop()
    else this.instance.noLoop()
  }

  dispose(): void {
    this.instance?.remove()
    this.instance = null
  }
}

export const Backend = P5Backend
