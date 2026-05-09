// Sharer credential — a 256-bit anonymous token stored in localStorage,
// proving "this browser created share X." Used to authorize revoke.
//
// The raw token is sent in publish/revoke request bodies. The server stores
// only its SHA-256 hash, so a leaked KV value cannot replay a revoke.
//
// See specs/002-shared-channels/data-model.md Entity 2 for spec.

export const CREDENTIAL_STORAGE_KEY = 'kranz.tv.sharer.credential.v1'

const TOKEN_BYTES = 32 // 256 bits
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/ // base64url, 32 bytes, no padding

/**
 * Returns the per-browser credential, generating + persisting one if absent
 * or if the stored value is malformed (e.g., from a corrupted write).
 */
export function getOrCreateCredential(): string {
  if (typeof window === 'undefined') {
    // Server-side calls should never reach this — the credential is a
    // client-only concept. Throw early with a clear message rather than
    // returning a token that won't match the browser's stored one.
    throw new Error(
      'getOrCreateCredential must run in a browser (no server-side access)',
    )
  }

  const existing = window.localStorage.getItem(CREDENTIAL_STORAGE_KEY)
  if (existing !== null && TOKEN_REGEX.test(existing)) return existing

  const fresh = generateToken()
  window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, fresh)
  return fresh
}

/**
 * SHA-256(credential), hex-encoded lowercase. Used both client-side (for
 * defensive UI checks) and server-side (for storage + comparison).
 */
export async function hashCredential(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(digest))
}

// ── helpers ─────────────────────────────────────────────────────────────

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return base64urlEncode(bytes)
}

function base64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}
