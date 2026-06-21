// Widget statuses come from sc-widget-context: 'mounting' | 'ready' | 'playing'
// | 'paused' | 'error'. Re-declared here so this pure helper has no dependency
// on the context module.
export type WidgetStatus = 'mounting' | 'ready' | 'playing' | 'paused' | 'error'

export interface TuningInput {
  isActiveChannel: boolean
  status: WidgetStatus
}

export interface TuningPhase {
  phase: 'resolving' | 'locking' | 'playing' | 'error'
  label: string
  showStatic: boolean
}

// Pure mapping from existing signals to the TUNING overlay's display state.
// No timers — derives entirely from whether this channel is the active one
// and the widget status the context already exposes.
export function tuningPhase({ isActiveChannel, status }: TuningInput): TuningPhase {
  if (status === 'error') {
    return { phase: 'error', label: 'NO SIGNAL', showStatic: true }
  }
  if (!isActiveChannel) {
    return { phase: 'resolving', label: 'RESOLVING SIGNAL…', showStatic: true }
  }
  if (status === 'mounting') {
    return { phase: 'locking', label: 'LOCKING AUDIO…', showStatic: true }
  }
  // ready | playing | paused → audio is up; clear the overlay
  return { phase: 'playing', label: '', showStatic: false }
}
