import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { TheaterControls } from '../../../src/components/theater-controls'

const defaultProps = {
  visible: true,
  channelNumber: 3,
  channelName: 'Skate Vids',
  onChannelUp: vi.fn(),
  onChannelDown: vi.fn(),
  onToggleGuide: vi.fn(),
  onCycleOverlay: vi.fn(),
  onExitTheater: vi.fn(),
  volume: 80,
  isMuted: false,
  onVolumeChange: vi.fn(),
  onToggleMute: vi.fn(),
}

afterEach(() => {
  // Restore cursor after each test
  document.body.style.cursor = ''
})

describe('TheaterControls', () => {
  it('shows opacity 1 and pointer-events on container when visible=true', () => {
    const { container } = render(
      <TheaterControls {...defaultProps} visible={true} />,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.style.opacity).toBe('1')
    expect(outer.className).toContain('pointer-events-none')
    const inner = outer.firstChild as HTMLElement
    expect(inner.className).toContain('pointer-events-auto')
  })

  it('shows opacity 0 when visible=false', () => {
    const { container } = render(
      <TheaterControls {...defaultProps} visible={false} />,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.style.opacity).toBe('0')
  })

  it('sets aria-hidden=true when visible=false', () => {
    const { container } = render(
      <TheaterControls {...defaultProps} visible={false} />,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.getAttribute('aria-hidden')).toBe('true')
  })

  it('sets aria-hidden=false when visible=true', () => {
    const { container } = render(
      <TheaterControls {...defaultProps} visible={true} />,
    )
    const outer = container.firstChild as HTMLElement
    expect(outer.getAttribute('aria-hidden')).toBe('false')
  })

  it('hides cursor on document.body when visible=false', () => {
    render(<TheaterControls {...defaultProps} visible={false} />)
    expect(document.body.style.cursor).toBe('none')
  })

  it('restores cursor on document.body when visible=true', () => {
    document.body.style.cursor = 'none'
    render(<TheaterControls {...defaultProps} visible={true} />)
    expect(document.body.style.cursor).toBe('auto')
  })

  it('restores cursor to auto on unmount', () => {
    document.body.style.cursor = 'none'
    const { unmount } = render(
      <TheaterControls {...defaultProps} visible={false} />,
    )
    unmount()
    expect(document.body.style.cursor).toBe('auto')
  })

  it('renders formatted channel label', () => {
    render(
      <TheaterControls
        {...defaultProps}
        channelNumber={3}
        channelName="Skate Vids"
      />,
    )
    expect(screen.getByText('CH 03 — SKATE VIDS')).toBeDefined()
  })

  it('renders fallback label when channelNumber is null', () => {
    render(
      <TheaterControls
        {...defaultProps}
        channelNumber={null}
        channelName={null}
      />,
    )
    expect(screen.getByText('— SELECT A CHANNEL')).toBeDefined()
  })

  it('calls onChannelUp when channel-up button is clicked', () => {
    const onChannelUp = vi.fn()
    render(<TheaterControls {...defaultProps} onChannelUp={onChannelUp} />)
    fireEvent.click(screen.getByRole('button', { name: 'Channel up' }))
    expect(onChannelUp).toHaveBeenCalledOnce()
  })

  it('calls onChannelDown when channel-down button is clicked', () => {
    const onChannelDown = vi.fn()
    render(<TheaterControls {...defaultProps} onChannelDown={onChannelDown} />)
    fireEvent.click(screen.getByRole('button', { name: 'Channel down' }))
    expect(onChannelDown).toHaveBeenCalledOnce()
  })

  it('calls onToggleGuide when guide button is clicked', () => {
    const onToggleGuide = vi.fn()
    render(<TheaterControls {...defaultProps} onToggleGuide={onToggleGuide} />)
    fireEvent.click(screen.getByTitle('Guide [G]'))
    expect(onToggleGuide).toHaveBeenCalledOnce()
  })

  it('calls onCycleOverlay when overlay button is clicked', () => {
    const onCycleOverlay = vi.fn()
    render(
      <TheaterControls {...defaultProps} onCycleOverlay={onCycleOverlay} />,
    )
    fireEvent.click(screen.getByTitle('Overlay [V]'))
    expect(onCycleOverlay).toHaveBeenCalledOnce()
  })

  it('calls onExitTheater when exit button is clicked', () => {
    const onExitTheater = vi.fn()
    render(<TheaterControls {...defaultProps} onExitTheater={onExitTheater} />)
    fireEvent.click(screen.getByTitle('Exit theater [T]'))
    expect(onExitTheater).toHaveBeenCalledOnce()
  })
})
