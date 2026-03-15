import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { EpgOverlay } from '../../../src/components/epg-overlay/epg-overlay'
import type { ChannelPreset } from '../../../src/lib/channels/types'
import type { Channel } from '../../../src/lib/scheduling/types'

// Stub out buildEpgEntries to keep tests fast
vi.mock('../../../src/lib/scheduling/epg-builder', () => ({
  buildEpgEntries: () => [],
}))

// jsdom doesn't implement scrollIntoView
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

const CHANNELS: ChannelPreset[] = [
  { id: 'ch1', number: 1, name: 'Channel One', description: '', playlistId: 'PL1', emoji: '📺' },
  { id: 'ch2', number: 2, name: 'Channel Two', description: '', playlistId: 'PL2', emoji: '🎬' },
  { id: 'ch3', number: 3, name: 'Channel Three', description: '', playlistId: 'PL3', emoji: '🎭' },
]

const LOADED: Map<string, Channel> = new Map()

const NOW = new Date('2026-03-15T20:00:00Z')

const defaultProps = {
  visible: true,
  channels: CHANNELS,
  loadedChannels: LOADED,
  currentChannelId: 'ch1',
  onChannelSelect: vi.fn(),
  onClose: vi.fn(),
  now: NOW,
}

describe('EpgOverlay', () => {
  it('renders nothing when visible is false', () => {
    const { container } = render(
      React.createElement(EpgOverlay, { ...defaultProps, visible: false }),
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the overlay when visible is true', () => {
    render(React.createElement(EpgOverlay, defaultProps))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('renders the TV GUIDE header', () => {
    render(React.createElement(EpgOverlay, defaultProps))
    expect(screen.getByText('TV GUIDE')).toBeTruthy()
  })

  it('renders all channel rows', () => {
    render(React.createElement(EpgOverlay, defaultProps))
    expect(screen.getByText('Channel One')).toBeTruthy()
    expect(screen.getByText('Channel Two')).toBeTruthy()
    expect(screen.getByText('Channel Three')).toBeTruthy()
  })

  it('shows NOW indicator on current channel', () => {
    render(React.createElement(EpgOverlay, defaultProps))
    expect(screen.getByText('▶ NOW')).toBeTruthy()
  })

  it('shows [ESC] CLOSE hint', () => {
    render(React.createElement(EpgOverlay, defaultProps))
    expect(screen.getByText('[ESC] CLOSE')).toBeTruthy()
  })
})
