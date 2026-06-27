/**
 * recoverPreset persistence contract
 *
 * Verifies that the REAL recoverPreset exported via TvLayoutContext does NOT
 * call savePreset, while setActivePreset DOES call savePreset.
 *
 * This test renders the real TvLayout component (with heavy deps mocked) so the
 * spy exercises the actual useCallback body. It will FAIL if someone changes
 * recoverPreset to call savePreset.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock all heavy TvLayout dependencies before importing the module
// ---------------------------------------------------------------------------

// OutletSlot is replaced per-test to inject a Consumer inside TvLayoutContext.Provider
let OutletSlot: () => React.ReactElement | null = () => null

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: unknown) => opts,
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Outlet: () => OutletSlot(),
}))

vi.mock('~/lib/sources/soundcloud/sc-widget-context', () => ({
  ScWidgetProvider: ({ children }: { children: React.ReactNode }) => children,
  useScWidget: () => ({ isReady: false, widget: null }),
}))

vi.mock('~/lib/channels/youtube-api', () => ({
  buildChannel: vi.fn(),
  YouTubeQuotaError: class YouTubeQuotaError extends Error {},
}))

vi.mock('~/lib/storage/local-channels', () => ({
  loadCustomChannels: () => [],
  saveCustomChannels: vi.fn(),
}))

vi.mock('~/lib/storage/preset-channel-cache', () => ({
  loadCachedChannel: () => null,
  saveCachedChannel: vi.fn(),
  clearPresetChannelCache: vi.fn(),
}))

vi.mock('~/lib/channels/revalidation', () => ({
  shouldApplyImmediately: () => false,
}))

vi.mock('~/lib/channels/quota-recovery', () => ({
  isQuotaTimestampStale: () => false,
}))

vi.mock('~/lib/datadog/rum', () => ({
  trackGuideToggle: vi.fn(),
  trackImportStarted: vi.fn(),
  trackShareChannel: vi.fn(),
  trackViewModeChange: vi.fn(),
  trackOverlayChange: vi.fn(),
  setViewerContext: vi.fn(),
  trackMusicBackdropSelected: vi.fn(),
  trackScCacheEvent: vi.fn(),
  trackScChannelLoad: vi.fn(),
}))

vi.mock('~/lib/datadog/logs', () => ({
  logChannelLoadFailed: vi.fn(),
}))

vi.mock('~/hooks/use-idle-timeout', () => ({
  useIdleTimeout: () => false,
}))

vi.mock('~/hooks/use-fullscreen', () => ({
  useFullscreen: () => ({ isFullscreen: false, toggleFullscreen: vi.fn() }),
}))

vi.mock('~/hooks/use-toast', () => ({
  useToast: () => ({ toast: null, showToast: vi.fn(), dismissToast: vi.fn() }),
}))

vi.mock('~/hooks/use-is-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('~/hooks/use-is-desktop', () => ({
  useIsDesktop: () => true,
}))

vi.mock('~/hooks/use-quota-recovery', () => ({
  useQuotaRecovery: () => ({ isRecovering: false }),
}))

vi.mock('~/hooks/use-local-storage', () => ({
  useLocalStorage: (_key: string, defaultVal: unknown) => [defaultVal, vi.fn()],
}))

vi.mock('~/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('~/contexts/surf-mode-context', () => ({
  SurfModeContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  useSurfMode: () => false,
}))

vi.mock('~/lib/import/schema', () => ({
  channelToPreset: vi.fn(),
}))

vi.mock('~/lib/scheduling/algorithm', () => ({
  getSchedulePosition: vi.fn(),
}))

vi.mock('~/lib/overlays', () => ({
  nextOverlayMode: vi.fn(),
}))

vi.mock('~/components/import-wizard/import-modal', () => ({
  ImportModal: () => null,
}))

vi.mock('~/components/quota-banner', () => ({
  QuotaBanner: () => null,
}))

vi.mock('~/components/volume-control', () => ({
  VolumeControl: () => null,
}))

vi.mock('~/components/theater-controls', () => ({
  TheaterControls: () => null,
}))

vi.mock('~/components/epg-overlay/epg-overlay', () => ({
  EpgOverlay: () => null,
}))

vi.mock('~/components/info-panel/info-panel', () => ({
  InfoPanel: () => null,
}))

vi.mock('~/components/boot-screen', () => ({
  BootScreen: () => null,
}))

vi.mock('~/components/toast', () => ({
  Toast: () => null,
}))

vi.mock('~/components/overlay-canvas', () => ({
  OverlayCanvas: () => null,
}))

vi.mock('lucide-react', () => ({
  LayoutGrid: () => null,
  Tv: () => null,
}))

// ---------------------------------------------------------------------------
// Now import the real module — the spy exercises the ACTUAL useCallback body
// ---------------------------------------------------------------------------

// These imports are intentionally placed after the vi.mock() block above so the
// "mock heavy deps, then import the module under test" grouping reads top-to-
// bottom. vi.mock is hoisted by Vitest regardless, so ordering is purely
// stylistic here — disable import/first rather than split the mock setup.
// eslint-disable-next-line import/first
import * as presetMod from '~/lib/visualizers/preset'
// eslint-disable-next-line import/first
import { TvLayout, useTvLayout } from '~/routes/_tv'

describe('recoverPreset persistence contract', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('recoverPreset does NOT call savePreset; setActivePreset DOES', () => {
    const saveSpy = vi.spyOn(presetMod, 'savePreset')

    let capturedCtx: ReturnType<typeof useTvLayout> | null = null

    // Inject Consumer into TvLayout's Outlet so it renders inside the Provider
    OutletSlot = () => {
      capturedCtx = useTvLayout()
      return null
    }

    render(React.createElement(TvLayout))

    expect(capturedCtx).not.toBeNull()

    // recoverPreset must NOT persist
    act(() => {
      capturedCtx!.recoverPreset('kaleidoscope')
    })
    expect(capturedCtx!.activePreset).toBe('kaleidoscope')
    expect(saveSpy).not.toHaveBeenCalled()

    // setActivePreset MUST persist — contrast check proves the spy works
    act(() => {
      capturedCtx!.setActivePreset('plasma')
    })
    expect(capturedCtx!.activePreset).toBe('plasma')
    expect(saveSpy).toHaveBeenCalledWith('plasma')
  })
})
