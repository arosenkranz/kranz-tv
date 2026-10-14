/**
 * Instrumentation wrapper for the API proxy routes (the only server code
 * paths with real production traffic). Emits a request count tagged by
 * route + status and a latency distribution, then submits the batch.
 *
 * Metrics must NEVER affect the response: emission is wrapped so a metrics
 * bug degrades to a console.error, and the handler result/error passes
 * through untouched. Submission is registered with the target-specific
 * waitUntil adapter — on Cloudflare that keeps the Datadog call alive
 * after the invocation ends; on Node it stays non-blocking. Either way the
 * response never waits on metric submission.
 */
import type { MetricsBatch } from './worker-metrics'
import { createMetricsBatch } from './worker-metrics'
import { waitUntil } from '~/lib/runtime/wait-until'

export type ProxyRoute = 'soundcloud' | 'youtube'

function emitProxyMetrics(
  batch: MetricsBatch,
  route: ProxyRoute,
  status: 'ok' | 'error',
  elapsedMs: number,
): void {
  try {
    batch.increment('kranz_tv.server.proxy_request', { route, status })
    batch.recordDistribution('kranz_tv.server.proxy_ms', elapsedMs, { route })
    // flush() never rejects; registering it (instead of awaiting) keeps
    // the response off the Datadog request path while guaranteeing the
    // submission can complete after the response on Workers.
    waitUntil(batch.flush())
  } catch (error) {
    console.error('[proxy-metrics] metric emission failed:', error)
  }
}

/** Run proxy handler work, recording exactly one count + one latency point. */
export async function withProxyMetrics<T>(
  route: ProxyRoute,
  work: () => Promise<T>,
): Promise<T> {
  // The batch is created per call, so concurrent requests record into
  // separate buffers and can never combine or steal each other's points.
  const batch = createMetricsBatch()
  const start = performance.now()
  try {
    const result = await work()
    emitProxyMetrics(batch, route, 'ok', performance.now() - start)
    return result
  } catch (error) {
    emitProxyMetrics(batch, route, 'error', performance.now() - start)
    throw error
  }
}
