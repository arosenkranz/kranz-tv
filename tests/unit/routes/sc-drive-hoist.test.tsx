import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect } from 'react'
import type { Channel, MusicChannel } from '~/lib/scheduling/types'

// ---------------------------------------------------------------------------
// Regression guard for the SC-drive-ownership hoist (bug: view-mode toggles
// reloaded the SoundCloud track).
//
// The shared SoundCloud widget is driven from TvLayout (src/routes/_tv.tsx),
// keyed on `currentChannel` IDENTITY only — NOT on `now` / `currentChannelId` /
// `loadedChannels`. This test encodes that contract in isolation (rendering the
// full TvLayout needs the router + provider + media-query stack, which is far
// more brittle than the invariant it would protect):
//   1. a music channel drives setActiveChannel(channel); anything else → null
//   2. a re-render with the SAME channel object must NOT re-call
//      setActiveChannel — this is what stops the per-second `now` tick (and a
//      remount that re-sets the same channel) from thrashing the provider's
//      advance guard, which setActiveChannel resets on every call.
//
// If someone widens the effect deps (e.g. adds `now`) or drops the identity
// stability of `currentChannel`, cases 2 below break.
// ---------------------------------------------------------------------------

/** Mirror of the hoisted effect in TvLayout — same logic, same deps. */
function ScDriver({
  currentChannel,
  setActiveChannel,
}: {
  currentChannel: Channel | undefined
  setActiveChannel: (c: MusicChannel | null) => void
}) {
  useEffect(() => {
    setActiveChannel(
      currentChannel?.kind === 'music' ? currentChannel : null,
    )
  }, [currentChannel, setActiveChannel])
  return null
}

const musicChannel = (id: string): MusicChannel => ({
  kind: 'music',
  id,
  number: 1,
  name: id,
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/x/sets/y',
  description: '',
  totalDurationSeconds: 300,
  trackCount: 1,
  tracks: [
    {
      id: 't1',
      title: 'Track',
      artist: 'Artist',
      durationSeconds: 300,
      embedUrl: 'https://api.soundcloud.com/tracks/1',
    },
  ],
})

const videoChannel = (id: string): Channel => ({
  kind: 'video',
  id,
  number: 2,
  name: id,
  playlistId: 'PL1',
  videos: [{ id: 'v1', title: 'Clip', durationSeconds: 300, thumbnailUrl: '' }],
  totalDurationSeconds: 300,
})

describe('SC-drive hoist contract', () => {
  it('drives a music channel and passes null for a video channel', () => {
    const setActiveChannel = vi.fn()
    const music = musicChannel('sc-calming')

    const { rerender } = render(
      <ScDriver currentChannel={music} setActiveChannel={setActiveChannel} />,
    )
    expect(setActiveChannel).toHaveBeenLastCalledWith(music)

    rerender(
      <ScDriver
        currentChannel={videoChannel('nature')}
        setActiveChannel={setActiveChannel}
      />,
    )
    expect(setActiveChannel).toHaveBeenLastCalledWith(null)
  })

  it('passes null when no channel is selected', () => {
    const setActiveChannel = vi.fn()
    render(
      <ScDriver currentChannel={undefined} setActiveChannel={setActiveChannel} />,
    )
    expect(setActiveChannel).toHaveBeenCalledWith(null)
  })

  it('does NOT re-call setActiveChannel when re-rendered with the same channel object (anti-churn)', () => {
    const setActiveChannel = vi.fn()
    const music = musicChannel('sc-calming')

    const { rerender } = render(
      <ScDriver currentChannel={music} setActiveChannel={setActiveChannel} />,
    )
    expect(setActiveChannel).toHaveBeenCalledTimes(1)

    // Simulate the 1s `now` tick / a same-channel remount: same identity in,
    // stable setActiveChannel — effect deps unchanged, so no second call.
    rerender(
      <ScDriver currentChannel={music} setActiveChannel={setActiveChannel} />,
    )
    expect(setActiveChannel).toHaveBeenCalledTimes(1)
  })
})
