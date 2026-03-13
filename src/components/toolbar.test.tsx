import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ChannelPreset } from '~/lib/channels/types'
import type { SchedulePosition } from '~/lib/scheduling/types'
import { Toolbar } from './toolbar'

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

function makePosition(overrides: Partial<SchedulePosition> = {}): SchedulePosition {
  return {
    video: {
      id: 'v1',
      title: 'Serengeti: The Great Migration',
      durationSeconds: 1800,
      thumbnailUrl: 'https://img/serengeti.jpg',
    },
    seekSeconds: 0,
    slotStartTime: new Date('2024-01-01T14:00:00Z'),
    slotEndTime: new Date('2024-01-01T14:30:00Z'),
    ...overrides,
  }
}

const defaultProps = {
  channel: makeChannel(),
  position: makePosition(),
  onToggleGuide: vi.fn(),
  onToggleMute: vi.fn(),
  onImport: vi.fn(),
  guideVisible: false,
  isMuted: false,
}

describe('Toolbar', () => {
  describe('channel info', () => {
    it('displays channel number and name when channel provided', () => {
      render(<Toolbar {...defaultProps} channel={makeChannel({ number: 5, name: 'TED Talks' })} />)
      expect(screen.getByText(/CH 5/)).toBeTruthy()
      expect(screen.getByText(/TED TALKS/)).toBeTruthy()
    })

    it('shows "NO SIGNAL" when channel is null', () => {
      render(<Toolbar {...defaultProps} channel={null} />)
      expect(screen.getByText('NO SIGNAL')).toBeTruthy()
    })
  })

  describe('video title', () => {
    it('displays current video title when position provided', () => {
      render(<Toolbar {...defaultProps} />)
      expect(screen.getByText('Serengeti: The Great Migration')).toBeTruthy()
    })

    it('shows fallback dash when position is null', () => {
      render(<Toolbar {...defaultProps} position={null} />)
      expect(screen.getByText('—')).toBeTruthy()
    })
  })

  describe('guide button', () => {
    it('calls onToggleGuide when guide button clicked', () => {
      const onToggleGuide = vi.fn()
      render(<Toolbar {...defaultProps} onToggleGuide={onToggleGuide} />)
      fireEvent.click(screen.getByRole('button', { name: 'Toggle guide' }))
      expect(onToggleGuide).toHaveBeenCalledOnce()
    })

    it('has aria-pressed=true when guide is visible', () => {
      render(<Toolbar {...defaultProps} guideVisible={true} />)
      const btn = screen.getByRole('button', { name: 'Toggle guide' })
      expect(btn.getAttribute('aria-pressed')).toBe('true')
    })

    it('has aria-pressed=false when guide is hidden', () => {
      render(<Toolbar {...defaultProps} guideVisible={false} />)
      const btn = screen.getByRole('button', { name: 'Toggle guide' })
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    })
  })

  describe('mute button', () => {
    it('calls onToggleMute when mute button clicked', () => {
      const onToggleMute = vi.fn()
      render(<Toolbar {...defaultProps} onToggleMute={onToggleMute} />)
      fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
      expect(onToggleMute).toHaveBeenCalledOnce()
    })

    it('has aria-pressed=true when muted', () => {
      render(<Toolbar {...defaultProps} isMuted={true} />)
      const btn = screen.getByRole('button', { name: 'Unmute' })
      expect(btn.getAttribute('aria-pressed')).toBe('true')
    })

    it('has aria-pressed=false when not muted', () => {
      render(<Toolbar {...defaultProps} isMuted={false} />)
      const btn = screen.getByRole('button', { name: 'Mute' })
      expect(btn.getAttribute('aria-pressed')).toBe('false')
    })

    it('shows Unmute label when muted', () => {
      render(<Toolbar {...defaultProps} isMuted={true} />)
      expect(screen.getByRole('button', { name: 'Unmute' })).toBeTruthy()
    })

    it('shows Mute label when not muted', () => {
      render(<Toolbar {...defaultProps} isMuted={false} />)
      expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy()
    })
  })

  describe('import button', () => {
    it('calls onImport when import button clicked', () => {
      const onImport = vi.fn()
      render(<Toolbar {...defaultProps} onImport={onImport} />)
      fireEvent.click(screen.getByRole('button', { name: 'Import channel' }))
      expect(onImport).toHaveBeenCalledOnce()
    })
  })

  describe('keyboard hints', () => {
    it('renders keyboard shortcut hints text', () => {
      render(<Toolbar {...defaultProps} />)
      expect(screen.getByText(/\[G\] Guide/)).toBeTruthy()
    })
  })

  describe('null state', () => {
    it('renders without errors when both channel and position are null', () => {
      expect(() =>
        render(<Toolbar {...defaultProps} channel={null} position={null} />),
      ).not.toThrow()
    })
  })
})
