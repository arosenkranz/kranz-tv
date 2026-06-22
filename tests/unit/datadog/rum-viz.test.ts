import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the entire browser-rum module before importing our module under test
vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: vi.fn(),
    startSessionReplayRecording: vi.fn(),
    addAction: vi.fn(),
    setGlobalContextProperty: vi.fn(),
  },
}))

// eslint-disable-next-line import/first
import { datadogRum } from '@datadog/browser-rum'
// eslint-disable-next-line import/first
import {
  trackVizPresetSelected,
  trackVizFallback,
  trackVizLazyLoad,
} from '~/lib/datadog/rum'

const mockAddAction = vi.mocked(datadogRum.addAction)

beforeEach(() => {
  mockAddAction.mockClear()
})

describe('visualizer RUM actions', () => {
  it('viz_preset_selected carries preset + backend', () => {
    trackVizPresetSelected('spectrum', 'shader-quad')
    expect(mockAddAction).toHaveBeenCalledWith('viz_preset_selected', {
      preset: 'spectrum',
      backend: 'shader-quad',
    })
  })

  it('viz_fallback carries reason', () => {
    trackVizFallback('webgl2-unavailable')
    expect(mockAddAction).toHaveBeenCalledWith('viz_fallback', {
      reason: 'webgl2-unavailable',
    })
  })

  it('viz_lazy_load carries backend + duration + success', () => {
    trackVizLazyLoad('three', 240, true)
    expect(mockAddAction).toHaveBeenCalledWith('viz_lazy_load', {
      backend: 'three',
      durationMs: 240,
      success: true,
    })
  })
})
