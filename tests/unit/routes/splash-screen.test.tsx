import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import { SplashScreen } from '../../../src/routes/index.tsx'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: unknown) => opts,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../../src/lib/storage/local-channels', () => ({
  loadCustomChannels: vi.fn(() => []),
}))

describe('SplashScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders the KTV title', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByText('KTV')).toBeTruthy()
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
})
