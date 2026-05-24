import {
  VISUALIZER_PRESETS,
  VISUALIZER_STORAGE_KEY,
  VISUALIZER_PARAM,
  DEFAULT_VISUALIZER,
  INTENSITY_LEVELS,
  INTENSITY_STORAGE_KEY,
  INTENSITY_PARAM,
  DEFAULT_INTENSITY,
} from './types'
import type { VisualizerPreset, IntensityLevel } from './types'

function isVisualizerPreset(value: string): value is VisualizerPreset {
  return (VISUALIZER_PRESETS as readonly string[]).includes(value)
}

export function resolvePreset(searchParams: URLSearchParams): VisualizerPreset {
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

export function cyclePreset(
  current: VisualizerPreset,
  presets: readonly VisualizerPreset[],
): VisualizerPreset {
  const idx = presets.indexOf(current)
  return presets[(idx + 1) % presets.length] ?? DEFAULT_VISUALIZER
}

// ── Intensity helpers ──────────────────────────────────────────────────────────

function isIntensityLevel(value: string): value is IntensityLevel {
  return (INTENSITY_LEVELS as readonly string[]).includes(value)
}

export function resolveIntensity(
  searchParams: URLSearchParams,
): IntensityLevel {
  const urlParam = searchParams.get(INTENSITY_PARAM)
  if (urlParam !== null && isIntensityLevel(urlParam)) return urlParam

  try {
    const stored = localStorage.getItem(INTENSITY_STORAGE_KEY)
    if (stored !== null && isIntensityLevel(stored)) return stored
  } catch {
    // localStorage unavailable
  }

  return DEFAULT_INTENSITY
}

export function saveIntensity(level: IntensityLevel): void {
  try {
    localStorage.setItem(INTENSITY_STORAGE_KEY, level)
  } catch {
    // Ignore storage errors for preference saving
  }
}

export function cycleIntensity(
  current: IntensityLevel,
  levels: readonly IntensityLevel[],
): IntensityLevel {
  const idx = levels.indexOf(current)
  return levels[(idx + 1) % levels.length] ?? DEFAULT_INTENSITY
}
