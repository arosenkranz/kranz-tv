import { test, expect } from '@playwright/test'
import { dismissOnboarding, seedCustomChannel } from './helpers/seed'

// E2E: revoke flow.
//
// Publish a share, revoke it via the same channel's button (the same button
// switches modes to REVOKE after a successful publish), then verify a fresh
// browser context cannot receive the share.

test.describe('Share revoke flow', () => {
  test.beforeEach(async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1440
    test.skip(viewportWidth <= 639, 'Revoke flow is desktop-only in v1')
  })

  test('revoking a share prevents new recipients from tuning in', async ({
    browser,
  }) => {
    const sharerContext = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
      viewport: { width: 1440, height: 900 },
    })
    const sharerPage = await sharerContext.newPage()
    // Auto-confirm the revoke dialog.
    sharerPage.on('dialog', (dialog) => {
      void dialog.accept()
    })

    await seedCustomChannel(sharerPage)
    await sharerPage.goto('/channel/e2e-test-channel')
    await expect(sharerPage.getByTestId('share-button')).toBeVisible({
      timeout: 10_000,
    })

    // Publish.
    const shareButton = sharerPage.getByTestId('share-button')
    await shareButton.click()
    await expect(sharerPage.locator('text=LINK COPIED')).toBeVisible()
    const shareUrl = await sharerPage.evaluate(async () =>
      navigator.clipboard.readText(),
    )

    // Button should now read REVOKE.
    await expect(shareButton).toHaveText(/REVOKE/, { timeout: 3_000 })

    // Revoke.
    await shareButton.click()
    await expect(sharerPage.locator('text=REVOKED')).toBeVisible({
      timeout: 5_000,
    })

    // Button should be back to SHARE (shareRef cleared from local).
    await expect(shareButton).toHaveText(/SHARE$/, { timeout: 3_000 })

    // ── Fresh recipient context — should see "channel unavailable" ─────────
    const recipientContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const recipientPage = await recipientContext.newPage()
    await dismissOnboarding(recipientPage)
    await recipientPage.goto(shareUrl)
    await expect(
      recipientPage.locator('text=This channel is no longer available'),
    ).toBeVisible({ timeout: 10_000 })

    await sharerContext.close()
    await recipientContext.close()
  })
})
