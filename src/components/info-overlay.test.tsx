import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ChannelPreset } from '~/lib/channels/types'
import type { SchedulePosition } from '~/lib/scheduling/types'
import { InfoOverlay } from './info-overlay'

const FIXED_NOW = new Date('2024-01-01T14:10:00Z').getTime()

function makeChannel(overrides: Partial<ChannelPreset> = {}): ChannelPreset {
  return {
    id: 'nature',
    number: 1,
    name: 'Nature & Wildlife',
    description: 'Nature docs',
    playlistId: 'PL123',
    emoji: '🌿',
    ...overrides,
  }
}

function makePosition(
  overrides: Partial<SchedulePosition> = {},
): SchedulePosition {
  return {
    video: {
      id: 'v1',
      title: 'The Secret Life of Elephants',
      durationSeconds: 1800,
      thumbnailUrl: 'https://img/elephants.jpg',
    },
    seekSeconds: 600,
    slotStartTime: new Date('2024-01-01T14:00:00Z'),
    slotEndTime: new Date('2024-01-01T14:30:00Z'),
    ...overrides,
  }
}

describe('InfoOverlay', () => {
  describe('visibility', () => {
    it('has opacity 1 when visible=true', () => {
      const { container } = render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      const overlay = container.firstChild as HTMLElement
      expect(overlay.style.opacity).toBe('1')
    })

    it('has opacity 0 when visible=false', () => {
      const { container } = render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={false}
          nowMs={FIXED_NOW}
        />,
      )
      const overlay = container.firstChild as HTMLElement
      expect(overlay.style.opacity).toBe('0')
    })

    it('sets aria-hidden=true when not visible', () => {
      const { container } = render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={false}
          nowMs={FIXED_NOW}
        />,
      )
      const overlay = container.firstChild as HTMLElement
      expect(overlay.getAttribute('aria-hidden')).toBe('true')
    })

    it('sets aria-hidden=false when visible', () => {
      const { container } = render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      const overlay = container.firstChild as HTMLElement
      expect(overlay.getAttribute('aria-hidden')).toBe('false')
    })
  })

  describe('channel display', () => {
    it('shows channel number and name when channel provided', () => {
      render(
        <InfoOverlay
          channel={makeChannel({ number: 3, name: 'Retro Tech' })}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText(/CH 3/)).toBeTruthy()
      expect(screen.getByText(/RETRO TECH/)).toBeTruthy()
    })

    it('shows "No channel selected" when channel is null', () => {
      render(
        <InfoOverlay
          channel={null}
          position={null}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText('No channel selected')).toBeTruthy()
    })

    it('shows "No program data" when channel provided but position is null', () => {
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={null}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText('No program data')).toBeTruthy()
    })
  })

  describe('program info', () => {
    it('shows the video title', () => {
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText('The Secret Life of Elephants')).toBeTruthy()
    })

    it('formats time remaining as MM:SS', () => {
      // slotEndTime = 14:30, now = 14:10 → 20 minutes = 1200 seconds → "20:00"
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText(/20:00 remaining/)).toBeTruthy()
    })

    it('pads seconds with leading zero: 1 min 5 sec → "01:05"', () => {
      const position = makePosition({
        slotEndTime: new Date(FIXED_NOW + 65 * 1000), // 65 seconds from now
      })
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={position}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText(/01:05 remaining/)).toBeTruthy()
    })

    it('shows 00:00 when slot has already ended', () => {
      const position = makePosition({
        slotEndTime: new Date(FIXED_NOW - 5000), // ended 5 seconds ago
      })
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={position}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText(/00:00 remaining/)).toBeTruthy()
    })

    it('shows 00:00 for exactly expired slot (not negative)', () => {
      const position = makePosition({
        slotEndTime: new Date(FIXED_NOW), // ends exactly now
      })
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={position}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByText(/00:00 remaining/)).toBeTruthy()
    })
  })

  describe('layout', () => {
    it('has role=status for screen reader announcements', () => {
      render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      expect(screen.getByRole('status')).toBeTruthy()
    })

    it('uses monospace font class', () => {
      const { container } = render(
        <InfoOverlay
          channel={makeChannel()}
          position={makePosition()}
          visible={true}
          nowMs={FIXED_NOW}
        />,
      )
      const inner = container.querySelector('.font-mono')
      expect(inner).not.toBeNull()
    })
  })
})
