import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DesktopWelcome } from './desktop-welcome'

describe('DesktopWelcome', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <DesktopWelcome visible={false} onDismiss={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the welcome overlay when visible', () => {
    render(<DesktopWelcome visible={true} onDismiss={vi.fn()} />)
    expect(screen.getByText('WELCOME TO KRANZTV')).toBeDefined()
    expect(
      screen.getByText('RETRO CABLE TV — LIVE-SCHEDULED YOUTUBE CHANNELS'),
    ).toBeDefined()
  })

  it('shows keyboard shortcuts', () => {
    render(<DesktopWelcome visible={true} onDismiss={vi.fn()} />)
    expect(screen.getByText('Change channels')).toBeDefined()
    expect(screen.getByText('Open the TV Guide')).toBeDefined()
    expect(screen.getByText('Import a YouTube playlist')).toBeDefined()
    expect(screen.getByText('Theater mode (cinematic)')).toBeDefined()
    expect(screen.getByText('All keyboard shortcuts')).toBeDefined()
  })

  it('calls onDismiss when START WATCHING is clicked', () => {
    const onDismiss = vi.fn()
    render(<DesktopWelcome visible={true} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('START WATCHING'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss on backdrop click', () => {
    const onDismiss = vi.fn()
    render(<DesktopWelcome visible={true} onDismiss={onDismiss} />)
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does NOT dismiss on inner modal click', () => {
    const onDismiss = vi.fn()
    render(<DesktopWelcome visible={true} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('WELCOME TO KRANZTV'))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('has correct aria attributes', () => {
    render(<DesktopWelcome visible={true} onDismiss={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Welcome to KranzTV')
  })

  it('does NOT register its own Esc key handler', () => {
    const onDismiss = vi.fn()
    render(<DesktopWelcome visible={true} onDismiss={onDismiss} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
