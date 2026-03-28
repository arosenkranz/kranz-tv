import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChannelBadge } from './channel-badge'

describe('ChannelBadge', () => {
  it('renders the emoji', () => {
    render(<ChannelBadge emoji="🛹" channelId="skate" />)
    expect(screen.getByText('🛹')).toBeDefined()
  })

  it('applies a deterministic background color from channelId', () => {
    const { container } = render(
      <ChannelBadge emoji="🎵" channelId="music" />,
    )
    const badge = container.firstElementChild as HTMLElement
    const style = badge.style.backgroundColor

    // Re-render with the same channelId — should produce the same color
    const { container: container2 } = render(
      <ChannelBadge emoji="🎵" channelId="music" />,
    )
    const badge2 = container2.firstElementChild as HTMLElement
    expect(badge2.style.backgroundColor).toBe(style)
  })

  it('produces different colors for different channelIds', () => {
    const { container: c1 } = render(
      <ChannelBadge emoji="🛹" channelId="skate" />,
    )
    const { container: c2 } = render(
      <ChannelBadge emoji="🎵" channelId="music" />,
    )
    const color1 = (c1.firstElementChild as HTMLElement).style.backgroundColor
    const color2 = (c2.firstElementChild as HTMLElement).style.backgroundColor
    expect(color1).not.toBe(color2)
  })

  it('defaults to sm size', () => {
    const { container } = render(
      <ChannelBadge emoji="🛹" channelId="skate" />,
    )
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('w-6')
    expect(badge.className).toContain('h-6')
  })

  it('applies md size classes', () => {
    const { container } = render(
      <ChannelBadge emoji="🛹" channelId="skate" size="md" />,
    )
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('w-8')
    expect(badge.className).toContain('h-8')
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(
      <ChannelBadge emoji="🛹" channelId="skate" />,
    )
    const badge = container.firstElementChild as HTMLElement
    expect(badge.getAttribute('aria-hidden')).toBe('true')
  })
})
