import * as THREE from 'three'
import type { IntensityLevel } from '../../types'
import type { Scene } from '../scene'
import type { ThreeSceneEnv } from './registry'
import { PARTICLE_GALAXY_INTENSITY } from './intensity'
import { particleBudgetFor } from '../../perf-gates'

const PSEUDO_BPM = 120
const PULSE_HZ = PSEUDO_BPM / 60

export function createParticleGalaxy(
  renderer: THREE.WebGLRenderer,
  env: ThreeSceneEnv,
): Scene {
  const scene = new THREE.Scene()
  const size = renderer.getSize(new THREE.Vector2())
  const camera = new THREE.PerspectiveCamera(
    70,
    size.x / Math.max(1, size.y),
    0.1,
    200,
  )
  camera.position.z = 40

  let params = PARTICLE_GALAXY_INTENSITY.normal
  // Allocate at the MAX possible count once (avoid reallocation on intensity
  // change); draw range is clamped to the active count.
  const maxCount = particleBudgetFor(env.tier, PARTICLE_GALAXY_INTENSITY.max.particleCount)
  const home = new Float32Array(maxCount * 3)
  const positions = new Float32Array(maxCount * 3)
  for (let i = 0; i < maxCount; i++) {
    // Spiral-galaxy home positions.
    const r = Math.pow(Math.random(), 0.5) * 20
    const arm = (i % 3) * ((Math.PI * 2) / 3)
    const a = r * 0.3 + arm + Math.random() * 0.4
    home[i * 3] = Math.cos(a) * r
    home[i * 3 + 1] = (Math.random() - 0.5) * 3
    home[i * 3 + 2] = Math.sin(a) * r
    positions[i * 3] = home[i * 3]
    positions[i * 3 + 1] = home[i * 3 + 1]
    positions[i * 3 + 2] = home[i * 3 + 2]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.12,
    color: 0x8be9fd,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)

  const setActiveCount = (level: IntensityLevel) => {
    params = PARTICLE_GALAXY_INTENSITY[level]
    const count = particleBudgetFor(env.tier, params.particleCount)
    geo.setDrawRange(0, Math.min(count, maxCount))
  }
  setActiveCount('normal')

  const attr = geo.getAttribute('position') as THREE.BufferAttribute

  return {
    setIntensity: setActiveCount,
    update(elapsed: number, _progress: number) {
      points.rotation.y = elapsed * 0.05
      // Explode/reform: pulse pushes particles out along their home vector.
      const pulse = (Math.sin(elapsed * PULSE_HZ * Math.PI * 2) + 1) * 0.5
      const push = pulse * params.explodeForce
      const n = geo.drawRange.count
      for (let i = 0; i < n; i++) {
        const k = i * 3
        const sp = params.spread + push
        positions[k] = home[k] * sp
        positions[k + 1] = home[k + 1] * sp
        positions[k + 2] = home[k + 2] * sp
      }
      attr.needsUpdate = true
      renderer.render(scene, camera)
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
