export const OVERLAY_MODES = [
  'crt',
  'vhs',
  'amber',
  'green',
  'film',
  'broadcast',
  'filmstrip',
  'none',
] as const

export type OverlayMode = (typeof OVERLAY_MODES)[number]

export interface OverlayModeConfig {
  readonly label: string
  readonly rendering: 'webgl' | 'css' | 'none'
  /** CSS class used for this mode or as WebGL fallback. Empty string = no CSS fallback. */
  readonly cssClass: string
}
