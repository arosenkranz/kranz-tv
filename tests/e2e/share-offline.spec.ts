import { test, expect } from '@playwright/test'
import { dismissOnboarding, seedCustomChannel } from './helpers/seed'

// E2E: receipient stays offline-first.
//
// After a recipient has resolved a share once, all subsequent visits to the
// channel must NOT call /api/shares — even when the registry is unreachable.
// This guards FR-008 + SC-005 against any future regression that couples
// the channel-route page to the share registry.

test.describe('Recipient offline-first behavior', () => {
  test.beforeEach(async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1440
    test.skip(viewportWidth <= 639, 'Sharer flow is desktop-only in v1')
  })

  test('a received share keeps working when the registry is down', async ({
    browser,
  }) => {
    // Sharer publishes.
    const sharerContext = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
      viewport: { width: 1440, height: 900 },
    })
    const sharerPage = await sharerContext.newPage()
    await seedCustomChannel(sharerPage)
    await sharerPage.goto('/channel/e2e-test-channel')
    await expect(sharerPage.getByTestId('share-button')).toBeVisible({
      timeout: 10_000,
    })
    await sharerPage.getByTestId('share-button').click()
    await expect(sharerPage.locator('text=LINK COPIED')).toBeVisible()
    const shareUrl = await sharerPage.evaluate(async () =>
      navigator.clipboard.readText(),
    )

    // Recipient receives (online).
    const recipientContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const recipientPage = await recipientContext.newPage()
    await dismissOnboarding(recipientPage)
    await recipientPage.goto(shareUrl)
    await recipientPage.waitForURL(/\/channel\/share-/, { timeout: 15_000 })
    const channelUrl = recipientPage.url()

    // Now block all /api/shares calls — simulating registry outage.
    await recipientContext.route('**/_serverFn/**shares**', (route) => {
      void route.abort('failed')
    })

    // Track calls. There should be zero after blocking.
    const blockedCalls: string[] = []
    recipientPage.on('requestfailed', (req) => {
      const url = req.url()
      if (url.includes('shares')) blockedCalls.push(url)
    })

    // Reload the channel route directly (not /s/<id>). This is the path that
    // matters: navigating to a previously-resolved channel should never need
    // the registry.
    await recipientPage.goto(channelUrl)
    // Wait briefly for any errant /api/shares call on hydration to fire.
    await recipientPage.waitForTimeout(2000)

    // Confirm we're on the channel page (not in a fallback/error state).
    expect(recipientPage.url()).toContain('/channel/share-')
    expect(blockedCalls).toEqual([])

    await sharerContext.close()
    await recipientContext.close()
  })
})
