/**
 * Cloudflare Workers adapter. waitUntil() from cloudflare:workers registers
 * background work with the current invocation, so metric submissions can
 * complete after the response is returned. Only linked into the Workers
 * build: vite.config.ts aliases this file in; tsc and Vitest resolve the
 * Node adapter instead.
 */
import { waitUntil } from 'cloudflare:workers'

export { waitUntil }
