/**
 * Default waitUntil resolution: the Node adapter. tsc and Vitest resolve
 * this file; the build-time alias in vite.config.ts swaps in the Cloudflare
 * adapter for Workers builds, which must be the only place that ever
 * resolves cloudflare:workers.
 */
export { waitUntil } from './wait-until.node'
