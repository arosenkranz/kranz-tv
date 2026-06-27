import { describe, it, expect } from 'vitest'
import { VISUALIZER_PRESETS, PRESET_META } from '~/lib/visualizers/types'
import { THREE_SCENE_KEYS } from '~/lib/visualizers/backends/three/keys'

describe('three scene registry totality', () => {
  // NOTE: This test verifies THREE_SCENE_KEYS totality only. It deliberately does
  // NOT import registry.ts (THREE_SCENES factory map) — that would drag `three`
  // into the test/main graph and break chunk isolation. Factory-map ↔ key-list
  // sync is covered by ThreeBackend integration + browser verification (Tasks 8/13).
  it('every three-backed preset has a scene entry', () => {
    const threePresets = VISUALIZER_PRESETS.filter(
      (p) => PRESET_META[p].backend === 'three',
    )
    for (const p of threePresets) {
      expect(THREE_SCENE_KEYS, `scene for ${p}`).toContain(p)
    }
  })

  it('registry has no entry for a non-three preset', () => {
    for (const key of THREE_SCENE_KEYS) {
      expect(PRESET_META[key].backend).toBe('three')
    }
  })
})
