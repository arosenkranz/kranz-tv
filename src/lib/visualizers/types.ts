export type VisualizerPreset =
  | 'spectrum'
  | 'kaleidoscope'
  | 'plasma'
  | 'starfield'
  | 'sacred-geometry'
  | 'op-art'
  | 'lava-lamp'
  | 'neon-noir'

export const VISUALIZER_PRESETS: readonly VisualizerPreset[] = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'sacred-geometry',
  'op-art',
  'lava-lamp',
  'neon-noir',
]

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
    displayName: 'Starfield',
    // Tiling star dots on deep space — actually conveys "stars" rather than solid black
    previewGradient:
      'radial-gradient(white 1px, transparent 2px) 0 0 / 18px 18px, radial-gradient(rgba(180,210,255,0.8) 1px, transparent 2px) 9px 9px / 26px 26px, radial-gradient(rgba(255,255,220,0.6) 1px, transparent 2px) 4px 13px / 22px 22px, #000208',
  },
  {
    id: 'sacred-geometry',
    displayName: 'Sacred Geometry',
    previewGradient:
      'radial-gradient(circle at 50% 50%, #c8a000 0%, #3a2000 50%, #000000 100%)',
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
    id: 'neon-noir',
    displayName: 'Neon Noir',
    // Dark void with diffuse magenta + blue glow sources
    previewGradient:
      'radial-gradient(ellipse at 30% 35%, rgba(220,0,120,0.5) 0%, transparent 55%), radial-gradient(ellipse at 70% 65%, rgba(0,80,200,0.4) 0%, transparent 55%), #04000c',
  },
]

export const VISUALIZER_STORAGE_KEY = 'kranz-tv:music-visualizer'
export const VISUALIZER_PARAM = 'viz'
export const DEFAULT_VISUALIZER: VisualizerPreset = 'spectrum'
