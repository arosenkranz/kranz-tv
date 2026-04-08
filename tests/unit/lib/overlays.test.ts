import { describe, it, expect } from 'vitest'
import {
  OVERLAY_MODES,
  nextOverlayMode,
  overlayClassName,
  overlayLabel,
  isWebGLMode,
} from '~/lib/overlays'
import type { OverlayMode } from '~/lib/overlays'

describe('OVERLAY_MODES', () => {
  it('contains all 7 modes', () => {
    expect(OVERLAY_MODES).toHaveLength(7)
  })

  it('includes the 5 original modes', () => {
    expect(OVERLAY_MODES).toContain('crt')
    expect(OVERLAY_MODES).toContain('vhs')
    expect(OVERLAY_MODES).toContain('amber')
    expect(OVERLAY_MODES).toContain('green')
    expect(OVERLAY_MODES).toContain('none')
  })

  it('includes the 2 new modes', () => {
    expect(OVERLAY_MODES).toContain('film')
    expect(OVERLAY_MODES).toContain('broadcast')
  })
})

describe('nextOverlayMode', () => {
  it('cycles through all modes in order and wraps back to crt', () => {
    const order: OverlayMode[] = []
    let current: OverlayMode = 'crt'
    for (let i = 0; i < OVERLAY_MODES.length; i++) {
      order.push(current)
      current = nextOverlayMode(current)
    }
    expect(order).toEqual([...OVERLAY_MODES])
    expect(current).toBe('crt') // wrapped back
  })

  it('wraps from none back to crt', () => {
    expect(nextOverlayMode('none')).toBe('crt')
  })

  it('advances from crt to vhs', () => {
    expect(nextOverlayMode('crt')).toBe('vhs')
  })

  it('advances from vhs to amber', () => {
    expect(nextOverlayMode('vhs')).toBe('amber')
  })

  it('advances from film to broadcast', () => {
    expect(nextOverlayMode('film')).toBe('broadcast')
  })

  it('advances from broadcast to none', () => {
    expect(nextOverlayMode('broadcast')).toBe('none')
  })
})

describe('overlayClassName', () => {
  it('returns CSS class for CSS-only modes', () => {
    expect(overlayClassName('amber')).toBe('overlay-amber')
    expect(overlayClassName('green')).toBe('overlay-green')
  })

  it('returns CSS fallback class for WebGL modes with a fallback', () => {
    expect(overlayClassName('crt')).toBe('overlay-crt')
    expect(overlayClassName('vhs')).toBe('overlay-vhs')
    expect(overlayClassName('film')).toBe('overlay-film')
  })

  it('returns empty string for modes with no CSS fallback', () => {
    expect(overlayClassName('broadcast')).toBe('')
  })

  it('returns empty string for none', () => {
    expect(overlayClassName('none')).toBe('')
  })
})

describe('overlayLabel', () => {
  it('returns uppercase display labels for all modes', () => {
    expect(overlayLabel('crt')).toBe('CRT')
    expect(overlayLabel('vhs')).toBe('VHS')
    expect(overlayLabel('amber')).toBe('AMBER')
    expect(overlayLabel('green')).toBe('GREEN')
    expect(overlayLabel('film')).toBe('FILM')
    expect(overlayLabel('broadcast')).toBe('BROADCAST')
    expect(overlayLabel('none')).toBe('OFF')
  })
})

describe('isWebGLMode', () => {
  it('returns true for WebGL-rendered modes', () => {
    expect(isWebGLMode('crt')).toBe(true)
    expect(isWebGLMode('vhs')).toBe(true)
    expect(isWebGLMode('film')).toBe(true)
    expect(isWebGLMode('broadcast')).toBe(true)
  })

  it('returns false for CSS-only modes', () => {
    expect(isWebGLMode('amber')).toBe(false)
    expect(isWebGLMode('green')).toBe(false)
  })

  it('returns false for none', () => {
    expect(isWebGLMode('none')).toBe(false)
  })
})
