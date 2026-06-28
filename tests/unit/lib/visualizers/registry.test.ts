import { describe, it, expect } from 'vitest'
import type { VisualizerPreset } from '~/lib/visualizers/types'
import {
  VISUALIZER_PRESETS,
  PRESET_META,
  VISUALIZER_STYLES,
} from '~/lib/visualizers/types'

describe('visualizer registry integrity', () => {
  it('includes the GLSL-wave + feedback preset ids', () => {
    for (const id of [
      'fractal-voyage',
      'liquid-ink',
      'lava-drip',
      'oil-slick',
      'blacklight',
      'mandala',
      'starfield',
    ] as const) {
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

  it('the four feedback presets are lava-drip, oil-slick, blacklight, mandala', () => {
    const feedbackIds = VISUALIZER_PRESETS.filter((id) => PRESET_META[id].feedback)
    expect(new Set(feedbackIds)).toEqual(
      new Set<VisualizerPreset>(['lava-drip', 'oil-slick', 'blacklight', 'mandala']),
    )
  })

  it('high-cost presets are fractal-voyage, the four feedback presets, and neon-tunnel', () => {
    const highIds = VISUALIZER_PRESETS.filter((id) => PRESET_META[id].costHint === 'high')
    expect(new Set(highIds)).toEqual(
      new Set<VisualizerPreset>([
        'fractal-voyage',
        'lava-drip',
        'oil-slick',
        'blacklight',
        'mandala',
        'neon-tunnel',
      ]),
    )
  })

  it('the raymarched neon-tunnel preset is registered (shader-quad, high cost, no feedback)', () => {
    expect(VISUALIZER_PRESETS).toContain('neon-tunnel')
    expect(PRESET_META['neon-tunnel']).toEqual({
      backend: 'shader-quad',
      costHint: 'high',
      feedback: false,
    })
  })

  it('new ids are appended at the end (cycle order preserved)', () => {
    expect(VISUALIZER_PRESETS.slice(-4)).toEqual([
      'oil-slick',
      'blacklight',
      'mandala',
      'neon-tunnel',
    ])
  })

  it('retired acid-melt id is gone', () => {
    expect(VISUALIZER_PRESETS).not.toContain('acid-melt' as VisualizerPreset)
  })

  it('starfield displays as Warp Drive', () => {
    const style = VISUALIZER_STYLES.find((s) => s.id === 'starfield')
    expect(style?.displayName).toBe('Warp Drive')
  })
})
