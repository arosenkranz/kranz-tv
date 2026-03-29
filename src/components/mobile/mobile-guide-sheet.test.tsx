import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileGuideSheet } from './mobile-guide-sheet'
import type { ChannelPreset } from '~/lib/channels/types'

const presets: ChannelPreset[] = [
  {
    id: 'ch-1',
    number: 1,
    name: 'Channel One',
    description: 'Test',
    playlistId: 'PL1',
    emoji: '📺',
  },
  {
    id: 'ch-2',
    number: 2,
    name: 'Channel Two',
    description: 'Test',
    playlistId: 'PL2',
    emoji: '🎵',
  },
]

describe('MobileGuideSheet', () => {
  it('renders channel rows when open', () => {
    render(
      <MobileGuideSheet
        isOpen={true}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        onChannelSelect={vi.fn()}
        allPresets={presets}
        loadedChannels={new Map()}
        currentChannelId="ch-1"
      />,
    )
    expect(screen.getByText('Channel One')).toBeDefined()
    expect(screen.getByText('Channel Two')).toBeDefined()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <MobileGuideSheet
        isOpen={true}
        onOpen={vi.fn()}
        onClose={onClose}
        onChannelSelect={vi.fn()}
        allPresets={presets}
        loadedChannels={new Map()}
        currentChannelId="ch-1"
      />,
    )
    // The backdrop is the first aria-hidden div
    const backdrop = document.querySelector('[aria-hidden="true"]')
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onChannelSelect and onClose when a channel is selected', () => {
    const onClose = vi.fn()
    const onChannelSelect = vi.fn()
    render(
      <MobileGuideSheet
        isOpen={true}
        onOpen={vi.fn()}
        onClose={onClose}
        onChannelSelect={onChannelSelect}
        allPresets={presets}
        loadedChannels={new Map()}
        currentChannelId="ch-1"
      />,
    )
    fireEvent.click(screen.getByText('Channel Two'))
    expect(onChannelSelect).toHaveBeenCalledWith('ch-2')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
