import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: unknown) => opts,
    Outlet: () => React.createElement('div', { 'data-testid': 'outlet-placeholder' }),
  }
})

import { TvLayout } from '../../../src/routes/_tv.tsx'

describe('TvLayout', () => {
  it('renders the TV GUIDE label', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByText('TV GUIDE')).toBeTruthy()
  })

  it('renders the KRANZTV brand in the toolbar', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByText('KRANZTV')).toBeTruthy()
  })

  it('renders the SELECT A CHANNEL placeholder', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByText(/SELECT A CHANNEL/i)).toBeTruthy()
  })

  it('renders the Outlet slot for child routes', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByTestId('outlet-placeholder')).toBeTruthy()
  })

  it('renders the CRT overlay element', () => {
    const { container } = render(React.createElement(TvLayout))
    expect(container.querySelector('.crt-overlay')).not.toBeNull()
  })

  it('renders the TV guide LOADING placeholder', () => {
    render(React.createElement(TvLayout))
    expect(screen.getByText(/LOADING GUIDE/i)).toBeTruthy()
  })

  it('renders the guide content container with correct id', () => {
    const { container } = render(React.createElement(TvLayout))
    expect(container.querySelector('#tv-guide-content')).not.toBeNull()
  })
})
