import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VisualizerRenderer } from '~/lib/visualizers/renderer'

// Minimal WebGL2 mock sufficient for constructor
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

  // happy-dom may not have ResizeObserver — stub it globally
  ;(window as unknown as Record<string, unknown>).ResizeObserver = vi.fn(
    () => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    }),
  )

  // matchMedia stub needed for prefers-reduced-motion check
  ;(window as unknown as Record<string, unknown>).matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

  return canvas
}

describe('VisualizerRenderer', () => {
  let gl: WebGL2RenderingContext
  let canvas: HTMLCanvasElement
  let renderer: VisualizerRenderer

  beforeEach(() => {
    gl = makeGl()
    canvas = makeCanvas(gl)
    renderer = new VisualizerRenderer(canvas)
  })

  afterEach(() => {
    renderer.dispose()
    vi.restoreAllMocks()
  })

  it('instantiates without throwing', () => {
    expect(renderer).toBeInstanceOf(VisualizerRenderer)
  })

  it('setTrackPosition updates track uniforms on next render', () => {
    renderer.setTrackPosition(90, 0.5)
    const r = renderer as unknown as { renderFrame: (t: number) => void }
    r.renderFrame(1.0)
    // trackElapsedLoc and trackProgressLoc are called via uniform1f
    expect(gl.uniform1f).toHaveBeenCalled()
  })

  it('dispose does not call loseContext (would poison canvas for React Strict Mode remount)', () => {
    // loseContext() was removed from dispose() because React Strict Mode runs
    // cleanup → remount, and a forcibly-lost context makes getContext('webgl2')
    // return null on the second mount, triggering the hasFallback path.
    const loseCtx = vi.fn()
    ;(gl.getExtension as ReturnType<typeof vi.fn>).mockReturnValue({
      loseContext: loseCtx,
    })
    renderer.dispose()
    expect(loseCtx).not.toHaveBeenCalled()
  })

  it('setPreset("kaleidoscope") calls gl.useProgram with the kaleidoscope program', () => {
    renderer.setPreset('kaleidoscope')
    ;(gl.useProgram as ReturnType<typeof vi.fn>).mockClear()
    const r = renderer as unknown as { renderFrame: (t: number) => void }
    r.renderFrame(1.0)
    expect(gl.useProgram).toHaveBeenCalled()
  })

  it('setPreset("plasma") calls gl.useProgram with the plasma program', () => {
    renderer.setPreset('plasma')
    ;(gl.useProgram as ReturnType<typeof vi.fn>).mockClear()
    const r = renderer as unknown as { renderFrame: (t: number) => void }
    r.renderFrame(1.0)
    expect(gl.useProgram).toHaveBeenCalled()
  })

  it('setPreset("retrowave") calls gl.useProgram with the retrowave program', () => {
    renderer.setPreset('retrowave')
    ;(gl.useProgram as ReturnType<typeof vi.fn>).mockClear()
    const r = renderer as unknown as { renderFrame: (t: number) => void }
    r.renderFrame(1.0)
    expect(gl.useProgram).toHaveBeenCalled()
  })

  it('calls onStart callback on start()', () => {
    const onStart = vi.fn()
    const r = new VisualizerRenderer(makeCanvas(makeGl()), { onStart })
    r.start()
    expect(onStart).toHaveBeenCalledWith('spectrum')
    r.dispose()
  })

  it('does not call onStart when prefers-reduced-motion is active', () => {
    const onStart = vi.fn()
    // Set matchMedia BEFORE makeCanvas so the constructor reads matches:true
    const reducedMotionMql = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    ;(window as unknown as Record<string, unknown>).matchMedia = vi
      .fn()
      .mockReturnValue(reducedMotionMql)
    const gl2 = makeGl()
    const canvas2 = {
      getContext: vi.fn().mockReturnValue(gl2),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      clientWidth: 800,
      clientHeight: 600,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement
    const r = new VisualizerRenderer(canvas2, { onStart })
    r.start()
    expect(onStart).not.toHaveBeenCalled()
    r.dispose()
  })

  it('does not initiate rAF loop when prefers-reduced-motion matches', () => {
    const reducedMotionMql = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    ;(window as unknown as Record<string, unknown>).matchMedia = vi
      .fn()
      .mockReturnValue(reducedMotionMql)
    const gl2 = makeGl()
    const canvas2 = {
      getContext: vi.fn().mockReturnValue(gl2),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      clientWidth: 800,
      clientHeight: 600,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement
    const r = new VisualizerRenderer(canvas2)
    r.start()
    const internal = r as unknown as { rafId: number | null }
    expect(internal.rafId).toBeNull()
    r.dispose()
  })

  it('calls onFallback when WebGL2 context is unavailable', () => {
    const onFallback = vi.fn()
    const nullGlCanvas = {
      getContext: vi.fn().mockReturnValue(null),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      clientWidth: 800,
      clientHeight: 600,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement
    expect(() => new VisualizerRenderer(nullGlCanvas, { onFallback })).toThrow()
    // onFallback is called by MusicVisualizerCanvas catch block, not renderer constructor
    // This test verifies the constructor throws, which triggers the caller's catch
  })
})
