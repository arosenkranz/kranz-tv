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

  it('dispose calls loseContext on the WebGL extension', () => {
    const loseCtx = vi.fn()
    ;(gl.getExtension as ReturnType<typeof vi.fn>).mockReturnValue({
      loseContext: loseCtx,
    })
    renderer.dispose()
    expect(loseCtx).toHaveBeenCalled()
  })
})
