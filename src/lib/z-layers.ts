/**
 * App-level overlay stacking scale.
 *
 * These constants order the full-screen / floating overlays relative to one
 * another so "which overlay is on top" is intentional rather than an accident
 * of whatever number each component happened to pick. Before this existed,
 * ad-hoc values collided and layering was accidental. The bug that motivated
 * this: the keyboard-help modal (z-index 60) rendered inside the channel route,
 * which lives under a `<main>` with `isolation: isolate` — a stacking context
 * that trapped the modal so it painted BELOW the desktop-welcome overlay
 * (z-index 50) at the root. Pressing `?` on first visit opened a help modal you
 * couldn't see. The fix hoisted help to the layout level (same root context as
 * welcome/import) so these numbers actually govern; the scale keeps them from
 * drifting back apart.
 *
 * Only overlays that compete at the APP level belong here. Intra-component
 * compositing (a visualizer behind its own tuning static, a video's overscan
 * burst) uses small local z-index values scoped to that component's stacking
 * context and is intentionally NOT modeled here — those never race these.
 *
 * Higher wins. Leave gaps between tiers so a future overlay can slot between
 * two without renumbering the world.
 */
export const Z = {
  /** EPG guide grid — the lowest full-screen overlay; always dismissable. */
  GUIDE: 40,
  /** First-run onboarding (desktop welcome, mobile fullscreen prompt). */
  ONBOARDING: 50,
  /**
   * Summonable modals: keyboard help, import wizard, mobile help/guide panel.
   * Must beat ONBOARDING — the user can open these while onboarding is still
   * up, and the thing they just opened has to be the thing they see.
   */
  MODAL: 60,
  /** Theater-mode transient controls floating over the video. */
  THEATER_CONTROLS: 70,
  /** Toasts / transient confirmations — above all interactive chrome. */
  TOAST: 80,
  /** Boot / standby screen — owns the viewport during startup, above all. */
  BOOT: 100,
} as const

export type ZLayer = (typeof Z)[keyof typeof Z]
