import {
  ShaderQuadRenderer,
  createProgram,
} from '~/lib/overlays/shader-quad-renderer'
import type { ShaderQuadCallbacks } from '~/lib/overlays/shader-quad-renderer'
import type { VisualizerPreset, IntensityLevel } from './types'
import { INTENSITY_MAP, DEFAULT_INTENSITY, PRESET_META } from './types'
import { frameIntervalMsFor, dprScaleFor } from './perf-gates'
import { SPECTRUM_SHADER } from './shaders/spectrum.glsl'
import { KALEIDOSCOPE_SHADER } from './shaders/kaleidoscope.glsl'
import { PLASMA_SHADER } from './shaders/plasma.glsl'
import { STARFIELD_SHADER } from './shaders/starfield.glsl'
import { OP_ART_SHADER } from './shaders/op-art.glsl'
import { LAVA_LAMP_SHADER } from './shaders/lava-lamp.glsl'

interface VisualizerUniforms {
  readonly posLoc: number
  readonly timeLoc: WebGLUniformLocation | null
  readonly resLoc: WebGLUniformLocation | null
  readonly trackElapsedLoc: WebGLUniformLocation | null
  readonly trackProgressLoc: WebGLUniformLocation | null
  readonly intensityLoc: WebGLUniformLocation | null
}

const SHADER_SOURCES: Record<VisualizerPreset, string> = {
  spectrum: SPECTRUM_SHADER,
  kaleidoscope: KALEIDOSCOPE_SHADER,
  plasma: PLASMA_SHADER,
  starfield: STARFIELD_SHADER,
  'op-art': OP_ART_SHADER,
  'lava-lamp': LAVA_LAMP_SHADER,
}

export type VisualizerRendererCallbacks = ShaderQuadCallbacks & {
  onStart?: (preset: VisualizerPreset) => void
  onFallback?: (reason: 'webgl2-unavailable' | 'context-lost') => void
}

export class VisualizerRenderer extends ShaderQuadRenderer {
  // `declare` tells TypeScript about the type without emitting a JS field
  // initializer. This is required because initSubclass() sets these from the
  // base constructor — a `= value` or bare `field!` declaration would emit
  // `this.field = undefined` after super() returns and wipe out the values.
  declare private programs: Map<VisualizerPreset, WebGLProgram | null>
  declare private uniformCache: Map<VisualizerPreset, VisualizerUniforms>
  declare private activeProgram: WebGLProgram | null
  declare private activeUniforms: VisualizerUniforms | null
  private trackElapsed = 0
  private trackProgress = 0
  private intensity: number = INTENSITY_MAP[DEFAULT_INTENSITY]
  private reducedMotion: boolean
  private activePreset: VisualizerPreset = 'spectrum'
  private readonly vizCallbacks: VisualizerRendererCallbacks

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: VisualizerRendererCallbacks = {},
  ) {
    super(canvas, callbacks)
    this.vizCallbacks = callbacks
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    mql.addEventListener('change', (e) => {
      this.reducedMotion = e.matches
      if (e.matches) this.stop()
      else this.start()
    })
  }

  protected initSubclass(): void {
    this.programs = new Map()
    this.uniformCache = new Map()
    this.activeProgram = null
    this.activeUniforms = null

    const { gl, vertexShader } = this
    if (!vertexShader) return

    for (const [preset, source] of Object.entries(SHADER_SOURCES) as [
      VisualizerPreset,
      string,
    ][]) {
      const program = createProgram(gl, vertexShader, source)
      this.programs.set(preset, program)
      if (program) {
        this.uniformCache.set(preset, {
          posLoc: gl.getAttribLocation(program, 'a_position'),
          timeLoc: gl.getUniformLocation(program, 'u_time'),
          resLoc: gl.getUniformLocation(program, 'u_resolution'),
          trackElapsedLoc: gl.getUniformLocation(program, 'u_trackElapsed'),
          trackProgressLoc: gl.getUniformLocation(program, 'u_trackProgress'),
          intensityLoc: gl.getUniformLocation(program, 'u_intensity'),
        })
      }
    }

    // Default to spectrum
    this.activeProgram = this.programs.get('spectrum') ?? null
    this.activeUniforms = this.uniformCache.get('spectrum') ?? null
  }

  protected reinitSubclass(): void {
    this.programs.clear()
    this.uniformCache.clear()
    this.activeProgram = null
    this.activeUniforms = null
  }

  protected teardownSubclass(): void {
    const { gl } = this
    for (const program of this.programs.values()) {
      if (program) gl.deleteProgram(program)
    }
    this.programs.clear()
    this.uniformCache.clear()
  }

  setPreset(preset: VisualizerPreset): void {
    this.activePreset = preset
    this.activeProgram = this.programs.get(preset) ?? null
    this.activeUniforms = this.uniformCache.get(preset) ?? null
    this.minFrameIntervalMs = frameIntervalMsFor(PRESET_META[preset].costHint)
  }

  setTrackPosition(elapsedSeconds: number, progress: number): void {
    this.trackElapsed = elapsedSeconds
    this.trackProgress = Math.max(0, Math.min(1, progress))
  }

  setIntensityLevel(level: IntensityLevel): void {
    this.intensity = INTENSITY_MAP[level]
  }

  start(): void {
    if (this.reducedMotion) return
    super.start()
    this.vizCallbacks.onStart?.(this.activePreset)
  }

  protected currentDprScale(): number {
    // `applyResize()` runs during the base constructor (via super()), before this
    // subclass's field initializers set `activePreset`. It is statically typed
    // non-nullable but is genuinely `undefined` at that point — fall back to
    // 'spectrum'. See the `declare` note above for the ordering details.
    const preset: VisualizerPreset =
      (this.activePreset as VisualizerPreset | undefined) ?? 'spectrum'
    return dprScaleFor(PRESET_META[preset].costHint, {
      dpr: window.devicePixelRatio,
      isMobile: window.innerWidth < 768,
    })
  }

  protected renderFrame(elapsedSeconds: number): void {
    const { gl, activeProgram, canvas, buffer } = this

    if (!activeProgram) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }

    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )

    gl.useProgram(activeProgram)

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const posLoc = this.activeUniforms?.posLoc ?? 0
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const locs = this.activeUniforms
    if (locs) {
      gl.uniform1f(locs.timeLoc, elapsedSeconds)
      gl.uniform2f(locs.resLoc, canvas.width, canvas.height)
      gl.uniform1f(locs.trackElapsedLoc, this.trackElapsed)
      gl.uniform1f(locs.trackProgressLoc, this.trackProgress)
      gl.uniform1f(locs.intensityLoc, this.intensity)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
