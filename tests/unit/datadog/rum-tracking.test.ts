import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  trackViewModeChange,
  trackOverlayChange,
  trackPlayerError,
  trackPlayerResync,
  trackEpgChannelSelect,
  setViewerContext,
  trackSurfModeStart,
  trackSurfModeStop,
  trackSurfHop,
  trackSurfSkip,
  trackSurfDwellChange,
} from '~/lib/datadog/rum'

const mockAddAction = vi.mocked(datadogRum.addAction)
const mockSetGlobalContextProperty = vi.mocked(
  datadogRum.setGlobalContextProperty,
)

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

describe('trackViewModeChange', () => {
  it('emits view_mode_change with from/to modes, trigger, and mobile flag', () => {
    trackViewModeChange('normal', 'theater', 'button', false)

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('view_mode_change', {
      from_mode: 'normal',
      to_mode: 'theater',
      trigger: 'button',
      is_mobile: false,
    })
  })

  it('tracks mobile fullscreen transition', () => {
    trackViewModeChange('normal', 'fullscreen', 'landscape_auto', true)

    expect(mockAddAction).toHaveBeenCalledWith('view_mode_change', {
      from_mode: 'normal',
      to_mode: 'fullscreen',
      trigger: 'landscape_auto',
      is_mobile: true,
    })
  })
})

describe('trackOverlayChange', () => {
  it('emits overlay_change with from/to modes', () => {
    trackOverlayChange('crt', 'vhs')

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('overlay_change', {
      from_mode: 'crt',
      to_mode: 'vhs',
    })
  })
})

describe('trackPlayerError', () => {
  it('emits player_error with error code, video id, and channel id', () => {
    trackPlayerError(150, 'dQw4w9WgXcQ', 'music')

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('player_error', {
      error_code: 150,
      video_id: 'dQw4w9WgXcQ',
      channel_id: 'music',
    })
  })
})

describe('trackPlayerResync', () => {
  it('emits player_resync with channel and video ids', () => {
    trackPlayerResync('nature', 'abc123')

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('player_resync', {
      channel_id: 'nature',
      video_id: 'abc123',
    })
  })
})

describe('trackEpgChannelSelect', () => {
  it('emits epg_channel_select with channel id and inline mode', () => {
    trackEpgChannelSelect('nature', 'inline')

    expect(mockAddAction).toHaveBeenCalledOnce()
    expect(mockAddAction).toHaveBeenCalledWith('epg_channel_select', {
      channel_id: 'nature',
      mode: 'inline',
    })
  })

  it('emits epg_channel_select with overlay mode', () => {
    trackEpgChannelSelect('skate', 'overlay')

    expect(mockAddAction).toHaveBeenCalledWith('epg_channel_select', {
      channel_id: 'skate',
      mode: 'overlay',
    })
  })
})

describe('setViewerContext', () => {
  it('sets global context properties for device type, channel count, and API key', () => {
    setViewerContext({
      deviceType: 'desktop',
      channelCount: 14,
      hasApiKey: true,
    })

    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.device_type',
      'desktop',
    )
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.channel_count',
      14,
    )
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.has_api_key',
      true,
    )
  })

  it('sets mobile context with no API key', () => {
    setViewerContext({
      deviceType: 'mobile',
      channelCount: 11,
      hasApiKey: false,
    })

    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.device_type',
      'mobile',
    )
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.has_api_key',
      false,
    )
  })
})

describe('trackSurfModeStart', () => {
  it('emits surf_mode_start action with dwell, count, and source', () => {
    trackSurfModeStart(15, 11, 'keyboard')
    expect(mockAddAction).toHaveBeenCalledWith('surf_mode_start', {
      dwell_seconds: 15,
      channel_count: 11,
      source: 'keyboard',
    })
  })

  it('sets viewer.surf_mode global context to true', () => {
    trackSurfModeStart(15, 11, 'toolbar')
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.surf_mode',
      true,
    )
  })
})

describe('trackSurfModeStop', () => {
  it('emits surf_mode_stop action with channels visited, duration, and stop reason', () => {
    trackSurfModeStop(8, 120, 'toggle')
    expect(mockAddAction).toHaveBeenCalledWith('surf_mode_stop', {
      channels_visited: 8,
      duration_seconds: 120,
      stop_reason: 'toggle',
    })
  })

  it('sets viewer.surf_mode global context to false', () => {
    trackSurfModeStop(3, 45, 'manual_switch')
    expect(mockSetGlobalContextProperty).toHaveBeenCalledWith(
      'viewer.surf_mode',
      false,
    )
  })

  it('tracks load_failure stop reason', () => {
    trackSurfModeStop(1, 10, 'load_failure')
    expect(mockAddAction).toHaveBeenCalledWith('surf_mode_stop', {
      channels_visited: 1,
      duration_seconds: 10,
      stop_reason: 'load_failure',
    })
  })

  it('tracks navigate_away stop reason', () => {
    trackSurfModeStop(5, 60, 'navigate_away')
    expect(mockAddAction).toHaveBeenCalledWith('surf_mode_stop', {
      channels_visited: 5,
      duration_seconds: 60,
      stop_reason: 'navigate_away',
    })
  })
})

describe('trackSurfHop', () => {
  it('emits surf_hop action with from/to channels and queue info', () => {
    trackSurfHop('nature', 'ai-ml', 3, 11)
    expect(mockAddAction).toHaveBeenCalledWith('surf_hop', {
      from_channel: 'nature',
      to_channel: 'ai-ml',
      queue_position: 3,
      queue_length: 11,
    })
  })

  it('tracks hop at start of queue', () => {
    trackSurfHop('music', 'skate', 0, 8)
    expect(mockAddAction).toHaveBeenCalledWith('surf_hop', {
      from_channel: 'music',
      to_channel: 'skate',
      queue_position: 0,
      queue_length: 8,
    })
  })
})

describe('trackSurfSkip', () => {
  it('emits surf_skip action with channel id and load_timeout reason', () => {
    trackSurfSkip('nature', 'load_timeout')
    expect(mockAddAction).toHaveBeenCalledWith('surf_skip', {
      channel_id: 'nature',
      reason: 'load_timeout',
    })
  })

  it('emits surf_skip action with load_error reason', () => {
    trackSurfSkip('ai-ml', 'load_error')
    expect(mockAddAction).toHaveBeenCalledWith('surf_skip', {
      channel_id: 'ai-ml',
      reason: 'load_error',
    })
  })
})

describe('trackSurfDwellChange', () => {
  it('emits surf_dwell_change action with new/old dwell and keyboard source', () => {
    trackSurfDwellChange(20, 15, 'keyboard')
    expect(mockAddAction).toHaveBeenCalledWith('surf_dwell_change', {
      new_dwell_seconds: 20,
      old_dwell_seconds: 15,
      source: 'keyboard',
    })
  })

  it('emits surf_dwell_change action with tap source', () => {
    trackSurfDwellChange(10, 20, 'tap')
    expect(mockAddAction).toHaveBeenCalledWith('surf_dwell_change', {
      new_dwell_seconds: 10,
      old_dwell_seconds: 20,
      source: 'tap',
    })
  })
})
