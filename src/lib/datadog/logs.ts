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

export function logPlayerError(
  errorCode: number,
  videoId: string,
  channelId: string,
): void {
  datadogLogs.logger.error('YouTube player error', {
    error_code: errorCode,
    video_id: videoId,
    channel_id: channelId,
  })
}

export function logPlayerCreationFailed(
  channelId: string,
  error: string,
): void {
  datadogLogs.logger.error('YouTube player creation failed', {
    channel_id: channelId,
    error,
  })
}

export function logChannelLoadFailed(channelId: string, error: string): void {
  datadogLogs.logger.warn('Channel load failed', {
    channel_id: channelId,
    error,
  })
}

export function logScheduleDesync(channelId: string, videoId: string): void {
  datadogLogs.logger.warn('Schedule desync detected', {
    channel_id: channelId,
    video_id: videoId,
  })
}

export function logQuotaRecovery(): void {
  datadogLogs.logger.info('YouTube API quota recovered')
}

export function logImportFileError(error: string, fileName: string): void {
  datadogLogs.logger.warn('Channel file import failed', {
    error,
    file_name: fileName,
  })
}
