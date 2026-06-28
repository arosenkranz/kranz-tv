import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VisualizerHost } from '~/components/visualizer-host'

describe('VisualizerHost', () => {
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
