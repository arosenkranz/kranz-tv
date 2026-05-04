import { ShaderQuadRenderer, createProgram } from '~/lib/overlays/shader-quad-renderer'
import type { ShaderQuadCallbacks } from '~/lib/overlays/shader-quad-renderer'
import type { VisualizerPreset } from './types'
import { SPECTRUM_SHADER } from './shaders/spectrum.glsl'

interface VisualizerUniforms {
  readonly timeLoc: WebGLUniformLocation | null
  readonly resLoc: WebGLUniformLocation | null
  readonly trackElapsedLoc: WebGLUniformLocation | null
  readonly trackProgressLoc: WebGLUniformLocation | null
}

const SHADER_SOURCES: Record<VisualizerPreset, string> = {
  spectrum: SPECTRUM_SHADER,
  // Remaining presets use spectrum as fallback until their shaders are authored
  particles: SPECTRUM_SHADER,
  kaleidoscope: SPECTRUM_SHADER,
  oscilloscope: SPECTRUM_SHADER,
}

export type VisualizerRendererCallbacks = ShaderQuadCallbacks

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
  private reducedMotion: boolean

  constructor(canvas: HTMLCanvasElement, callbacks: VisualizerRendererCallbacks = {}) {
    super(canvas, callbacks)
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

    for (const [preset, source] of Object.entries(SHADER_SOURCES) as [VisualizerPreset, string][]) {
      const program = createProgram(gl, vertexShader, source)
      this.programs.set(preset, program)
      if (program) {
        this.uniformCache.set(preset, {
          timeLoc: gl.getUniformLocation(program, 'u_time'),
          resLoc: gl.getUniformLocation(program, 'u_resolution'),
          trackElapsedLoc: gl.getUniformLocation(program, 'u_trackElapsed'),
          trackProgressLoc: gl.getUniformLocation(program, 'u_trackProgress'),
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
    for (const program of (this.programs?.values() ?? [])) {
      if (program) gl.deleteProgram(program)
    }
    this.programs?.clear()
    this.uniformCache?.clear()
  }

  setPreset(preset: VisualizerPreset): void {
    this.activeProgram = this.programs.get(preset) ?? null
    this.activeUniforms = this.uniformCache.get(preset) ?? null
  }

  setTrackPosition(elapsedSeconds: number, progress: number): void {
    this.trackElapsed = elapsedSeconds
    this.trackProgress = Math.max(0, Math.min(1, progress))
  }

  start(): void {
    if (this.reducedMotion) return
    super.start()
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
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    gl.useProgram(activeProgram)

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const posLoc = gl.getAttribLocation(activeProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const locs = this.activeUniforms
    if (locs) {
      gl.uniform1f(locs.timeLoc, elapsedSeconds)
      gl.uniform2f(locs.resLoc, canvas.width, canvas.height)
      gl.uniform1f(locs.trackElapsedLoc, this.trackElapsed)
      gl.uniform1f(locs.trackProgressLoc, this.trackProgress)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
