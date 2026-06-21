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
