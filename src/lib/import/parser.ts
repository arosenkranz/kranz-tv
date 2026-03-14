/**
 * Extracts a YouTube playlist ID from various URL formats or bare IDs.
 *
 * Handles:
 *   - https://www.youtube.com/playlist?list=PLxxx
 *   - https://www.youtube.com/watch?v=abc&list=PLxxx
 *   - https://youtu.be/abc?list=PLxxx
 *   - Bare playlist ID: PL..., UU..., FL..., OL..., LL..., RD...
 *
 * Returns null for invalid or unrecognized input.
 */
export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  // Try URL parsing first
  let url: URL | null = null
  try {
    url = new URL(trimmed)
  } catch {
    // Not a URL — fall through to bare ID check
  }

  if (url !== null) {
    const host = url.hostname.toLowerCase()
    const isYouTube =
      host === 'www.youtube.com' ||
      host === 'youtube.com' ||
      host === 'm.youtube.com'
    const isShort = host === 'youtu.be'

    if (!isYouTube && !isShort) return null

    const listParam = url.searchParams.get('list')
    return listParam !== null && listParam !== '' ? listParam : null
  }

  // Bare playlist ID: must start with a recognized prefix
  const BARE_ID_PATTERN = /^(PL|UU|FL|OL|LL|RD)[A-Za-z0-9_-]+$/
  return BARE_ID_PATTERN.test(trimmed) ? trimmed : null
}
