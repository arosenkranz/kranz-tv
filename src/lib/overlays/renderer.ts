import type { OverlayMode } from './types'
import { CRT_SHADER } from './shaders/crt.glsl'
import { VHS_SHADER } from './shaders/vhs.glsl'
import { FILM_SHADER } from './shaders/film.glsl'
import { BROADCAST_SHADER } from './shaders/broadcast.glsl'

const SHADER_SOURCES: Partial<Record<OverlayMode, string>> = {
  crt: CRT_SHADER,
  vhs: VHS_SHADER,
  film: FILM_SHADER,
  broadcast: BROADCAST_SHADER,
}

// Fullscreen quad: 2 triangles covering clip space [-1, 1]
const VERTEX_SHADER_SOURCE = /* glsl */ `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[OverlayRenderer] Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentSource: string,
): WebGLProgram | null {
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!fragShader) return null

  const program = gl.createProgram()

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragShader)
  gl.linkProgram(program)
  gl.deleteShader(fragShader) // safe to delete after link

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[OverlayRenderer] Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  return program
}

export type OverlayRendererCallbacks = {
  onContextLost?: () => void
  onContextRestored?: () => void
}

export class OverlayRenderer {
  private readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private vertexShader: WebGLShader | null = null
  private readonly programs = new Map<OverlayMode, WebGLProgram | null>()
  private activeProgram: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private rafId: number | null = null
  private frameCount = 0
  private startTime: number = performance.now()
  private resizeObserver: ResizeObserver
  private resizePending = false
  private readonly callbacks: OverlayRendererCallbacks
  private destroyed = false

  constructor(canvas: HTMLCanvasElement, callbacks: OverlayRendererCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl) throw new Error('[OverlayRenderer] WebGL2 context creation failed')
    this.gl = gl

    this.initialize()

    // ResizeObserver owned by renderer — debounced via rAF flag
    this.resizeObserver = new ResizeObserver(() => {
      this.resizePending = true
    })
    this.resizeObserver.observe(canvas)

    // Context loss handling — MUST call e.preventDefault() or restored never fires
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)

    // Reset u_time when tab becomes visible again to prevent float precision loss
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private initialize(): void {
    const { gl } = this

    // Compile the shared vertex shader once
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    if (!vert) return
    this.vertexShader = vert

    // Eagerly compile all fragment shader programs
    for (const [mode, source] of Object.entries(SHADER_SOURCES) as [OverlayMode, string][]) {
      const program = createProgram(gl, vert, source)
      this.programs.set(mode, program)
    }

    // Fullscreen quad vertex buffer
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    // Initial size
    this.applyResize()
  }

  setMode(mode: OverlayMode): void {
    this.activeProgram = this.programs.get(mode) ?? null
  }

  private applyResize(): void {
    const { gl, canvas } = this
    const scale = window.devicePixelRatio
    // Use 0.5x DPR on mobile (smaller viewport = mobile heuristic)
    const isMobile = window.innerWidth < 768
    const effectiveScale = isMobile ? scale * 0.5 : scale
    const w = Math.round(canvas.clientWidth * effectiveScale)
    const h = Math.round(canvas.clientHeight * effectiveScale)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
  }

  start(): void {
    if (this.rafId !== null || this.destroyed) return
    this.startTime = performance.now()
    this.frameCount = 0
    this.loop()
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop)

    // Skip when tab is hidden
    if (document.hidden) return

    // Apply debounced resize
    if (this.resizePending) {
      this.applyResize()
      this.resizePending = false
    }

    // 30fps: skip every other frame
    this.frameCount++
    if (this.frameCount % 2 !== 0) return

    const { gl, activeProgram, canvas } = this
    if (!activeProgram) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }

    const u_time = (performance.now() - this.startTime) / 1000.0

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    gl.useProgram(activeProgram)

    // Bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const posLoc = gl.getAttribLocation(activeProgram, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Upload uniforms
    const timeLoc = gl.getUniformLocation(activeProgram, 'u_time')
    const resLoc = gl.getUniformLocation(activeProgram, 'u_resolution')
    gl.uniform1f(timeLoc, u_time)
    gl.uniform2f(resLoc, canvas.width, canvas.height)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault() // CRITICAL: without this, webglcontextrestored never fires on iOS Safari
    this.stop()
    this.callbacks.onContextLost?.()
  }

  private handleContextRestored = (): void => {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl) return
    this.gl = gl
    this.programs.clear()
    this.vertexShader = null
    this.buffer = null
    this.initialize()
    this.start()
    this.callbacks.onContextRestored?.()
  }

  private handleVisibilityChange = (): void => {
    if (!document.hidden) {
      // Reset u_time to prevent float32 precision loss after long background periods
      this.startTime = performance.now()
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stop()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)

    const { gl } = this
    for (const program of this.programs.values()) {
      if (program) gl.deleteProgram(program)
    }
    if (this.vertexShader) gl.deleteShader(this.vertexShader)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    this.programs.clear()
  }
}
