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
