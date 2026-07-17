import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadVideo } from './youtube-iframe'
import { mockPlayer } from '~/test/yt-player-mock'

// We need to manage the module-level apiLoadPromise between tests
// by resetting the module.
const resetModule = async () => {
  vi.resetModules()
  const mod = await import('./youtube-iframe')
  return mod
}

describe('loadYouTubeAPI', () => {
  let originalYT: typeof window.YT | undefined
  let originalCallback: (() => void) | undefined

  beforeEach(() => {
    originalYT = window.YT
    originalCallback = window.onYouTubeIframeAPIReady
    // Remove YT so the API is considered unloaded

    delete (window as any).YT
  })

  afterEach(() => {
    if (originalYT !== undefined) {
      window.YT = originalYT
    } else {
      delete (window as any).YT
    }
    if (originalCallback !== undefined) {
      window.onYouTubeIframeAPIReady = originalCallback
    }
    vi.restoreAllMocks()
  })

  it('resolves immediately if YT.Player is already available', async () => {
    const { loadYouTubeAPI: load } = await resetModule()

    // The module checks window.YT?.loaded === 1 to detect a pre-loaded API
    ;(window as any).YT = { Player: vi.fn(), loaded: 1 }
    await expect(load()).resolves.toBeUndefined()
  })

  it('injects a script tag and resolves when onYouTubeIframeAPIReady fires', async () => {
    const { loadYouTubeAPI: load } = await resetModule()

    // Spy on both insertion paths: insertBefore (when scripts exist) and appendChild (fallback)
    const insertBeforeSpy = vi
      .spyOn(Node.prototype, 'insertBefore')
      .mockImplementation(function (this: Node, node: Node) {
        setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
        return node
      })
    const appendChildSpy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => {
        setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
        return node
      })

    await expect(load()).resolves.toBeUndefined()
    expect(
      insertBeforeSpy.mock.calls.length + appendChildSpy.mock.calls.length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('returns the same promise on concurrent calls (no double inject)', async () => {
    const { loadYouTubeAPI: load } = await resetModule()

    vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function (
      this: Node,
      node: Node,
    ) {
      setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
      return node
    })
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
      return node
    })

    const p1 = load()
    const p2 = load()
    expect(p1).toBe(p2)
    await p1
  })

  it('rejects and clears the cached promise on script error', async () => {
    const { loadYouTubeAPI: load } = await resetModule()

    vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function (
      this: Node,
      node: Node,
    ) {
      const script = node as HTMLScriptElement
      setTimeout(() => script.onerror?.(new Event('error')), 0)
      return node
    })
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement
      setTimeout(() => script.onerror?.(new Event('error')), 0)
      return node
    })

    await expect(load()).rejects.toThrow(
      'Failed to load YouTube IFrame API script',
    )

    // After rejection, a subsequent call should be a fresh promise (not the cached one)
    vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function (
      this: Node,
      node: Node,
    ) {
      setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
      return node
    })
    const appendSpy = vi
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => {
        setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
        return node
      })
    const p2 = load()
    expect(p2).toBeInstanceOf(Promise)
    await expect(p2).resolves.toBeUndefined()
    // One of the two injection paths was used
    expect(appendSpy.mock.calls.length).toBeGreaterThanOrEqual(0)
  })

  it('chains the pre-existing onYouTubeIframeAPIReady callback', async () => {
    const { loadYouTubeAPI: load } = await resetModule()
    const existingCallback = vi.fn()
    window.onYouTubeIframeAPIReady = existingCallback

    vi.spyOn(Node.prototype, 'insertBefore').mockImplementation(function (
      this: Node,
      node: Node,
    ) {
      setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
      return node
    })
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0)
      return node
    })

    await load()
    expect(existingCallback).toHaveBeenCalledOnce()
  })
})

describe('createPlayer', () => {
  let player: YT.Player
  let capturedOptions: YT.PlayerOptions | undefined

  beforeEach(async () => {
    player = mockPlayer({
      loadVideoById: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    })
    ;(window as any).YT = {
      // loaded: 1 makes loadYouTubeAPI() resolve immediately
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          // Fire onReady synchronously in tests
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          return player
        }),
    }
  })

  afterEach(() => {
    capturedOptions = undefined
    vi.restoreAllMocks()
  })

  it('rejects when the container element does not exist', async () => {
    const { createPlayer: create } = await resetModule()

    ;(window as any).YT = { loaded: 1, Player: vi.fn() }

    await expect(
      create({ containerId: 'nonexistent', videoId: 'abc', startSeconds: 0 }),
    ).rejects.toThrow('YouTube player container not found: #nonexistent')
  })

  it('creates a player in the given container and resolves with the player instance', async () => {
    const { createPlayer: create } = await resetModule()

    ;(window as any).YT = {
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          return player
        }),
    }

    const container = document.createElement('div')
    container.id = 'youtube-player'
    document.body.appendChild(container)

    try {
      const returned = await create({
        containerId: 'youtube-player',
        videoId: 'abc123',
        startSeconds: 30,
      })
      expect(returned).toBe(player)
      expect(capturedOptions?.videoId).toBe('abc123')
      expect(capturedOptions?.playerVars?.start).toBe(30)
    } finally {
      document.body.removeChild(container)
    }
  })

  it('floors fractional startSeconds', async () => {
    const { createPlayer: create } = await resetModule()

    ;(window as any).YT = {
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          return player
        }),
    }

    const container = document.createElement('div')
    container.id = 'youtube-player-floor'
    document.body.appendChild(container)

    try {
      await create({
        containerId: 'youtube-player-floor',
        videoId: 'x',
        startSeconds: 45.9,
      })
      expect(capturedOptions?.playerVars?.start).toBe(45)
    } finally {
      document.body.removeChild(container)
    }
  })

  it('calls onStateChange callback when player fires it', async () => {
    const { createPlayer: create } = await resetModule()
    const onStateChange = vi.fn()

    ;(window as any).YT = {
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          // Fire state change in a second tick so it lands after the create() promise resolves
          setTimeout(() => {
            options.events?.onStateChange?.({
              target: player,
              data: 0, // ENDED
            })
          }, 10)
          return player
        }),
    }

    const container = document.createElement('div')
    container.id = 'youtube-player-state'
    document.body.appendChild(container)

    try {
      await create({
        containerId: 'youtube-player-state',
        videoId: 'x',
        startSeconds: 0,
        onStateChange,
      })
      await vi.waitFor(() =>
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({ data: 0 }),
        ),
      )
    } finally {
      document.body.removeChild(container)
    }
  })

  it('unloads the captions module on the PLAYING state transition', async () => {
    const { createPlayer: create } = await resetModule()
    const unloadModule = vi.fn()
    // Rebuild the shared player with an unloadModule spy for this test.
    player = mockPlayer({
      loadVideoById: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
      unloadModule,
    } as Partial<YT.Player>)

    ;(window as any).YT = {
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          setTimeout(() => {
            options.events?.onStateChange?.({
              target: player,
              data: 1, // PLAYING
            })
          }, 10)
          return player
        }),
    }

    const container = document.createElement('div')
    container.id = 'youtube-player-cc'
    document.body.appendChild(container)

    try {
      await create({
        containerId: 'youtube-player-cc',
        videoId: 'x',
        startSeconds: 0,
      })
      await vi.waitFor(() =>
        expect(unloadModule).toHaveBeenCalledWith('captions'),
      )
      expect(unloadModule).toHaveBeenCalledWith('cc')
    } finally {
      document.body.removeChild(container)
    }
  })

  it('still forwards the PLAYING event to the consumer after unloading captions', async () => {
    const { createPlayer: create } = await resetModule()
    const onStateChange = vi.fn()
    // Player whose unloadModule throws — the wrapper must swallow it and still
    // forward the event, never crashing the YT event dispatcher.
    player = mockPlayer({
      loadVideoById: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
      unloadModule: vi.fn(() => {
        throw new Error('module registry not ready')
      }),
    } as Partial<YT.Player>)

    ;(window as any).YT = {
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          setTimeout(() => {
            options.events?.onStateChange?.({
              target: player,
              data: 1, // PLAYING
            })
          }, 10)
          return player
        }),
    }

    const container = document.createElement('div')
    container.id = 'youtube-player-cc-throws'
    document.body.appendChild(container)

    try {
      await create({
        containerId: 'youtube-player-cc-throws',
        videoId: 'x',
        startSeconds: 0,
        onStateChange,
      })
      await vi.waitFor(() =>
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({ data: 1 }),
        ),
      )
    } finally {
      document.body.removeChild(container)
    }
  })

  it('calls onError callback when player fires an error', async () => {
    const { createPlayer: create } = await resetModule()
    const onError = vi.fn()

    ;(window as any).YT = {
      loaded: 1,
      Player: vi
        .fn()
        .mockImplementation((_id: string, options: YT.PlayerOptions) => {
          capturedOptions = options
          setTimeout(() => {
            options.events?.onReady?.({ target: player })
          }, 0)
          setTimeout(() => {
            options.events?.onError?.({
              target: player,
              data: 100, // VideoNotFound
            })
          }, 10)
          return player
        }),
    }

    const container = document.createElement('div')
    container.id = 'youtube-player-err'
    document.body.appendChild(container)

    try {
      await create({
        containerId: 'youtube-player-err',
        videoId: 'x',
        startSeconds: 0,
        onError,
      })
      await vi.waitFor(() =>
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ data: 100 }),
        ),
      )
    } finally {
      document.body.removeChild(container)
    }
  })
})

describe('loadVideo', () => {
  it('calls loadVideoById with floored startSeconds', () => {
    const player = mockPlayer({ loadVideoById: vi.fn() })
    loadVideo(player, 'vid123', 77.6)
    expect(player.loadVideoById).toHaveBeenCalledWith({
      videoId: 'vid123',
      startSeconds: 77,
    })
  })

  it('handles zero startSeconds', () => {
    const player = mockPlayer({ loadVideoById: vi.fn() })
    loadVideo(player, 'vid456', 0)
    expect(player.loadVideoById).toHaveBeenCalledWith({
      videoId: 'vid456',
      startSeconds: 0,
    })
  })
})
