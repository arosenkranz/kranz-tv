import { useRef, useState, useCallback } from 'react'
import type { Channel } from '~/lib/scheduling/types'
import type { CustomChannelUpdates } from '~/routes/_tv'
import { exportChannelsAsJson } from '~/lib/storage/export-channels'
import { importChannelsFromFile } from '~/lib/storage/import-channels-file'
import { importChannel } from '~/lib/import/import-channel'
import { isChannelNumberAvailable } from '~/lib/import/schema'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { trackExportChannels, trackImportJson } from '~/lib/datadog/rum'

const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'
const ORANGE = '#ffa500'
const DIM = 'rgba(255,255,255,0.3)'
const RED = 'rgba(255,100,100,0.9)'

const PRESET_IDS = new Set(CHANNEL_PRESETS.map((p) => p.id))

type ImportFileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; importedCount: number; skippedCount: number }
  | { status: 'error'; message: string }

interface EditForm {
  readonly name: string
  readonly number: number
  readonly description: string
}

export interface ManageTabProps {
  customChannels: readonly Channel[]
  onClose: () => void
  onBatchImport?: (channels: readonly Channel[]) => void
  onUpdateChannel: (id: string, updates: CustomChannelUpdates) => void
  onDeleteChannel: (id: string) => void
  onRefreshChannel?: (id: string, updated: Channel) => void
  isQuotaExhausted?: boolean
}

export function ManageTab({
  customChannels,
  onClose: _onClose,
  onBatchImport,
  onUpdateChannel,
  onDeleteChannel,
  onRefreshChannel,
  isQuotaExhausted = false,
}: ManageTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importState, setImportState] = useState<ImportFileState>({
    status: 'idle',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    number: 0,
    description: '',
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<Record<string, string>>({})
  const [refreshSuccess, setRefreshSuccess] = useState<Record<string, boolean>>(
    {},
  )

  const startEditing = (channel: Channel): void => {
    setConfirmDeleteId(null)
    setEditingId(channel.id)
    setEditForm({
      name: channel.name,
      number: channel.number,
      description: channel.description ?? '',
    })
  }

  const cancelEditing = (): void => {
    setEditingId(null)
  }

  const saveEditing = (id: string): void => {
    const trimmedName = editForm.name.trim()
    if (trimmedName === '') return

    onUpdateChannel(id, {
      name: trimmedName,
      number: editForm.number,
      description: editForm.description.trim() || undefined,
    })
    setEditingId(null)
  }

  const confirmDelete = (id: string): void => {
    setEditingId(null)
    setConfirmDeleteId(id)
  }

  const executeDelete = (id: string): void => {
    onDeleteChannel(id)
    setConfirmDeleteId(null)
  }

  const handleRefresh = useCallback(
    async (channel: Channel): Promise<void> => {
      if (refreshingId !== null || !onRefreshChannel) return
      if (channel.kind !== 'video' || !channel.playlistId) return

      setRefreshingId(channel.id)
      setRefreshError((prev) => {
        const next = { ...prev }
        delete next[channel.id]
        return next
      })
      setRefreshSuccess((prev) => {
        const next = { ...prev }
        delete next[channel.id]
        return next
      })

      const result = await importChannel(
        channel.playlistId,
        channel.name,
        channel.number,
      )

      if (result.success) {
        if (
          result.channel.kind === 'video' &&
          result.channel.videos.length === 0
        ) {
          setRefreshError((prev) => ({
            ...prev,
            [channel.id]: 'PLAYLIST EMPTY OR PRIVATE',
          }))
        } else {
          const merged: Channel = {
            ...result.channel,
            id: channel.id,
            name: channel.name,
            number: channel.number,
            description: channel.description,
          }
          onRefreshChannel(channel.id, merged)
          setRefreshSuccess((prev) => ({ ...prev, [channel.id]: true }))
        }
      } else {
        setRefreshError((prev) => ({
          ...prev,
          [channel.id]: 'PLAYLIST UNAVAILABLE — USING CACHED DATA',
        }))
      }

      setRefreshingId(null)
    },
    [refreshingId, onRefreshChannel],
  )

  const numberError = (() => {
    if (editingId === null) return null
    const n = editForm.number
    if (!Number.isInteger(n) || n <= 0) return 'INVALID NUMBER'
    if (!isChannelNumberAvailable(n, editingId, customChannels)) {
      return `CH ${String(n).padStart(2, '0')} ALREADY IN USE`
    }
    return null
  })()

  const isSaveDisabled = editForm.name.trim() === '' || numberError !== null

  // ── Export / Import handlers (preserved from original) ──

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

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isExportDisabled = customChannels.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/* ── Channel list ── */}
      <div className="flex flex-col gap-2">
        <div
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: DIM, fontFamily: MONO }}
        >
          YOUR CHANNELS ({customChannels.length})
        </div>

        {customChannels.length === 0 && (
          <div
            className="rounded border px-4 py-6 text-center"
            style={{
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <div
              className="font-mono text-sm tracking-widest uppercase"
              style={{ color: DIM, fontFamily: MONO }}
            >
              NO CUSTOM CHANNELS
            </div>
            <div
              className="mt-2 font-mono text-xs tracking-wider"
              style={{ color: 'rgba(255,255,255,0.15)', fontFamily: MONO }}
            >
              USE THE ADD CHANNEL TAB TO IMPORT A YOUTUBE PLAYLIST
            </div>
          </div>
        )}

        <div
          className="flex flex-col gap-1 overflow-y-auto"
          style={{ maxHeight: '40vh' }}
        >
          {customChannels.map((channel) => {
            // ── Delete confirmation row ──
            if (confirmDeleteId === channel.id) {
              return (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded border px-3 py-2"
                  style={{
                    borderColor: 'rgba(255,50,50,0.4)',
                    backgroundColor: 'rgba(255,50,50,0.05)',
                  }}
                >
                  <span
                    className="font-mono text-sm tracking-wider uppercase"
                    style={{ color: RED, fontFamily: MONO }}
                  >
                    DELETE {channel.name.toUpperCase()}?
                  </span>
                  <span className="flex gap-2">
                    <button
                      onClick={() => executeDelete(channel.id)}
                      className="font-mono text-sm tracking-widest uppercase"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: RED,
                        fontFamily: MONO,
                        cursor: 'pointer',
                      }}
                      aria-label={`Confirm delete ${channel.name}`}
                    >
                      YES
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="font-mono text-sm tracking-widest uppercase"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: DIM,
                        fontFamily: MONO,
                        cursor: 'pointer',
                      }}
                      aria-label="Cancel delete"
                    >
                      NO
                    </button>
                  </span>
                </div>
              )
            }

            // ── Inline edit form ──
            if (editingId === channel.id) {
              return (
                <div
                  key={channel.id}
                  className="flex flex-col gap-3 rounded border px-3 py-3"
                  style={{
                    borderColor: 'rgba(255,165,0,0.4)',
                    backgroundColor: 'rgba(255,165,0,0.03)',
                  }}
                >
                  <div
                    className="font-mono text-xs tracking-widest uppercase"
                    style={{ color: ORANGE, fontFamily: MONO }}
                  >
                    EDITING: {channel.name.toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex flex-col gap-1">
                    <label
                      className="font-mono text-xs tracking-widest uppercase"
                      style={{ color: 'rgba(57,255,20,0.6)', fontFamily: MONO }}
                    >
                      NAME
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full rounded border px-2 py-1.5 font-mono text-sm"
                      style={{
                        backgroundColor: '#1a1a1a',
                        borderColor: 'rgba(255,165,0,0.3)',
                        color: '#e0e0e0',
                        fontFamily: MONO,
                        outline: 'none',
                      }}
                      aria-label="Channel name"
                    />
                  </div>

                  {/* Number */}
                  <div className="flex flex-col gap-1">
                    <label
                      className="font-mono text-xs tracking-widest uppercase"
                      style={{ color: 'rgba(57,255,20,0.6)', fontFamily: MONO }}
                    >
                      CH #
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.number}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          number: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-24 rounded border px-2 py-1.5 font-mono text-sm"
                      style={{
                        backgroundColor: '#1a1a1a',
                        borderColor: numberError
                          ? 'rgba(255,50,50,0.5)'
                          : 'rgba(255,165,0,0.3)',
                        color: '#e0e0e0',
                        fontFamily: MONO,
                        outline: 'none',
                      }}
                      aria-label="Channel number"
                    />
                    {numberError !== null && (
                      <span
                        className="font-mono text-xs tracking-wider"
                        style={{ color: RED, fontFamily: MONO }}
                      >
                        {numberError}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1">
                    <label
                      className="font-mono text-xs tracking-widest uppercase"
                      style={{ color: 'rgba(57,255,20,0.6)', fontFamily: MONO }}
                    >
                      DESCRIPTION
                    </label>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Imported channel"
                      className="w-full rounded border px-2 py-1.5 font-mono text-sm"
                      style={{
                        backgroundColor: '#1a1a1a',
                        borderColor: 'rgba(255,165,0,0.3)',
                        color: '#e0e0e0',
                        fontFamily: MONO,
                        outline: 'none',
                      }}
                      aria-label="Channel description"
                    />
                  </div>

                  {/* Save / Cancel */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEditing(channel.id)}
                      disabled={isSaveDisabled}
                      className="flex-1 rounded border py-2 font-mono text-sm tracking-widest uppercase"
                      style={{
                        backgroundColor: isSaveDisabled
                          ? 'transparent'
                          : 'rgba(57,255,20,0.1)',
                        borderColor: isSaveDisabled
                          ? 'rgba(57,255,20,0.2)'
                          : 'rgba(57,255,20,0.5)',
                        color: isSaveDisabled ? 'rgba(57,255,20,0.25)' : GREEN,
                        fontFamily: MONO,
                        cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                      }}
                      aria-label="Save changes"
                    >
                      SAVE
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 rounded border py-2 font-mono text-sm tracking-widest uppercase"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: DIM,
                        fontFamily: MONO,
                        cursor: 'pointer',
                      }}
                      aria-label="Cancel editing"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )
            }

            // ── Normal channel row ──
            return (
              <div key={channel.id} className="flex flex-col gap-1">
                <div
                  className="flex items-center justify-between rounded border px-3 py-2"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="shrink-0 font-mono text-xs tracking-wider"
                      style={{ color: ORANGE, fontFamily: MONO }}
                    >
                      CH {String(channel.number).padStart(2, '0')}
                    </span>
                    <span
                      className="font-mono text-sm tracking-wider uppercase truncate"
                      style={{ color: '#e0e0e0', fontFamily: MONO }}
                      title={channel.name}
                    >
                      {channel.name.toUpperCase()}
                    </span>
                  </span>
                  <span className="flex gap-2 shrink-0">
                    {onRefreshChannel && (
                      <button
                        onClick={() => void handleRefresh(channel)}
                        disabled={isQuotaExhausted || refreshingId !== null}
                        className="font-mono text-xs tracking-widest uppercase"
                        style={{
                          background: 'none',
                          border: 'none',
                          color:
                            isQuotaExhausted || refreshingId !== null
                              ? 'rgba(57,255,20,0.25)'
                              : GREEN,
                          fontFamily: MONO,
                          cursor:
                            isQuotaExhausted || refreshingId !== null
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                        title={isQuotaExhausted ? 'QUOTA EXHAUSTED' : undefined}
                        aria-label={
                          refreshingId === channel.id
                            ? `Refreshing ${channel.name}`
                            : `Refresh ${channel.name}`
                        }
                      >
                        {refreshingId === channel.id
                          ? 'REFRESHING...'
                          : 'REFRESH'}
                      </button>
                    )}
                    <button
                      onClick={() => startEditing(channel)}
                      className="font-mono text-xs tracking-widest uppercase"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: ORANGE,
                        fontFamily: MONO,
                        cursor: 'pointer',
                      }}
                      aria-label={`Edit ${channel.name}`}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => confirmDelete(channel.id)}
                      className="font-mono text-xs tracking-widest uppercase"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,100,100,0.6)',
                        fontFamily: MONO,
                        cursor: 'pointer',
                      }}
                      aria-label={`Delete ${channel.name}`}
                    >
                      X
                    </button>
                  </span>
                </div>
                {/* Refresh error/success inline message */}
                {channel.id in refreshError && (
                  <div
                    className="rounded border px-3 py-1.5 font-mono text-xs tracking-wider"
                    style={{
                      backgroundColor: 'rgba(255,50,50,0.05)',
                      borderColor: 'rgba(255,50,50,0.3)',
                      color: RED,
                      fontFamily: MONO,
                    }}
                  >
                    {refreshError[channel.id]}
                  </div>
                )}
                {refreshSuccess[channel.id] === true && (
                  <div
                    className="rounded border px-3 py-1.5 font-mono text-xs tracking-wider"
                    style={{
                      backgroundColor: 'rgba(57,255,20,0.05)',
                      borderColor: 'rgba(57,255,20,0.3)',
                      color: GREEN,
                      fontFamily: MONO,
                    }}
                  >
                    CHANNEL REFRESHED
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      />

      {/* ── Export section ── */}
      <div className="flex flex-col gap-2">
        <div
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: DIM, fontFamily: MONO }}
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

      {/* ── Import from file section ── */}
      <div className="flex flex-col gap-2">
        <div
          className="font-mono text-xs tracking-widest uppercase"
          style={{ color: DIM, fontFamily: MONO }}
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
              color: RED,
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
