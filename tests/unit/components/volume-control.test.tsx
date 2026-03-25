import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { VolumeControl } from '../../../src/components/volume-control'

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addAction: vi.fn(),
  },
}))

describe('VolumeControl', () => {
  const onVolumeChange = vi.fn()
  const onToggleMute = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a range slider with the current volume', () => {
    render(
      <VolumeControl
        volume={80}
        isMuted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const slider = screen.getByRole('slider', { name: /volume/i })
    expect((slider as HTMLInputElement).value).toBe('80')
  })

  it('renders VolumeX icon when muted', () => {
    render(
      <VolumeControl
        volume={80}
        isMuted={true}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const muteBtn = screen.getByRole('button', { name: /unmute/i })
    expect(muteBtn).toBeDefined()
  })

  it('renders mute button with "Mute" label when not muted', () => {
    render(
      <VolumeControl
        volume={80}
        isMuted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    expect(screen.getByRole('button', { name: /mute/i })).toBeDefined()
  })

  it('calls onVolumeChange when slider changes', () => {
    render(
      <VolumeControl
        volume={80}
        isMuted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const slider = screen.getByRole('slider', { name: /volume/i })
    fireEvent.change(slider, { target: { value: '60' } })
    expect(onVolumeChange).toHaveBeenCalledWith(60)
  })

  it('calls onToggleMute when mute button clicked', () => {
    render(
      <VolumeControl
        volume={80}
        isMuted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /mute/i }))
    expect(onToggleMute).toHaveBeenCalledOnce()
  })

  it('auto-unmutes when slider moved above 0 while muted', () => {
    render(
      <VolumeControl
        volume={0}
        isMuted={true}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const slider = screen.getByRole('slider', { name: /volume/i })
    fireEvent.change(slider, { target: { value: '30' } })
    expect(onVolumeChange).toHaveBeenCalledWith(30)
    expect(onToggleMute).toHaveBeenCalledOnce()
  })

  it('auto-mutes when slider set to 0 while not muted', () => {
    render(
      <VolumeControl
        volume={50}
        isMuted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const slider = screen.getByRole('slider', { name: /volume/i })
    fireEvent.change(slider, { target: { value: '0' } })
    expect(onVolumeChange).toHaveBeenCalledWith(0)
    expect(onToggleMute).toHaveBeenCalledOnce()
  })

  it('does not double-toggle mute when dragging slider above 0 while not muted', () => {
    render(
      <VolumeControl
        volume={50}
        isMuted={false}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const slider = screen.getByRole('slider', { name: /volume/i })
    fireEvent.change(slider, { target: { value: '70' } })
    expect(onToggleMute).not.toHaveBeenCalled()
  })

  it('dims slider opacity when muted', () => {
    render(
      <VolumeControl
        volume={80}
        isMuted={true}
        onVolumeChange={onVolumeChange}
        onToggleMute={onToggleMute}
      />,
    )
    const slider = screen.getByRole('slider', { name: /volume/i }) as HTMLInputElement
    expect(slider.style.opacity).toBe('0.5')
  })
})
