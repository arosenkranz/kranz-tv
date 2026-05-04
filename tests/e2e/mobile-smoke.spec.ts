import { test, expect } from '@playwright/test'

test('MobileNowNextBar is visible on channel page', async ({ page }) => {
  // Skip on desktop — the MobileNowNextBar only renders on mobile viewports
  const viewportWidth = page.viewportSize()?.width ?? 1440
  test.skip(
    viewportWidth > 639,
    'Mobile-only test — skipping on non-mobile viewport',
  )

  await page.goto('/channel/lofi-hip-hop')
  await page.waitForLoadState('networkidle')

  const nowPlayingBar = page.getByRole('button', {
    name: /Now playing/i,
  })

  await expect(nowPlayingBar).toBeVisible()
})
