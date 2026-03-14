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
    version: import.meta.env.VITE_DD_VERSION ?? '0.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: [{ match: /\/api\//, propagatorTypes: ['datadog'] }],
  })

  datadogRum.startSessionReplayRecording()
}

// Custom RUM action helpers
export function trackChannelSwitch(
  fromChannelId: string,
  toChannelId: string,
): void {
  datadogRum.addAction('channel_switch', {
    from_channel: fromChannelId,
    to_channel: toChannelId,
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
