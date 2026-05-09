// Share URL build/parse helpers.
//
// Canonical form: `<origin>/s/<SHAREID>` where SHAREID is the 8-char
// Crockford-base32 id (uppercase). See research.md R6.

import { isValidShareId, normalizeShareId } from './share-id'

const SHARE_PATH_PREFIX = '/s/'

/**
 * Build an absolute share URL. The share-id is uppercased to canonical form.
 * Origin defaults to `window.location.origin` for browser callers.
 */
export function buildShareUrl(shareId: string, origin?: string): string {
  if (typeof shareId !== 'string' || shareId.trim() === '') {
    throw new Error('buildShareUrl: shareId must be a non-empty string')
  }
  const canonical = normalizeShareId(shareId.trim())
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  if (base === '') {
    throw new Error(
      'buildShareUrl: origin not provided and window.location is unavailable',
    )
  }
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}${SHARE_PATH_PREFIX}${canonical}`
}

/**
 * Parse a path or full URL of the form `<origin>?/s/<shareId>` and return
 * the canonical uppercase share-id, or null if the input doesn't match or
 * the share-id is malformed.
 */
export function parseShareUrl(input: string): string | null {
  if (typeof input !== 'string' || input === '') return null

  // Pull just the path. URL() handles full URLs; bare paths fall through
  // to the manual prefix check.
  let path = input
  try {
    const url = new URL(input)
    path = url.pathname
  } catch {
    // Not a full URL; treat as a path.
  }

  if (!path.startsWith(SHARE_PATH_PREFIX)) return null

  // Strip leading prefix, query string, and trailing slash.
  let id = path.slice(SHARE_PATH_PREFIX.length)
  const queryIdx = id.indexOf('?')
  if (queryIdx !== -1) id = id.slice(0, queryIdx)
  const hashIdx = id.indexOf('#')
  if (hashIdx !== -1) id = id.slice(0, hashIdx)
  if (id.endsWith('/')) id = id.slice(0, -1)
  if (id === '') return null

  const canonical = normalizeShareId(id)
  return isValidShareId(canonical) ? canonical : null
}
