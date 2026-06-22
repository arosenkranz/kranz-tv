import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  resolvePreset,
  savePreset,
  cyclePreset,
  resolveIntensity,
  saveIntensity,
  cycleIntensity,
} from '~/lib/visualizers/preset'
import {
  VISUALIZER_STORAGE_KEY,
  VISUALIZER_PARAM,
  DEFAULT_VISUALIZER,
  VISUALIZER_PRESETS,
  INTENSITY_STORAGE_KEY,
  INTENSITY_PARAM,
  DEFAULT_INTENSITY,
  INTENSITY_LEVELS,
  PRESET_META,
} from '~/lib/visualizers/types'

const ALL_PRESET_IDS = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'op-art',
  'lava-lamp',
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
    const params = new URLSearchParams({ [VISUALIZER_PARAM]: 'kaleidoscope' })
    expect(resolvePreset(params)).toBe('kaleidoscope')
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
    savePreset('lava-lamp')
    expect(resolvePreset(new URLSearchParams())).toBe('lava-lamp')
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

// ──────────────────────────────────────────────────────────────────────
describe('resolveIntensity — URL param priority', () => {
  it.each(INTENSITY_LEVELS)('accepts valid level "%s"', (level) => {
    const params = new URLSearchParams({ [INTENSITY_PARAM]: level })
    expect(resolveIntensity(params)).toBe(level)
  })

  it('URL param takes priority over localStorage', () => {
    localStorage.setItem(INTENSITY_STORAGE_KEY, 'chill')
    const params = new URLSearchParams({ [INTENSITY_PARAM]: 'max' })
    expect(resolveIntensity(params)).toBe('max')
  })

  it('falls back to DEFAULT_INTENSITY when URL param is invalid', () => {
    const params = new URLSearchParams({ [INTENSITY_PARAM]: 'ludicrous' })
    expect(resolveIntensity(params)).toBe(DEFAULT_INTENSITY)
  })
})

describe('resolveIntensity — localStorage fallback', () => {
  it('returns stored level when no URL param', () => {
    localStorage.setItem(INTENSITY_STORAGE_KEY, 'intense')
    const params = new URLSearchParams()
    expect(resolveIntensity(params)).toBe('intense')
  })

  it('falls back to DEFAULT_INTENSITY when localStorage is empty', () => {
    expect(resolveIntensity(new URLSearchParams())).toBe(DEFAULT_INTENSITY)
  })

  it('falls back to DEFAULT when stored value is invalid', () => {
    localStorage.setItem(INTENSITY_STORAGE_KEY, 'turbo')
    expect(resolveIntensity(new URLSearchParams())).toBe(DEFAULT_INTENSITY)
  })
})

describe('saveIntensity', () => {
  it('writes the level to localStorage', () => {
    saveIntensity('max')
    expect(localStorage.getItem(INTENSITY_STORAGE_KEY)).toBe('max')
  })

  it('resolveIntensity picks up saved value on next call', () => {
    saveIntensity('chill')
    expect(resolveIntensity(new URLSearchParams())).toBe('chill')
  })
})

describe('cycleIntensity', () => {
  it('advances chill → normal → intense → max', () => {
    expect(cycleIntensity('chill', INTENSITY_LEVELS)).toBe('normal')
    expect(cycleIntensity('normal', INTENSITY_LEVELS)).toBe('intense')
    expect(cycleIntensity('intense', INTENSITY_LEVELS)).toBe('max')
  })

  it('wraps from max back to chill', () => {
    expect(cycleIntensity('max', INTENSITY_LEVELS)).toBe('chill')
  })
})

describe('PRESET_META', () => {
  it('has an entry for every preset', () => {
    for (const p of VISUALIZER_PRESETS) {
      expect(PRESET_META[p]).toBeDefined()
    }
  })
  it('marks all current presets as shader-quad backend', () => {
    for (const p of VISUALIZER_PRESETS) {
      expect(PRESET_META[p].backend).toBe('shader-quad')
    }
  })
  it('exposes a costHint used for perf scaling', () => {
    expect(['low', 'normal', 'high']).toContain(PRESET_META.spectrum.costHint)
  })
})
