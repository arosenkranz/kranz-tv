import { test, expect } from '@playwright/test'
import { dismissOnboarding, seedCustomChannel } from './helpers/seed'

// E2E: full publish-then-receive loop.
//
// One browser publishes (sharer); a second browser context receives by
// opening the share URL. Verifies the recipient lands on the channel page,
// the channel persists in their localStorage, and the loader completes
// without further /api/shares calls on subsequent visits (FR-008).

test.describe('Share receive flow', () => {
  test.beforeEach(async ({ page }) => {
    const viewportWidth = page.viewportSize()?.width ?? 1440
    test.skip(viewportWidth <= 639, 'Sharer flow is desktop-only in v1')
  })

  test('recipient receives a published share and persists it locally', async ({
    browser,
  }) => {
    // ── Sharer context ─────────────────────────────────────
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

    // ── Recipient context (fresh browser — no shared localStorage) ─────────
    const recipientContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const recipientPage = await recipientContext.newPage()
    await dismissOnboarding(recipientPage)

    // Track network calls to /api/shares — should fire exactly once.
    const shareApiCalls: string[] = []
    recipientPage.on('request', (req) => {
      const url = req.url()
      if (url.includes('/_serverFn/') && url.includes('shares')) {
        shareApiCalls.push(url)
      }
    })

    await recipientPage.goto(shareUrl)
    // The recipient route validates → resolves → imports → redirects.
    // We expect to land on /channel/share-<SHAREID> within 15s.
    await recipientPage.waitForURL(/\/channel\/share-[0-9A-HJKMNP-TV-Z]{8}/, {
      timeout: 15_000,
    })

    // Verify the channel was persisted to localStorage with shareRef.
    const storedChannels = await recipientPage.evaluate(() => {
      const raw = window.localStorage.getItem('kranz-tv:custom-channels')
      return raw === null
        ? []
        : (JSON.parse(raw) as Array<{
            id: string
            shareRef?: { shareId: string; role: string }
          }>)
    })
    expect(storedChannels).toHaveLength(1)
    expect(storedChannels[0]?.shareRef?.role).toBe('recipient')

    // Reload — should hit idempotent receive path, no further /api/shares calls.
    const callsBeforeReload = shareApiCalls.length
    await recipientPage.reload()
    // Channel route lacks a stable selector; wait briefly for any /api/shares
    // call that would happen on hydration to either fire (failing the
    // assertion) or not fire (passing).
    await recipientPage.waitForTimeout(2000)
    expect(shareApiCalls.length).toBe(callsBeforeReload)

    await sharerContext.close()
    await recipientContext.close()
  })
})
