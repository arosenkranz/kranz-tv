import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SignalLost } from '~/components/signal-lost'

describe('SignalLost', () => {
  it('shows SIGNAL LOST and the channel name', () => {
    render(<SignalLost channelNumber={20} channelName="Calming" onRetry={vi.fn()} retrying={false} />)
    expect(screen.getByText('SIGNAL LOST')).toBeDefined()
    expect(screen.getByText(/Calming/i)).toBeDefined()
  })
  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<SignalLost channelNumber={20} channelName="Calming" onRetry={onRetry} retrying={false} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
  it('disables the retry button while retrying', () => {
    render(<SignalLost channelNumber={20} channelName="Calming" onRetry={vi.fn()} retrying={true} />)
    const btn = screen.getByRole('button', { name: /retry/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
