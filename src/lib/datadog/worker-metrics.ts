/**
 * Workers-compatible Datadog metrics client. dd-trace/DogStatsD cannot run
 * on Cloudflare Workers, so metrics are submitted over HTTP:
 * counts/gauges → v2 series API, distributions → v1 distribution_points
 * (the API-native replacement for DogStatsD histograms).
 *
 * Helpers buffer points; flushMetrics() posts the buffer fire-and-forget.
 * Without DD_API_KEY everything is a silent no-op (same contract as initRum).
 */

const SERIES_URL = 'https://api.datadoghq.com/api/v2/series'
const DISTRIBUTION_URL = 'https://api.datadoghq.com/api/v1/distribution_points'

// v2 series metric type ids
const TYPE_COUNT = 1
const TYPE_GAUGE = 3

interface SeriesPoint {
  metric: string
  type: typeof TYPE_COUNT | typeof TYPE_GAUGE
  value: number
  tags: string[]
}

interface DistributionPoint {
  metric: string
  value: number
  tags: string[]
}

let seriesBuffer: SeriesPoint[] = []
let distributionBuffer: DistributionPoint[] = []

function baseTags(): string[] {
  return [
    'service:kranz-tv',
    `env:${process.env.DD_ENV ?? 'production'}`,
    `version:${__APP_VERSION__}`,
  ]
}

function formatTags(tags?: Record<string, string>): string[] {
  const custom = tags
    ? Object.entries(tags).map(([k, v]) => `${k}:${v}`)
    : []
  return [...baseTags(), ...custom]
}

export function incrementMetric(
  name: string,
  tags?: Record<string, string>,
): void {
  seriesBuffer = [
    ...seriesBuffer,
    { metric: name, type: TYPE_COUNT, value: 1, tags: formatTags(tags) },
  ]
}

export function recordGauge(
  name: string,
  value: number,
  tags?: Record<string, string>,
): void {
  seriesBuffer = [
    ...seriesBuffer,
    { metric: name, type: TYPE_GAUGE, value, tags: formatTags(tags) },
  ]
}

export function recordDistribution(
  name: string,
  value: number,
  tags?: Record<string, string>,
): void {
  distributionBuffer = [
    ...distributionBuffer,
    { metric: name, value, tags: formatTags(tags) },
  ]
}

/** Post buffered points. Never throws — metric loss must not break requests. */
export async function flushMetrics(): Promise<void> {
  const series = seriesBuffer
  const distributions = distributionBuffer
  seriesBuffer = []
  distributionBuffer = []

  const apiKey = process.env.DD_API_KEY
  if (!apiKey || (series.length === 0 && distributions.length === 0)) return

  const now = Math.floor(Date.now() / 1000)
  const headers = {
    'Content-Type': 'application/json',
    'DD-API-KEY': apiKey,
  }

  const requests: Promise<Response>[] = []
  if (series.length > 0) {
    requests.push(
      fetch(SERIES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          series: series.map((s) => ({
            metric: s.metric,
            type: s.type,
            points: [{ timestamp: now, value: s.value }],
            tags: s.tags,
          })),
        }),
      }),
    )
  }
  if (distributions.length > 0) {
    requests.push(
      fetch(DISTRIBUTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          series: distributions.map((d) => ({
            metric: d.metric,
            points: [[now, [d.value]]],
            tags: d.tags,
          })),
        }),
      }),
    )
  }

  const results = await Promise.allSettled(requests)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[worker-metrics] metric submission failed:', result.reason)
    } else if (!result.value.ok) {
      console.error(
        '[worker-metrics] Datadog rejected metrics: HTTP',
        result.value.status,
      )
    }
  }
}
