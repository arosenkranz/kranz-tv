const SOUNDCLOUD_ALLOWED_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
])

export function isSoundCloudUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      SOUNDCLOUD_ALLOWED_HOSTS.has(parsed.hostname)
    )
  } catch {
    return false
  }
}

export function normalizeSoundCloudUrl(url: string): string {
  const parsed = new URL(url)
  // Strip query params, hash, and trailing slash
  let pathname = parsed.pathname.replace(/\/$/, '')
  // Normalize www. to bare domain
  const hostname = parsed.hostname === 'www.soundcloud.com'
    ? 'soundcloud.com'
    : parsed.hostname
  return `https://${hostname}${pathname}`
}
