import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'node:path'

export default defineConfig({
  plugins: [viteReact(), tsconfigPaths({ projects: ['./tsconfig.json'] })],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/routeTree.gen.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        // Browser-only modules that cannot run in jsdom
        'src/lib/datadog/**',
        // Generated route types
        'src/routes/api/**',
        'src/routes/__root.tsx',
        'src/routes/-dev-tools.tsx',
        // Type-only files with no executable code
        'src/lib/channels/types.ts',
        'src/lib/scheduling/types.ts',
      ],
    },
  },
})
