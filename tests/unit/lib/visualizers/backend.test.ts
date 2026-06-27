import { describe, it, expect, vi, afterEach } from 'vitest'
import { ShaderQuadBackend } from '~/lib/visualizers/backend'
import { VisualizerRenderer } from '~/lib/visualizers/renderer'

// Minimal WebGL2 mock sufficient for constructing a VisualizerRenderer.
// Mirrors the mock in renderer.test.ts — replicated here because that file
// does not export its helpers.
function makeGl() {
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
    getUniformLocation: vi.fn().mockReturnValue({}),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendFuncSeparate: vi.fn(),
    useProgram: vi.fn(),
    getAttribLocation: vi.fn().mockReturnValue(0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    drawArrays: vi.fn(),
    deleteBuffer: vi.fn(),
    uniform1i: vi.fn(),
    disable: vi.fn(),
    activeTexture: vi.fn(),
    // Feedback FBO surface — enableFeedback() runs in the constructor now.
    createTexture: vi.fn().mockReturnValue({}),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    deleteTexture: vi.fn(),
    createFramebuffer: vi.fn().mockReturnValue({}),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    deleteFramebuffer: vi.fn(),
    checkFramebufferStatus: vi.fn().mockReturnValue(0x8cd5),
    getExtension: vi.fn().mockReturnValue({ loseContext: vi.fn() }),
    COLOR_BUFFER_BIT: 0x4000,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88b4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    BLEND: 0x0be2,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    TEXTURE0: 0x84c0,
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
    FRAMEBUFFER_COMPLETE: 0x8cd5,
  } as unknown as WebGL2RenderingContext
}

function makeMockCanvas(): HTMLCanvasElement {
  const gl = makeGl()
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

  ;(window as unknown as Record<string, unknown>).matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

  return canvas
}

describe('ShaderQuadBackend', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('implements the VisualizerBackend interface methods', () => {
    const b = new ShaderQuadBackend()
    expect(typeof b.mount).toBe('function')
    expect(typeof b.setPreset).toBe('function')
    expect(typeof b.setTrackPosition).toBe('function')
    expect(typeof b.setIntensity).toBe('function')
    expect(typeof b.setVisible).toBe('function')
    expect(typeof b.dispose).toBe('function')
  })

  it('dispose before mount is a no-op (no throw)', () => {
    const b = new ShaderQuadBackend()
    expect(() => b.dispose()).not.toThrow()
  })

  it('setVisible(false) stops the underlying renderer', async () => {
    const stopSpy = vi.spyOn(VisualizerRenderer.prototype, 'stop')
    const b = new ShaderQuadBackend()
    const canvas = makeMockCanvas()
    await b.mount(canvas, { preset: 'spectrum', intensity: 'normal', tier: 'desktop' })
    b.setVisible(false)
    expect(stopSpy).toHaveBeenCalled()
    b.dispose()
    stopSpy.mockRestore()
  })
})

describe('ShaderQuadBackend callbacks', () => {
  it('compiles the generalized mount opts signature (tier + BackendCallbacks)', () => {
    // jsdom has no WebGL2; mount throws synchronously. We assert that the
    // backend exposes the generalized mount signature with tier + BackendCallbacks,
    // and that mount throws when WebGL2 is unavailable. The onFallback callback is
    // never fired in this environment (mount throws before any callback invocation).
    const backend = new ShaderQuadBackend()
    const onFallback = vi.fn()
    const canvas = document.createElement('canvas')
    // mount throws synchronously (no webgl2 in jsdom).
    expect(() =>
      backend.mount(canvas, {
        preset: 'spectrum',
        intensity: 'normal',
        tier: 'desktop',
        callbacks: { onStart: () => {}, onFallback },
      }),
    ).toThrow()
    // Confirm onFallback was never called (mount threw before any callback fired).
    expect(onFallback).not.toHaveBeenCalled()
  })
})
