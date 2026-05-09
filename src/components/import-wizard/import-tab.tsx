import { useEffect, useRef, useState } from 'react'
import type { Channel } from '~/lib/scheduling/types'
import { importChannel } from '~/lib/import/import-channel'
import { getNextChannelNumber } from '~/lib/import/schema'
import { useTvLayout } from '~/routes/_tv'
import { detectSource } from '~/lib/sources/registry'

const MONO = "'VT323', 'Courier New', monospace"

type ImportState = 'input' | 'loading' | 'error' | 'success'

export interface ImportTabProps {
  customChannels: readonly Channel[]
  onImportComplete: (channel: Channel) => void
  onClose: () => void
}

export function ImportTab({
  customChannels,
  onImportComplete,
  onClose,
}: ImportTabProps) {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const { isQuotaExhausted } = useTvLayout()

  const [state, setState] = useState<ImportState>('input')
  const [url, setUrl] = useState('')
  const [channelName, setChannelName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [importedChannel, setImportedChannel] = useState<Channel | null>(null)

  // Auto-focus and reset when tab mounts
  useEffect(() => {
    setState('input')
    setUrl('')
    setChannelName('')
    setErrorMessage('')
    setImportedChannel(null)
    setTimeout(() => urlInputRef.current?.focus(), 50)
  }, [])

  const handleImport = async (): Promise<void> => {
    setState('loading')
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
      setState('success')
    } else {
      setErrorMessage(result.error)
      setState('error')
    }
  }

  const handleWatchNow = (): void => {
    if (importedChannel !== null) onImportComplete(importedChannel)
  }

  const isInputDisabled = url.trim() === '' || channelName.trim() === ''

  // Quota exhausted state
  if (isQuotaExhausted && state !== 'success') {
    return (
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
    )
  }

  // Input state
  if (state === 'input') {
    const detectedSource = url.trim() !== '' ? detectSource(url) : null

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label
              className="font-mono text-sm tracking-widest uppercase"
              style={{ color: 'rgba(57,255,20,0.8)', fontFamily: MONO }}
            >
              PLAYLIST URL
            </label>
            {detectedSource !== null && (
              <span
                className="font-mono text-xs tracking-widest uppercase px-2 py-0.5 rounded border"
                style={{
                  color:
                    detectedSource.id === 'soundcloud' ? '#ff5500' : '#ff0000',
                  borderColor:
                    detectedSource.id === 'soundcloud'
                      ? 'rgba(255,85,0,0.4)'
                      : 'rgba(255,0,0,0.4)',
                  backgroundColor:
                    detectedSource.id === 'soundcloud'
                      ? 'rgba(255,85,0,0.08)'
                      : 'rgba(255,0,0,0.08)',
                  fontFamily: MONO,
                }}
              >
                {detectedSource.id === 'soundcloud' ? 'SOUNDCLOUD' : 'YOUTUBE'}
              </span>
            )}
          </div>
          <input
            ref={urlInputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/playlist?list=... or soundcloud.com/..."
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
        <p
          className="mt-2 font-mono text-xs tracking-wider text-center"
          style={{ color: 'rgba(255,255,255,0.15)', fontFamily: MONO }}
        >
          CLICK OUTSIDE OR PRESS ESC TO CLOSE
        </p>
      </div>
    )
  }

  // Loading state
  if (state === 'loading') {
    const loadingSource = detectSource(url)
    const loadingLabel =
      loadingSource?.id === 'soundcloud'
        ? 'Loading SoundCloud playlist...'
        : 'Fetching playlist data from YouTube'
    return (
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
          {loadingLabel}
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error') {
    return (
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
          onClick={() => setState('input')}
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
    )
  }

  // Success state — only reachable when state is 'success' (other states returned early above)
  if (importedChannel !== null) {
    return (
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
            {importedChannel.kind === 'video'
              ? `${importedChannel.videos.length} videos`
              : `${importedChannel.trackCount} tracks`}
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
    )
  }

  return null
}
