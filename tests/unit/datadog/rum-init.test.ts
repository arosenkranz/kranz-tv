import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the entire browser-rum module before importing our module under test
vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: vi.fn(),
    startSessionReplayRecording: vi.fn(),
    addAction: vi.fn(),
    setGlobalContextProperty: vi.fn(),
  },
}))

// eslint-disable-next-line import/first
import { datadogRum } from '@datadog/browser-rum'
// eslint-disable-next-line import/first
import { initRum } from '~/lib/datadog/rum'

const mockInit = vi.mocked(datadogRum.init)
const mockStartReplay = vi.mocked(datadogRum.startSessionReplayRecording)
const mockSetGlobalContextProperty = vi.mocked(
  datadogRum.setGlobalContextProperty,
)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('initRum', () => {
  it('does not initialize when the app id is missing', () => {
    vi.stubEnv('VITE_DD_RUM_APP_ID', '')
    vi.stubEnv('VITE_DD_RUM_CLIENT_TOKEN', 'token-abc')

    initRum()

    expect(mockInit).not.toHaveBeenCalled()
    expect(mockStartReplay).not.toHaveBeenCalled()
  })

  it('does not initialize when the client token is missing', () => {
    vi.stubEnv('VITE_DD_RUM_APP_ID', 'app-123')
    vi.stubEnv('VITE_DD_RUM_CLIENT_TOKEN', '')

    initRum()

    expect(mockInit).not.toHaveBeenCalled()
    expect(mockStartReplay).not.toHaveBeenCalled()
  })

  it('initializes with the app id, client token, and default env', () => {
    vi.stubEnv('VITE_DD_RUM_APP_ID', 'app-123')
    vi.stubEnv('VITE_DD_RUM_CLIENT_TOKEN', 'token-abc')

    initRum()

    expect(mockInit).toHaveBeenCalledOnce()
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-123',
        clientToken: 'token-abc',
        service: 'kranz-tv',
        env: 'local',
        version: __APP_VERSION__,
        trackUserInteractions: true,
      }),
    )
    expect(mockStartReplay).toHaveBeenCalledOnce()
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'git.commit.sha',
      'unknown',
    )
  })

  it("defaults to env 'local' and sha 'unknown' when unset", () => {
    vi.stubEnv('VITE_DD_RUM_APP_ID', 'app-123')
    vi.stubEnv('VITE_DD_RUM_CLIENT_TOKEN', 'token-abc')
    const hadEnv = process.env.VITE_DD_ENV
    const hadSha = process.env.VITE_DD_COMMIT_SHA
    delete process.env.VITE_DD_ENV
    delete process.env.VITE_DD_COMMIT_SHA
    try {
      initRum()
    } finally {
      if (hadEnv !== undefined) process.env.VITE_DD_ENV = hadEnv
      if (hadSha !== undefined) process.env.VITE_DD_COMMIT_SHA = hadSha
    }

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ env: 'local' }),
    )
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'git.commit.sha',
      'unknown',
    )
  })

  it('uses the configured env and commit sha when present', () => {
    vi.stubEnv('VITE_DD_RUM_APP_ID', 'app-123')
    vi.stubEnv('VITE_DD_RUM_CLIENT_TOKEN', 'token-abc')
    vi.stubEnv('VITE_DD_ENV', 'production')
    vi.stubEnv('VITE_DD_COMMIT_SHA', 'abc1234')

    initRum()

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({ env: 'production' }),
    )
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'git.commit.sha',
      'abc1234',
    )
  })
})

describe('initRum allowedTracingUrls match', () => {
  it('accepts same-origin /api/ URLs only', () => {
    vi.stubEnv('VITE_DD_RUM_APP_ID', 'app-123')
    vi.stubEnv('VITE_DD_RUM_CLIENT_TOKEN', 'token-abc')

    initRum()

    expect(mockInit).toHaveBeenCalledOnce()
    const config = mockInit.mock.calls[0][0]
    // initRum always passes a { match, propagatorTypes } entry
    const entry = config.allowedTracingUrls?.[0] as
      { match: (url: string) => boolean } | undefined
    expect(entry).toBeDefined()
    if (entry === undefined) return
    const match = entry.match

    const origin = window.location.origin
    expect(match(`${origin}/api/youtube`)).toBe(true)
    // Same origin but not an API route
    expect(match(`${origin}/tv`)).toBe(false)
    // API route on another origin
    expect(match('https://evil.example.com/api/youtube')).toBe(false)
    // Invalid URL
    expect(match('not a url')).toBe(false)
  })
})
