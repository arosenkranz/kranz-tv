import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('dd-trace', () => ({
  default: {
    dogstatsd: {
      increment: vi.fn(),
      histogram: vi.fn(),
    },
  },
}))

// eslint-disable-next-line import/first
import tracer from 'dd-trace'
// eslint-disable-next-line import/first
import { incrementMetric, recordHistogram } from '~/lib/datadog/server-metrics'

const mockIncrement = vi.mocked(tracer.dogstatsd.increment)
const mockHistogram = vi.mocked(tracer.dogstatsd.histogram)

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
