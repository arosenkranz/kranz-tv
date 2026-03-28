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
