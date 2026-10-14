import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { SplashScreen } from '../../../src/routes/index.tsx'
import type { Channel } from '../../../src/lib/scheduling/types'
import { CHANNEL_PRESETS } from '../../../src/lib/channels/presets'

const mockNavigate = vi.fn()
const mockLoadCustomChannels = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: unknown) => opts,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../../src/lib/storage/local-channels', () => ({
  loadCustomChannels: mockLoadCustomChannels,
}))

const makeCustomChannel = (id: string, number: number): Channel => ({
  kind: 'video',
  id,
  number,
  name: `Custom ${id}`,
  playlistId: 'PLcustom',
  videos: [
    { id: 'cv1', title: 'Custom clip', durationSeconds: 180, thumbnailUrl: '' },
  ],
  totalDurationSeconds: 180,
})

describe('SplashScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    mockLoadCustomChannels.mockReset()
    mockLoadCustomChannels.mockReturnValue([])
    localStorage.clear()
  })

  it('renders the KranzTV title', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByText('KranzTV')).toBeTruthy()
  })

  it('renders the tagline', () => {
    render(React.createElement(SplashScreen))
    expect(
      screen.getByText('Live Cable TV from YouTube Playlists'),
    ).toBeTruthy()
  })

  it('renders the channel count with preset channels only when no custom channels', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByText(/CHANNELS AVAILABLE/i)).toBeTruthy()
  })

  it('renders the TURN ON TV button', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByRole('button', { name: /TURN ON TV/i })).toBeTruthy()
  })

  it('navigates to the first channel when TURN ON TV is clicked', () => {
    render(React.createElement(SplashScreen))

    fireEvent.click(screen.getByRole('button', { name: /TURN ON TV/i }))

    expect(mockNavigate).toHaveBeenCalledOnce()
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: 'skate' },
    })
  })

  it('renders the retro overlay element', () => {
    const { container } = render(React.createElement(SplashScreen))
    // Default overlay mode is 'crt' (reads from localStorage, which is empty in tests)
    expect(container.querySelector('.overlay-crt')).not.toBeNull()
  })

  it('renders the SIGNAL FOUND channel bug', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByText(/SIGNAL FOUND/i)).toBeTruthy()
  })

  it('button hover style handlers do not throw', () => {
    render(React.createElement(SplashScreen))
    const btn = screen.getByRole('button', { name: /TURN ON TV/i })
    expect(() => {
      fireEvent.mouseEnter(btn)
      fireEvent.mouseLeave(btn)
    }).not.toThrow()
  })

  it('does not render the IMPORTED section when there are no custom channels', () => {
    render(React.createElement(SplashScreen))
    expect(screen.queryByText(/IMPORTED/i)).toBeNull()
  })

  it('renders the IMPORTED section and navigates when a custom channel is clicked', () => {
    const custom = makeCustomChannel('my-list', 90)
    mockLoadCustomChannels.mockReturnValue([custom])
    render(React.createElement(SplashScreen))

    expect(screen.getByText('— IMPORTED —')).toBeTruthy()
    expect(screen.getByText(`Custom my-list`)).toBeTruthy()

    fireEvent.click(screen.getByText(`Custom my-list`))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: 'my-list' },
    })
  })

  it('counts custom channels in the CHANNELS AVAILABLE badge', async () => {
    mockLoadCustomChannels.mockReturnValue([makeCustomChannel('my-list', 90)])
    render(React.createElement(SplashScreen))

    await waitFor(() =>
      expect(
        screen.getByText(`■ ${CHANNEL_PRESETS.length + 1} CHANNELS AVAILABLE`),
      ).toBeTruthy(),
    )
  })

  it('shows the live VCR clock once mounted', () => {
    render(React.createElement(SplashScreen))

    // formatClock output always ends with AM/PM
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2} (AM|PM)/)).toBeTruthy()
  })

  it('reads a stored overlay mode and renders its overlay class', () => {
    localStorage.setItem('kranz-tv:overlay-mode', JSON.stringify('vhs'))
    const { container } = render(React.createElement(SplashScreen))

    expect(container.querySelector('.overlay-vhs')).not.toBeNull()
  })

  it('falls back to CRT for an invalid stored overlay mode', () => {
    localStorage.setItem('kranz-tv:overlay-mode', 'not-json')
    const { container } = render(React.createElement(SplashScreen))

    expect(container.querySelector('.overlay-crt')).not.toBeNull()
  })

  it('falls back to CRT for a stored value that is not a known mode', () => {
    localStorage.setItem('kranz-tv:overlay-mode', JSON.stringify('bogus'))
    const { container } = render(React.createElement(SplashScreen))

    expect(container.querySelector('.overlay-crt')).not.toBeNull()
  })

  it('shows TECHNICAL DIFFICULTIES when the stored quota timestamp is fresh', () => {
    localStorage.setItem('kranz-tv:quota-exhausted', String(Date.now()))
    render(React.createElement(SplashScreen))

    expect(screen.getByText('TECHNICAL DIFFICULTIES')).toBeTruthy()
    expect(screen.getByText(/PLEASE STAND BY/)).toBeTruthy()
    expect(screen.queryByText(/SIGNAL FOUND/)).toBeNull()
  })

  it('shows SIGNAL FOUND when the stored quota timestamp predates the last PT reset', () => {
    localStorage.setItem(
      'kranz-tv:quota-exhausted',
      String(Date.now() - 7 * 24 * 60 * 60 * 1000),
    )
    render(React.createElement(SplashScreen))

    expect(screen.getByText(/SIGNAL FOUND/)).toBeTruthy()
    expect(screen.queryByText('TECHNICAL DIFFICULTIES')).toBeNull()
  })

  it('treats a legacy non-timestamp quota flag as not exhausted', () => {
    localStorage.setItem('kranz-tv:quota-exhausted', '1')
    render(React.createElement(SplashScreen))

    expect(screen.getByText(/SIGNAL FOUND/)).toBeTruthy()
  })

  it('preset and custom channel button hover handlers update styles without throwing', () => {
    mockLoadCustomChannels.mockReturnValue([makeCustomChannel('my-list', 90)])
    render(React.createElement(SplashScreen))

    const presetBtn = screen.getByText('Skate Vids').closest('button') as HTMLElement
    const customBtn = screen.getByText(`Custom my-list`).closest('button') as HTMLElement
    expect(() => {
      fireEvent.mouseEnter(presetBtn)
      fireEvent.mouseLeave(presetBtn)
      fireEvent.mouseEnter(customBtn)
      fireEvent.mouseLeave(customBtn)
    }).not.toThrow()
  })
})
