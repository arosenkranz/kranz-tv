import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VisualizerPicker } from '~/components/visualizer-picker'
import type { VisualizerStyleMeta } from '~/lib/visualizers/types'

const MOCK_STYLES: readonly VisualizerStyleMeta[] = [
  { id: 'spectrum', displayName: 'Spectrum', previewGradient: 'linear-gradient(#000, #fff)' },
  { id: 'kaleidoscope', displayName: 'Kaleidoscope', previewGradient: 'conic-gradient(#f00, #00f)' },
  { id: 'plasma', displayName: 'Plasma', previewGradient: 'radial-gradient(#f0f, #000)' },
]

describe('VisualizerPicker', () => {
  it('renders a button for each style', () => {
    render(
      <VisualizerPicker
        activePreset="spectrum"
        styles={MOCK_STYLES}
        onChange={() => {}}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Spectrum' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Kaleidoscope' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Plasma' })).toBeTruthy()
  })

  it('marks only the active preset as aria-pressed', () => {
    render(
      <VisualizerPicker
        activePreset="kaleidoscope"
        styles={MOCK_STYLES}
        onChange={() => {}}
      />,
    )
    const spectrumBtn = screen.getByRole('button', { name: 'Spectrum' })
    const kaleidoscopeBtn = screen.getByRole('button', { name: 'Kaleidoscope' })
    const plasmaBtn = screen.getByRole('button', { name: 'Plasma' })

    expect(kaleidoscopeBtn.getAttribute('aria-pressed')).toBe('true')
    expect(spectrumBtn.getAttribute('aria-pressed')).toBe('false')
    expect(plasmaBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange with the clicked preset id', () => {
    const onChange = vi.fn()
    render(
      <VisualizerPicker
        activePreset="spectrum"
        styles={MOCK_STYLES}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Plasma' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('plasma')
  })

  it('updates aria-pressed when activePreset prop changes', () => {
    const { rerender } = render(
      <VisualizerPicker
        activePreset="spectrum"
        styles={MOCK_STYLES}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Spectrum' }).getAttribute('aria-pressed')).toBe('true')

    rerender(
      <VisualizerPicker
        activePreset="plasma"
        styles={MOCK_STYLES}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Spectrum' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Plasma' }).getAttribute('aria-pressed')).toBe('true')
  })
})
