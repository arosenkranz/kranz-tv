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
  none: { label: 'OFF', rendering: 'none', cssClass: '' },
}

export function nextOverlayMode(current: OverlayMode): OverlayMode {
  const idx = OVERLAY_MODES.indexOf(current)
  return OVERLAY_MODES[(idx + 1) % OVERLAY_MODES.length]
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
