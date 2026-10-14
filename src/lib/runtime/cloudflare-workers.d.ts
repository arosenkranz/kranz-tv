/**
 * Ambient types for the `cloudflare:workers` service module. Only the
 * surface this app uses is declared (mirroring waitUntil from the installed
 * @cloudflare/workers-types `declare module "cloudflare:workers"`), so the
 * Node/DOM type environment stays untouched.
 */
declare module 'cloudflare:workers' {
  export function waitUntil(promise: Promise<unknown>): void
}
