import type { IntensityLevel } from '../../types'

export interface NeonTunnelParams {
  readonly flySpeed: number
  readonly pulseDepth: number
  readonly bloomStrength: number
}

export interface ParticleGalaxyParams {
  // Base count BEFORE device-tier scaling (particleBudgetFor applies the tier).
  readonly particleCount: number
  readonly spread: number
  readonly explodeForce: number
}

// SCAFFOLD VALUES — user reviews screenshots and refines. Do not micro-tune.
export const NEON_TUNNEL_INTENSITY: Record<IntensityLevel, NeonTunnelParams> = {
  chill:   { flySpeed: 0.4, pulseDepth: 0.08, bloomStrength: 0.5 },
  normal:  { flySpeed: 0.8, pulseDepth: 0.18, bloomStrength: 0.9 },
  intense: { flySpeed: 1.5, pulseDepth: 0.32, bloomStrength: 1.4 },
  max:     { flySpeed: 2.6, pulseDepth: 0.50, bloomStrength: 2.0 },
}

export const PARTICLE_GALAXY_INTENSITY: Record<
  IntensityLevel,
  ParticleGalaxyParams
> = {
  chill:   { particleCount: 8000,  spread: 0.6, explodeForce: 0.3 },
  normal:  { particleCount: 20000, spread: 1.0, explodeForce: 0.7 },
  intense: { particleCount: 40000, spread: 1.5, explodeForce: 1.3 },
  max:     { particleCount: 60000, spread: 2.2, explodeForce: 2.0 },
}
