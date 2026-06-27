import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { IntensityLevel } from '../../types'
import type { Scene } from '../scene'
import type { ThreeSceneEnv } from './registry'
import { NEON_TUNNEL_INTENSITY } from './intensity'

const PSEUDO_BPM = 120
const PULSE_HZ = PSEUDO_BPM / 60

export function createNeonTunnel(
  renderer: THREE.WebGLRenderer,
  _env: ThreeSceneEnv,
): Scene {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x07021a, 0.18)

  const size = renderer.getSize(new THREE.Vector2())
  const camera = new THREE.PerspectiveCamera(
    75,
    size.x / Math.max(1, size.y),
    0.1,
    100,
  )

  // Tunnel: a torus-knot-ish tube the camera flies down the inside of.
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 12 }, (_, i) => {
      const t = i / 12
      return new THREE.Vector3(
        Math.sin(t * Math.PI * 4) * 2,
        Math.cos(t * Math.PI * 3) * 2,
        -i * 6,
      )
    }),
    false,
  )
  const geo = new THREE.TubeGeometry(curve, 400, 1.6, 24, false)
  const mat = new THREE.MeshBasicMaterial({
    color: 0x18e0ff,
    wireframe: true,
    side: THREE.BackSide,
  })
  const tube = new THREE.Mesh(geo, mat)
  scene.add(tube)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    NEON_TUNNEL_INTENSITY.normal.bloomStrength,
    0.6,
    0.85,
  )
  composer.addPass(bloom)

  let params = NEON_TUNNEL_INTENSITY.normal
  let hue = 0.55

  return {
    setIntensity(level: IntensityLevel) {
      params = NEON_TUNNEL_INTENSITY[level]
      bloom.strength = params.bloomStrength
    },
    update(elapsed: number, progress: number) {
      // Fly-through: move camera along the curve, looping.
      const along = (elapsed * params.flySpeed * 0.04) % 1
      const pt = curve.getPointAt(along)
      const ahead = curve.getPointAt((along + 0.02) % 1)
      camera.position.copy(pt)
      camera.lookAt(ahead)
      // Pulse: deterministic sine on elapsed × pseudo-BPM scales the tube + hue.
      const pulse = (Math.sin(elapsed * PULSE_HZ * Math.PI * 2) + 1) * 0.5
      const s = 1 + pulse * params.pulseDepth
      tube.scale.setScalar(s)
      hue = (0.55 + progress * 0.4) % 1
      ;(tube.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.6)
      composer.render()
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      // Composer render targets are NOT freed by renderer.dispose() — do it here.
      composer.renderTarget1.dispose()
      composer.renderTarget2.dispose()
      bloom.dispose()
    },
  }
}
