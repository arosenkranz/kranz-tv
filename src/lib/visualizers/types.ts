export type VisualizerPreset =
  | 'spectrum'
  | 'kaleidoscope'
  | 'plasma'
  | 'starfield'
  | 'op-art'
  | 'lava-lamp'
  | 'fractal-voyage'
  | 'liquid-ink'
  | 'lava-drip'
  | 'oil-slick'
  | 'blacklight'
  | 'mandala'
  | 'neon-tunnel'
  | 'particle-galaxy'
  | 'flow-field'

export const VISUALIZER_PRESETS: readonly VisualizerPreset[] = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'op-art',
  'lava-lamp',
  'fractal-voyage',
  'liquid-ink',
  'lava-drip',
  'oil-slick',
  'blacklight',
  'mandala',
  'neon-tunnel',
  'particle-galaxy',
  'flow-field',
]

export type VisualizerBackendKind = 'shader-quad' | 'three' | 'p5'

// Cost hint drives per-preset perf gates (DPR clamp + FPS cap). Raymarch and
// feedback effects (added in later PRs) will be 'high'; the current procedural
// quad shaders are 'normal'.
export type VisualizerCostHint = 'low' | 'normal' | 'high'

export interface VisualizerPresetMeta {
  readonly backend: VisualizerBackendKind
  readonly costHint: VisualizerCostHint
  // shader-quad-specific: true only for two-pass feedback-FBO presets (Acid
  // Melt). PR 3's three/p5 presets carry false. Revisit as a discriminated
  // union by `backend` if more backend-specific flags accumulate.
  readonly feedback: boolean
}

export const PRESET_META: Record<VisualizerPreset, VisualizerPresetMeta> = {
  spectrum: { backend: 'shader-quad', costHint: 'normal', feedback: false },
  kaleidoscope: { backend: 'shader-quad', costHint: 'normal', feedback: false },
  plasma: { backend: 'shader-quad', costHint: 'normal', feedback: false },
  starfield: { backend: 'shader-quad', costHint: 'normal', feedback: false },
  'op-art': { backend: 'shader-quad', costHint: 'normal', feedback: false },
  'lava-lamp': { backend: 'shader-quad', costHint: 'normal', feedback: false },
  'fractal-voyage': { backend: 'shader-quad', costHint: 'high', feedback: false },
  'liquid-ink': { backend: 'shader-quad', costHint: 'normal', feedback: false },
  'lava-drip': { backend: 'shader-quad', costHint: 'high', feedback: true },
  'oil-slick': { backend: 'shader-quad', costHint: 'high', feedback: true },
  blacklight: { backend: 'shader-quad', costHint: 'high', feedback: true },
  mandala: { backend: 'shader-quad', costHint: 'high', feedback: true },
  'neon-tunnel': { backend: 'three', costHint: 'high', feedback: false },
  'particle-galaxy': { backend: 'three', costHint: 'high', feedback: false },
  'flow-field': { backend: 'p5', costHint: 'high', feedback: false },
}

// ── Intensity system ──────────────────────────────────────────────────────────

export type IntensityLevel = 'chill' | 'normal' | 'intense' | 'max'

export const INTENSITY_LEVELS: readonly IntensityLevel[] = [
  'chill',
  'normal',
  'intense',
  'max',
]

/** Maps named intensity level to the u_intensity uniform value (0.0–1.0). */
export const INTENSITY_MAP: Record<IntensityLevel, number> = {
  chill:   0.25,
  normal:  0.5,
  intense: 0.75,
  max:     1.0,
}

export const DEFAULT_INTENSITY: IntensityLevel = 'normal'
export const INTENSITY_STORAGE_KEY = 'kranz-tv:viz-intensity'
export const INTENSITY_PARAM = 'viz-intensity'

export interface VisualizerStyleMeta {
  readonly id: VisualizerPreset
  readonly displayName: string
  readonly previewGradient: string
}

export const VISUALIZER_STYLES: readonly VisualizerStyleMeta[] = [
  {
    id: 'spectrum',
    displayName: 'Spectrum',
    previewGradient:
      'linear-gradient(to top, #00ffcc 0%, #0080ff 40%, #001a33 100%)',
  },
  {
    id: 'kaleidoscope',
    displayName: 'Kaleidoscope',
    previewGradient:
      'conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #ff0080, #00ff88, #8800ff, #ff00ff)',
  },
  {
    id: 'plasma',
    displayName: 'Plasma',
    previewGradient:
      'radial-gradient(ellipse at 30% 60%, #cc0044 0%, #550088 45%, #1a0033 100%)',
  },
  {
    id: 'starfield',
    displayName: 'Warp Drive',
    // Radial light-streaks converging to a bright core — relativistic warp
    previewGradient:
      'radial-gradient(circle at 50% 50%, #ffffff 0%, #9fd8ff 8%, #2b6cff 22%, #0a0030 70%, #02000a 100%)',
  },
  {
    id: 'op-art',
    displayName: 'Op-Art',
    // High-contrast concentric interference — cream/near-black, amber tint
    previewGradient:
      'repeating-radial-gradient(circle at 38% 55%, #111 0px, #111 3px, #f0ead0 3px, #f0ead0 8px)',
  },
  {
    id: 'lava-lamp',
    displayName: 'Lava Lamp',
    // Warm amber blob on deep black-brown
    previewGradient:
      'radial-gradient(ellipse at 35% 40%, #e87020 0%, #a03000 40%, #050200 100%)',
  },
  {
    id: 'fractal-voyage',
    displayName: 'Fractal Voyage',
    previewGradient:
      'radial-gradient(ellipse at 50% 45%, #ff8a3d 0%, #c81e6e 38%, #2a0a4a 72%, #07021a 100%)',
  },
  {
    id: 'liquid-ink',
    displayName: 'Liquid Ink',
    previewGradient:
      'conic-gradient(from 210deg at 45% 55%, #18e0ff, #6a3df0, #ff2bd6, #18e0ff)',
  },
  {
    id: 'lava-drip',
    displayName: 'Lava Drip',
    // Gooey amber/green blobs dripping on black — lava-lamp metaballs
    previewGradient:
      'radial-gradient(ellipse at 40% 35%, #c8ff2b 0%, #ff8a3d 30%, #c81e6e 60%, #07021a 100%)',
  },
  {
    id: 'oil-slick',
    displayName: 'Oil Slick',
    // Thin-film iridescence — oil-on-water sheen
    previewGradient:
      'conic-gradient(from 140deg at 50% 50%, #18e0ff, #6aff8f, #ffe23d, #ff5bd6, #6a3df0, #18e0ff)',
  },
  {
    id: 'blacklight',
    displayName: 'Blacklight',
    // Electric neon filaments on near-black — UV-reactive paint
    previewGradient:
      'radial-gradient(circle at 50% 55%, #ff2bd6 0%, #2bffd6 35%, #1a00ff 65%, #02000a 100%)',
  },
  {
    id: 'mandala',
    displayName: 'Mandala',
    // Symmetric radial bloom — kaleidoscope feedback
    previewGradient:
      'conic-gradient(from 0deg at 50% 50%, #ff2b8f, #2bd6ff, #c8ff2b, #8a2bff, #ff2b8f)',
  },
  {
    id: 'neon-tunnel',
    displayName: 'Neon Tunnel',
    previewGradient:
      'radial-gradient(circle at 50% 50%, #18e0ff 0%, #6a3df0 35%, #ff2bd6 65%, #07021a 100%)',
  },
  {
    id: 'particle-galaxy',
    displayName: 'Particle Galaxy',
    previewGradient:
      'radial-gradient(ellipse at 50% 50%, #ffffff 0%, #8be9fd 12%, #6a3df0 45%, #1a0040 80%, #02000a 100%)',
  },
  {
    id: 'flow-field',
    displayName: 'Flow-Field Organism',
    previewGradient:
      'conic-gradient(from 90deg at 50% 50%, #39ff14, #18e0ff, #6a3df0, #39ff14)',
  },
]

export const VISUALIZER_STORAGE_KEY = 'kranz-tv:music-visualizer'
export const VISUALIZER_PARAM = 'viz'
export const DEFAULT_VISUALIZER: VisualizerPreset = 'spectrum'

// Unified fallback reason — single source of truth for every fallback path.
// shader-quad emits webgl2-unavailable/context-lost; the host emits
// lazy-import-failed when a three/p5 chunk fails to load.
export type VisualizerFallbackReason =
  | 'webgl2-unavailable'
  | 'context-lost'
  | 'lazy-import-failed'

// Device tier drives per-preset budget scaling (e.g. particle count). Threaded
// in via BackendMountOpts so backends never re-derive it from `window`.
export type DeviceTier = 'mobile' | 'desktop'
