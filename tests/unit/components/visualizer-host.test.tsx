import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { VisualizerHost } from '~/components/visualizer-host'
import * as rum from '~/lib/datadog/rum'

// ---------------------------------------------------------------------------
// Fake VisualizerBackend — controllable mount resolution
// ---------------------------------------------------------------------------
interface FakeBackend {
  mount: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  setPreset: ReturnType<typeof vi.fn>
  setIntensity: ReturnType<typeof vi.fn>
  setTrackPosition: ReturnType<typeof vi.fn>
  _resolveMountFn: (() => void) | null
  _rejectMountFn: ((e: Error) => void) | null
}

// Track all backends created per-test
const createdBackends: FakeBackend[] = []

function makeFakeBackend(): FakeBackend {
  let resolveFn: (() => void) | null = null
  let rejectFn: ((e: Error) => void) | null = null
  const b: FakeBackend = {
    mount: vi.fn(
      () =>
        new Promise<void>((res, rej) => {
          resolveFn = res
          rejectFn = rej
        }),
    ),
    dispose: vi.fn(),
    setPreset: vi.fn(),
    setIntensity: vi.fn(),
    setTrackPosition: vi.fn(),
    get _resolveMountFn() {
      return resolveFn
    },
    get _rejectMountFn() {
      return rejectFn
    },
  }
  createdBackends.push(b)
  return b
}

// Mock the dynamic import modules so no real three/p5 chunks are loaded.
vi.mock('~/lib/visualizers/backends/three-backend', () => ({
  Backend: vi.fn(() => makeFakeBackend()),
}))
vi.mock('~/lib/visualizers/backends/p5-backend', () => ({
  Backend: vi.fn(() => makeFakeBackend()),
}))

// Spy on telemetry
vi.mock('~/lib/datadog/rum', async (importOriginal) => {
  const original = await importOriginal<typeof rum>()
  return {
    ...original,
    trackVizLazyLoad: vi.fn(),
    trackVizFallback: vi.fn(),
    trackVizPresetSelected: vi.fn(),
  }
})

beforeEach(() => {
  createdBackends.length = 0
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Existing shader-quad tests (must stay green)
// ---------------------------------------------------------------------------
describe('VisualizerHost — shader-quad (existing)', () => {
  it('renders the canvas for a shader-quad preset', () => {
    render(
      <VisualizerHost
        preset="spectrum"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
      />,
    )
    expect(screen.getByTestId('music-visualizer-canvas')).toBeTruthy()
  })

  it('does not show the lazy-loading placeholder for a shader-quad preset', () => {
    render(
      <VisualizerHost
        preset="spectrum"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
      />,
    )
    expect(screen.queryByTestId('visualizer-loading')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Lazy state-machine race tests
// ---------------------------------------------------------------------------
describe('VisualizerHost — lazy backend state machine', () => {
  it('shows loading indicator while mount is pending for a three preset', async () => {
    render(
      <VisualizerHost
        preset="neon-tunnel"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
      />,
    )
    // The dynamic import resolves synchronously in the mock, so we need to
    // flush microtasks to let the .then(({ Backend }) => ...) run, which sets
    // pending = new Backend() and calls mount(). After that, the loading
    // indicator should still be visible (mount is still pending).
    await act(async () => {
      // Flush the import microtask so Backend constructor runs
      await Promise.resolve()
    })
    expect(screen.getByTestId('visualizer-loading')).toBeTruthy()
  })

  it('hides loading indicator and calls trackVizLazyLoad(true) on success', async () => {
    render(
      <VisualizerHost
        preset="neon-tunnel"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
      />,
    )

    // Flush microtasks so import resolves and Backend is constructed
    await act(async () => {
      await Promise.resolve()
    })

    const backend = createdBackends[0]
    expect(backend).toBeTruthy()
    expect(screen.getByTestId('visualizer-loading')).toBeTruthy()

    // Resolve mount
    await act(async () => {
      backend._resolveMountFn?.()
      // Flush the chained .then()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByTestId('visualizer-loading')).toBeNull()
    expect(rum.trackVizLazyLoad).toHaveBeenCalledWith('three', expect.any(Number), true)
  })

  it('RACE recheck #2: cancelled-after-mount disposes the pending backend and does NOT install it', async () => {
    const { unmount } = render(
      <VisualizerHost
        preset="neon-tunnel"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
      />,
    )

    // Flush microtasks so import resolves and Backend is constructed
    await act(async () => {
      await Promise.resolve()
    })

    const backend = createdBackends[0]
    expect(backend).toBeTruthy()

    // Unmount (sets cancelled = true) BEFORE mount resolves
    unmount()

    // Now resolve mount — recheck #2 must dispose pending and skip install
    await act(async () => {
      backend._resolveMountFn?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(backend.dispose).toHaveBeenCalled()
    // trackVizLazyLoad should NOT be called (cancelled path returns early)
    expect(rum.trackVizLazyLoad).not.toHaveBeenCalled()
  })

  it('C1: canvas is remounted (fresh DOM node) when backendKind changes', async () => {
    // Start with a shader-quad preset so ShaderQuadBackend is used directly.
    const { rerender } = render(
      <VisualizerHost
        preset="spectrum"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
      />,
    )
    const canvasBefore = screen.getByTestId('music-visualizer-canvas')

    // Rerender with a three-backend preset — backendKind switches to 'three'.
    // key={backendKind} must force React to unmount the old canvas and mount
    // a completely new DOM element; without the key prop this test will fail
    // because React reuses the same node.
    await act(async () => {
      rerender(
        <VisualizerHost
          preset="neon-tunnel"
          intensity="normal"
          trackElapsed={0}
          trackProgress={0}
        />,
      )
      // Flush the dynamic-import microtask so the lazy branch runs.
      await Promise.resolve()
    })

    const canvasAfter = screen.getByTestId('music-visualizer-canvas')
    expect(canvasAfter).not.toBe(canvasBefore)
  })

  it('import/mount failure: disposes pending, calls trackVizLazyLoad(false), and fires handleFallback', async () => {
    const onFallback = vi.fn()
    render(
      <VisualizerHost
        preset="neon-tunnel"
        intensity="normal"
        trackElapsed={0}
        trackProgress={0}
        onFallback={onFallback}
      />,
    )

    // Flush microtasks so import resolves and Backend is constructed
    await act(async () => {
      await Promise.resolve()
    })

    const backend = createdBackends[0]
    expect(backend).toBeTruthy()

    // Reject mount to simulate failure
    await act(async () => {
      backend._rejectMountFn?.(new Error('GPU init failed'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(backend.dispose).toHaveBeenCalled()
    expect(rum.trackVizLazyLoad).toHaveBeenCalledWith('three', expect.any(Number), false)
    expect(onFallback).toHaveBeenCalledWith('lazy-import-failed')
  })
})
