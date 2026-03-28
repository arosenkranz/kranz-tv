import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChannelBadge } from './channel-badge'

describe('ChannelBadge', () => {
  it('renders the formatted channel number', () => {
    render(<ChannelBadge channelId="skate" channelNumber={1} />)
    expect(screen.getByText('CH01')).toBeDefined()
  })

  it('applies a deterministic background color from channelId', () => {
    const { container } = render(
      <ChannelBadge channelId="music" channelNumber={2} />,
    )
    const badge = container.firstElementChild as HTMLElement
    const style = badge.style.backgroundColor

    // Re-render with the same channelId — should produce the same color
    const { container: container2 } = render(
      <ChannelBadge channelId="music" channelNumber={2} />,
    )
    const badge2 = container2.firstElementChild as HTMLElement
    expect(badge2.style.backgroundColor).toBe(style)
  })

  it('produces different colors for different channelIds', () => {
    const { container: c1 } = render(
      <ChannelBadge channelId="skate" channelNumber={1} />,
    )
    const { container: c2 } = render(
      <ChannelBadge channelId="music" channelNumber={2} />,
    )
    const color1 = (c1.firstElementChild as HTMLElement).style.backgroundColor
    const color2 = (c2.firstElementChild as HTMLElement).style.backgroundColor
    expect(color1).not.toBe(color2)
  })

  it('defaults to sm size', () => {
    const { container } = render(
      <ChannelBadge channelId="skate" channelNumber={1} />,
    )
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('text-xs')
  })

  it('applies md size classes', () => {
    const { container } = render(
      <ChannelBadge channelId="skate" channelNumber={1} size="md" />,
    )
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('text-sm')
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(
      <ChannelBadge channelId="skate" channelNumber={1} />,
    )
    const badge = container.firstElementChild as HTMLElement
    expect(badge.getAttribute('aria-hidden')).toBe('true')
  })
})
