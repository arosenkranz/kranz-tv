import * as THREE from 'three'
import type {
  VisualizerPreset,
  IntensityLevel,
} from '../types'
import { frameIntervalMsFor, dprScaleFor } from '../perf-gates'
import { PRESET_META } from '../types'
import type { VisualizerBackend, BackendMountOpts } from '../backend'
import type { Scene } from './scene'
import { THREE_SCENES  } from './three/registry'
import type {ThreeSceneEnv} from './three/registry';

class ThreeBackend implements VisualizerBackend {
  private renderer: THREE.WebGLRenderer | null = null
  private scene: Scene | null = null
  private rafId: number | null = null
  private lastFrame = 0
  private minIntervalMs = frameIntervalMsFor('high')
  private elapsed = 0
  private progress = 0
  private reducedMotion = false
  private env: ThreeSceneEnv = { tier: 'desktop' }

  mount(canvas: HTMLCanvasElement, opts: BackendMountOpts): Promise<void> {
    this.env = { tier: opts.tier }
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    })
    const scale = dprScaleFor('high', {
      dpr: window.devicePixelRatio,
      isMobile: opts.tier === 'mobile',
    })
    renderer.setPixelRatio(scale)
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer = renderer
    this.setPreset(opts.preset)
    this.scene?.setIntensity(opts.intensity)
    if (this.reducedMotion) this.renderOnce()
    else this.startLoop()
    return Promise.resolve()
  }

  private buildScene(preset: VisualizerPreset): void {
    const entry = THREE_SCENES[preset]
    if (!entry || !this.renderer) return
    this.scene?.exit?.()
    this.scene?.dispose()
    this.scene = entry.create(this.renderer, this.env)
    this.scene.enter?.()
  }

  setPreset(preset: VisualizerPreset): void {
    if (PRESET_META[preset].backend !== 'three') return
    this.buildScene(preset)
    if (this.rafId === null) this.renderOnce() // one-shot while paused
  }

  setIntensity(level: IntensityLevel): void {
    this.scene?.setIntensity(level)
    if (this.rafId === null) this.renderOnce()
  }

  setTrackPosition(elapsed: number, progress: number): void {
    this.elapsed = elapsed
    this.progress = progress
  }

  setVisible(visible: boolean): void {
    if (visible && !this.reducedMotion) this.startLoop()
    else this.stopLoop()
  }

  private renderOnce(): void {
    this.scene?.update(this.elapsed, this.progress)
  }

  private startLoop(): void {
    if (this.rafId !== null) return
    const tick = (now: number): void => {
      this.rafId = requestAnimationFrame(tick)
      if (document.hidden) return
      if (now - this.lastFrame < this.minIntervalMs) return
      this.lastFrame = now
      this.scene?.update(this.elapsed, this.progress)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopLoop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  dispose(): void {
    this.stopLoop()
    this.scene?.exit?.()
    this.scene?.dispose()
    this.scene = null
    const r = this.renderer
    this.renderer = null
    if (r) {
      r.dispose()
      r.forceContextLoss()
    }
  }
}

// Backend-agnostic entry point for the host's dynamic import.
export const Backend = ThreeBackend
