import { test, expect, chromium } from '@playwright/test'

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

  await page.goto('http://localhost:3001/channel/sc-calming', { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForTimeout(4000)

  const canvasCount = await page.locator('[data-testid="music-visualizer-canvas"]').count()

  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
  console.log('viz canvas count:', canvasCount)

  await page.screenshot({ path: 'test-results/viz-check.png' })
  await browser.close()

  expect(canvasCount).toBeGreaterThan(0)
})
