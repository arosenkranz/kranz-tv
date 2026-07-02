import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the entire browser-rum module before importing our module under test
vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: vi.fn(),
    startSessionReplayRecording: vi.fn(),
    addAction: vi.fn(),
    setGlobalContextProperty: vi.fn(),
  },
}))

// eslint-disable-next-line import/first
import { datadogRum } from '@datadog/browser-rum'
// eslint-disable-next-line import/first
import { trackScCacheEvent, trackScChannelLoad } from '~/lib/datadog/rum'

const mockAddAction = vi.mocked(datadogRum.addAction)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('trackScCacheEvent', () => {
  it('emits sc_cache action with outcome and channelId', () => {
    trackScCacheEvent('hit', 'preset-lofi')

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('sc_cache', {
      outcome: 'hit',
      channelId: 'preset-lofi',
    })
  })
})

describe('trackScChannelLoad', () => {
  it('emits sc_channel_load action with channelId, durationMs, fromCache', () => {
    trackScChannelLoad('preset-lofi', 1234, false)

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('sc_channel_load', {
      channelId: 'preset-lofi',
      durationMs: 1234,
      fromCache: false,
    })
  })
})

describe('trackScTrackUnplayable', () => {
  it('emits sc_track_unplayable with track identity and reason', async () => {
    const { trackScTrackUnplayable } = await import('~/lib/datadog/rum')
    trackScTrackUnplayable({
      channelId: 'sc-calming',
      trackId: '123456789',
      reason: 'widget-error',
      sourceUrlCorrelationId: 'ab12cd34',
    })

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('sc_track_unplayable', {
      channel_id: 'sc-calming',
      track_id: '123456789',
      reason: 'widget-error',
      source_url_correlation_id: 'ab12cd34',
      retry_count: 0,
    })
  })

  it('includes retryCount for load-retries-exhausted', async () => {
    const { trackScTrackUnplayable } = await import('~/lib/datadog/rum')
    trackScTrackUnplayable({
      channelId: 'sc-eclectic',
      trackId: '987',
      reason: 'load-retries-exhausted',
      sourceUrlCorrelationId: 'ff00ff00',
      retryCount: 2,
    })

    expect(mockAddAction).toHaveBeenCalledWith(
      'sc_track_unplayable',
      expect.objectContaining({ reason: 'load-retries-exhausted', retry_count: 2 }),
    )
  })
})
