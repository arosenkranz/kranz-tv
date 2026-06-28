import { test, expect, chromium } from '@playwright/test'

// PR 2 browser verification — drives each new GLSL preset in a real headless
// Chromium (WebGL2 via ANGLE) and screenshots it. SoundCloud channels don't
// resolve headless, so we inject a resolved music channel into the v2 channel
// cache (kranz-tv:channel-cache-v2:sc-calming) via addInitScript BEFORE the app
// reads it — sidestepping SC resolution entirely.
//
// Run against a dev/preview server on port 3001 (same as viz-check.spec.ts).

const BASE = 'http://localhost:3001'
const CHANNEL_ID = 'sc-calming'

// A schema-valid resolved music Channel (matches MusicChannelSchema): raw SC
// permalink embedUrls (NOT w.soundcloud.com widget URLs, which the cache loader
// rejects), trackCount + totalDurationSeconds consistent with the tracks.
const resolvedChannel = {
  kind: 'music',
  id: CHANNEL_ID,
  number: 16,
  name: 'Calming',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/krunz/sets/calming',
  description: 'Calming SoundCloud set',
  trackCount: 2,
  totalDurationSeconds: 480,
  tracks: [
    {
      id: 'verify-track-1',
      title: 'Verify Track One',
      artist: 'KranzTV',
      durationSeconds: 240,
      embedUrl: 'https://soundcloud.com/krunz/verify-track-one',
    },
    {
      id: 'verify-track-2',
      title: 'Verify Track Two',
      artist: 'KranzTV',
      durationSeconds: 240,
      embedUrl: 'https://soundcloud.com/krunz/verify-track-two',
    },
  ],
}

const PRESETS = [
  'fractal-voyage',
  'liquid-ink',
  'lava-drip',
  'oil-slick',
  'blacklight',
  'mandala',
  'starfield',
] as const
// Representative feedback preset for the intensity-knob check.
const FEEDBACK_PRESET = 'lava-drip'
const INTENSITIES_FOR_FEEDBACK = ['chill', 'max'] as const

test('PR2 visualizer presets render in real WebGL2', async () => {
  // 7 navigations × (≤6s boot failsafe + render settle) needs well over the
  // default 30s budget.
  test.setTimeout(150_000)
  const browser = await chromium.launch({
    args: [
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--enable-unsafe-webgl',
      '--enable-webgl',
    ],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // Seed the resolved channel into the v2 cache + mark desktop onboarding seen,
  // both before any page script runs — otherwise the first-visit welcome modal
  // covers the visualizer canvas.
  await page.addInitScript(
    ([id, channel]) => {
      const entry = { channel, cachedAt: Date.now() }
      window.localStorage.setItem(
        `kranz-tv:channel-cache-v2:${id}`,
        JSON.stringify(entry),
      )
      window.localStorage.setItem('kranz-tv:desktop-onboarding-seen', 'true')
    },
    [CHANNEL_ID, resolvedChannel] as const,
  )

  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  const results: Record<string, { canvas: number; loading: number }> = {}

  // The boot screen gates on scReady ("WARMING SOUNDCLOUD"), which never fires
  // headless — but sc-widget-context has a 6s failsafe that flips isReady true.
  // Wait that out (plus margin) before the first screenshot, then the boot
  // overlay is gone and the visualizer is visible.
  const settleForBoot = async () => {
    // BootScreen renders a "WARMING SOUNDCLOUD" phase label; wait for it to leave.
    await page
      .getByText('WARMING SOUNDCLOUD', { exact: false })
      .waitFor({ state: 'detached', timeout: 12000 })
      .catch(() => {
        /* already gone */
      })
  }

  // Each preset at normal intensity.
  for (const preset of PRESETS) {
    await page.goto(
      `${BASE}/channel/${CHANNEL_ID}?viz=${preset}&viz-intensity=normal`,
      { waitUntil: 'domcontentloaded', timeout: 20000 },
    )
    await settleForBoot()
    // Let the shader compile + render several frames (feedback trails need time).
    await page.waitForTimeout(3500)
    const canvas = await page
      .locator('[data-testid="music-visualizer-canvas"]')
      .count()
    // The LOADING VISUAL… placeholder must NOT be stuck on for a shader-quad preset.
    const loading = await page
      .locator('[data-testid="visualizer-loading"]')
      .count()
    results[preset] = { canvas, loading }
    await page.screenshot({ path: `test-results/viz-${preset}.png` })
  }

  await settleForBoot()
  // A feedback preset at chill + max to confirm the intensity knob is meaningful.
  for (const level of INTENSITIES_FOR_FEEDBACK) {
    await page.goto(
      `${BASE}/channel/${CHANNEL_ID}?viz=${FEEDBACK_PRESET}&viz-intensity=${level}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 },
    )
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `test-results/viz-${FEEDBACK_PRESET}-${level}.png` })
  }

  // Resize during a feedback preset — exercises the FBO reallocation path.
  await page.goto(
    `${BASE}/channel/${CHANNEL_ID}?viz=${FEEDBACK_PRESET}&viz-intensity=normal`,
    { waitUntil: 'domcontentloaded', timeout: 20000 },
  )
  await page.waitForTimeout(2500)
  await page.setViewportSize({ width: 900, height: 700 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `test-results/viz-${FEEDBACK_PRESET}-resized.png` })

  if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
  console.log('PRESET RESULTS:', JSON.stringify(results, null, 2))

  await browser.close()

  // Every preset must mount a canvas and NOT be stuck on the loading placeholder.
  for (const preset of PRESETS) {
    expect(results[preset].canvas, `${preset} canvas`).toBeGreaterThan(0)
    expect(results[preset].loading, `${preset} not stuck loading`).toBe(0)
  }
  // Filter the known pre-existing hydration mismatch (issue #74 — React SSR/client
  // divergence on overlay markup). Dev builds emit the verbose "did not match the
  // server-rendered HTML" wording; production builds minify it to "React error
  // #418/#423" (the hydration-mismatch family). Match both forms by code so the
  // filter is build-mode-agnostic — a real WebGL/shader error is never a #418/#423,
  // so genuine visualizer failures still surface and fail the test.
  const vizErrors = errors.filter(
    (e) =>
      !/hydrat|did not match the server-rendered|server-rendered HTML|Minified React error #(418|423|425)/i.test(
        e,
      ),
  )
  expect(vizErrors, 'no visualizer-related page errors').toEqual([])
})
