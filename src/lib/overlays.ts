export const OVERLAY_MODES = ['crt', 'vhs', 'amber', 'green', 'none'] as const
export type OverlayMode = (typeof OVERLAY_MODES)[number]

export function nextOverlayMode(current: OverlayMode): OverlayMode {
  const idx = OVERLAY_MODES.indexOf(current)
  return OVERLAY_MODES[(idx + 1) % OVERLAY_MODES.length]
}

export function overlayClassName(mode: OverlayMode): string {
  switch (mode) {
    case 'crt':
      return 'overlay-crt'
    case 'vhs':
      return 'overlay-vhs'
    case 'amber':
      return 'overlay-amber'
    case 'green':
      return 'overlay-green'
    case 'none':
      return ''
  }
}
