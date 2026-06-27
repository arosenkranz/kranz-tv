import type { VisualizerCostHint, DeviceTier } from './types'

export interface DprEnv {
  dpr: number
  isMobile: boolean
}

// Resolution scale (multiplied by clientWidth/Height to get the backing-store
// size). Clamped per cost so expensive fragment shaders don't render at full
// retina density on a phone. Never exceeds the real device DPR.
export function dprScaleFor(cost: VisualizerCostHint, env: DprEnv): number {
  const ceilingByCost: Record<VisualizerCostHint, number> = {
    low: 2,
    normal: 1.5,
    high: 1,
  }
  let scale = Math.min(env.dpr, ceilingByCost[cost])
  if (env.isMobile) scale *= 0.5
  return scale
}

// Minimum ms between rendered frames. Only expensive presets (raymarch/feedback)
// are frame-capped to bound GPU/thermal load. Cheap procedural shaders run at
// native refresh (0 = uncapped → rAF paces them, including 120/144Hz displays).
export function frameIntervalMsFor(cost: VisualizerCostHint): number {
  if (cost === 'high') return 1000 / 30
  return 0
}

// Particle budget per device tier — mirrors dprScaleFor's policy-in-one-place
// shape. Mobile gets ~0.3x to bound geometry/overdraw on phone GPUs (the FPS
// cap limits draws/sec, not per-draw cost). First-pass multiplier; tune later.
export function particleBudgetFor(tier: DeviceTier, baseCount: number): number {
  const mult = tier === 'mobile' ? 0.3 : 1
  return Math.round(baseCount * mult)
}
