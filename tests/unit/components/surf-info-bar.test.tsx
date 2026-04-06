import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SurfInfoBar } from '~/components/surf-info-bar'
import type { ChannelPreset } from '~/lib/channels/types'

const mockChannel: ChannelPreset = {
  id: 'nature',
  number: 1,
  name: 'Nature',
  description: 'Nature videos',
  playlistId: 'PLtest',
  emoji: '🌿',
}

const defaultProps = {
  channel: mockChannel,
  videoTitle: 'Beautiful Forests of the Pacific Northwest',
  countdown: 7,
  dwellSeconds: 10,
  visible: true,
  isMobile: false,
}

describe('SurfInfoBar', () => {
  it('renders channel number, channel name, and video title', () => {
    render(<SurfInfoBar {...defaultProps} />)

    expect(screen.getByTestId('surf-channel-number').textContent).toBe('CH01')
    expect(screen.getByTestId('surf-channel-name').textContent).toBe('Nature')
    expect(screen.getByTestId('surf-video-title').textContent).toBe(
      'Beautiful Forests of the Pacific Northwest',
    )
  })

  it('shows SURF badge', () => {
    render(<SurfInfoBar {...defaultProps} />)

    const badge = screen.getByTestId('surf-badge')
    expect(badge.textContent).toBe('SURF')
  })

  it('is hidden (opacity 0) when visible is false', () => {
    const { container } = render(
      <SurfInfoBar {...defaultProps} visible={false} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.style.opacity).toBe('0')
    expect(root.style.pointerEvents).toBe('none')
  })

  it('is hidden (opacity 0) when channel is null', () => {
    const { container } = render(
      <SurfInfoBar {...defaultProps} channel={null} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.style.opacity).toBe('0')
    expect(root.style.pointerEvents).toBe('none')
  })

  it('progress bar width reflects countdown / dwellSeconds ratio', () => {
    render(<SurfInfoBar {...defaultProps} countdown={5} dwellSeconds={10} />)

    const fill = screen.getByTestId('surf-progress-fill')
    expect(fill.style.width).toBe('50%')
  })

  it('uses right 30% on desktop', () => {
    const { container } = render(
      <SurfInfoBar {...defaultProps} isMobile={false} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.style.right).toBe('30%')
  })

  it('uses right 1rem on mobile', () => {
    const { container } = render(
      <SurfInfoBar {...defaultProps} isMobile={true} />,
    )
    const root = container.firstChild as HTMLElement
    expect(root.style.right).toBe('1rem')
  })

  it('fires onDwellTap when countdown is tapped on mobile', () => {
    const handler = vi.fn()
    render(
      <SurfInfoBar
        {...defaultProps}
        isMobile={true}
        onDwellTap={handler}
      />,
    )

    const countdown = screen.getByTestId('surf-countdown')
    fireEvent.click(countdown)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('renders countdown as a span (not button) when no tap handler on mobile', () => {
    render(<SurfInfoBar {...defaultProps} isMobile={true} />)

    const countdown = screen.getByTestId('surf-countdown')
    expect(countdown.tagName).toBe('SPAN')
  })

  it('renders countdown as a span on desktop even with onDwellTap', () => {
    const handler = vi.fn()
    render(
      <SurfInfoBar
        {...defaultProps}
        isMobile={false}
        onDwellTap={handler}
      />,
    )

    const countdown = screen.getByTestId('surf-countdown')
    expect(countdown.tagName).toBe('SPAN')
  })

  it('shows countdown text with the current value', () => {
    render(<SurfInfoBar {...defaultProps} countdown={3} />)

    const countdown = screen.getByTestId('surf-countdown')
    expect(countdown.textContent).toBe('NEXT 3s')
  })
})
