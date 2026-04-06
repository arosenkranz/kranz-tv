import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QuotaBanner } from './quota-banner'

const mockUseTvLayout = vi.fn()

vi.mock('~/routes/_tv', () => ({
  useTvLayout: () => mockUseTvLayout(),
}))

vi.mock('~/hooks/use-quota-countdown', () => ({
  useQuotaCountdown: (active: boolean) => (active ? '~3h 42m' : null),
}))

describe('QuotaBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseTvLayout.mockReturnValue({ isQuotaExhausted: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when quota is not exhausted', () => {
    mockUseTvLayout.mockReturnValue({ isQuotaExhausted: false })
    const { container } = render(<QuotaBanner onRetry={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the banner with countdown', () => {
    render(<QuotaBanner onRetry={vi.fn()} />)
    expect(screen.getByText(/TECHNICAL DIFFICULTIES/)).toBeDefined()
    expect(screen.getByText(/RESETS IN ~3h 42m/)).toBeDefined()
    expect(screen.getByText('IMPORTED CHANNELS UNAFFECTED')).toBeDefined()
  })

  it('shows RETRY NOW button', () => {
    render(<QuotaBanner onRetry={vi.fn()} />)
    expect(screen.getByText('RETRY NOW')).toBeDefined()
  })

  it('calls onRetry when RETRY NOW is clicked', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined)
    render(<QuotaBanner onRetry={onRetry} />)
    await act(async () => {
      fireEvent.click(screen.getByText('RETRY NOW'))
    })
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows CHECKING... during retry', () => {
    let resolveRetry!: () => void
    const onRetry = vi.fn(
      () => new Promise<void>((resolve) => { resolveRetry = resolve }),
    )
    render(<QuotaBanner onRetry={onRetry} />)
    // Don't await — we want to inspect the intermediate state
    fireEvent.click(screen.getByText('RETRY NOW'))
    expect(screen.getByText('CHECKING...')).toBeDefined()
    // Clean up the pending promise
    resolveRetry()
  })

  it('shows STILL EXHAUSTED on failure', async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error('quota'))
    render(<QuotaBanner onRetry={onRetry} />)
    await act(async () => {
      fireEvent.click(screen.getByText('RETRY NOW'))
    })
    expect(screen.getByText('STILL EXHAUSTED')).toBeDefined()
  })

  it('disables button during cooldown', async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error('quota'))
    render(<QuotaBanner onRetry={onRetry} />)
    await act(async () => {
      fireEvent.click(screen.getByText('RETRY NOW'))
    })
    // Cooldown active — button should be disabled
    const button = screen.getByRole('button')
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('shows MAX RETRIES after 3 attempts', async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error('quota'))
    render(<QuotaBanner onRetry={onRetry} />)

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button'))
      })
      // Advance past cooldown (30s) and failure message clear (3s)
      await act(async () => {
        vi.advanceTimersByTime(33_000)
      })
    }

    expect(screen.getByText('MAX RETRIES')).toBeDefined()
  })

  it('has alert role for accessibility', () => {
    render(<QuotaBanner onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeDefined()
  })
})
