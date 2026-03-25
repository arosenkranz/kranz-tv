import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@datadog/browser-logs', () => ({
  datadogLogs: {
    init: vi.fn(),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  },
}))

// eslint-disable-next-line import/first
import { datadogLogs } from '@datadog/browser-logs'
// eslint-disable-next-line import/first
import { logQuotaExhaustion, logImportError } from '~/lib/datadog/logs'

const mockError = vi.mocked(datadogLogs.logger.error)
const mockWarn = vi.mocked(datadogLogs.logger.warn)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logQuotaExhaustion', () => {
  it('logs an error with the quota exhaustion message', () => {
    logQuotaExhaustion()

    expect(mockError).toHaveBeenCalledOnce()
    expect(mockError).toHaveBeenCalledWith('YouTube API quota exhausted', undefined)
  })

  it('passes optional context to the logger', () => {
    const ctx = { channelId: 'nature', userId: 'anon' }
    logQuotaExhaustion(ctx)

    expect(mockError).toHaveBeenCalledWith('YouTube API quota exhausted', ctx)
  })
})

describe('logImportError', () => {
  it('logs a warning with error message and channel name', () => {
    logImportError('Playlist not found', 'My Custom Channel')

    expect(mockWarn).toHaveBeenCalledOnce()
    expect(mockWarn).toHaveBeenCalledWith('Channel import failed', {
      error: 'Playlist not found',
      channel_name: 'My Custom Channel',
    })
  })
})
