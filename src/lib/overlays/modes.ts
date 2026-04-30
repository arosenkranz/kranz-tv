import { OVERLAY_MODES } from './types'
import type { OverlayMode, OverlayModeConfig } from './types'

export { OVERLAY_MODES }

const MODE_CONFIG: Record<OverlayMode, OverlayModeConfig> = {
  crt: { label: 'CRT', rendering: 'webgl', cssClass: 'overlay-crt' },
  vhs: { label: 'VHS', rendering: 'webgl', cssClass: 'overlay-vhs' },
  amber: { label: 'AMBER', rendering: 'css', cssClass: 'overlay-amber' },
  green: { label: 'GREEN', rendering: 'css', cssClass: 'overlay-green' },
  film: { label: 'FILM', rendering: 'webgl', cssClass: 'overlay-film' },
  broadcast: { label: 'BROADCAST', rendering: 'webgl', cssClass: '' },
  filmstrip: { label: 'FILMSTRIP', rendering: 'webgl', cssClass: '' },
  none: { label: 'OFF', rendering: 'none', cssClass: '' },
}

const MOTION_INTENSIVE: ReadonlySet<OverlayMode> = new Set<OverlayMode>([])

/** Returns true for effects with high-motion animated patterns (photosensitivity concern). */
export function isMotionIntensive(mode: OverlayMode): boolean {
  return MOTION_INTENSIVE.has(mode)
}

export function nextOverlayMode(
  current: OverlayMode,
  skipMotionIntensive = false,
): OverlayMode {
  let idx = OVERLAY_MODES.indexOf(current)
  do {
    idx = (idx + 1) % OVERLAY_MODES.length
  } while (skipMotionIntensive && isMotionIntensive(OVERLAY_MODES[idx]))
  return OVERLAY_MODES[idx]
}

/** CSS class for this mode. For WebGL modes, this is the fallback class shown when WebGL is unavailable or lost. */
export function overlayClassName(mode: OverlayMode): string {
  return MODE_CONFIG[mode].cssClass
}

/** Display label used in toasts and UI (e.g. 'CRT', 'FILM', 'OFF'). */
export function overlayLabel(mode: OverlayMode): string {
  return MODE_CONFIG[mode].label
}

/** Returns true for modes that render via a WebGL canvas. */
export function isWebGLMode(mode: OverlayMode): boolean {
  return MODE_CONFIG[mode].rendering === 'webgl'
}
