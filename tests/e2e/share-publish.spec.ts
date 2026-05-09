import { test, expect } from '@playwright/test'
import { seedCustomChannel } from './helpers/seed'

// E2E: full publish flow.
//
// Strategy: seed a custom channel directly via localStorage (avoids the YouTube
// API key dependency in CI), then exercise the share button. This is enough
// to verify the publish pipeline end-to-end against the in-memory KV stub
// that Nitro's dev plugin provides for `cloudflare:workers`.

test.describe('Share publish flow', () => {
  test.beforeEach(async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1440
    test.skip(
      viewportWidth <= 639,
      'Share button is desktop-only in v1; mobile placement deferred',
    )
    await seedCustomChannel(page)
  })

  test('publishing a custom channel exposes a share URL via the share button', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto('/channel/e2e-test-channel')
    const shareButton = page.getByTestId('share-button')
    await expect(shareButton).toBeVisible({ timeout: 10_000 })
    await expect(shareButton).toHaveText(/SHARE/)

    await shareButton.click()
    await expect(page.locator('text=LINK COPIED')).toBeVisible({
      timeout: 10_000,
    })

    const clipboard = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    )
    expect(clipboard).toMatch(/\/s\/[0-9A-HJKMNP-TV-Z]{8}$/)

    await expect(shareButton).toHaveText(/REVOKE/, { timeout: 3_000 })
  })

  test('idempotent re-publish returns the same URL', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto('/channel/e2e-test-channel')
    await expect(page.getByTestId('share-button')).toBeVisible({
      timeout: 10_000,
    })

    await page.getByTestId('share-button').click()
    await expect(page.locator('text=LINK COPIED')).toBeVisible({
      timeout: 10_000,
    })
    const firstUrl = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    )

    // Clear the local shareRef to simulate a sharer who lost their UI state
    // but still has the credential — re-share should hit idempotency and
    // return the same URL.
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('kranz-tv:custom-channels')
      if (raw === null) return
      const parsed = JSON.parse(raw) as Array<{ shareRef?: unknown }>
      for (const c of parsed) delete c.shareRef
      window.localStorage.setItem(
        'kranz-tv:custom-channels',
        JSON.stringify(parsed),
      )
    })
    await page.reload()
    await expect(page.getByTestId('share-button')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByTestId('share-button')).toHaveText(/SHARE/)

    await page.getByTestId('share-button').click()
    await expect(page.locator('text=LINK COPIED')).toBeVisible({
      timeout: 10_000,
    })
    const secondUrl = await page.evaluate(async () =>
      navigator.clipboard.readText(),
    )

    expect(secondUrl).toBe(firstUrl)
  })
})
