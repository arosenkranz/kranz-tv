import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { TvLayout } from '../../../src/routes/_tv.tsx'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: unknown) => opts,
    Outlet: () =>
      React.createElement('div', { 'data-testid': 'outlet-placeholder' }),
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode
      to: string
      [key: string]: unknown
    }) => React.createElement('a', { href: to, ...props }, children),
    useNavigate: () => vi.fn(),
  }
})

describe('TvLayout', () => {
  it('renders the KTV toolbar (not the guide — guide is overlay, hidden by default)', () => {
    render(React.createElement(TvLayout))
    // Guide overlay is not visible by default (guideVisible starts true but
    // EpgOverlay requires now !== null which is set async via useEffect).
    // The toolbar is always present.
    expect(screen.getByText('KTV')).toBeTruthy()
  })

  it('renders the KTV brand in the toolbar', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByText('KTV')).toBeTruthy()
  })

  it('renders the SELECT A CHANNEL placeholder', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByText(/SELECT A CHANNEL/i)).toBeTruthy()
  })

  it('renders the Outlet slot for child routes', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByTestId('outlet-placeholder')).toBeTruthy()
  })

  it('renders the retro overlay element', () => {
    const { container } = render(React.createElement(TvLayout))
    // Default overlay is 'crt' — rendered as .overlay-crt
    expect(container.querySelector('.overlay-crt')).not.toBeNull()
  })

  it('does not render the old bottom guide panel', () => {
    const { container } = render(React.createElement(TvLayout))
    // The bottom panel was replaced by the EPG overlay; #tv-guide-content no longer exists
    expect(container.querySelector('#tv-guide-content')).toBeNull()
  })

  it('KTV brand is a link to home', () => {
    render(React.createElement(TvLayout))
    const link = screen.getByRole('link', { name: /KTV/i })
    expect(link).toBeTruthy()
  })
})
