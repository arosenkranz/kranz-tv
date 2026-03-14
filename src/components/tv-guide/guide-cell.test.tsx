import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EpgEntry } from '~/lib/scheduling/types'
import { GuideCell } from './guide-cell'

const WINDOW_START = new Date('2024-01-01T14:00:00Z')
const WINDOW_END = new Date('2024-01-01T16:00:00Z') // 2-hour window

function makeEntry(overrides: Partial<EpgEntry> = {}): EpgEntry {
  return {
    video: {
      id: 'v1',
      title: 'Nature Documentary',
      durationSeconds: 1800,
      thumbnailUrl: 'https://img/nature.jpg',
    },
    channelId: 'nature',
    startTime: new Date('2024-01-01T14:00:00Z'),
    endTime: new Date('2024-01-01T14:30:00Z'),
    isCurrentlyPlaying: false,
    ...overrides,
  }
}

describe('GuideCell', () => {
  describe('layout calculation', () => {
    it('renders at left=0% for entry starting at window start', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T14:30:00Z'),
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.style.left).toBe('0%')
    })

    it('renders at left=50% for entry starting at window midpoint', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T15:00:00Z'), // 60 min into 2h window = 50%
        endTime: new Date('2024-01-01T15:30:00Z'),
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.style.left).toBe('50%')
    })

    it('renders width=25% for a 30-min entry in a 2-hour window', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T14:30:00Z'), // 30 min / 120 min = 25%
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.style.width).toBe('25%')
    })

    it('clips entry that starts before window start', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T13:30:00Z'), // 30 min before window
        endTime: new Date('2024-01-01T14:30:00Z'),
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.style.left).toBe('0%')
      // visible portion is 30 min of 120 min = 25%
      expect(cell.style.width).toBe('25%')
    })

    it('clips entry that ends after window end', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T15:30:00Z'),
        endTime: new Date('2024-01-01T17:00:00Z'), // extends 60 min past window
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      // left = (90 min / 120 min) * 100 = 75%
      expect(cell.style.left).toBe('75%')
      // visible = 30 min / 120 min = 25%
      expect(cell.style.width).toBe('25%')
    })

    it('returns null for entry entirely before window', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T13:00:00Z'),
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      expect(container.firstChild).toBeNull()
    })

    it('returns null for entry entirely after window', () => {
      const entry = makeEntry({
        startTime: new Date('2024-01-01T17:00:00Z'),
        endTime: new Date('2024-01-01T18:00:00Z'),
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      expect(container.firstChild).toBeNull()
    })
  })

  describe('content', () => {
    it('shows the video title', () => {
      render(
        <GuideCell
          entry={makeEntry()}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      expect(screen.getByText('Nature Documentary')).toBeTruthy()
    })

    it('sets title attribute for tooltip on full title', () => {
      const { container } = render(
        <GuideCell
          entry={makeEntry()}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.getAttribute('title')).toBe('Nature Documentary')
    })
  })

  describe('visual states', () => {
    it('applies amber border when isSelected', () => {
      const { container } = render(
        <GuideCell
          entry={makeEntry()}
          isSelected={true}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.className).toContain('border-amber-400')
    })

    it('applies green border when isCurrentlyPlaying and not selected', () => {
      const { container } = render(
        <GuideCell
          entry={makeEntry({ isCurrentlyPlaying: true })}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.className).toContain('border-green-400')
    })

    it('applies amber border (selected) over green (playing) when both true', () => {
      const { container } = render(
        <GuideCell
          entry={makeEntry({ isCurrentlyPlaying: true })}
          isSelected={true}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.className).toContain('border-amber-400')
    })

    it('applies standard zinc border when not selected and not playing', () => {
      const { container } = render(
        <GuideCell
          entry={makeEntry({ isCurrentlyPlaying: false })}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.className).toContain('border-zinc-600')
    })
  })

  describe('interaction', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(
        <GuideCell
          entry={makeEntry()}
          isSelected={false}
          onClick={handleClick}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledOnce()
    })

    it('is rendered as a button element', () => {
      render(
        <GuideCell
          entry={makeEntry()}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      expect(screen.getByRole('button')).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    it('handles zero-duration window gracefully (returns null)', () => {
      const sameTime = new Date('2024-01-01T14:00:00Z')
      const { container } = render(
        <GuideCell
          entry={makeEntry()}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={sameTime}
          windowEnd={sameTime}
        />,
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders an entry that exactly fills the window', () => {
      const entry = makeEntry({
        startTime: WINDOW_START,
        endTime: WINDOW_END,
      })
      const { container } = render(
        <GuideCell
          entry={entry}
          isSelected={false}
          onClick={vi.fn()}
          windowStart={WINDOW_START}
          windowEnd={WINDOW_END}
        />,
      )
      const cell = container.firstChild as HTMLElement
      expect(cell.style.left).toBe('0%')
      expect(cell.style.width).toBe('100%')
    })
  })
})
