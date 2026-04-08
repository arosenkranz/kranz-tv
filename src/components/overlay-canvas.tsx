import { useEffect, useRef, useState } from 'react'
import { isWebGLMode, overlayClassName, supportsWebGL2 } from '~/lib/overlays'
import { OverlayRenderer } from '~/lib/overlays/renderer'
import type { OverlayMode } from '~/lib/overlays'

interface OverlayCanvasProps {
  readonly mode: OverlayMode
  /** Override position for contexts like the splash screen that need position:fixed */
  readonly position?: 'absolute' | 'fixed'
}

const BASE_STYLE = {
  inset: 0,
  pointerEvents: 'none' as const,
  zIndex: 50,
  width: '100%',
  height: '100%',
  // Force a dedicated GPU compositing layer so the canvas paints above
  // cross-origin iframes (YouTube) whose hardware-decoded video gets its
  // own compositor layer.  Without this hint the browser may merge the
  // canvas into a lower paint layer that ends up behind the iframe.
  willChange: 'transform',
} as const

/**
 * Renders the active visual overlay mode.
 *
 * Routing logic:
 * - mode === 'none'              → null (no DOM node)
 * - CSS modes (amber, green)     → <div className={overlayClassName(mode)}>
 * - WebGL modes, no WebGL2       → CSS fallback div (overlayClassName may be empty)
 * - WebGL modes, WebGL2 ok       → <canvas> with OverlayRenderer
 * - WebGL modes, context lost    → CSS fallback div during loss→restore window
 */
export function OverlayCanvas({ mode, position = 'absolute' }: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<OverlayRenderer | null>(null)
  const [contextLost, setContextLost] = useState(false)

  const useWebGL = isWebGLMode(mode) && supportsWebGL2()

  // Mount/destroy the renderer when switching between WebGL and non-WebGL
  useEffect(() => {
    if (!useWebGL || !canvasRef.current) return

    const renderer = new OverlayRenderer(canvasRef.current, {
      onContextLost: () => setContextLost(true),
      onContextRestored: () => setContextLost(false),
    })
    rendererRef.current = renderer
    renderer.setMode(mode)
    renderer.start()

    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebGL]) // only re-run if WebGL availability changes

  // Update active shader when mode changes (no remount needed)
  useEffect(() => {
    if (rendererRef.current && isWebGLMode(mode)) {
      rendererRef.current.setMode(mode)
    }
  }, [mode])

  if (mode === 'none') return null

  const positionStyle = { position } as const

  // CSS-only modes (amber, green) always use the div path
  if (!isWebGLMode(mode)) {
    return (
      <div
        className={overlayClassName(mode)}
        aria-hidden="true"
        style={positionStyle}
      />
    )
  }

  // WebGL mode but no WebGL2 support, or context is currently lost → CSS fallback
  if (!useWebGL || contextLost) {
    const fallbackClass = overlayClassName(mode)
    if (!fallbackClass) return null
    return (
      <div
        className={fallbackClass}
        aria-hidden="true"
        style={positionStyle}
      />
    )
  }

  // WebGL canvas
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="overlay-canvas"
      style={{ ...BASE_STYLE, ...positionStyle }}
    />
  )
}
