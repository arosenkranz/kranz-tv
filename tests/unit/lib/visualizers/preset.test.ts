import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolvePreset, savePreset, cyclePreset } from '~/lib/visualizers/preset'
import {
  VISUALIZER_STORAGE_KEY,
  VISUALIZER_PARAM,
  DEFAULT_VISUALIZER,
  VISUALIZER_PRESETS,
} from '~/lib/visualizers/types'

const ALL_PRESET_IDS = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'retrowave',
  'sacred-geometry',
] as const

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isVisualizerPreset (via resolvePreset)', () => {
  it.each(ALL_PRESET_IDS)('accepts valid preset id "%s"', (id) => {
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: id })
    expect(resolvePreset(params)).toBe(id)
  })

  it('rejects "particles" (retired preset)', () => {
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: 'particles' })
    expect(resolvePreset(params)).toBe(DEFAULT_VISUALIZER)
  })

  it('rejects "oscilloscope" (retired preset)', () => {
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: 'oscilloscope' })
    expect(resolvePreset(params)).toBe(DEFAULT_VISUALIZER)
  })
})

describe('resolvePreset — URL param priority', () => {
  it('returns URL param preset when valid', () => {
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: 'kaleidoscope' })
    expect(resolvePreset(params)).toBe('kaleidoscope')
  })

  it('URL param takes priority over localStorage', () => {
    localStorage.setItem(VISUALIZER_STORAGE_KEY, 'plasma')
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: 'retrowave' })
    expect(resolvePreset(params)).toBe('retrowave')
  })

  it('falls back to DEFAULT when URL param is invalid', () => {
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: 'invalid-id' })
    expect(resolvePreset(params)).toBe(DEFAULT_VISUALIZER)
  })
})

describe('resolvePreset — localStorage fallback', () => {
  it('returns stored preset when no URL param', () => {
    localStorage.setItem(VISUALIZER_STORAGE_KEY, 'starfield')
    const params = new URLSearchParams()
    expect(resolvePreset(params)).toBe('starfield')
  })

  it('falls back to DEFAULT_VISUALIZER when localStorage is empty', () => {
    const params = new URLSearchParams()
    expect(resolvePreset(params)).toBe(DEFAULT_VISUALIZER)
  })

  it('falls back to DEFAULT when stored value is invalid', () => {
    localStorage.setItem(VISUALIZER_STORAGE_KEY, 'particles')
    const params = new URLSearchParams()
    expect(resolvePreset(params)).toBe(DEFAULT_VISUALIZER)
  })
})

describe('savePreset', () => {
  it('writes the preset id to localStorage', () => {
    savePreset('plasma')
    expect(localStorage.getItem(VISUALIZER_STORAGE_KEY)).toBe('plasma')
  })

  it('resolvePreset picks up saved value on next call', () => {
    savePreset('sacred-geometry')
    expect(resolvePreset(new URLSearchParams())).toBe('sacred-geometry')
  })
})

describe('cyclePreset', () => {
  it('advances to the next preset', () => {
    expect(cyclePreset('spectrum', VISUALIZER_PRESETS)).toBe('kaleidoscope')
    expect(cyclePreset('kaleidoscope', VISUALIZER_PRESETS)).toBe('plasma')
    expect(cyclePreset('plasma', VISUALIZER_PRESETS)).toBe('starfield')
  })

  it('wraps around from the last preset to the first', () => {
    // VISUALIZER_PRESETS is readonly VisualizerPreset[] so index access is typed correctly
    const last = VISUALIZER_PRESETS.at(-1) ?? DEFAULT_VISUALIZER
    expect(cyclePreset(last, VISUALIZER_PRESETS)).toBe(VISUALIZER_PRESETS[0])
  })

  it('works with a single-element array', () => {
    expect(cyclePreset('spectrum', ['spectrum'])).toBe('spectrum')
  })

  it('returns the first preset when current is not in the array', () => {
    // indexOf returns -1 → (-1+1) % n = 0 → first element
    expect(cyclePreset('spectrum', ['kaleidoscope', 'plasma'])).toBe(
      'kaleidoscope',
    )
  })
})
