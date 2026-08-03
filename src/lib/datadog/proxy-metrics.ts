/**
 * Instrumentation wrapper for the API proxy routes (the only server code
 * paths with real production traffic). Emits a request count tagged by
 * route + status and a latency distribution, then flushes fire-and-forget.
 *
 * Metrics must NEVER affect the response: emission is wrapped so a metrics
 * bug degrades to a console.error, and the handler result/error passes
 * through untouched.
 */
import {
  flushMetrics,
  incrementMetric,
  recordDistribution,
} from './worker-metrics'

export type ProxyRoute = 'soundcloud' | 'youtube'

function emitProxyMetrics(
  route: ProxyRoute,
  status: 'ok' | 'error',
  elapsedMs: number,
): void {
  try {
    incrementMetric('kranz_tv.server.proxy_request', { route, status })
    recordDistribution('kranz_tv.server.proxy_ms', elapsedMs, { route })
    // Fire-and-forget: flushMetrics never rejects, and the response must
    // not wait on metric submission.
    void flushMetrics()
  } catch (error) {
    console.error('[proxy-metrics] metric emission failed:', error)
  }
}

/** Run proxy handler work, recording exactly one count + one latency point. */
export async function withProxyMetrics<T>(
  route: ProxyRoute,
  work: () => Promise<T>,
): Promise<T> {
  const start = performance.now()
  try {
    const result = await work()
    emitProxyMetrics(route, 'ok', performance.now() - start)
    return result
  } catch (error) {
    emitProxyMetrics(route, 'error', performance.now() - start)
    throw error
  }
}
