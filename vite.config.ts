import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import path from 'node:path'
import pkg from './package.json' with { type: 'json' }

// In dev, `vite dev` doesn't activate Nitro's Cloudflare preset, so the
// `cloudflare:workers` virtual module isn't resolved. This plugin redirects
// imports to a local shim that lazy-creates an in-memory KV on first access.
// Production deploys use Nitro's preset and real KV — this plugin is dev-only.
function cloudflareWorkersDevShim(): Plugin {
  const shimPath = path.resolve(
    __dirname,
    './src/lib/shares/dev/cloudflare-workers-shim.ts',
  )
  return {
    name: 'kranz-tv:cloudflare-workers-dev-shim',
    apply: 'serve',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'cloudflare:workers') return shimPath
      return null
    },
  }
}

const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    cloudflareWorkersDevShim(),
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
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  // `cloudflare:*` virtual modules are provided by the Workers runtime
  // (or by Nitro's preset). They must be externalized in every Rollup pass —
  // Nitro plugin externals only cover Nitro's pass.
  // SSR external takes string IDs only (no regex), so we list the modules
  // we actually import.
  ssr: {
    external: ['cloudflare:workers'],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [/^cloudflare:/],
    },
  },
})

export default config
