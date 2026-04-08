let _webgl2Supported: boolean | null = null

/**
 * Returns true if the browser supports WebGL2. Result is cached after first call.
 * Returns false in SSR/non-browser environments.
 */
export function supportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  if (_webgl2Supported !== null) return _webgl2Supported

  const canvas = document.createElement('canvas')
  _webgl2Supported = canvas.getContext('webgl2') !== null
  return _webgl2Supported
}

/**
 * Returns the canvas pixel ratio to use for overlay rendering.
 * Mobile uses half DPR — retro effects look great (and more authentic) at lower res.
 */
export function getCanvasScale(isMobile: boolean): number {
  const dpr = window.devicePixelRatio
  return isMobile ? dpr * 0.5 : dpr
}
