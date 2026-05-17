export type VisualizerPreset =
  | 'spectrum'
  | 'kaleidoscope'
  | 'plasma'
  | 'starfield'
  | 'retrowave'
  | 'sacred-geometry'

export const VISUALIZER_PRESETS: readonly VisualizerPreset[] = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'retrowave',
  'sacred-geometry',
]

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
    previewGradient:
      'radial-gradient(ellipse at 50% 50%, #002255 0%, #000820 60%, #000000 100%)',
  },
  {
    id: 'retrowave',
    displayName: 'Retrowave Grid',
    previewGradient:
      'linear-gradient(to bottom, #1a0033 0%, #ff1493 45%, #00e5ff 55%, #0d0020 100%)',
  },
  {
    id: 'sacred-geometry',
    displayName: 'Sacred Geometry',
    previewGradient:
      'radial-gradient(circle at 50% 50%, #c8a000 0%, #3a2000 50%, #000000 100%)',
  },
]

export const VISUALIZER_STORAGE_KEY = 'kranz-tv:music-visualizer'
export const VISUALIZER_PARAM = 'viz'
export const DEFAULT_VISUALIZER: VisualizerPreset = 'spectrum'
