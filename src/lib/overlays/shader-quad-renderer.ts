// Fullscreen quad: 2 triangles covering clip space [-1, 1]
// Uses WebGL1/GLSL ES 1.0 syntax so existing overlay shaders work unchanged.
const VERTEX_SHADER_SOURCE = /* glsl */ `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    console.error(
      '[ShaderQuadRenderer] Shader compile error:',
      log ?? '(no log — driver returned null)',
      '\nSource (first 200 chars):',
      source.slice(0, 200),
    )
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentSource: string,
): WebGLProgram | null {
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!fragShader) return null

  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragShader)
  gl.linkProgram(program)
  gl.deleteShader(fragShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      '[ShaderQuadRenderer] Program link error:',
      gl.getProgramInfoLog(program),
    )
    gl.deleteProgram(program)
    return null
  }

  return program
}

export type ShaderQuadCallbacks = {
  onContextLost?: () => void
  onContextRestored?: () => void
}

export abstract class ShaderQuadRenderer {
  protected readonly canvas: HTMLCanvasElement
  protected gl: WebGLRenderingContext
  protected vertexShader: WebGLShader | null = null
  protected buffer: WebGLBuffer | null = null
  protected rafId: number | null = null
  protected startTime: number = performance.now()
  protected destroyed = false

  private resizeObserver: ResizeObserver
  private resizePending = false
  private readonly callbacks: ShaderQuadCallbacks

  constructor(canvas: HTMLCanvasElement, callbacks: ShaderQuadCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl)
      throw new Error('[ShaderQuadRenderer] WebGL context creation failed')
    this.gl = gl

    this.initBase()
    this.initSubclass()

    this.resizeObserver = new ResizeObserver(() => {
      this.resizePending = true
    })
    this.resizeObserver.observe(canvas)

    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private initBase(): void {
    const { gl } = this
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
    if (!vert) return
    this.vertexShader = vert

    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ])
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    this.applyResize()
  }

  protected applyResize(): void {
    const { gl, canvas } = this
    const scale = window.devicePixelRatio
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

  protected abstract initSubclass(): void
  protected abstract renderFrame(elapsedSeconds: number): void
  protected abstract teardownSubclass(): void
  protected abstract reinitSubclass(): void

  start(): void {
    if (this.rafId !== null || this.destroyed) return
    this.startTime = performance.now()
    this.loop()
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  protected loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop)
    if (document.hidden) return

    if (this.resizePending) {
      this.applyResize()
      this.resizePending = false
    }

    const elapsedSeconds = (performance.now() - this.startTime) / 1000.0
    this.renderFrame(elapsedSeconds)
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault()
    this.stop()
    this.callbacks.onContextLost?.()
  }

  private handleContextRestored = (): void => {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl) return
    this.gl = gl as WebGLRenderingContext
    this.vertexShader = null
    this.buffer = null
    this.reinitSubclass()
    this.initBase()
    this.initSubclass()
    this.start()
    this.callbacks.onContextRestored?.()
  }

  private handleVisibilityChange = (): void => {
    if (!document.hidden) {
      this.startTime = performance.now()
    }
  }

  dispose(): void {
    this.destroyed = true
    this.stop()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    )
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    )

    const { gl } = this
    this.teardownSubclass()
    if (this.vertexShader) gl.deleteShader(this.vertexShader)
    if (this.buffer) gl.deleteBuffer(this.buffer)

    // Release WebGL context to free GPU resources
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}
