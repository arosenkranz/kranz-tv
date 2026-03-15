import { useEffect, useRef, useState } from 'react'
import type { Channel } from '~/lib/scheduling/types'
import { importChannel } from '~/lib/import/import-channel'
import { getNextChannelNumber } from '~/lib/import/schema'
import { useIsMobile } from '~/hooks/use-is-mobile'
import { useTvLayout } from '~/routes/_tv'

const MONO = "'VT323', 'Courier New', monospace"

export interface ImportModalProps {
  visible: boolean
  onClose: () => void
  onImportComplete: (channel: Channel) => void
  customChannels: readonly Channel[]
}

type ModalState = 'input' | 'loading' | 'error' | 'success'

export function ImportModal({
  visible,
  onClose,
  onImportComplete,
  customChannels,
}: ImportModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const { isQuotaExhausted } = useTvLayout()

  const [modalState, setModalState] = useState<ModalState>('input')
  const [url, setUrl] = useState('')
  const [channelName, setChannelName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [importedChannel, setImportedChannel] = useState<Channel | null>(null)

  // Auto-focus URL input on open, reset state on close
  useEffect(() => {
    if (visible) {
      setModalState('input')
      setUrl('')
      setChannelName('')
      setErrorMessage('')
      setImportedChannel(null)
      // Defer focus until after render
      setTimeout(() => urlInputRef.current?.focus(), 50)
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  if (!visible) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === backdropRef.current) onClose()
  }

  const handleImport = async (): Promise<void> => {
    setModalState('loading')

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
    const nextNumber = getNextChannelNumber(customChannels)

    const result = await importChannel(
      url,
      channelName,
      nextNumber,
      apiKey ?? '',
    )

    if (result.success) {
      setImportedChannel(result.channel)
      setModalState('success')
    } else {
      setErrorMessage(result.error)
      setModalState('error')
    }
  }

  const handleWatchNow = (): void => {
    if (importedChannel !== null) {
      onImportComplete(importedChannel)
    }
  }

  const isInputDisabled = url.trim() === '' || channelName.trim() === ''

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Import YouTube channel"
    >
      <div
        className="relative rounded border-2 px-4 py-6 sm:px-8"
        style={{
          backgroundColor: '#0d0d0d',
          borderColor: 'rgba(255,165,0,0.7)',
          width: 'min(90vw, 520px)',
          boxShadow: '0 0 30px rgba(255,165,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2
            className="font-mono text-xl tracking-widest uppercase"
            style={{ color: '#ffa500', fontFamily: MONO }}
          >
            IMPORT CHANNEL
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-sm tracking-widest"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}
            aria-label="Close import modal"
          >
            {isMobile ? '✕' : '[ESC]'}
          </button>
        </div>

        {/* Quota exhausted — import unavailable */}
        {isQuotaExhausted && modalState !== 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className="font-mono text-2xl tracking-widest animate-pulse uppercase text-center"
              style={{ color: '#ffa500', fontFamily: MONO }}
            >
              IMPORT UNAVAILABLE
            </div>
            <div
              className="font-mono text-sm tracking-wider text-center"
              style={{ color: 'rgba(255,165,0,0.6)', fontFamily: MONO }}
            >
              EXPERIENCING TECHNICAL DIFFICULTIES
            </div>
            <div
              className="font-mono text-xs tracking-wider text-center"
              style={{ color: 'rgba(255,255,255,0.25)', fontFamily: MONO }}
            >
              PLEASE STAND BY
            </div>
          </div>
        )}

        {/* Input state */}
        {!isQuotaExhausted && modalState === 'input' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label
                className="font-mono text-sm tracking-widest uppercase"
                style={{ color: 'rgba(57,255,20,0.8)', fontFamily: MONO }}
              >
                YOUTUBE PLAYLIST URL
              </label>
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/playlist?list=..."
                className="w-full rounded border px-3 py-2 font-mono text-sm"
                style={{
                  backgroundColor: '#1a1a1a',
                  borderColor: 'rgba(255,165,0,0.3)',
                  color: '#e0e0e0',
                  fontFamily: MONO,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255,165,0,0.7)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,165,0,0.3)'
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-mono text-sm tracking-widest uppercase"
                style={{ color: 'rgba(57,255,20,0.8)', fontFamily: MONO }}
              >
                CHANNEL NAME
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="My Custom Channel"
                className="w-full rounded border px-3 py-2 font-mono text-sm"
                style={{
                  backgroundColor: '#1a1a1a',
                  borderColor: 'rgba(255,165,0,0.3)',
                  color: '#e0e0e0',
                  fontFamily: MONO,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255,165,0,0.7)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,165,0,0.3)'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isInputDisabled) void handleImport()
                }}
              />
            </div>

            <button
              onClick={() => void handleImport()}
              disabled={isInputDisabled}
              className="mt-2 w-full rounded border py-3 font-mono text-base tracking-widest uppercase transition-colors"
              style={{
                backgroundColor: isInputDisabled
                  ? 'transparent'
                  : 'rgba(255,165,0,0.1)',
                borderColor: isInputDisabled
                  ? 'rgba(255,165,0,0.2)'
                  : 'rgba(255,165,0,0.7)',
                color: isInputDisabled ? 'rgba(255,165,0,0.3)' : '#ffa500',
                fontFamily: MONO,
                cursor: isInputDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              IMPORT
            </button>
          </div>
        )}

        {/* Loading state */}
        {!isQuotaExhausted && modalState === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="font-mono text-2xl tracking-widest animate-pulse uppercase"
              style={{ color: 'rgba(57,255,20,0.8)', fontFamily: MONO }}
            >
              TUNING IN...
            </div>
            <div
              className="font-mono text-sm tracking-wider"
              style={{ color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}
            >
              Fetching playlist data from YouTube
            </div>
          </div>
        )}

        {/* Error state */}
        {!isQuotaExhausted && modalState === 'error' && (
          <div className="flex flex-col gap-4">
            <div
              className="rounded border px-4 py-3 font-mono text-sm tracking-wider"
              style={{
                backgroundColor: 'rgba(255,50,50,0.05)',
                borderColor: 'rgba(255,50,50,0.4)',
                color: 'rgba(255,100,100,0.9)',
                fontFamily: MONO,
              }}
            >
              {errorMessage}
            </div>
            <button
              onClick={() => setModalState('input')}
              className="w-full rounded border py-3 font-mono text-base tracking-widest uppercase"
              style={{
                backgroundColor: 'rgba(255,165,0,0.05)',
                borderColor: 'rgba(255,165,0,0.5)',
                color: '#ffa500',
                fontFamily: MONO,
                cursor: 'pointer',
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* Success state */}
        {modalState === 'success' && importedChannel !== null && (
          <div className="flex flex-col gap-4">
            <div
              className="rounded border px-4 py-3"
              style={{
                backgroundColor: 'rgba(57,255,20,0.05)',
                borderColor: 'rgba(57,255,20,0.3)',
              }}
            >
              <div
                className="font-mono text-lg tracking-widest uppercase"
                style={{ color: '#39ff14', fontFamily: MONO }}
              >
                CHANNEL ADDED
              </div>
              <div
                className="mt-1 font-mono text-sm tracking-wider"
                style={{ color: 'rgba(255,255,255,0.6)', fontFamily: MONO }}
              >
                📡 CH {String(importedChannel.number).padStart(2, '0')} —{' '}
                {importedChannel.name.toUpperCase()}
              </div>
              <div
                className="mt-1 font-mono text-xs"
                style={{ color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}
              >
                {importedChannel.videos.length} videos
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleWatchNow}
                className="flex-1 rounded border py-3 font-mono text-base tracking-widest uppercase"
                style={{
                  backgroundColor: 'rgba(57,255,20,0.1)',
                  borderColor: 'rgba(57,255,20,0.5)',
                  color: '#39ff14',
                  fontFamily: MONO,
                  cursor: 'pointer',
                }}
              >
                WATCH NOW
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded border py-3 font-mono text-base tracking-widest uppercase"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: MONO,
                  cursor: 'pointer',
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        )}

        {/* Footer hint */}
        {!isQuotaExhausted && modalState === 'input' && (
          <p
            className="mt-4 font-mono text-xs tracking-wider text-center"
            style={{ color: 'rgba(255,255,255,0.15)', fontFamily: MONO }}
          >
            {isMobile ? 'TAP OUTSIDE TO CLOSE' : 'CLICK OUTSIDE OR PRESS ESC TO CLOSE'}
          </p>
        )}
      </div>
    </div>
  )
}
