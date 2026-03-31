import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('dd-trace', () => ({
  default: {
    dogstatsd: {
      increment: vi.fn(),
      histogram: vi.fn(),
      gauge: vi.fn(),
    },
  },
}))

// eslint-disable-next-line import/first
import tracer from 'dd-trace'
// eslint-disable-next-line import/first
import {
  incrementMetric,
  recordHistogram,
  recordGauge,
} from '~/lib/datadog/server-metrics'

const mockIncrement = vi.mocked(tracer.dogstatsd.increment)
const mockHistogram = vi.mocked(tracer.dogstatsd.histogram)
const mockGauge = vi.mocked(tracer.dogstatsd.gauge)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('incrementMetric', () => {
  it('calls tracer.dogstatsd.increment with metric name', () => {
    incrementMetric('kranz_tv.server.channels_request')

    expect(mockIncrement).toHaveBeenCalledOnce()
    expect(mockIncrement).toHaveBeenCalledWith(
      'kranz_tv.server.channels_request',
      1,
      [],
    )
  })

  it('formats tags as key:value strings', () => {
    incrementMetric('kranz_tv.channel.switch', { from: 'nature', to: 'ai-ml' })

    expect(mockIncrement).toHaveBeenCalledWith('kranz_tv.channel.switch', 1, [
      'from:nature',
      'to:ai-ml',
    ])
  })
})

describe('recordHistogram', () => {
  it('calls tracer.dogstatsd.histogram with metric name and value', () => {
    recordHistogram('kranz_tv.server.channels_ms', 12.5)

    expect(mockHistogram).toHaveBeenCalledOnce()
    expect(mockHistogram).toHaveBeenCalledWith(
      'kranz_tv.server.channels_ms',
      12.5,
      [],
    )
  })

  it('includes tags when provided', () => {
    recordHistogram('kranz_tv.youtube_api.latency_ms', 340, {
      endpoint: 'playlistItems',
    })

    expect(mockHistogram).toHaveBeenCalledWith(
      'kranz_tv.youtube_api.latency_ms',
      340,
      ['endpoint:playlistItems'],
    )
  })
})

describe('recordGauge', () => {
  it('calls tracer.dogstatsd.gauge with metric name and value', () => {
    recordGauge('kranz_tv.server.preset_channels', 11)

    expect(mockGauge).toHaveBeenCalledOnce()
    expect(mockGauge).toHaveBeenCalledWith(
      'kranz_tv.server.preset_channels',
      11,
      [],
    )
  })

  it('includes tags when provided', () => {
    recordGauge('kranz_tv.server.active_sessions', 5, { env: 'prod' })

    expect(mockGauge).toHaveBeenCalledWith(
      'kranz_tv.server.active_sessions',
      5,
      ['env:prod'],
    )
  })
})
