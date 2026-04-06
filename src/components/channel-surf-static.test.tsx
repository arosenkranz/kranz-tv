import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChannelSurfStatic } from './channel-surf-static'
import type { ChannelPreset } from '~/lib/channels/types'

const makePreset = (overrides: Partial<ChannelPreset> = {}): ChannelPreset => ({
  id: 'test',
  number: 4,
  name: 'Favorites',
  description: 'All-time favorites',
  playlistId: 'PLtest',
  emoji: '⭐',
  ...overrides,
})

describe('ChannelSurfStatic', () => {
  it('renders nothing when both showStatic and showOsd are false', () => {
    const { container } = render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={false}
        showOsd={false}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders static burst when showStatic is true', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={true}
        showOsd={false}
      />,
    )
    expect(screen.getByTestId('surf-static')).toBeTruthy()
  })

  it('renders OSD with channel number and name when showOsd is true', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset({ number: 7, name: 'Live Music' })}
        showStatic={false}
        showOsd={true}
      />,
    )

    const osd = screen.getByTestId('surf-osd')
    expect(osd.textContent).toContain('CH07')
    expect(osd.textContent).toContain('LIVE MUSIC')
  })

  it('renders both static and OSD simultaneously', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={true}
        showOsd={true}
      />,
    )

    expect(screen.getByTestId('surf-static')).toBeTruthy()
    expect(screen.getByTestId('surf-osd')).toBeTruthy()
  })

  it('does not render OSD when channel is null', () => {
    render(
      <ChannelSurfStatic
        channel={null}
        showStatic={false}
        showOsd={true}
      />,
    )

    expect(screen.queryByTestId('surf-osd')).toBeNull()
  })

  it('applies osd-fade class when static is not showing', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={false}
        showOsd={true}
      />,
    )

    const osd = screen.getByTestId('surf-osd')
    expect(osd.className).toContain('osd-fade')
  })

  it('does not apply osd-fade class when static is showing', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={true}
        showOsd={true}
      />,
    )

    const osd = screen.getByTestId('surf-osd')
    expect(osd.className).not.toContain('osd-fade')
  })

  it('formats single-digit channel numbers with leading zero', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset({ number: 3 })}
        showStatic={false}
        showOsd={true}
      />,
    )

    expect(screen.getByTestId('surf-osd').textContent).toContain('CH03')
  })

  it('formats double-digit channel numbers without extra padding', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset({ number: 11 })}
        showStatic={false}
        showOsd={true}
      />,
    )

    expect(screen.getByTestId('surf-osd').textContent).toContain('CH11')
  })

  it('applies reduced opacity for surf navigation source', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={true}
        showOsd={false}
        navigationSource="surf"
      />,
    )

    const staticEl = screen.getByTestId('surf-static')
    expect(staticEl.style.opacity).toBe('0.5')
  })

  it('does not apply reduced opacity for keyboard navigation source', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={true}
        showOsd={false}
        navigationSource="keyboard"
      />,
    )

    const staticEl = screen.getByTestId('surf-static')
    expect(staticEl.style.opacity).not.toBe('0.5')
  })

  it('does not apply reduced opacity when navigationSource is omitted', () => {
    render(
      <ChannelSurfStatic
        channel={makePreset()}
        showStatic={true}
        showOsd={false}
      />,
    )

    const staticEl = screen.getByTestId('surf-static')
    expect(staticEl.style.opacity).not.toBe('0.5')
  })
})
