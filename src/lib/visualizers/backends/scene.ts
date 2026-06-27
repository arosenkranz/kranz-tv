import type { IntensityLevel } from '../types'

// A Scene owns geometry/material/uniforms for ONE preset and reacts to track
// position + intensity. The backend owns the GPU context (renderer); the scene
// owns what's drawn. The deterministic pulse lives in update().
export interface Scene {
  setIntensity: (level: IntensityLevel) => void
  // Called per rendered frame with per-client track position. Derive the
  // pulse here (fixed pseudo-BPM × elapsed) — schedule-pure, no host plumbing.
  // CONTRACT: update() MUST issue its own draw call (renderer.render /
  // composer.render). The backend's loop and its one-shot renderOnce() only
  // call update() — they never render separately. A scene that mutates state
  // but never renders produces a silent blank canvas.
  update: (elapsed: number, progress: number) => void
  enter?: () => void
  exit?: () => void
  // Free per-scene GPU resources (geometry/material/targets). NOT the renderer.
  dispose: () => void
}

export type SceneFactory<TRenderer, TEnv> = (
  renderer: TRenderer,
  env: TEnv,
) => Scene

export interface SceneEntry<TRenderer = unknown, TEnv = unknown> {
  readonly create: SceneFactory<TRenderer, TEnv>
}
