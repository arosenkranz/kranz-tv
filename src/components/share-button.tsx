// Share / Revoke button for custom channels.
//
// States:
//   - 'idle' (no shareRef): button reads "SHARE", click → publish
//   - 'sharing': pending RPC
//   - 'shared' (shareRef.role='sharer'): button reads "REVOKE", click → revoke
//   - 'revoking': pending RPC
//
// Errors surface as inline toasts (caller-provided). The button itself
// stays minimal — we don't try to render error states inside the button.
//
// Preset channels never get a share button; the parent route should not
// render <ShareButton> for them.

import { useState } from 'react'
import { copyToClipboard } from '~/lib/clipboard'
import { publishShare, revokeShare } from '~/lib/shares/share-client'
import { buildShareUrl } from '~/lib/shares/share-url'
import type { Channel, ShareRef } from '~/lib/scheduling/types'
import type { ShareErrorCode } from '~/lib/shares/share-record'

const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'

export interface ShareButtonProps {
  channel: Channel
  /** Called with a short, user-friendly message after every action. */
  onToast: (message: string, detail?: string) => void
  /**
   * Called after a successful publish/revoke. The parent is responsible for
   * persisting (e.g., via `useTvLayout().updateCustomChannel`).
   */
  onShareRefChanged: (next: ShareRef | undefined) => void
}

type ButtonState = 'idle' | 'pending'

const RATE_LIMIT_MESSAGE_FALLBACK = 'TRY AGAIN LATER'

function formatRetryDuration(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60)
    return `Try again in about ${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`
}

const ERROR_TOASTS: Record<
  ShareErrorCode,
  (retryAfterMs: number | undefined) => string
> = {
  rate_limited: (ms) =>
    ms !== undefined ? formatRetryDuration(ms) : RATE_LIMIT_MESSAGE_FALLBACK,
  invalid_payload: () => 'Cannot share this channel.',
  not_found: () => 'Share not found.',
  unauthorized: () => 'Only the original sharer can revoke.',
  kv_unavailable: () => "Couldn't reach the share registry — try again.",
}

export function ShareButton({
  channel,
  onToast,
  onShareRefChanged,
}: ShareButtonProps): React.ReactElement {
  const [state, setState] = useState<ButtonState>('idle')
  const sharerRef =
    channel.shareRef?.role === 'sharer' ? channel.shareRef : undefined
  const isSharer = sharerRef !== undefined

  async function handlePublish(): Promise<void> {
    setState('pending')
    try {
      const result = await publishShare(channel)
      if (!result.ok) {
        onToast('SHARE FAILED', ERROR_TOASTS[result.error](result.retryAfterMs))
        return
      }
      const { shareId, shareUrl } = result.value
      const copied = await copyToClipboard(shareUrl)
      const ref: ShareRef = { shareId, role: 'sharer' }
      onShareRefChanged(ref)
      onToast(
        copied ? 'LINK COPIED' : 'LINK READY',
        copied ? shareUrl : `Copy this URL: ${shareUrl}`,
      )
    } finally {
      setState('idle')
    }
  }

  async function handleRevoke(): Promise<void> {
    if (channel.shareRef === undefined) return
    const confirmed = window.confirm(
      'Revoke this share? New visitors will no longer be able to tune in. People who already received the channel keep their copy.',
    )
    if (!confirmed) return
    setState('pending')
    try {
      const result = await revokeShare(channel.shareRef.shareId)
      if (!result.ok) {
        onToast(
          'REVOKE FAILED',
          ERROR_TOASTS[result.error](result.retryAfterMs),
        )
        return
      }
      onShareRefChanged(undefined)
      onToast('REVOKED', 'This share will stop resolving for new visitors.')
    } finally {
      setState('idle')
    }
  }

  const onClick = isSharer ? handleRevoke : handlePublish
  const label =
    state === 'pending'
      ? isSharer
        ? 'REVOKING…'
        : 'SHARING…'
      : isSharer
        ? 'REVOKE'
        : 'SHARE'

  return (
    <button
      type="button"
      onClick={() => {
        void onClick()
      }}
      disabled={state === 'pending'}
      data-testid="share-button"
      aria-label={isSharer ? 'Revoke share' : 'Share this channel'}
      title={
        sharerRef !== undefined
          ? `Revoke share ${buildShareUrl(sharerRef.shareId)}`
          : 'Publish a shareable link to this channel'
      }
      style={{
        backgroundColor: 'transparent',
        color: GREEN,
        border: `1px solid ${isSharer ? '#ff4444' : GREEN}`,
        padding: '0.4rem 0.9rem',
        fontFamily: MONO,
        fontSize: '1rem',
        letterSpacing: '0.12em',
        cursor: state === 'pending' ? 'wait' : 'pointer',
        opacity: state === 'pending' ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}
