import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import path from 'node:path'
import pkg from './package.json' with { type: 'json' }

// In dev, `vite dev` doesn't activate Nitro's Cloudflare preset, so the
// `cloudflare:workers` virtual module isn't resolved. We alias it to a local
// shim that lazy-creates an in-memory KV on first access. The alias is
// applied via `resolve.alias` (not a plugin) so it runs before `ssr.external`
// and reaches Nitro's env-runner child process — a plugin's `resolveId`
// hook only fires in the main Vite process. Production deploys use Nitro's
// preset and real KV; the alias is no-op in production builds because we
// also externalize the same id under `build.rollupOptions.external`.
const isDev = process.env['NODE_ENV'] !== 'production'
const cloudflareWorkersShimPath = path.resolve(
  __dirname,
  './src/lib/shares/dev/cloudflare-workers-shim.ts',
)

const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: {
        external: [/^@sentry\//, /^dd-trace/, /^cloudflare:/],
      },
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: isDev
      ? {
          '~': path.resolve(__dirname, './src'),
          // Dev-only: redirect cloudflare:workers to our in-memory shim. In
          // production this is externalized via build.rollupOptions.external
          // and Nitro's preset provides the real implementation.
          'cloudflare:workers': cloudflareWorkersShimPath,
        }
      : {
          '~': path.resolve(__dirname, './src'),
        },
  },
  // `cloudflare:*` virtual modules are provided by the Workers runtime
  // (or by Nitro's preset). In production builds they must be externalized
  // in every Rollup pass — Nitro plugin externals only cover Nitro's pass.
  // In dev, the alias above takes precedence so externalization is skipped.
  ssr: isDev ? undefined : { external: ['cloudflare:workers'] },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [/^cloudflare:/],
    },
  },
})

export default config
