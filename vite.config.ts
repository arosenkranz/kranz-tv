import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import path from 'node:path'
import pkg from './package.json' with { type: 'json' }

// Two build targets share this config:
// - Cloudflare Workers (default): `pnpm dev` / `pnpm build` / `pnpm deploy`,
//   bundled by @cloudflare/vite-plugin and deployed via wrangler
// - Node server (Docker): `pnpm build:node` sets NITRO_PRESET=node-server,
//   switching to the Nitro adapter that emits .output/server/index.mjs
const isNodeTarget = Boolean(process.env.NITRO_PRESET)

const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    devtools(),
    // The target adapter must come before tanstackStart().
    ...(isNodeTarget
      ? [
          nitro({
            rollupConfig: { external: [/^@sentry\//, /^dd-trace/] },
          }),
        ]
      : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    alias: {
      // Target-specific waitUntil adapter, selected before the general '~'
      // alias. The Cloudflare build must link the adapter that imports
      // cloudflare:workers (wait-until.cloudflare.ts); the Node build must
      // never resolve it. tsc and Vitest see the default wait-until.ts,
      // which re-exports the Node adapter.
      '~/lib/runtime/wait-until': path.resolve(
        __dirname,
        isNodeTarget
          ? './src/lib/runtime/wait-until.node.ts'
          : './src/lib/runtime/wait-until.cloudflare.ts',
      ),
      '~': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: true,
  },
})

export default config
