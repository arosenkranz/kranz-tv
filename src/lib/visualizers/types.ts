export type VisualizerPreset =
  | 'spectrum'
  | 'kaleidoscope'
  | 'plasma'
  | 'starfield'
  | 'op-art'
  | 'lava-lamp'
  | 'fractal-voyage'
  | 'liquid-ink'
  | 'acid-melt'

export const VISUALIZER_PRESETS: readonly VisualizerPreset[] = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'op-art',
  'lava-lamp',
  'fractal-voyage',
  'liquid-ink',
  'acid-melt',
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
  'acid-melt': { backend: 'shader-quad', costHint: 'high', feedback: true },
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
    id: 'acid-melt',
    displayName: 'Acid Melt',
    previewGradient:
      'radial-gradient(circle at 40% 40%, #c8ff2b 0%, #2bffd6 30%, #c850ff 60%, #1a0033 100%)',
  },
]

export const VISUALIZER_STORAGE_KEY = 'kranz-tv:music-visualizer'
export const VISUALIZER_PARAM = 'viz'
export const DEFAULT_VISUALIZER: VisualizerPreset = 'spectrum'
