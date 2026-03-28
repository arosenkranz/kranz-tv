import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChannelBadge } from './channel-badge'

describe('ChannelBadge', () => {
  it('renders the formatted channel number', () => {
    render(<ChannelBadge channelNumber={1} />)
    expect(screen.getByText('CH01')).toBeDefined()
  })

  it('uses the retro green theme color', () => {
    const { container } = render(<ChannelBadge channelNumber={5} />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.style.color).toContain('57')
    expect(badge.style.color).toContain('255')
    expect(badge.style.color).toContain('20')
  })

  it('defaults to sm size', () => {
    const { container } = render(<ChannelBadge channelNumber={1} />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('text-xs')
  })

  it('applies md size classes', () => {
    const { container } = render(<ChannelBadge channelNumber={1} size="md" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('text-sm')
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(<ChannelBadge channelNumber={1} />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.getAttribute('aria-hidden')).toBe('true')
  })
})
