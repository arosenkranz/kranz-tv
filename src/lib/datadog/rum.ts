import { datadogRum } from '@datadog/browser-rum'

export function initRum(): void {
  const appId = import.meta.env.VITE_DD_RUM_APP_ID
  const clientToken = import.meta.env.VITE_DD_RUM_CLIENT_TOKEN

  if (!appId || !clientToken) return // Skip if not configured

  datadogRum.init({
    applicationId: appId,
    clientToken,
    site: 'datadoghq.com',
    service: 'kranz-tv',
    env: import.meta.env.VITE_DD_ENV ?? 'local',
    version: __APP_VERSION__,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: [
      {
        match: (url: string) => {
          try {
            return (
              new URL(url).origin === window.location.origin &&
              url.includes('/api/')
            )
          } catch {
            return false
          }
        },
        propagatorTypes: ['datadog'] as const,
      },
    ],
  })

  datadogRum.setGlobalContextProperty(
    'git.commit.sha',
    import.meta.env.VITE_DD_COMMIT_SHA ?? 'unknown',
  )

  datadogRum.startSessionReplayRecording()
}

// Custom RUM action helpers
export function trackChannelSwitch(
  fromChannelId: string,
  toChannelId: string,
  fromNumber: number,
  toNumber: number,
): void {
  datadogRum.addAction('channel_switch', {
    from_channel: fromChannelId,
    to_channel: toChannelId,
    from_number: fromNumber,
    to_number: toNumber,
  })
}

export function trackGuideToggle(visible: boolean): void {
  datadogRum.addAction('guide_toggle', { guide_visible: visible })
}

export function trackImportStarted(): void {
  datadogRum.addAction('import_started', {})
}

export function trackKeyboardShortcut(key: string): void {
  datadogRum.addAction('keyboard_shortcut', { key })
}

export function trackYouTubeApiLatency(
  endpoint: 'playlistItems' | 'videos',
  durationMs: number,
  itemCount: number,
): void {
  datadogRum.addAction('youtube_api_latency', {
    endpoint,
    duration_ms: durationMs,
    item_count: itemCount,
  })
}

export function trackChannelBuildTime(
  channelId: string,
  durationMs: number,
  videoCount: number,
): void {
  datadogRum.addAction('channel_build_time', {
    channel_id: channelId,
    duration_ms: durationMs,
    video_count: videoCount,
  })
}

export function trackVolumeChange(
  volume: number,
  source: 'keyboard' | 'slider' | 'mute',
): void {
  datadogRum.addAction('volume_change', { volume, source })
}

export function trackExportChannels(channelCount: number): void {
  datadogRum.addAction('export_channels', { channel_count: channelCount })
}

export function trackImportJson(
  importedCount: number,
  skippedCount: number,
): void {
  datadogRum.addAction('import_json', {
    imported_count: importedCount,
    skipped_count: skippedCount,
  })
}

export function trackImportComplete(
  success: boolean,
  videoCount: number,
  channelName: string,
): void {
  datadogRum.addAction('import_complete', {
    success,
    video_count: videoCount,
    channel_name: channelName,
  })
}

export function trackChannelSurf(channelId: string, channelNumber: number): void {
  datadogRum.addAction('channel_surf', {
    channel_id: channelId,
    channel_number: channelNumber,
  })
}

export function trackShareChannel(channelId: string, success: boolean): void {
  datadogRum.addAction('share_channel', {
    channel_id: channelId,
    success,
  })
}

export function trackSwipeChannelChange(
  direction: 'up' | 'down',
  toChannelId: string,
): void {
  datadogRum.addAction('swipe_channel_change', {
    direction,
    to_channel: toChannelId,
  })
}

export function trackLandscapeFullscreen(): void {
  datadogRum.addAction('landscape_fullscreen', {})
}

export function trackGuideSheetOpen(): void {
  datadogRum.addAction('guide_sheet_open', {})
}

export function trackMobileToolbarAction(action: string): void {
  datadogRum.addAction('mobile_toolbar_action', { action })
}

export function trackViewModeChange(
  fromMode: 'normal' | 'theater' | 'fullscreen',
  toMode: 'normal' | 'theater' | 'fullscreen',
  trigger: 'keyboard' | 'button' | 'landscape_auto',
  isMobile: boolean,
): void {
  datadogRum.addAction('view_mode_change', {
    from_mode: fromMode,
    to_mode: toMode,
    trigger,
    is_mobile: isMobile,
  })
}

export function trackOverlayChange(
  fromMode: string,
  toMode: string,
): void {
  datadogRum.addAction('overlay_change', {
    from_mode: fromMode,
    to_mode: toMode,
  })
}

export function trackPlayerError(
  errorCode: number,
  videoId: string,
  channelId: string,
): void {
  datadogRum.addAction('player_error', {
    error_code: errorCode,
    video_id: videoId,
    channel_id: channelId,
  })
}

export function trackPlayerResync(channelId: string, videoId: string): void {
  datadogRum.addAction('player_resync', {
    channel_id: channelId,
    video_id: videoId,
  })
}

export function trackEpgChannelSelect(
  channelId: string,
  mode: 'inline' | 'overlay',
): void {
  datadogRum.addAction('epg_channel_select', {
    channel_id: channelId,
    mode,
  })
}

export function setViewerContext(opts: {
  deviceType: 'mobile' | 'desktop'
  channelCount: number
  hasApiKey: boolean
}): void {
  datadogRum.setGlobalContextProperty('viewer.device_type', opts.deviceType)
  datadogRum.setGlobalContextProperty('viewer.channel_count', opts.channelCount)
  datadogRum.setGlobalContextProperty('viewer.has_api_key', opts.hasApiKey)
}

export function trackSurfModeStart(
  dwellSeconds: number,
  channelCount: number,
  source: 'keyboard' | 'toolbar',
): void {
  datadogRum.addAction('surf_mode_start', {
    dwell_seconds: dwellSeconds,
    channel_count: channelCount,
    source,
  })
  datadogRum.setGlobalContextProperty('viewer.surf_mode', true)
}

export function trackSurfModeStop(
  channelsVisited: number,
  durationSeconds: number,
  stopReason: 'toggle' | 'manual_switch' | 'load_failure' | 'navigate_away',
): void {
  datadogRum.addAction('surf_mode_stop', {
    channels_visited: channelsVisited,
    duration_seconds: durationSeconds,
    stop_reason: stopReason,
  })
  datadogRum.setGlobalContextProperty('viewer.surf_mode', false)
}

export function trackSurfHop(
  fromChannel: string,
  toChannel: string,
  queuePosition: number,
  queueLength: number,
): void {
  datadogRum.addAction('surf_hop', {
    from_channel: fromChannel,
    to_channel: toChannel,
    queue_position: queuePosition,
    queue_length: queueLength,
  })
}

export function trackSurfSkip(
  channelId: string,
  reason: 'load_timeout' | 'load_error',
): void {
  datadogRum.addAction('surf_skip', {
    channel_id: channelId,
    reason,
  })
}

export function trackSurfDwellChange(
  newDwellSeconds: number,
  oldDwellSeconds: number,
  source: 'keyboard' | 'tap',
): void {
  datadogRum.addAction('surf_dwell_change', {
    new_dwell_seconds: newDwellSeconds,
    old_dwell_seconds: oldDwellSeconds,
    source,
  })
}

// ── Music channel RUM (FR-019: no raw URLs, titles, or artist names) ──────────

/** Deterministic 8-char correlation ID derived from a URL — not sensitive data. */
export function urlCorrelationId(url: string): string {
  let h = 5381
  for (let i = 0; i < url.length; i++) {
    h = (((h << 5) + h) ^ url.charCodeAt(i)) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export function trackMusicChannelPlay(opts: {
  channelId: string
  source: 'soundcloud'
  trackCount: number
  sourceUrlCorrelationId: string
}): void {
  datadogRum.addAction('music_channel_play', {
    channel_id: opts.channelId,
    source: opts.source,
    track_count: opts.trackCount,
    source_url_correlation_id: opts.sourceUrlCorrelationId,
  })
}

export function trackMusicChannelImport(opts: {
  success: boolean
  source: 'soundcloud'
  trackCount: number
  sourceUrlCorrelationId: string
  errorCode?: string
}): void {
  datadogRum.addAction('music_channel_import', {
    success: opts.success,
    source: opts.source,
    track_count: opts.trackCount,
    source_url_correlation_id: opts.sourceUrlCorrelationId,
    ...(opts.errorCode !== undefined ? { error_code: opts.errorCode } : {}),
  })
}

export function trackMusicBackdropSelected(preset: string): void {
  datadogRum.addAction('music_backdrop_selected', { preset })
}
