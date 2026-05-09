// Virtual module provided by the Cloudflare Workers runtime.
// At build time, Nitro's Cloudflare preset injects this; the dev plugin
// shims it with `unenv`'s `process.env`. We only declare the surface we
// actually use — see `~/lib/shares/handlers.ts` for the `KVNamespace` shape.

declare module 'cloudflare:workers' {
  // The full `env` shape is defined by `wrangler.jsonc`. We type it as a
  // dictionary; consumers narrow to specific bindings (e.g., `KVNamespace`)
  // at the call site.
  export const env: Record<string, unknown>

  // `waitUntil` is a Cloudflare Workers API for extending the request
  // lifecycle. Not used by the shares feature, but typed defensively.
  export function waitUntil(promise: Promise<unknown>): Promise<void>
}
