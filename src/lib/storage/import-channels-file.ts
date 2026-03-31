import type { Channel } from '~/lib/scheduling/types'
import { ChannelArraySchema, ExportEnvelopeSchema } from '~/lib/import/schema'
import {
  mergeCustomChannels

} from '~/lib/storage/local-channels'
import type {MergeResult} from '~/lib/storage/local-channels';
import { logImportFileError } from '~/lib/datadog/logs'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export type ImportFileResult =
  | ({ success: true } & MergeResult)
  | { success: false; error: string }

/**
 * Reads a File, validates its contents as a channel export, deduplicates, and
 * returns the merged result. Never throws — all errors are returned as
 * discriminated union values.
 */
export async function importChannelsFromFile(
  file: File,
  existingChannels: readonly Channel[],
  presetIds: ReadonlySet<string>,
): Promise<ImportFileResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    logImportFileError('FILE TOO LARGE — maximum size is 5MB', file.name)
    return { success: false, error: 'FILE TOO LARGE — maximum size is 5MB' }
  }

  let parsed: unknown
  try {
    const text = await file.text()
    parsed = JSON.parse(text)
  } catch {
    logImportFileError('INVALID FILE — NOT VALID JSON', file.name)
    return { success: false, error: 'INVALID FILE — NOT VALID JSON' }
  }

  // Single object normalization: wrap bare channel or bare array
  const normalized = Array.isArray(parsed) ? parsed : [parsed]

  // Try envelope format first
  const envelopeResult = ExportEnvelopeSchema.safeParse(parsed)
  if (envelopeResult.success) {
    const { merged, importedCount, skippedCount } = mergeCustomChannels(
      existingChannels,
      envelopeResult.data.channels,
      presetIds,
    )
    return { success: true, merged, importedCount, skippedCount }
  }

  // Fall back to raw array
  const arrayResult = ChannelArraySchema.safeParse(normalized)
  if (arrayResult.success) {
    const { merged, importedCount, skippedCount } = mergeCustomChannels(
      existingChannels,
      arrayResult.data,
      presetIds,
    )
    return { success: true, merged, importedCount, skippedCount }
  }

  logImportFileError(
    'INVALID FILE — does not match expected channel format',
    file.name,
  )
  return {
    success: false,
    error: 'INVALID FILE — does not match expected channel format',
  }
}
