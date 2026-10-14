import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { MobileView } from './mobile-view'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  orientationState,
  onboardingState,
  swipeOpts,
  mockDismissOnboarding,
  mockVibrate,
  rum,
} = vi.hoisted(() => ({
  orientationState: { value: 'portrait' as 'portrait' | 'landscape' },
  onboardingState: { value: false },
  swipeOpts: { current: null as null | { onSwipe: (d: 'up' | 'down') => void } },
  mockDismissOnboarding: vi.fn(),
  mockVibrate: vi.fn(),
  rum: {
    trackSwipeChannelChange: vi.fn(),
    trackLandscapeFullscreen: vi.fn(),
    trackGuideSheetOpen: vi.fn(),
  },
}))

vi.mock('~/hooks/use-orientation', () => ({
  useOrientation: () => orientationState.value,
}))

vi.mock('~/hooks/use-swipe-gesture', () => ({
  useSwipeGesture: (
    _ref: unknown,
    opts: { onSwipe: (d: 'up' | 'down') => void },
  ) => {
    swipeOpts.current = opts
  },
}))

vi.mock('~/hooks/use-onboarding', () => ({
  useOnboarding: () => ({
    needsOnboarding: onboardingState.value,
    dismissOnboarding: mockDismissOnboarding,
  }),
}))

vi.mock('~/lib/haptic', () => ({
  vibrate: mockVibrate,
}))

vi.mock('~/lib/datadog/rum', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/rum')>()
  return { ...actual, ...rum }
})

// MobilePlayerArea is replaced with a control panel that drives the
// onPlay/onResync/onUnmute callbacks from buttons and reports isPlaying.
vi.mock('~/components/mobile/mobile-player-area', async () => {
  const React = await import('react')
  return {
    MobilePlayerArea: (props: {
      isPlaying: boolean
      onPlay: () => void
      onResync: () => void
      onUnmute?: () => void
      fillHeight?: boolean
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'mobile-player-area' },
        React.createElement(
          'span',
          { 'data-testid': 'player-is-playing' },
          String(props.isPlaying),
        ),
        React.createElement(
          'span',
          { 'data-testid': 'player-fill-height' },
          String(props.fillHeight ?? false),
        ),
        React.createElement('button', {
          'data-testid': 'player-play',
          onClick: () => props.onPlay(),
        }),
        React.createElement('button', {
          'data-testid': 'player-resync',
          onClick: () => props.onResync(),
        }),
        React.createElement('button', {
          'data-testid': 'player-unmute',
          onClick: () => props.onUnmute?.(),
        }),
      ),
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeChannel = (id = 'skate'): Channel => ({
  kind: 'video',
  id,
  number: 1,
  name: 'Skate Vids',
  playlistId: 'PL123',
  videos: [
    { id: 'v1', title: 'Skate Clip', durationSeconds: 300, thumbnailUrl: '' },
  ],
  totalDurationSeconds: 300,
})

const makePosition = (): SchedulePosition => ({
  item: { id: 'v1', durationSeconds: 300 },
  seekSeconds: 45,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

const makePresets = (): ChannelPreset[] => [
  {
    id: 'skate',
    number: 1,
    name: 'Skate Vids',
    description: 'Skateboarding',
    kind: 'video',
    playlistId: 'PL1',
  },
  {
    id: 'party',
    number: 3,
    name: 'Party Background',
    description: 'Party',
    kind: 'video',
    playlistId: 'PL3',
  },
]

const makeProps = (
  overrides: Partial<Parameters<typeof MobileView>[0]> = {},
) => ({
  channel: makeChannel(),
  position: makePosition(),
  isMuted: false,
  volume: 80,
  isFullscreen: false,
  onToggleMute: vi.fn(),
  onPlay: vi.fn(),
  onChannelSelect: vi.fn(),
  onNextChannel: vi.fn(),
  onPrevChannel: vi.fn(),
  onResync: vi.fn(),
  onShare: vi.fn(),
  onCycleOverlay: vi.fn(),
  onFullscreen: vi.fn(),
  showStatic: false,
  overlayMode: 'crt' as const,
  showOverlayToast: false,
  toast: { visible: false, message: '', detail: undefined },
  allPresets: makePresets(),
  loadedChannels: new Map<string, Channel>([['skate', makeChannel()]]),
  currentChannelId: 'skate',
  surfState: {
    showStatic: false,
    showOsd: false,
    channel: null,
    navigationSource: 'keyboard' as const,
  },
  ...overrides,
})

const renderMobileView = (props: Parameters<typeof MobileView>[0]) =>
  render(<MobileView {...props} />)

const swipe = (direction: 'up' | 'down') => {
  expect(swipeOpts.current, 'swipe hook not wired').not.toBeNull()
  act(() => {
    swipeOpts.current!.onSwipe(direction)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MobileView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    orientationState.value = 'portrait'
    onboardingState.value = false
    swipeOpts.current = null
  })

  afterEach(() => {
    swipeOpts.current = null
  })

  describe('portrait composition', () => {
    it('renders player area, now/next bar, toolbar, and now playing', () => {
      renderMobileView(makeProps())

      expect(screen.getByTestId('mobile-player-area')).toBeTruthy()
      expect(
        screen.getByRole('button', {
          name: 'Now playing — tap for guide, swipe to change channel',
        }),
      ).toBeTruthy()
      expect(screen.getByLabelText('Mute')).toBeTruthy()
      expect(screen.getByLabelText('Help')).toBeTruthy()
      expect(screen.getByText('On Air')).toBeTruthy()
      // The video title appears in both the now/next bar and now playing
      expect(screen.getAllByText('Skate Clip').length).toBe(2)
    })

    it('player area does not fill the screen in portrait', () => {
      renderMobileView(makeProps())

      expect(screen.getByTestId('player-fill-height').textContent).toBe('false')
    })

    it('relays resync and unmute from the player area', () => {
      const props = makeProps()
      renderMobileView(props)

      fireEvent.click(screen.getByTestId('player-resync'))
      expect(props.onResync).toHaveBeenCalledOnce()

      fireEvent.click(screen.getByTestId('player-unmute'))
      expect(props.onToggleMute).toHaveBeenCalledOnce()
    })

    it('toolbar buttons relay share, overlay, and fullscreen', () => {
      const props = makeProps()
      renderMobileView(props)

      fireEvent.click(screen.getByLabelText('Share link'))
      expect(props.onShare).toHaveBeenCalledOnce()

      fireEvent.click(screen.getByLabelText('Overlay: crt'))
      expect(props.onCycleOverlay).toHaveBeenCalledOnce()

      fireEvent.click(screen.getByLabelText('Fullscreen'))
      expect(props.onFullscreen).toHaveBeenCalledOnce()
    })
  })

  describe('swipe navigation', () => {
    it('swipe up goes to the next channel with haptics and telemetry', () => {
      const props = makeProps()
      renderMobileView(props)

      swipe('up')

      expect(mockVibrate).toHaveBeenCalled()
      expect(rum.trackSwipeChannelChange).toHaveBeenCalledWith('up', 'skate')
      expect(props.onNextChannel).toHaveBeenCalledOnce()
      expect(props.onPrevChannel).not.toHaveBeenCalled()
    })

    it('swipe down goes to the previous channel', () => {
      const props = makeProps()
      renderMobileView(props)

      swipe('down')

      expect(rum.trackSwipeChannelChange).toHaveBeenCalledWith('down', 'skate')
      expect(props.onPrevChannel).toHaveBeenCalledOnce()
    })

    it('swipes are blocked while the guide sheet is open', () => {
      const props = makeProps()
      renderMobileView(props)

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Now playing — tap for guide, swipe to change channel',
        }),
      )
      expect(rum.trackGuideSheetOpen).toHaveBeenCalledOnce()

      swipe('up')
      expect(props.onNextChannel).not.toHaveBeenCalled()
    })

    it('swipes are blocked while the help overlay is open', () => {
      const props = makeProps()
      renderMobileView(props)
      fireEvent.click(screen.getByLabelText('Help'))
      expect(screen.getByText('GOT IT')).toBeTruthy()

      swipe('up')

      expect(props.onNextChannel).not.toHaveBeenCalled()
    })

    it('swipes are blocked during first-visit onboarding', () => {
      onboardingState.value = true
      const props = makeProps()
      renderMobileView(props)

      swipe('down')

      expect(props.onPrevChannel).not.toHaveBeenCalled()
    })

    it('swipes are blocked while the landscape fullscreen prompt is showing', () => {
      orientationState.value = 'landscape'
      const props = makeProps()
      renderMobileView(props)

      // Start playback so the landscape prompt appears
      fireEvent.click(screen.getByTestId('player-play'))
      expect(screen.getByLabelText('Tap for fullscreen')).toBeTruthy()

      swipe('up')

      expect(props.onNextChannel).not.toHaveBeenCalled()
    })
  })

  describe('guide sheet', () => {
    it('opens from the now/next bar and selects a channel from the list', () => {
      const props = makeProps()
      const { container } = renderMobileView(props)

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Now playing — tap for guide, swipe to change channel',
        }),
      )
      expect(rum.trackGuideSheetOpen).toHaveBeenCalledOnce()
      expect(container.querySelector('.fixed.inset-0.z-40')).not.toBeNull()

      fireEvent.click(screen.getByLabelText('Channel 3: Party Background'))
      expect(props.onChannelSelect).toHaveBeenCalledWith('party')

      // Selecting from the sheet closes it: the backdrop disappears once the
      // sheet slides back below the fold (the row buttons stay mounted).
      expect(container.querySelector('.fixed.inset-0.z-40')).toBeNull()
    })

    it('reopens via the collapsed peek bar and closes via the backdrop', () => {
      const props = makeProps()
      renderMobileView(props)

      // Open, select (closes), then reopen via the peek bar
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Now playing — tap for guide, swipe to change channel',
        }),
      )
      fireEvent.click(screen.getByLabelText('Channel 3: Party Background'))
      fireEvent.click(screen.getByLabelText('Open program guide'))
      expect(rum.trackGuideSheetOpen).toHaveBeenCalledTimes(2)

      // Backdrop click closes the sheet without selecting
      fireEvent.click(screen.getByLabelText('Channel 1: Skate Vids'))
      expect(props.onChannelSelect).toHaveBeenCalledWith('skate')
    })
  })

  describe('landscape composition', () => {
    it('hides toolbar, now/next bar, now playing, and the guide sheet', () => {
      orientationState.value = 'landscape'
      renderMobileView(makeProps())

      expect(screen.getByTestId('player-fill-height').textContent).toBe('true')
      expect(screen.queryByLabelText('Mute')).toBeNull()
      expect(
        screen.queryByRole('button', {
          name: 'Now playing — tap for guide, swipe to change channel',
        }),
      ).toBeNull()
      expect(screen.queryByText('On Air')).toBeNull()
      expect(screen.queryByLabelText('Open program guide')).toBeNull()
    })

    it('does not show the fullscreen prompt until playback starts', () => {
      orientationState.value = 'landscape'
      const props = makeProps()
      renderMobileView(props)

      expect(screen.queryByLabelText('Tap for fullscreen')).toBeNull()

      fireEvent.click(screen.getByTestId('player-play'))
      expect(screen.getByLabelText('Tap for fullscreen')).toBeTruthy()
    })

    it('entering fullscreen from the prompt tracks landscape-fullscreen', () => {
      orientationState.value = 'landscape'
      const props = makeProps()
      renderMobileView(props)
      fireEvent.click(screen.getByTestId('player-play'))

      fireEvent.click(screen.getByLabelText('Tap for fullscreen'))

      expect(props.onFullscreen).toHaveBeenCalledOnce()
      expect(rum.trackLandscapeFullscreen).toHaveBeenCalledOnce()
    })

    it('dismissing the prompt hides it for this orientation', () => {
      orientationState.value = 'landscape'
      const props = makeProps()
      renderMobileView(props)
      fireEvent.click(screen.getByTestId('player-play'))

      fireEvent.click(screen.getByLabelText('Dismiss fullscreen prompt'))

      expect(screen.queryByLabelText('Tap for fullscreen')).toBeNull()
      expect(props.onFullscreen).not.toHaveBeenCalled()
    })
  })

  describe('fullscreen composition', () => {
    it('renders the player full-screen with an EXIT button', () => {
      const props = makeProps({ isFullscreen: true })
      renderMobileView(props)

      expect(screen.getByTestId('player-fill-height').textContent).toBe('true')
      expect(screen.queryByLabelText('Mute')).toBeNull()

      fireEvent.click(screen.getByLabelText('Exit fullscreen'))
      expect(props.onFullscreen).toHaveBeenCalledOnce()
    })

    it('first tap plays and force-mutes via onPlay; later taps do not re-fire onPlay', () => {
      const props = makeProps({ isFullscreen: true })
      renderMobileView(props)

      fireEvent.click(screen.getByTestId('player-play'))
      expect(props.onPlay).toHaveBeenCalledOnce()
      expect(screen.getByTestId('player-is-playing').textContent).toBe('true')

      fireEvent.click(screen.getByTestId('player-play'))
      expect(props.onPlay).toHaveBeenCalledOnce() // hasPlayedRef gates re-fires
    })

    it('changing channels resets the poster state (isPlaying) but not the session play gate', () => {
      const { rerender } = renderMobileView(makeProps({ isFullscreen: true }))

      fireEvent.click(screen.getByTestId('player-play'))
      expect(screen.getByTestId('player-is-playing').textContent).toBe('true')

      const nextProps = makeProps({
        isFullscreen: true,
        channel: makeChannel('party'),
      })
      rerender(<MobileView {...nextProps} />)

      expect(screen.getByTestId('player-is-playing').textContent).toBe('false')

      // The first-play gate is session-level: the tap plays again without
      // re-firing the force-mute onPlay callback.
      fireEvent.click(screen.getByTestId('player-play'))
      expect(nextProps.onPlay).not.toHaveBeenCalled()
      expect(screen.getByTestId('player-is-playing').textContent).toBe('true')
    })
  })

  describe('auto-exit fullscreen on portrait return', () => {
    it('exits fullscreen on portrait only when it was auto-entered from landscape', () => {
      orientationState.value = 'landscape'
      const props = makeProps()
      const { rerender } = renderMobileView(props)

      // Auto-enter via the landscape prompt (sets landscapeFullscreenRef)
      fireEvent.click(screen.getByTestId('player-play'))
      fireEvent.click(screen.getByLabelText('Tap for fullscreen'))
      expect(props.onFullscreen).toHaveBeenCalledTimes(1)

      // Rotate back to portrait while fullscreen → auto-exit fires exactly
      // once, against the same stable onFullscreen callback.
      orientationState.value = 'portrait'
      rerender(<MobileView {...{ ...props, isFullscreen: true }} />)
      expect(props.onFullscreen).toHaveBeenCalledTimes(2)

      // The auto-entered flag was consumed — later portraits do not re-exit
      rerender(<MobileView {...{ ...props, isFullscreen: true }} />)
      expect(props.onFullscreen).toHaveBeenCalledTimes(2)
    })
  })

  describe('help overlay and onboarding', () => {
    it('toolbar help opens the overlay and GOT IT dismisses it', () => {
      const props = makeProps()
      renderMobileView(props)

      fireEvent.click(screen.getByLabelText('Help'))
      expect(screen.getByText('GOT IT')).toBeTruthy()

      fireEvent.click(screen.getByText('GOT IT'))
      expect(screen.queryByText('GOT IT')).toBeNull()
      expect(mockDismissOnboarding).toHaveBeenCalledOnce()
    })

    it('auto-shows the overlay for first-visit onboarding', () => {
      onboardingState.value = true
      renderMobileView(makeProps())

      expect(screen.getByText('GOT IT')).toBeTruthy()
    })
  })

  describe('toasts', () => {
    it('shows the overlay-mode toast with the mode label', () => {
      renderMobileView(
        makeProps({ showOverlayToast: true, overlayMode: 'vhs' }),
      )

      expect(screen.getByText('OVERLAY: VHS')).toBeTruthy()
    })

    it('labels the none overlay mode as OFF in the toast', () => {
      renderMobileView(
        makeProps({ showOverlayToast: true, overlayMode: 'none' }),
      )

      expect(screen.getByText('OVERLAY: OFF')).toBeTruthy()
    })

    it('renders the shared toast when visible', () => {
      renderMobileView(
        makeProps({
          toast: { visible: true, message: 'LINK COPIED', detail: 'https://tv' },
        }),
      )

      expect(screen.getByText('LINK COPIED')).toBeTruthy()
      expect(screen.getByText('https://tv')).toBeTruthy()
    })
  })
})
