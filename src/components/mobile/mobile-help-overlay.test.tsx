import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileHelpOverlay } from './mobile-help-overlay'

describe('MobileHelpOverlay', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <MobileHelpOverlay visible={false} onDismiss={vi.fn()} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders help items when visible', () => {
    render(<MobileHelpOverlay visible={true} onDismiss={vi.fn()} />)
    expect(screen.getByText('CONTROLS')).toBeDefined()
    expect(screen.getByText('Swipe up / down')).toBeDefined()
    expect(screen.getByText('Tap now playing')).toBeDefined()
    expect(screen.getByText('Pull up guide')).toBeDefined()
    expect(screen.getByText('Toolbar')).toBeDefined()
    expect(screen.getByText('Rotate device')).toBeDefined()
  })

  it('calls onDismiss when GOT IT is clicked', () => {
    const onDismiss = vi.fn()
    render(<MobileHelpOverlay visible={true} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('GOT IT'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when backdrop is clicked', () => {
    const onDismiss = vi.fn()
    render(<MobileHelpOverlay visible={true} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
