import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: unknown) => opts,
    useNavigate: () => mockNavigate,
  }
})

import { SplashScreen } from '../../../src/routes/index.tsx'

describe('SplashScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders the KRANZTV title', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByText('KRANZTV')).toBeTruthy()
  })

  it('renders the tagline', () => {
    render(React.createElement(SplashScreen))
    expect(
      screen.getByText('Live Cable TV from YouTube Playlists'),
    ).toBeTruthy()
  })

  it('renders the channel count', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByText(/12 CHANNELS AVAILABLE/i)).toBeTruthy()
  })

  it('renders the TURN ON TV button', () => {
    render(React.createElement(SplashScreen))
    expect(screen.getByRole('button', { name: /TURN ON TV/i })).toBeTruthy()
  })

  it('navigates to /channel/nature when TURN ON TV is clicked', () => {
    render(React.createElement(SplashScreen))

    fireEvent.click(screen.getByRole('button', { name: /TURN ON TV/i }))

    expect(mockNavigate).toHaveBeenCalledOnce()
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: 'nature' },
    })
  })

  it('renders the CRT overlay element', () => {
    const { container } = render(React.createElement(SplashScreen))
    expect(container.querySelector('.crt-overlay')).not.toBeNull()
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
})
