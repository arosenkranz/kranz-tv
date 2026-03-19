import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardHelp } from './keyboard-help'

describe('KeyboardHelp', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <KeyboardHelp visible={false} onClose={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the modal when visible is true', () => {
    render(<KeyboardHelp visible={true} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('KEYBOARD SHORTCUTS')).toBeDefined()
  })

  it('renders all key bindings', () => {
    render(<KeyboardHelp visible={true} onClose={vi.fn()} />)
    expect(screen.getByText('↑ / ↓')).toBeDefined()
    expect(screen.getByText('Change channel')).toBeDefined()
    expect(screen.getByText('G')).toBeDefined()
    expect(screen.getByText('Toggle TV Guide overlay')).toBeDefined()
    expect(screen.getByText('Enter (in guide)')).toBeDefined()
    expect(screen.getByText('Tune to channel')).toBeDefined()
    expect(screen.getByText('M')).toBeDefined()
    expect(screen.getByText('Mute / unmute')).toBeDefined()
    expect(screen.getByText('N')).toBeDefined()
    expect(screen.getByText('Now playing info')).toBeDefined()
    expect(screen.getByText('I')).toBeDefined()
    expect(screen.getByText('Import channel')).toBeDefined()
    expect(screen.getByText('?')).toBeDefined()
    expect(screen.getByText('Keyboard shortcuts')).toBeDefined()
    expect(screen.getByText('Esc')).toBeDefined()
    expect(screen.getByText('Close modal')).toBeDefined()
  })

  it('calls onClose when the ESC button is clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp visible={true} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close keyboard shortcuts'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp visible={true} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp visible={true} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'g' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp visible={true} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when inner modal content is clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardHelp visible={true} onClose={onClose} />)
    // Click the heading inside the modal — should not propagate to backdrop handler
    const heading = screen.getByText('KEYBOARD SHORTCUTS')
    fireEvent.click(heading)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not register keydown listener when not visible', () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener')
    render(<KeyboardHelp visible={false} onClose={vi.fn()} />)
    // Should not have registered a keydown listener since we returned early
    const keydownCalls = addEventSpy.mock.calls.filter(
      ([type]) => type === 'keydown',
    )
    expect(keydownCalls.length).toBe(0)
    addEventSpy.mockRestore()
  })

  it('removes keydown listener on unmount', () => {
    const removeEventSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(
      <KeyboardHelp visible={true} onClose={vi.fn()} />,
    )
    unmount()
    const keydownRemovals = removeEventSpy.mock.calls.filter(
      ([type]) => type === 'keydown',
    )
    expect(keydownRemovals.length).toBeGreaterThan(0)
    removeEventSpy.mockRestore()
  })

  it('has aria-modal attribute', () => {
    render(<KeyboardHelp visible={true} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders troubleshooting section with known issues', () => {
    render(<KeyboardHelp visible={true} onClose={vi.fn()} />)
    expect(screen.getByText('TROUBLESHOOTING')).toBeDefined()
    expect(screen.getByText('Video stuck loading / black screen')).toBeDefined()
    expect(
      screen.getByText('Ad blocker detected. Allowlist kranz.tv and youtube.com, then reload.'),
    ).toBeDefined()
    expect(screen.getByText('Channels show but no program data')).toBeDefined()
    expect(
      screen.getByText('YouTube API quota may be exhausted. Resets daily at midnight PT.'),
    ).toBeDefined()
  })
})
