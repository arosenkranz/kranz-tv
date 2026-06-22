// Fullscreen quad: 2 triangles covering clip space [-1, 1]. GLSL ES 3.00.
const VERTEX_SHADER_SOURCE = /* glsl */ `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    console.warn(
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
  protected gl: WebGL2RenderingContext
  protected vertexShader: WebGLShader | null = null
  protected buffer: WebGLBuffer | null = null
  protected rafId: number | null = null
  protected startTime: number = performance.now()
  protected destroyed = false

  // Minimum ms between rendered frames; 0 = uncapped (every rAF tick). Subclasses
  // set this from the active preset's cost hint.
  protected minFrameIntervalMs = 0
  // Timestamp of the last *rendered* frame (not every rAF tick — ticks skipped
  // by the FPS cap don't update this).
  private lastFrameTime = 0

  private resizeObserver: ResizeObserver
  private resizePending = false
  private readonly callbacks: ShaderQuadCallbacks

  // Optional ping-pong feedback framebuffers — opt-in via enableFeedback().
  // When disabled (default), all the FBO machinery below is inert.
  private feedbackEnabled = false
  private fbos: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [
    null,
    null,
  ]
  private fboTextures: [WebGLTexture | null, WebGLTexture | null] = [null, null]
  private fboReadIndex = 0

  constructor(canvas: HTMLCanvasElement, callbacks: ShaderQuadCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    })
    if (!gl)
      throw new Error('[ShaderQuadRenderer] WebGL2 context creation failed')
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
    if (!vert) throw new Error('[ShaderQuadRenderer] Vertex shader compilation failed')
    this.vertexShader = vert

    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ])
    this.buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    this.applyResize()
  }

  // Subclasses override to scale resolution by the active preset's cost.
  // Default: device DPR with mobile halving (preserves prior behavior).
  protected currentDprScale(): number {
    const scale = window.devicePixelRatio
    return window.innerWidth < 768 ? scale * 0.5 : scale
  }

  protected applyResize(): void {
    const { gl, canvas } = this
    const effectiveScale = this.currentDprScale()
    const w = Math.round(canvas.clientWidth * effectiveScale)
    const h = Math.round(canvas.clientHeight * effectiveScale)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    // No-op when feedback is disabled (guarded inside). When enabled, the
    // ping-pong targets must match the new canvas size, so reallocate.
    // Reallocating clears both targets, so a feedback shader sees an empty
    // previous frame for one frame after a resize (rare, invisible during a trail).
    this.allocateFeedbackTargets()
  }

  // Subclasses call this in initSubclass() to opt into previous-frame feedback.
  protected enableFeedback(): void {
    this.feedbackEnabled = true
    this.allocateFeedbackTargets()
  }

  // PR 2 (before any consumer samples the FBOs): add checkFramebufferStatus()
  // === FRAMEBUFFER_COMPLETE validation with graceful disable, and guard the
  // 0×0-canvas case (texImage2D with 0 dims produces incomplete FBOs).
  private allocateFeedbackTargets(): void {
    const { gl, canvas } = this
    if (!this.feedbackEnabled) return
    // Reset parity so the ping-pong starts from a known state on every
    // (re)allocation — this field otherwise survives a full GL-context rebuild
    // (on webglcontextrestored, initSubclass re-runs enableFeedback→allocate).
    this.fboReadIndex = 0
    this.freeFeedbackTargets()
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        canvas.width,
        canvas.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
      )
      this.fboTextures[i] = tex
      this.fbos[i] = fbo
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private freeFeedbackTargets(): void {
    const { gl } = this
    for (let i = 0; i < 2; i++) {
      if (this.fboTextures[i]) gl.deleteTexture(this.fboTextures[i])
      if (this.fbos[i]) gl.deleteFramebuffer(this.fbos[i])
      this.fboTextures[i] = null
      this.fbos[i] = null
    }
  }

  // The texture holding the previous rendered frame (for the subclass to bind
  // as a sampler). Null when feedback is disabled.
  protected previousFrameTexture(): WebGLTexture | null {
    return this.feedbackEnabled ? this.fboTextures[this.fboReadIndex] : null
  }

  // Subclasses that use feedback call this to render INTO the write target,
  // then the base presents it to screen and swaps. PR 1 exposes the primitives;
  // the Acid Melt preset (PR 2) wires the actual draw sequence.
  // Caller owns presenting: after rendering the feedback pass, the consumer must
  // rebind the default framebuffer (gl.bindFramebuffer(FRAMEBUFFER, null)) before
  // drawing to screen, then call swapFeedbackTargets(). The bound target is
  // undefined after dispose/resize.
  protected bindFeedbackWriteTarget(): void {
    if (!this.feedbackEnabled) return
    const writeIndex = this.fboReadIndex ^ 1
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbos[writeIndex])
  }

  protected swapFeedbackTargets(): void {
    if (!this.feedbackEnabled) return
    this.fboReadIndex ^= 1
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

    const now = performance.now()
    if (
      this.minFrameIntervalMs > 0 &&
      now - this.lastFrameTime < this.minFrameIntervalMs
    ) {
      return
    }
    this.lastFrameTime = now

    if (this.resizePending) {
      this.applyResize()
      this.resizePending = false
    }

    const elapsedSeconds = (now - this.startTime) / 1000.0
    this.renderFrame(elapsedSeconds)
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault()
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
    this.vertexShader = null
    this.buffer = null
    // On restore, old-context FBO/texture handles are abandoned (the driver
    // reclaims them on context loss); a later freeFeedbackTargets deletes
    // against the new context, which is a spec no-op for foreign handles.
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
    this.freeFeedbackTargets()
    if (this.vertexShader) gl.deleteShader(this.vertexShader)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    // Note: intentionally NOT calling WEBGL_lose_context.loseContext() here.
    // Doing so permanently poisons the canvas element — in React Strict Mode the
    // effect cleanup fires before remount, so the second getContext('webgl2') call
    // returns null and triggers the hasFallback path. The browser reclaims GPU
    // resources when the canvas is removed from the DOM anyway.
  }
}
