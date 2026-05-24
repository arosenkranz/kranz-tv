import { useEffect, useRef } from 'react'
import type { VisualizerPreset, IntensityLevel } from '~/lib/visualizers/types'
import { VisualizerRenderer } from '~/lib/visualizers/renderer'
import type { VisualizerRendererCallbacks } from '~/lib/visualizers/renderer'

interface Props {
  preset?: VisualizerPreset
  intensity?: IntensityLevel
  trackElapsed: number
  trackProgress: number
  onStart?: (preset: VisualizerPreset) => void
  onFallback?: (reason: 'webgl2-unavailable' | 'context-lost') => void
}

export function MusicVisualizerCanvas({
  preset = 'spectrum',
  intensity = 'normal',
  trackElapsed,
  trackProgress,
  onStart,
  onFallback,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<VisualizerRenderer | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: VisualizerRenderer | null = null
    try {
      const callbacks: VisualizerRendererCallbacks = {
        onStart,
        onContextLost: () => {},
        onContextRestored: () => {
          // If context can't be restored, signal fallback
        },
        onFallback,
      }
      renderer = new VisualizerRenderer(canvas, callbacks)
      renderer.setPreset(preset)
      renderer.start()
      rendererRef.current = renderer
    } catch {
      onFallback?.('webgl2-unavailable')
      rendererRef.current = null
    }

    return () => {
      renderer?.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    rendererRef.current?.setPreset(preset)
  }, [preset])

  useEffect(() => {
    rendererRef.current?.setIntensityLevel(intensity)
  }, [intensity])

  useEffect(() => {
    rendererRef.current?.setTrackPosition(trackElapsed, trackProgress)
  }, [trackElapsed, trackProgress])

  return (
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
  )
}
