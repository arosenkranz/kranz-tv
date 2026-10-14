/**
 * Workers-compatible Datadog metrics client. dd-trace/DogStatsD cannot run
 * on Cloudflare Workers, so metrics are submitted over HTTP:
 * counts/gauges → v2 series API, distributions → v1 distribution_points
 * (the API-native replacement for DogStatsD histograms).
 *
 * createMetricsBatch() returns a request-local batch: points buffer inside
 * the batch, flush() posts them, and concurrent requests can never mix or
 * steal each other's points (there is no module-level buffer). Without
 * DD_API_KEY everything is a silent no-op (same contract as initRum).
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

export interface MetricsBatch {
  /** Buffer a count point (value 1) for this batch. */
  increment: (name: string, tags?: Record<string, string>) => void
  /** Buffer a gauge point for this batch. */
  recordGauge: (
    name: string,
    value: number,
    tags?: Record<string, string>,
  ) => void
  /** Buffer a distribution point for this batch. */
  recordDistribution: (
    name: string,
    value: number,
    tags?: Record<string, string>,
  ) => void
  /**
   * Post buffered points. Never rejects — metric loss must not break
   * requests. No-op without DD_API_KEY or with an empty batch.
   */
  flush: () => Promise<void>
}

function baseTags(): string[] {
  return [
    'service:kranz-tv',
    `env:${process.env.DD_ENV ?? 'production'}`,
    `version:${__APP_VERSION__}`,
  ]
}

function formatTags(tags?: Record<string, string>): string[] {
  const custom = tags ? Object.entries(tags).map(([k, v]) => `${k}:${v}`) : []
  return [...baseTags(), ...custom]
}

/** Log an error without its stack/payload: logs must never leak the API key or request data. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createMetricsBatch(): MetricsBatch {
  const series: SeriesPoint[] = []
  const distributions: DistributionPoint[] = []

  async function flush(): Promise<void> {
    // Hand the buffers over atomically: points recorded after this call
    // (e.g. a second flush on the same batch) stay out of this submission.
    const seriesToSend = series.splice(0)
    const distributionsToSend = distributions.splice(0)

    const apiKey = process.env.DD_API_KEY
    if (
      !apiKey ||
      (seriesToSend.length === 0 && distributionsToSend.length === 0)
    ) {
      return
    }

    try {
      const now = Math.floor(Date.now() / 1000)
      const headers = {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
      }

      const requests: Promise<Response>[] = []
      if (seriesToSend.length > 0) {
        requests.push(
          fetch(SERIES_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              series: seriesToSend.map((s) => ({
                metric: s.metric,
                type: s.type,
                points: [{ timestamp: now, value: s.value }],
                tags: s.tags,
              })),
            }),
          }),
        )
      }
      if (distributionsToSend.length > 0) {
        requests.push(
          fetch(DISTRIBUTION_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              series: distributionsToSend.map((d) => ({
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
          console.error(
            '[worker-metrics] metric submission failed:',
            errorMessage(result.reason),
          )
        } else if (!result.value.ok) {
          console.error(
            '[worker-metrics] Datadog rejected metrics: HTTP',
            result.value.status,
          )
        }
      }
    } catch (error) {
      // Defensive: flush() must never reject, even for an unexpected bug —
      // the response path must not depend on metric submission.
      console.error(
        '[worker-metrics] metric submission failed:',
        errorMessage(error),
      )
    }
  }

  return {
    increment(name, tags) {
      series.push({
        metric: name,
        type: TYPE_COUNT,
        value: 1,
        tags: formatTags(tags),
      })
    },
    recordGauge(name, value, tags) {
      series.push({
        metric: name,
        type: TYPE_GAUGE,
        value,
        tags: formatTags(tags),
      })
    },
    recordDistribution(name, value, tags) {
      distributions.push({
        metric: name,
        value,
        tags: formatTags(tags),
      })
    },
    flush,
  }
}
