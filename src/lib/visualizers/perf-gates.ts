import type { VisualizerCostHint } from './types'

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

// Minimum ms between rendered frames. Normal = 60fps; high (raymarch/feedback)
// = 30fps to bound GPU/thermal load. The render loop skips frames that arrive
// sooner than this.
export function frameIntervalMsFor(cost: VisualizerCostHint): number {
  const fpsByCost: Record<VisualizerCostHint, number> = {
    low: 60,
    normal: 60,
    high: 30,
  }
  return 1000 / fpsByCost[cost]
}
