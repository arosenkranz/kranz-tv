export const VOLUME_STEP = 10
export const VOLUME_DEFAULT = 80

/**
 * Clamp a raw volume value to a valid integer in [0, 100].
 */
export function clampVolume(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)))
}

/**
 * Add delta to current volume, clamping the result to [0, 100].
 */
export function adjustVolume(current: number, delta: number): number {
  return clampVolume(current + delta)
}

/**
 * Map a volume (0-100) to a filled segment count out of `total` segments.
 */
export function volumeToSegments(volume: number, total: number): number {
  return Math.round((volume / 100) * total)
}
