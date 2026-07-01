import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { render } from '@testing-library/react'

import { OverlayCanvas } from '~/components/overlay-canvas'

// supportsWebGL2 probes a real WebGL2 context — force it "available" so the
// only thing keeping the server render on the CSS-fallback path is the
// clientReady hydration gate (the #84 fix), not the absence of WebGL.
vi.mock('~/lib/overlays/capabilities', () => ({
  supportsWebGL2: () => true,
}))

// jsdom has no real WebGL2, so a real OverlayRenderer would throw on construction
// and the component would fall back to the CSS div. Stub it to a no-op so the
// post-hydration canvas branch is observable.
vi.mock('~/lib/overlays/renderer', () => ({
  OverlayRenderer: class {
    setMode(): void {}
    start(): void {}
    destroy(): void {}
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OverlayCanvas — hydration safety (#84)', () => {
  it('server render emits the CSS fallback, not a <canvas>, even when WebGL2 is available', () => {
    // renderToString runs NO effects, so clientReady stays false — exactly the
    // server pass. Before the fix this rendered <canvas> (because supportsWebGL2
    // is mocked true), diverging from the client and causing the mismatch.
    const html = renderToString(<OverlayCanvas mode="crt" />)
    expect(html).not.toContain('<canvas')
    expect(html).toContain('overlay-crt')
  })

  it('client render swaps to <canvas> after hydration (the fix defers, not removes)', () => {
    // RTL flushes effects inside render's act() wrapper, so clientReady becomes
    // true and the WebGL canvas mounts — proving the fallback is only for the
    // pre-hydration window.
    const { container } = render(<OverlayCanvas mode="crt" />)
    expect(container.querySelector('canvas[data-testid="overlay-canvas"]')).not.toBeNull()
  })
})
