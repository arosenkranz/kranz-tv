import { test, expect, chromium } from '@playwright/test'
import config from '../../playwright.config'

// This test launches its own chromium browser instead of using Playwright's
// `page` fixture, so `baseURL` from the config is NOT applied automatically.
// Source it from the config directly so the port can never drift out of sync
// with `webServer.url` / `use.baseURL` (the original bug: hardcoded :3001).
const baseURL = config.use?.baseURL ?? 'http://localhost:3000'

// KNOWN CAVEAT: SoundCloud channels do not resolve in local dev / headless
// runs, so a music channel stays stuck in the RESOLVING SIGNAL… (TUNING) state
// and MusicChannelView — which hosts the visualizer canvas — never mounts. Even
// with the port fixed, this test can time out waiting for a canvas that is
// gated behind SC resolution unless a resolved channel is injected into
// localStorage (key `kranz-tv:channel-cache-v2:<id>`) before navigation. That
// injection is out of scope here; documented so the gap is visible.
test('music channel renders WebGL visualization canvas', async () => {
  // Headless Chrome requires explicit GPU flags for WebGL2 support
  const browser = await chromium.launch({
    args: [
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-unsafe-webgl',
      '--enable-webgl',
    ],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))

  await page.goto(`${baseURL}/channel/sc-calming`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(4000)

  const canvasCount = await page.locator('[data-testid="music-visualizer-canvas"]').count()

  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
  console.log('viz canvas count:', canvasCount)

  await page.screenshot({ path: 'test-results/viz-check.png' })
  await browser.close()

  expect(canvasCount).toBeGreaterThan(0)
})
