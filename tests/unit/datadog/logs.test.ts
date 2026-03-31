import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@datadog/browser-logs', () => ({
  datadogLogs: {
    init: vi.fn(),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  },
}))

// eslint-disable-next-line import/first
import { datadogLogs } from '@datadog/browser-logs'
// eslint-disable-next-line import/first
import {
  logQuotaExhaustion,
  logImportError,
  logPlayerError,
  logPlayerCreationFailed,
  logChannelLoadFailed,
  logScheduleDesync,
  logQuotaRecovery,
  logImportFileError,
} from '~/lib/datadog/logs'

const mockError = vi.mocked(datadogLogs.logger.error)
const mockWarn = vi.mocked(datadogLogs.logger.warn)
const mockInfo = vi.mocked(datadogLogs.logger.info)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('logQuotaExhaustion', () => {
  it('logs an error with the quota exhaustion message', () => {
    logQuotaExhaustion()

    expect(mockError).toHaveBeenCalledOnce()
    expect(mockError).toHaveBeenCalledWith(
      'YouTube API quota exhausted',
      undefined,
    )
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

describe('logPlayerError', () => {
  it('logs an error with error code, video id, and channel id', () => {
    logPlayerError(150, 'dQw4w9WgXcQ', 'music')

    expect(mockError).toHaveBeenCalledOnce()
    expect(mockError).toHaveBeenCalledWith('YouTube player error', {
      error_code: 150,
      video_id: 'dQw4w9WgXcQ',
      channel_id: 'music',
    })
  })
})

describe('logPlayerCreationFailed', () => {
  it('logs an error with channel id and error message', () => {
    logPlayerCreationFailed('nature', 'Container not found')

    expect(mockError).toHaveBeenCalledOnce()
    expect(mockError).toHaveBeenCalledWith('YouTube player creation failed', {
      channel_id: 'nature',
      error: 'Container not found',
    })
  })
})

describe('logChannelLoadFailed', () => {
  it('logs a warning with channel id and error', () => {
    logChannelLoadFailed('nature', 'Network error')

    expect(mockWarn).toHaveBeenCalledOnce()
    expect(mockWarn).toHaveBeenCalledWith('Channel load failed', {
      channel_id: 'nature',
      error: 'Network error',
    })
  })
})

describe('logScheduleDesync', () => {
  it('logs a warning with channel and video ids', () => {
    logScheduleDesync('nature', 'abc123')

    expect(mockWarn).toHaveBeenCalledOnce()
    expect(mockWarn).toHaveBeenCalledWith('Schedule desync detected', {
      channel_id: 'nature',
      video_id: 'abc123',
    })
  })
})

describe('logQuotaRecovery', () => {
  it('logs an info message for quota recovery', () => {
    logQuotaRecovery()

    expect(mockInfo).toHaveBeenCalledOnce()
    expect(mockInfo).toHaveBeenCalledWith('YouTube API quota recovered')
  })
})

describe('logImportFileError', () => {
  it('logs a warning with error and file name', () => {
    logImportFileError('INVALID FILE — NOT VALID JSON', 'bad-file.txt')

    expect(mockWarn).toHaveBeenCalledOnce()
    expect(mockWarn).toHaveBeenCalledWith('Channel file import failed', {
      error: 'INVALID FILE — NOT VALID JSON',
      file_name: 'bad-file.txt',
    })
  })
})
