import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ShaderQuadRenderer } from '~/lib/overlays/shader-quad-renderer'

// WebGL2 mock with FBO-related spies. createFramebuffer/createTexture return
// distinct truthy objects so tests can assert identity (which texture is the
// "previous frame") across swaps.
function makeGl() {
  let texSeq = 0
  let fboSeq = 0
  return {
    createShader: vi.fn().mockReturnValue({}),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getShaderInfoLog: vi.fn().mockReturnValue(''),
    createProgram: vi.fn().mockReturnValue({}),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getProgramInfoLog: vi.fn().mockReturnValue(''),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn().mockReturnValue({}),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    viewport: vi.fn(),
    deleteBuffer: vi.fn(),
    getExtension: vi.fn().mockReturnValue({ loseContext: vi.fn() }),
    // FBO plumbing
    createTexture: vi.fn(() => ({ tex: ++texSeq })),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    deleteTexture: vi.fn(),
    createFramebuffer: vi.fn(() => ({ fbo: ++fboSeq })),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    deleteFramebuffer: vi.fn(),
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88b4,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    TEXTURE_2D: 0x0de1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
  } as unknown as WebGL2RenderingContext
}

function makeCanvas(gl: WebGL2RenderingContext): HTMLCanvasElement {
  const canvas = {
    getContext: vi.fn().mockReturnValue(gl),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    clientWidth: 800,
    clientHeight: 600,
    width: 0,
    height: 0,
  } as unknown as HTMLCanvasElement

  vi.spyOn(document, 'addEventListener').mockImplementation(vi.fn())
  vi.spyOn(document, 'removeEventListener').mockImplementation(vi.fn())
  ;(window as unknown as Record<string, unknown>).ResizeObserver = vi.fn(
    () => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    }),
  )

  return canvas
}

// Concrete subclass that opts into feedback.
class FeedbackTestRenderer extends ShaderQuadRenderer {
  protected initSubclass(): void {
    this.enableFeedback()
  }
  protected renderFrame(): void {}
  protected teardownSubclass(): void {}
  protected reinitSubclass(): void {}

  // Test accessors.
  prevTexture(): WebGLTexture | null {
    return this.previousFrameTexture()
  }
  swap(): void {
    this.swapFeedbackTargets()
  }
}

// Concrete subclass that does NOT opt into feedback.
class PlainTestRenderer extends ShaderQuadRenderer {
  protected initSubclass(): void {}
  protected renderFrame(): void {}
  protected teardownSubclass(): void {}
  protected reinitSubclass(): void {}

  prevTexture(): WebGLTexture | null {
    return this.previousFrameTexture()
  }
}

describe('ShaderQuadRenderer feedback FBO', () => {
  let gl: WebGL2RenderingContext

  beforeEach(() => {
    gl = makeGl()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allocates exactly 2 framebuffers + 2 textures when feedback is enabled', () => {
    const r = new FeedbackTestRenderer(makeCanvas(gl))
    expect(gl.createFramebuffer).toHaveBeenCalledTimes(2)
    expect(gl.createTexture).toHaveBeenCalledTimes(2)
    r.dispose()
  })

  it('previousFrameTexture() returns a non-null texture after enabling', () => {
    const r = new FeedbackTestRenderer(makeCanvas(gl))
    expect(r.prevTexture()).not.toBeNull()
    r.dispose()
  })

  it('creates 0 framebuffers when feedback is not enabled (opt-in)', () => {
    const r = new PlainTestRenderer(makeCanvas(gl))
    expect(gl.createFramebuffer).not.toHaveBeenCalled()
    expect(r.prevTexture()).toBeNull()
    r.dispose()
  })

  it('swapFeedbackTargets() flips which texture previousFrameTexture() returns', () => {
    const r = new FeedbackTestRenderer(makeCanvas(gl))
    const first = r.prevTexture()
    r.swap()
    const second = r.prevTexture()
    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    r.swap()
    expect(r.prevTexture()).toBe(first)
    r.dispose()
  })

  it('frees both textures + framebuffers on dispose', () => {
    const r = new FeedbackTestRenderer(makeCanvas(gl))
    r.dispose()
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2)
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(2)
  })
})
