export type VisualizerPreset = 'spectrum' | 'particles' | 'kaleidoscope' | 'oscilloscope'

export const VISUALIZER_PRESETS: readonly VisualizerPreset[] = [
  'spectrum',
  'particles',
  'kaleidoscope',
  'oscilloscope',
]

export const VISUALIZER_STORAGE_KEY = 'kranz-tv:music-visualizer'
export const VISUALIZER_PARAM = 'viz'
export const DEFAULT_VISUALIZER: VisualizerPreset = 'spectrum'
