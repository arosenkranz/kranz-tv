import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'iPhone 14',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'iPad Mini',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'Desktop Chrome',
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    timeout: 30_000,
    reuseExistingServer: !process.env['CI'],
  },
})
