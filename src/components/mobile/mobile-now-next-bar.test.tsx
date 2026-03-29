import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNowNextBar } from './mobile-now-next-bar'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

const channel: Channel = {
  id: 'test-ch',
  number: 3,
  name: 'Test Channel',
  playlistId: 'PLtest',
  videos: [
    {
      id: 'dQw4w9WgXcQ',
      title: 'Test Video Title',
      durationSeconds: 300,
      thumbnailUrl: '',
    },
  ],
  totalDurationSeconds: 300,
}

const position: SchedulePosition = {
  video: channel.videos[0],
  seekSeconds: 120,
  slotStart: new Date('2026-03-29T00:00:00Z'),
  slotEnd: new Date('2026-03-29T00:05:00Z'),
}

describe('MobileNowNextBar', () => {
  it('renders channel name and video title', () => {
    render(
      <MobileNowNextBar
        channel={channel}
        position={position}
        onTap={vi.fn()}
        onSwipeUp={vi.fn()}
        onSwipeDown={vi.fn()}
      />,
    )
    expect(screen.getByText('TEST CHANNEL')).toBeDefined()
    expect(screen.getByText('Test Video Title')).toBeDefined()
  })

  it('renders channel badge with correct number', () => {
    render(
      <MobileNowNextBar
        channel={channel}
        position={position}
        onTap={vi.fn()}
        onSwipeUp={vi.fn()}
        onSwipeDown={vi.fn()}
      />,
    )
    expect(screen.getByText('CH03')).toBeDefined()
  })

  it('calls onTap when clicked', () => {
    const onTap = vi.fn()
    render(
      <MobileNowNextBar
        channel={channel}
        position={position}
        onTap={onTap}
        onSwipeUp={vi.fn()}
        onSwipeDown={vi.fn()}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /now playing/i }),
    )
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('renders a progress bar', () => {
    const { container } = render(
      <MobileNowNextBar
        channel={channel}
        position={position}
        onTap={vi.fn()}
        onSwipeUp={vi.fn()}
        onSwipeDown={vi.fn()}
      />,
    )
    // 120/300 = 40%
    const progressBar = container.querySelector('[style*="width: 40%"]')
    expect(progressBar).not.toBeNull()
  })
})
