import { describe, it, expect } from 'vitest'
import type { Scene } from '~/lib/visualizers/backends/scene'

describe('Scene interface', () => {
  it('a minimal Scene satisfies the contract', () => {
    const calls: string[] = []
    const scene: Scene = {
      setIntensity: () => calls.push('intensity'),
      update: () => calls.push('update'),
      dispose: () => calls.push('dispose'),
    }
    scene.setIntensity('normal')
    scene.update(1, 0.5)
    scene.dispose()
    expect(calls).toEqual(['intensity', 'update', 'dispose'])
  })
})
