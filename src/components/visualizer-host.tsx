import { useEffect, useRef, useState } from 'react'
import type { VisualizerPreset, IntensityLevel, DeviceTier, VisualizerFallbackReason } from '~/lib/visualizers/types'
import { PRESET_META } from '~/lib/visualizers/types'
import { ShaderQuadBackend } from '~/lib/visualizers/backend'
import type { VisualizerBackend } from '~/lib/visualizers/backend'
import { trackVizPresetSelected, trackVizFallback, trackVizLazyLoad } from '~/lib/datadog/rum'

interface Props {
  preset?: VisualizerPreset
  intensity?: IntensityLevel
  tier?: DeviceTier
  trackElapsed: number
  trackProgress: number
  onStart?: (preset: VisualizerPreset) => void
  onFallback?: (reason: VisualizerFallbackReason) => void
}

/**
 * VisualizerHost — single-GPU-owner. Owns exactly one live `VisualizerBackend`,
 * selected by `PRESET_META[preset].backend`, and enforces dispose-then-mount when
 * the backend KIND changes so no two GPU contexts are ever alive at once.
 *
 * For PR 1 only the `'shader-quad'` backend is real; `'three'`/`'p5'` render the
 * `LOADING VISUAL…` placeholder (wired to lazy backends in PR 3).
 *
 * Replaces `MusicVisualizerCanvas`. Keeps `data-testid="music-visualizer-canvas"`.
 */
export function VisualizerHost({
  preset = 'spectrum',
  intensity = 'normal',
  tier = 'desktop',
  trackElapsed,
  trackProgress,
  onStart,
  onFallback,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backendRef = useRef<VisualizerBackend | null>(null)
  const backendKind = PRESET_META[preset].backend
  const [loadingBackend, setLoadingBackend] = useState(false)

  // Mount/replace the backend whenever the BACKEND KIND changes (not on every
  // preset change within the same backend — that's a cheap setPreset).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Single-owner: dispose any existing backend before mounting a new one.
    backendRef.current?.dispose()
    backendRef.current = null
    // Disposed-token guard: if backendKind changes again before mount()'s
    // microtask resolves, the cleanup flips `cancelled` so a stale resolution
    // can't install a now-disposed backend into backendRef.
    let cancelled = false

    // Single fallback path: emit telemetry AND notify the parent prop, so no
    // call site can drift. Guarded by `cancelled` so a fallback resolving after
    // this mount was torn down emits nothing.
    const handleFallback = (reason: VisualizerFallbackReason) => {
      if (cancelled) return
      trackVizFallback(reason)
      onFallback?.(reason)
    }

    if (backendKind !== 'shader-quad') {
      setLoadingBackend(true)
      let pending: VisualizerBackend | null = null
      const t0 = performance.now()
      const modImport =
        backendKind === 'three'
          ? import('~/lib/visualizers/backends/three-backend')
          : import('~/lib/visualizers/backends/p5-backend')
      modImport
        .then(({ Backend }) => {
          if (cancelled) return // recheck #1: torn down during import
          pending = new Backend()
          return pending.mount(canvas, {
            preset,
            intensity,
            tier,
            callbacks: { onStart, onFallback: handleFallback },
          })
        })
        .then(() => {
          if (cancelled) {
            pending?.dispose() // recheck #2: torn down during mount → free GPU
            return
          }
          trackVizLazyLoad(backendKind, performance.now() - t0, true)
          backendRef.current = pending
          setLoadingBackend(false)
        })
        .catch(() => {
          pending?.dispose()
          trackVizLazyLoad(backendKind, performance.now() - t0, false)
          handleFallback('lazy-import-failed')
        })
      return () => {
        cancelled = true
        pending?.dispose() // dispose a backend whose mount is mid-flight
        backendRef.current = null
        // Clear the placeholder so a torn-down lazy mount doesn't leave the
        // LOADING overlay stuck; a same-tick re-mount re-sets it to true above.
        setLoadingBackend(false)
      }
    }

    setLoadingBackend(false)
    const backend = new ShaderQuadBackend()
    // mount() builds the WebGL2 renderer synchronously, so a webgl2-unavailable
    // environment throws here (not as a rejection). Catch the synchronous throw
    // so the fallback fires in the same tick; also attach .catch for any future
    // async rejection from the returned Promise.
    try {
      void backend
        .mount(canvas, {
          preset,
          intensity,
          tier,
          callbacks: { onStart, onFallback: handleFallback },
        })
        .then(() => {
          // Resolved after a re-render disposed this backend: drop it.
          if (cancelled) {
            backend.dispose()
            return
          }
          backendRef.current = backend
        })
        .catch(() => {
          handleFallback('webgl2-unavailable')
        })
    } catch {
      // Synchronous throw — same tick as mount(), so `cancelled` can't be set
      // yet (handleFallback's guard is a no-op here, unlike the async path above).
      handleFallback('webgl2-unavailable')
      backendRef.current = null
    }

    return () => {
      cancelled = true
      backend.dispose()
      backendRef.current = null
    }
    // preset/intensity/callbacks are seeded into mount() here and corrected by
    // the sibling effects; this effect must run only on backendKind change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendKind])

  // Hidden-tab pausing is owned by the backend (ShaderQuadRenderer self-gates on
  // document.hidden); the host wires setVisible only when viewport/occlusion
  // gating is added.

  useEffect(() => {
    backendRef.current?.setPreset(preset)
    trackVizPresetSelected(preset, backendKind)
    // backendKind is derived from preset (PRESET_META lookup); it changes in
    // lockstep, so listing only [preset] keeps a single emit per selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  useEffect(() => {
    backendRef.current?.setIntensity(intensity)
  }, [intensity])

  useEffect(() => {
    backendRef.current?.setTrackPosition(trackElapsed, trackProgress)
  }, [trackElapsed, trackProgress])

  return (
    <>
      <canvas
        ref={canvasRef}
        data-testid="music-visualizer-canvas"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />
      {loadingBackend && (
        <div
          data-testid="visualizer-loading"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              color: '#39ff14',
              letterSpacing: '0.3em',
            }}
          >
            LOADING VISUAL…
          </span>
        </div>
      )}
    </>
  )
}
