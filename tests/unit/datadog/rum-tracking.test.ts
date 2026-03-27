import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the entire browser-rum module before importing our module under test
vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    init: vi.fn(),
    startSessionReplayRecording: vi.fn(),
    addAction: vi.fn(),
  },
}))

// eslint-disable-next-line import/first
import { datadogRum } from '@datadog/browser-rum'
// eslint-disable-next-line import/first
import {
  trackChannelSwitch,
  trackYouTubeApiLatency,
  trackChannelBuildTime,
  trackImportComplete,
  trackGuideToggle,
  trackKeyboardShortcut,
  trackVolumeChange,
  trackShareChannel,
  trackExportChannels,
  trackImportJson,
} from '~/lib/datadog/rum'

const mockAddAction = vi.mocked(datadogRum.addAction)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('trackChannelSwitch', () => {
  it('emits channel_switch action with from/to IDs and numbers', () => {
    trackChannelSwitch('nature', 'ai-ml', 1, 2)

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('channel_switch', {
      from_channel: 'nature',
      to_channel: 'ai-ml',
      from_number: 1,
      to_number: 2,
    })
  })
})

describe('trackGuideToggle', () => {
  it('emits guide_toggle with visible state', () => {
    trackGuideToggle(true)
    expect(mockAddAction).toHaveBeenCalledWith('guide_toggle', {
      guide_visible: true,
    })
  })
})

describe('trackKeyboardShortcut', () => {
  it('emits keyboard_shortcut with key name', () => {
    trackKeyboardShortcut('g')
    expect(mockAddAction).toHaveBeenCalledWith('keyboard_shortcut', {
      key: 'g',
    })
  })
})

describe('trackYouTubeApiLatency', () => {
  it('emits youtube_api_latency with endpoint, duration, and item count', () => {
    trackYouTubeApiLatency('playlistItems', 342, 87)

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('youtube_api_latency', {
      endpoint: 'playlistItems',
      duration_ms: 342,
      item_count: 87,
    })
  })

  it('works for the videos endpoint', () => {
    trackYouTubeApiLatency('videos', 123, 50)

    expect(mockAddAction).toHaveBeenCalledWith('youtube_api_latency', {
      endpoint: 'videos',
      duration_ms: 123,
      item_count: 50,
    })
  })
})

describe('trackChannelBuildTime', () => {
  it('emits channel_build_time with channel id, duration, and video count', () => {
    trackChannelBuildTime('nature', 870, 45)

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('channel_build_time', {
      channel_id: 'nature',
      duration_ms: 870,
      video_count: 45,
    })
  })
})

describe('trackVolumeChange', () => {
  it('emits volume_change action with volume and keyboard source', () => {
    trackVolumeChange(70, 'keyboard')
    expect(mockAddAction).toHaveBeenCalledWith('volume_change', {
      volume: 70,
      source: 'keyboard',
    })
  })

  it('emits volume_change action with slider source', () => {
    trackVolumeChange(50, 'slider')
    expect(mockAddAction).toHaveBeenCalledWith('volume_change', {
      volume: 50,
      source: 'slider',
    })
  })

  it('emits volume_change action with mute source', () => {
    trackVolumeChange(0, 'mute')
    expect(mockAddAction).toHaveBeenCalledWith('volume_change', {
      volume: 0,
      source: 'mute',
    })
  })
})

describe('trackImportComplete', () => {
  it('emits import_complete with success=true and video count', () => {
    trackImportComplete(true, 32, 'My Playlist')

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('import_complete', {
      success: true,
      video_count: 32,
      channel_name: 'My Playlist',
    })
  })

  it('emits import_complete with success=false and zero video count', () => {
    trackImportComplete(false, 0, 'Bad Playlist')

    expect(mockAddAction).toHaveBeenCalledWith('import_complete', {
      success: false,
      video_count: 0,
      channel_name: 'Bad Playlist',
    })
  })
})

describe('trackShareChannel', () => {
  it('emits share_channel action with channel id and success=true', () => {
    trackShareChannel('nature', true)
    expect(mockAddAction).toHaveBeenCalledWith('share_channel', {
      channel_id: 'nature',
      success: true,
    })
  })

  it('emits share_channel action with success=false', () => {
    trackShareChannel('skate', false)
    expect(mockAddAction).toHaveBeenCalledWith('share_channel', {
      channel_id: 'skate',
      success: false,
    })
  })

  it('emits share_channel with empty channel id for unknown channel', () => {
    trackShareChannel('', true)
    expect(mockAddAction).toHaveBeenCalledWith('share_channel', {
      channel_id: '',
      success: true,
    })
  })
})

describe('trackExportChannels', () => {
  it('emits export_channels action with count', () => {
    trackExportChannels(3)
    expect(mockAddAction).toHaveBeenCalledWith('export_channels', {
      channel_count: 3,
    })
  })

  it('emits export_channels with zero count', () => {
    trackExportChannels(0)
    expect(mockAddAction).toHaveBeenCalledWith('export_channels', {
      channel_count: 0,
    })
  })
})

describe('trackImportJson', () => {
  it('emits import_json action with imported and skipped counts', () => {
    trackImportJson(2, 1)
    expect(mockAddAction).toHaveBeenCalledWith('import_json', {
      imported_count: 2,
      skipped_count: 1,
    })
  })

  it('emits import_json with all zeros', () => {
    trackImportJson(0, 0)
    expect(mockAddAction).toHaveBeenCalledWith('import_json', {
      imported_count: 0,
      skipped_count: 0,
    })
  })
})
