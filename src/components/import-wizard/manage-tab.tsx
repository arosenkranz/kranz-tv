import { useRef, useState } from 'react'
import type { Channel } from '~/lib/scheduling/types'
import { exportChannelsAsJson } from '~/lib/storage/export-channels'
import { importChannelsFromFile } from '~/lib/storage/import-channels-file'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { trackExportChannels, trackImportJson } from '~/lib/datadog/rum'

const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'
const ORANGE = '#ffa500'

const PRESET_IDS = new Set(CHANNEL_PRESETS.map((p) => p.id))

type ImportFileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; importedCount: number; skippedCount: number }
  | { status: 'error'; message: string }

export interface ManageTabProps {
  customChannels: readonly Channel[]
  onClose: () => void
  onBatchImport?: (channels: readonly Channel[]) => void
}

export function ManageTab({
  customChannels,
  onClose: _onClose,
  onBatchImport,
}: ManageTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importState, setImportState] = useState<ImportFileState>({
    status: 'idle',
  })

  const handleExport = (): void => {
    exportChannelsAsJson(customChannels)
    trackExportChannels(customChannels.length)
  }

  const handleBrowseClick = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportState({ status: 'loading' })

    const result = await importChannelsFromFile(
      file,
      customChannels,
      PRESET_IDS,
    )

    if (result.success) {
      trackImportJson(result.importedCount, result.skippedCount)
      if (result.importedCount > 0 && onBatchImport) {
        onBatchImport(result.merged.slice(customChannels.length))
      }
      setImportState({
        status: 'success',
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
      })
    } else {
      setImportState({ status: 'error', message: result.error })
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isExportDisabled = customChannels.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/* Export section */}
      <div className="flex flex-col gap-2">
        <div
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}
        >
          EXPORT
        </div>
        <button
          onClick={handleExport}
          disabled={isExportDisabled}
          aria-label="Export channels"
          title={isExportDisabled ? 'NO CHANNELS TO EXPORT' : undefined}
          className="w-full rounded border py-3 font-mono text-base tracking-widest uppercase transition-colors"
          style={{
            backgroundColor: isExportDisabled
              ? 'transparent'
              : 'rgba(57,255,20,0.1)',
            borderColor: isExportDisabled
              ? 'rgba(57,255,20,0.2)'
              : 'rgba(57,255,20,0.5)',
            color: isExportDisabled ? 'rgba(57,255,20,0.25)' : GREEN,
            fontFamily: MONO,
            cursor: isExportDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          EXPORT CHANNELS ({customChannels.length})
        </button>
        {isExportDisabled && (
          <p
            className="font-mono text-xs tracking-wider text-center"
            style={{ color: 'rgba(255,255,255,0.2)', fontFamily: MONO }}
          >
            NO CHANNELS TO EXPORT
          </p>
        )}
      </div>

      {/* Import from file section */}
      <div className="flex flex-col gap-2">
        <div
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}
        >
          IMPORT FROM FILE
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => void handleFileChange(e)}
          aria-label="Select JSON file"
        />
        <button
          onClick={handleBrowseClick}
          aria-label="Browse for file"
          className="w-full rounded border py-3 font-mono text-base tracking-widest uppercase"
          style={{
            backgroundColor: 'rgba(255,165,0,0.05)',
            borderColor: 'rgba(255,165,0,0.5)',
            color: ORANGE,
            fontFamily: MONO,
            cursor: 'pointer',
          }}
        >
          BROWSE
        </button>

        {/* Import results */}
        {importState.status === 'loading' && (
          <div
            className="font-mono text-sm tracking-wider animate-pulse text-center"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}
          >
            READING FILE...
          </div>
        )}

        {importState.status === 'success' && (
          <div
            className="rounded border px-3 py-2 font-mono text-sm tracking-wider"
            style={{
              backgroundColor: 'rgba(57,255,20,0.05)',
              borderColor: 'rgba(57,255,20,0.3)',
              color: GREEN,
              fontFamily: MONO,
            }}
          >
            {importState.importedCount} IMPORTED, {importState.skippedCount}{' '}
            ALREADY{importState.skippedCount === 1 ? ' EXISTS' : ' EXIST'}
          </div>
        )}

        {importState.status === 'error' && (
          <div
            className="rounded border px-3 py-2 font-mono text-sm tracking-wider"
            style={{
              backgroundColor: 'rgba(255,50,50,0.05)',
              borderColor: 'rgba(255,50,50,0.4)',
              color: 'rgba(255,100,100,0.9)',
              fontFamily: MONO,
            }}
          >
            {importState.message}
          </div>
        )}
      </div>
    </div>
  )
}
