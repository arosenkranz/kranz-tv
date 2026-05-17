import { test, expect } from '@playwright/test'

const SC_CHANNELS = [
  { id: 'sc-calming', number: 16, name: 'Calming' },
  { id: 'sc-all-time-favorites', number: 17, name: 'All Time Favorites' },
  { id: 'sc-deeply-disco', number: 20, name: 'Deeply Disco' },
]

// Errors that are expected / outside our control and should not fail tests
const NOISE_PATTERNS = [
  'hydration',
  'tree hydrated',
  'compute-pressure',
  // SC widget's internal iframe fetches geo-blocked/private tracks — not our code
  'Failed to load resource',
  // React StrictMode double-invokes effects; first fetch is deliberately cancelled
  'signal is aborted without reason',
]

function isNoise(msg: string): boolean {
  return NOISE_PATTERNS.some((p) => msg.includes(p))
}

for (const channel of SC_CHANNELS) {
  test(`SC CH${channel.number} ${channel.name} loads and plays`, async ({
    page,
  }) => {
    const errors: string[] = []
    const sc404s: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error' && !isNoise(text)) {
        errors.push(`[error] ${text.slice(0, 200)}`)
      }
    })
    page.on('pageerror', (err) => {
      if (!isNoise(err.message)) {
        errors.push(`[pageerror] ${err.message.slice(0, 200)}`)
      }
    })
    page.on('response', (resp) => {
      const url = resp.url()
      // Double-encoded widget URLs are the bug we fixed — flag if they return
      if (
        url.includes('soundcloud.com') &&
        resp.status() === 404 &&
        url.includes('player/?url=https://w.soundcloud.com')
      ) {
        sc404s.push(url.slice(0, 140))
      }
    })

    await page.addInitScript(() => {
      localStorage.setItem('kranz-tv-welcome-dismissed', 'true')
    })

    await page.goto(`/channel/${channel.id}`, {
      waitUntil: 'domcontentloaded',
    })

    const startBtn = page.getByRole('button', { name: /start watching/i })
    if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startBtn.click()
    }

    // Wait for SC API + widget SDK + READY + load() + PLAY_PROGRESS + seek
    await page.waitForTimeout(20000)

    await page.screenshot({
      path: `/tmp/sc-${channel.id}.png`,
      fullPage: false,
    })

    const bodyText = await page.evaluate(() => document.body.innerText)
    const onAirMatch = bodyText.match(/ON AIR\s*\n([^\n]+)/)
    const nowPlayingTitle = onAirMatch?.[1]?.trim() ?? '(not found)'

    console.log(`CH${channel.number} ${channel.name}: ON AIR = "${nowPlayingTitle}"`)
    if (sc404s.length) console.log(`  Double-encoded 404s: ${sc404s.join(', ')}`)
    if (errors.length) console.log(`  Errors: ${errors.join(', ')}`)

    expect(errors, `Unexpected JS errors on ${channel.name}`).toHaveLength(0)
    expect(sc404s, `Double-encoded SC URLs on ${channel.name}`).toHaveLength(0)
    expect(
      bodyText.toUpperCase().includes('TUNING IN'),
      `${channel.name} stuck on loading screen after 20s`,
    ).toBe(false)
    expect(bodyText.includes('NO SIGNAL'), `${channel.name} shows NO SIGNAL`).toBe(false)
    expect(nowPlayingTitle, `${channel.name} ON AIR empty`).not.toBe('(not found)')
  })
}
