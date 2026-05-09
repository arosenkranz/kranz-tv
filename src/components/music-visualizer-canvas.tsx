import React, { useEffect, useRef } from 'react'
import type { VisualizerPreset } from '~/lib/visualizers/types'
import { VisualizerRenderer } from '~/lib/visualizers/renderer'

interface Props {
  preset?: VisualizerPreset
  trackElapsed: number
  trackProgress: number
}

export function MusicVisualizerCanvas({
  preset = 'spectrum',
  trackElapsed,
  trackProgress,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<VisualizerRenderer | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: VisualizerRenderer | null = null
    try {
      renderer = new VisualizerRenderer(canvas)
      renderer.setPreset(preset)
      renderer.start()
      rendererRef.current = renderer
    } catch {
      // WebGL2 unavailable — canvas stays dark; NowPlayingCard still visible
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
