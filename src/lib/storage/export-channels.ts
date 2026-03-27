import type { Channel } from '~/lib/scheduling/types'
import type { ExportEnvelope } from '~/lib/import/schema'

/**
 * Serializes custom channels into a versioned JSON envelope and triggers a
 * browser file download. Caller is responsible for disabling the trigger when
 * there are no channels to export.
 */
export function exportChannelsAsJson(channels: readonly Channel[]): void {
  const envelope: ExportEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    channels: [...channels],
  }

  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const dateStamp = new Date().toISOString().slice(0, 10)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `kranz-tv-channels-${dateStamp}.json`

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  URL.revokeObjectURL(url)
}
