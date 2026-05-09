// Test helpers shared across the share-* E2E suites.
//
// `seedCustomChannel` puts a known-good custom channel + dismisses the
// onboarding modal so tests can interact with the page without first having
// to drive through the welcome flow.

import type { Page } from '@playwright/test'

export const E2E_CHANNEL_ID = 'e2e-test-channel'

export async function seedCustomChannel(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    // Mark onboarding as seen so the welcome modal doesn't block clicks.
    window.localStorage.setItem('kranz-tv:desktop-onboarding-seen', 'true')
    window.localStorage.setItem('kranz-tv:mobile-onboarding-seen', 'true')

    const customChannel = {
      kind: 'video',
      id: 'e2e-test-channel',
      number: 99,
      name: 'E2E Test Channel',
      playlistId: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
      videos: [
        {
          id: 'dQw4w9WgXcQ',
          title: 'Test Video',
          durationSeconds: 213,
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        },
      ],
      totalDurationSeconds: 213,
    }
    window.localStorage.setItem(
      'kranz-tv:custom-channels',
      JSON.stringify([customChannel]),
    )
  })
}

/**
 * Skip onboarding for a fresh recipient browser context (no custom channels
 * seeded — recipient gets one from the share URL).
 */
export async function dismissOnboarding(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.setItem('kranz-tv:desktop-onboarding-seen', 'true')
    window.localStorage.setItem('kranz-tv:mobile-onboarding-seen', 'true')
  })
}
