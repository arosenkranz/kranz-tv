import type * as THREE from 'three'
import type { Scene } from '../scene'
import type { ThreeSceneEnv } from './registry'

export function createParticleGalaxy(
  _renderer: THREE.WebGLRenderer,
  _env: ThreeSceneEnv,
): Scene {
  // Full scene in Task 7.
  return {
    setIntensity: () => {},
    update: () => {},
    dispose: () => {},
  }
}
