/**
 * Node adapter (Docker server). The process outlives the request, so
 * background work is plain fire-and-forget with a catch, so an unexpected
 * failure logs instead of becoming an unhandled rejection. Never resolves
 * the Cloudflare service module — that import is Workers-only.
 */
export function waitUntil(promise: Promise<unknown>): void {
  void promise.catch((error) => {
    console.error('[wait-until] background work failed:', error)
  })
}
