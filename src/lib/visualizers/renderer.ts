import {
  ShaderQuadRenderer,
  createProgram,
  compileShader,
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
import { ACID_MELT_SHADER } from './shaders/acid-melt.glsl'
import { FRACTAL_VOYAGE_SHADER } from './shaders/fractal-voyage.glsl'
import { LIQUID_INK_SHADER } from './shaders/liquid-ink.glsl'
import {
  PRESENT_VERTEX_SHADER,
  PRESENT_FRAGMENT_SHADER,
} from './shaders/present.glsl'

interface VisualizerUniforms {
  readonly posLoc: number
  readonly timeLoc: WebGLUniformLocation | null
  readonly resLoc: WebGLUniformLocation | null
  readonly trackElapsedLoc: WebGLUniformLocation | null
  readonly trackProgressLoc: WebGLUniformLocation | null
  readonly intensityLoc: WebGLUniformLocation | null
  readonly prevFrameLoc: WebGLUniformLocation | null
  readonly hasPrevLoc: WebGLUniformLocation | null
}

const SHADER_SOURCES: Record<VisualizerPreset, string> = {
  spectrum: SPECTRUM_SHADER,
  kaleidoscope: KALEIDOSCOPE_SHADER,
  plasma: PLASMA_SHADER,
  starfield: STARFIELD_SHADER,
  'op-art': OP_ART_SHADER,
  'lava-lamp': LAVA_LAMP_SHADER,
  'fractal-voyage': FRACTAL_VOYAGE_SHADER,
  'liquid-ink': LIQUID_INK_SHADER,
  'acid-melt': ACID_MELT_SHADER,
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
  declare private presentProgram: WebGLProgram | null
  declare private presentTexLoc: WebGLUniformLocation | null
  declare private presentPosLoc: number
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
          prevFrameLoc: gl.getUniformLocation(program, 'u_prevFrame'),
          hasPrevLoc: gl.getUniformLocation(program, 'u_hasPrev'),
        })
      }
    }

    // Default to spectrum
    this.activeProgram = this.programs.get('spectrum') ?? null
    this.activeUniforms = this.uniformCache.get('spectrum') ?? null

    // Internal present program (blit FBO → screen). Locations cached once here.
    const presentVert = compileShader(gl, gl.VERTEX_SHADER, PRESENT_VERTEX_SHADER)
    this.presentProgram = presentVert
      ? createProgram(gl, presentVert, PRESENT_FRAGMENT_SHADER)
      : null
    if (presentVert) gl.deleteShader(presentVert)
    this.presentTexLoc = this.presentProgram
      ? gl.getUniformLocation(this.presentProgram, 'u_tex')
      : null
    this.presentPosLoc = this.presentProgram
      ? gl.getAttribLocation(this.presentProgram, 'a_position')
      : 0

    // Allocate feedback FBOs once for the renderer's lifetime. Modest VRAM;
    // avoids context churn when switching into/out of Acid Melt. Harmless for
    // non-feedback presets (they never sample the targets).
    this.enableFeedback()
  }

  protected reinitSubclass(): void {
    this.programs.clear()
    this.uniformCache.clear()
    this.activeProgram = null
    this.activeUniforms = null
    this.presentProgram = null
    this.presentTexLoc = null
    this.presentPosLoc = 0
  }

  protected teardownSubclass(): void {
    const { gl } = this
    for (const program of this.programs.values()) {
      if (program) gl.deleteProgram(program)
    }
    this.programs.clear()
    this.uniformCache.clear()
    if (this.presentProgram) gl.deleteProgram(this.presentProgram)
    this.presentProgram = null
  }

  setPreset(preset: VisualizerPreset): void {
    const prevPreset = this.activePreset
    this.activePreset = preset
    this.activeProgram = this.programs.get(preset) ?? null
    this.activeUniforms = this.uniformCache.get(preset) ?? null
    this.minFrameIntervalMs = frameIntervalMsFor(PRESET_META[preset].costHint)
    // If the cost class changed, the DPR ceiling changed — reallocate the
    // backing store (and feedback FBOs) at the new scale immediately, rather
    // than waiting for an incidental resize (which would leave a high-cost
    // preset rendering at the previous preset's larger scale).
    if (PRESET_META[preset].costHint !== PRESET_META[prevPreset].costHint) {
      this.applyResize()
    }
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

  // Bind the quad buffer to a program's position attribute and set the five
  // standard uniforms. Shared by both render paths.
  private bindQuadAndUniforms(
    program: WebGLProgram,
    locs: VisualizerUniforms | null,
    elapsedSeconds: number,
  ): void {
    const { gl, canvas, buffer } = this
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const posLoc = locs?.posLoc ?? 0
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    if (locs) {
      gl.uniform1f(locs.timeLoc, elapsedSeconds)
      gl.uniform2f(locs.resLoc, canvas.width, canvas.height)
      gl.uniform1f(locs.trackElapsedLoc, this.trackElapsed)
      gl.uniform1f(locs.trackProgressLoc, this.trackProgress)
      gl.uniform1f(locs.intensityLoc, this.intensity)
    }
  }

  // Two-pass feedback path: render the shader into the write FBO (shader owns
  // accumulation, blend disabled), then blit it to screen (true copy, blend
  // disabled). Present BEFORE swap (load-bearing — do not reorder).
  private renderFeedback(
    program: WebGLProgram,
    locs: VisualizerUniforms | null,
    elapsedSeconds: number,
  ): void {
    const { gl } = this
    // ── Pass 1: render the feedback shader into the write FBO.
    this.bindFeedbackWriteTarget()
    gl.disable(gl.BLEND)
    this.bindQuadAndUniforms(program, locs, elapsedSeconds)
    if (locs) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.previousFrameTexture())
      gl.uniform1i(locs.prevFrameLoc, 0)
      gl.uniform1f(locs.hasPrevLoc, 1)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // ── Pass 2: present the just-written target to screen (true copy).
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.disable(gl.BLEND)
    gl.useProgram(this.presentProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(this.presentPosLoc)
    gl.vertexAttribPointer(this.presentPosLoc, 2, gl.FLOAT, false, 0, 0)
    gl.activeTexture(gl.TEXTURE0)
    // The write target became the read target's sibling; present the texture
    // we just rendered into (index = readIndex ^ 1), then swap.
    gl.bindTexture(gl.TEXTURE_2D, this.writeFrameTexture())
    gl.uniform1i(this.presentTexLoc, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Present BEFORE swap (load-bearing — do not reorder).
    this.swapFeedbackTargets()
  }

  protected renderFrame(elapsedSeconds: number): void {
    const { gl, activeProgram } = this

    if (!activeProgram) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }

    const locs = this.activeUniforms
    const feedback =
      PRESET_META[this.activePreset].feedback &&
      this.presentProgram !== null &&
      this.previousFrameTexture() !== null

    if (feedback) {
      this.renderFeedback(activeProgram, locs, elapsedSeconds)
      return
    }

    // ── Single-pass path (all non-feedback presets) ──
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )
    this.bindQuadAndUniforms(activeProgram, locs, elapsedSeconds)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
