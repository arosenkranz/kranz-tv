import { describe, it, expect } from 'vitest'
import type { VisualizerPreset } from '~/lib/visualizers/types'
import {
  VISUALIZER_PRESETS,
  PRESET_META,
  VISUALIZER_STYLES,
} from '~/lib/visualizers/types'

describe('visualizer registry integrity', () => {
  it('includes the four PR-2 preset ids', () => {
    for (const id of ['fractal-voyage', 'liquid-ink', 'acid-melt', 'starfield'] as const) {
      expect(VISUALIZER_PRESETS).toContain(id)
    }
  })

  it('every preset has PRESET_META and a VISUALIZER_STYLES entry', () => {
    const styleIds = new Set(VISUALIZER_STYLES.map((s) => s.id))
    for (const id of VISUALIZER_PRESETS) {
      expect(PRESET_META[id], `meta for ${id}`).toBeDefined()
      expect(styleIds.has(id), `style for ${id}`).toBe(true)
    }
  })

  it('acid-melt is the only feedback preset', () => {
    const feedbackIds = VISUALIZER_PRESETS.filter((id) => PRESET_META[id].feedback)
    expect(feedbackIds).toEqual(['acid-melt'])
  })

  it('high-cost presets are fractal-voyage and acid-melt', () => {
    const highIds = VISUALIZER_PRESETS.filter((id) => PRESET_META[id].costHint === 'high')
    expect(new Set(highIds)).toEqual(new Set<VisualizerPreset>(['fractal-voyage', 'acid-melt']))
  })

  it('new ids are appended at the end (cycle order preserved)', () => {
    expect(VISUALIZER_PRESETS.slice(-3)).toEqual(['fractal-voyage', 'liquid-ink', 'acid-melt'])
  })

  it('starfield displays as Warp Drive', () => {
    const style = VISUALIZER_STYLES.find((s) => s.id === 'starfield')
    expect(style?.displayName).toBe('Warp Drive')
  })
})
