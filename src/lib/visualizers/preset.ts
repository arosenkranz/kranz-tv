import {
  
  VISUALIZER_PRESETS,
  VISUALIZER_STORAGE_KEY,
  VISUALIZER_PARAM,
  DEFAULT_VISUALIZER
} from './types'
import type {VisualizerPreset} from './types';

function isVisualizerPreset(value: string): value is VisualizerPreset {
  return (VISUALIZER_PRESETS as readonly string[]).includes(value)
}

export function resolvePreset(searchParams: URLSearchParams): VisualizerPreset {
  // URL param takes priority over localStorage default
  const urlParam = searchParams.get(VISUALIZER_PARAM)
  if (urlParam !== null && isVisualizerPreset(urlParam)) return urlParam

  try {
    const stored = localStorage.getItem(VISUALIZER_STORAGE_KEY)
    if (stored !== null && isVisualizerPreset(stored)) return stored
  } catch {
    // localStorage unavailable
  }

  return DEFAULT_VISUALIZER
}

export function savePreset(preset: VisualizerPreset): void {
  try {
    localStorage.setItem(VISUALIZER_STORAGE_KEY, preset)
  } catch {
    // Ignore storage errors for preference saving
  }
}
