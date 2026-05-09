import { useState, useCallback, useRef } from 'react'
import { useQuotaCountdown } from '~/hooks/use-quota-countdown'
import { useTvLayout } from '~/routes/_tv'
import { MONO_FONT } from '~/lib/theme'

const COOLDOWN_MS = 30_000
const MAX_RETRIES = 3

type RetryState = 'idle' | 'checking' | 'failed'

export interface QuotaBannerProps {
  readonly onRetry: () => Promise<void>
}

/**
 * Informational banner shown when YouTube API quota is exhausted.
 * Displays a countdown to midnight PT reset and a manual retry button
 * with a 30s cooldown and 3-attempt max.
 */
export function QuotaBanner({ onRetry }: QuotaBannerProps) {
  const { isQuotaExhausted } = useTvLayout()
  const countdown = useQuotaCountdown(isQuotaExhausted)
  const [retryState, setRetryState] = useState<RetryState>('idle')
  const [retryCount, setRetryCount] = useState(0)
  const [cooldown, setCooldown] = useState(false)
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRetry = useCallback(async (): Promise<void> => {
    if (cooldown || retryCount >= MAX_RETRIES || retryState === 'checking')
      return

    setRetryState('checking')
    if (failTimerRef.current !== null) clearTimeout(failTimerRef.current)

    try {
      await onRetry()
      // Success — banner will unmount when isQuotaExhausted becomes false
    } catch {
      setRetryState('failed')
      setRetryCount((prev) => prev + 1)
      failTimerRef.current = setTimeout(() => setRetryState('idle'), 3_000)
    }

    setCooldown(true)
    setTimeout(() => setCooldown(false), COOLDOWN_MS)
  }, [cooldown, retryCount, retryState, onRetry])

  if (!isQuotaExhausted) return null

  const retriesExhausted = retryCount >= MAX_RETRIES
  const buttonDisabled =
    cooldown || retriesExhausted || retryState === 'checking'

  const buttonLabel =
    retryState === 'checking'
      ? 'CHECKING...'
      : retryState === 'failed'
        ? 'STILL EXHAUSTED'
        : retriesExhausted
          ? 'MAX RETRIES'
          : 'RETRY NOW'

  return (
    <div
      className="shrink-0 px-4 py-2 font-mono text-sm tracking-widest text-center"
      style={{
        backgroundColor: 'rgba(255,165,0,0.08)',
        borderTop: '1px solid rgba(255,165,0,0.3)',
        color: '#ffa500',
        fontFamily: MONO_FONT,
      }}
      role="alert"
    >
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <span className="animate-pulse">
          ▋ TECHNICAL DIFFICULTIES
          {countdown !== null ? ` — RESETS IN ${countdown}` : ''}
        </span>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={buttonDisabled}
          className="rounded border px-3 py-1 font-mono text-xs tracking-widest"
          style={{
            backgroundColor: buttonDisabled
              ? 'rgba(255,165,0,0.05)'
              : 'rgba(255,165,0,0.15)',
            borderColor: buttonDisabled
              ? 'rgba(255,165,0,0.15)'
              : 'rgba(255,165,0,0.4)',
            color: buttonDisabled ? 'rgba(255,165,0,0.4)' : '#ffa500',
            fontFamily: MONO_FONT,
            cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {buttonLabel}
        </button>
      </div>
      <div
        className="mt-1 text-xs tracking-wider"
        style={{ color: 'rgba(255,165,0,0.5)', fontFamily: MONO_FONT }}
      >
        IMPORTED CHANNELS UNAFFECTED
      </div>
    </div>
  )
}
