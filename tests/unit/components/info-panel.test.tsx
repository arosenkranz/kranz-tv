import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InfoPanel } from '~/components/info-panel/info-panel'
import type {
  Channel,
  SchedulePosition,
  VideoChannel,
} from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'

const videos = [
  {
    id: 'v1',
    title: 'Video One',
    durationSeconds: 120,
    thumbnailUrl: 'https://example.com/v1.jpg',
  },
  {
    id: 'v2',
    title: 'Video Two',
    durationSeconds: 120,
    thumbnailUrl: 'https://example.com/v2.jpg',
  },
]

const channel: VideoChannel = {
  kind: 'video',
  id: 'test-ch',
  number: 5,
  name: 'Test Channel',
  playlistId: 'PL123',
  videos,
  totalDurationSeconds: 240,
}

function localDate(h: number, m: number): Date {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

function makePosition(slotEnd: Date): SchedulePosition {
  return {
    item: videos[0],
    seekSeconds: 30,
    slotStartTime: new Date(slotEnd.getTime() - 120_000),
    slotEndTime: slotEnd,
  }
}

const allPresets: ChannelPreset[] = [
  {
    kind: 'video',
    id: 'test-ch',
    number: 5,
    name: 'Preset Five',
    description: 'Fifth',
    playlistId: 'PL123',
  },
  {
    kind: 'video',
    id: 'other-ch',
    number: 6,
    name: 'Preset Six',
    description: 'Sixth',
    playlistId: 'PL456',
  },
]

function renderPanel(overrides: Partial<Parameters<typeof InfoPanel>[0]> = {}) {
  const onChannelSelect = vi.fn()
  const props = {
    channel: channel as Channel,
    preset: allPresets[0],
    position: makePosition(localDate(10, 0)),
    allPresets,
    loadedChannels: new Map([['test-ch', channel as Channel]]),
    currentChannelId: 'test-ch',
    onChannelSelect,
    ...overrides,
  }
  const utils = render(<InfoPanel {...props} />)
  return { ...utils, onChannelSelect, props }
}

describe('InfoPanel', () => {
  it('shows the preset channel number when a preset is given', () => {
    renderPanel()
    expect(screen.getAllByText('CH05').length).toBeGreaterThan(0)
  })

  it('falls back to the channel id when no preset is given', () => {
    renderPanel({ preset: undefined })
    expect(screen.getByText('test-ch')).toBeTruthy()
  })

  it('shows the "Select a channel" placeholder without a position', () => {
    renderPanel({ position: null })
    expect(screen.getByText('SELECT A CHANNEL')).toBeTruthy()
  })

  it('shows the up-next slot end as a 12-hour clock time in PM', () => {
    renderPanel({ position: makePosition(localDate(14, 5)) })
    expect(screen.getByText(/2:05 PM/)).toBeTruthy()
  })

  it('renders noon as 12:xx PM', () => {
    renderPanel({ position: makePosition(localDate(12, 0)) })
    expect(screen.getByText(/12:00 PM/)).toBeTruthy()
  })

  it('renders midnight as 12:xx AM', () => {
    renderPanel({ position: makePosition(localDate(0, 30)) })
    expect(screen.getByText(/12:30 AM/)).toBeTruthy()
  })

  it('lists the loaded channel name when the channel is loaded', () => {
    renderPanel()
    expect(screen.getByText('Test Channel')).toBeTruthy()
  })

  it('falls back to the preset name for channels that are not loaded', () => {
    renderPanel({ loadedChannels: new Map() })
    expect(screen.getByText('Preset Five')).toBeTruthy()
  })

  it('highlights a mini-guide row on hover and restores it on leave', () => {
    renderPanel({ currentChannelId: 'other-ch' })

    const testRow = screen
      .getByText('Test Channel')
      .closest('button') as HTMLElement
    expect(testRow).not.toBeNull()
    expect(testRow.style.backgroundColor).toBe('transparent')

    fireEvent.mouseEnter(testRow)
    expect(testRow.style.backgroundColor).toBe('rgba(57, 255, 20, 0.06)')

    fireEvent.mouseLeave(testRow)
    expect(testRow.style.backgroundColor).toBe('transparent')
  })

  it('does not apply the hover highlight to the current channel row', () => {
    renderPanel({ currentChannelId: 'test-ch' })

    const testRow = screen
      .getByText('Test Channel')
      .closest('button') as HTMLElement
    expect(testRow.style.backgroundColor).toBe('rgba(57, 255, 20, 0.1)')

    fireEvent.mouseEnter(testRow)
    expect(testRow.style.backgroundColor).toBe('rgba(57, 255, 20, 0.1)')

    fireEvent.mouseLeave(testRow)
    expect(testRow.style.backgroundColor).toBe('rgba(57, 255, 20, 0.1)')
  })

  it('calls onChannelSelect with the preset id when a row is clicked', () => {
    const { onChannelSelect } = renderPanel({ currentChannelId: 'other-ch' })

    fireEvent.click(
      screen.getByText('Preset Six').closest('button') as HTMLElement,
    )
    expect(onChannelSelect).toHaveBeenCalledWith('other-ch')
  })
})
