import type * as THREE from 'three'
import type { VisualizerPreset, DeviceTier } from '../../types'
import type { SceneEntry } from '../scene'
import { createNeonTunnel } from './neon-tunnel'
import { createParticleGalaxy } from './particle-galaxy'

export interface ThreeSceneEnv {
  readonly tier: DeviceTier
}

export type ThreeSceneEntry = SceneEntry<THREE.WebGLRenderer, ThreeSceneEnv>

// Re-export from keys.ts (pure data, no three import) so callers that only
// need the key list can import from keys.ts and stay out of the three chunk.
export { THREE_SCENE_KEYS } from './keys'

// The factory map DOES import the scene modules (which import `three`). Only
// three-backend.ts (lazy chunk root) imports THIS — never the entry graph.
export const THREE_SCENES: Partial<
  Record<VisualizerPreset, ThreeSceneEntry>
> = {
  'neon-tunnel': { create: createNeonTunnel },
  'particle-galaxy': { create: createParticleGalaxy },
}
