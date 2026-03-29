import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileToolbar } from './mobile-toolbar'

const defaultProps = {
  isMuted: false,
  overlayMode: 'none' as const,
  onToggleMute: vi.fn(),
  onShare: vi.fn(),
  onCycleOverlay: vi.fn(),
  onToggleInfo: vi.fn(),
  onFullscreen: vi.fn(),
  onHelp: vi.fn(),
}

describe('MobileToolbar', () => {
  it('renders all toolbar buttons', () => {
    render(<MobileToolbar {...defaultProps} />)
    expect(screen.getByLabelText('Mute')).toBeDefined()
    expect(screen.getByLabelText('Share link')).toBeDefined()
    expect(screen.getByLabelText('Overlay: none')).toBeDefined()
    expect(screen.getByLabelText('Now playing info')).toBeDefined()
    expect(screen.getByLabelText('Fullscreen')).toBeDefined()
    expect(screen.getByLabelText('Help')).toBeDefined()
  })

  it('shows Unmute label when muted', () => {
    render(<MobileToolbar {...defaultProps} isMuted={true} />)
    expect(screen.getByLabelText('Unmute')).toBeDefined()
  })

  it('calls onToggleMute when mute button is tapped', () => {
    const onToggleMute = vi.fn()
    render(<MobileToolbar {...defaultProps} onToggleMute={onToggleMute} />)
    fireEvent.click(screen.getByLabelText('Mute'))
    expect(onToggleMute).toHaveBeenCalledOnce()
  })

  it('calls onShare when share button is tapped', () => {
    const onShare = vi.fn()
    render(<MobileToolbar {...defaultProps} onShare={onShare} />)
    fireEvent.click(screen.getByLabelText('Share link'))
    expect(onShare).toHaveBeenCalledOnce()
  })

  it('calls onHelp when help button is tapped', () => {
    const onHelp = vi.fn()
    render(<MobileToolbar {...defaultProps} onHelp={onHelp} />)
    fireEvent.click(screen.getByLabelText('Help'))
    expect(onHelp).toHaveBeenCalledOnce()
  })

  it('shows active overlay mode in label', () => {
    render(<MobileToolbar {...defaultProps} overlayMode="crt" />)
    expect(screen.getByLabelText('Overlay: crt')).toBeDefined()
  })
})
