import { datadogLogs } from '@datadog/browser-logs'

export function initLogs(): void {
  const clientToken = import.meta.env.VITE_DD_RUM_CLIENT_TOKEN
  if (!clientToken) return

  datadogLogs.init({
    clientToken,
    site: 'datadoghq.com',
    service: 'kranz-tv',
    env: import.meta.env.VITE_DD_ENV ?? 'local',
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  })
}

export function logQuotaExhaustion(context?: Record<string, unknown>): void {
  datadogLogs.logger.error('YouTube API quota exhausted', context)
}

export function logImportError(error: string, channelName: string): void {
  datadogLogs.logger.warn('Channel import failed', {
    error,
    channel_name: channelName,
  })
}
