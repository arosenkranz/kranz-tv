import { describe, it, expect } from 'vitest'
import { INTENSITY_LEVELS } from '~/lib/visualizers/types'
import {
  NEON_TUNNEL_INTENSITY,
  PARTICLE_GALAXY_INTENSITY,
} from '~/lib/visualizers/backends/three/intensity'

describe('three intensity tables', () => {
  it('neon tunnel defines every intensity level with 3 knobs', () => {
    for (const lvl of INTENSITY_LEVELS) {
      const p = NEON_TUNNEL_INTENSITY[lvl]
      expect(p, lvl).toBeDefined()
      expect(typeof p.flySpeed).toBe('number')
      expect(typeof p.pulseDepth).toBe('number')
      expect(typeof p.bloomStrength).toBe('number')
    }
  })

  it('particle galaxy defines every intensity level with 3 knobs', () => {
    for (const lvl of INTENSITY_LEVELS) {
      const p = PARTICLE_GALAXY_INTENSITY[lvl]
      expect(p, lvl).toBeDefined()
      expect(typeof p.particleCount).toBe('number')
      expect(typeof p.spread).toBe('number')
      expect(typeof p.explodeForce).toBe('number')
    }
  })

  it('knobs increase monotonically chill → max (sanity for tuning)', () => {
    const lv = ['chill', 'normal', 'intense', 'max'] as const

    // Neon Tunnel: flySpeed, pulseDepth, bloomStrength
    const neonKnobs = ['flySpeed', 'pulseDepth', 'bloomStrength'] as const
    for (let i = 1; i < lv.length; i++) {
      for (const knob of neonKnobs) {
        expect(
          NEON_TUNNEL_INTENSITY[lv[i]][knob],
          `neon-tunnel ${knob} at ${lv[i]}`,
        ).toBeGreaterThan(NEON_TUNNEL_INTENSITY[lv[i - 1]][knob])
      }
    }

    // Particle Galaxy: particleCount, spread, explodeForce
    const pgKnobs = ['particleCount', 'spread', 'explodeForce'] as const
    for (let i = 1; i < lv.length; i++) {
      for (const knob of pgKnobs) {
        expect(
          PARTICLE_GALAXY_INTENSITY[lv[i]][knob],
          `particle-galaxy ${knob} at ${lv[i]}`,
        ).toBeGreaterThan(PARTICLE_GALAXY_INTENSITY[lv[i - 1]][knob])
      }
    }
  })
})
