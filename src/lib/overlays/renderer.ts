import type { OverlayMode } from './types'
import { CRT_SHADER } from './shaders/crt.glsl'
import { VHS_SHADER } from './shaders/vhs.glsl'
import { FILM_SHADER } from './shaders/film.glsl'
import { BROADCAST_SHADER } from './shaders/broadcast.glsl'
import { FILMSTRIP_SHADER } from './shaders/filmstrip.glsl'
import { ShaderQuadRenderer, createProgram } from './shader-quad-renderer'
import type { ShaderQuadCallbacks } from './shader-quad-renderer'

const SHADER_SOURCES: Partial<Record<OverlayMode, string>> = {
  crt: CRT_SHADER,
  vhs: VHS_SHADER,
  film: FILM_SHADER,
  broadcast: BROADCAST_SHADER,
  filmstrip: FILMSTRIP_SHADER,
}

interface CachedUniforms {
  readonly timeLoc: WebGLUniformLocation | null
  readonly resLoc: WebGLUniformLocation | null
}

export type OverlayRendererCallbacks = ShaderQuadCallbacks

export class OverlayRenderer extends ShaderQuadRenderer {
  // `declare` prevents JS field initializer emission so initSubclass() values survive.
  declare private programs: Map<OverlayMode, WebGLProgram | null>
  declare private uniformCache: Map<OverlayMode, CachedUniforms>
  declare private activeProgram: WebGLProgram | null
  declare private activeUniforms: CachedUniforms | null
  private frameCount = 0

  constructor(canvas: HTMLCanvasElement, callbacks: OverlayRendererCallbacks = {}) {
    super(canvas, callbacks)
  }

  protected initSubclass(): void {
    this.programs = new Map()
    this.uniformCache = new Map()
    this.activeProgram = null
    this.activeUniforms = null
    const { gl, vertexShader } = this
    if (!vertexShader) return

    for (const [mode, source] of Object.entries(SHADER_SOURCES) as [OverlayMode, string][]) {
      const program = createProgram(gl, vertexShader, source)
      this.programs.set(mode, program)
      if (program) {
        this.uniformCache.set(mode, {
          timeLoc: gl.getUniformLocation(program, 'u_time'),
          resLoc: gl.getUniformLocation(program, 'u_resolution'),
        })
      }
    }
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

  setMode(mode: OverlayMode): void {
    this.activeProgram = this.programs.get(mode) ?? null
    this.activeUniforms = this.uniformCache.get(mode) ?? null
  }

  protected renderFrame(elapsedSeconds: number): void {
    const { gl, activeProgram, canvas, buffer } = this

    // 30fps: skip every other frame
    this.frameCount++
    if (this.frameCount % 2 !== 0) return

    if (!activeProgram) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }

    gl.clearColor(0, 0, 0, 0)
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
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  /** @deprecated Use dispose() from the base class */
  destroy(): void {
    this.dispose()
  }
}
