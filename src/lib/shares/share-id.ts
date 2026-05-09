// Share-ID generation and validation.
//
// Format: 8 characters, Crockford base32 alphabet (uppercase). 40 bits of
// entropy. Crockford excludes I, L, O, U to avoid visual ambiguity.
//
// See specs/002-shared-channels/research.md R2 for rationale.

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const
export const SHARE_ID_LENGTH = 8

const SHARE_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/

/**
 * Generate a fresh 8-char Crockford-base32 share-id with 40 bits of entropy.
 *
 * Implementation: take 5 random bytes (40 bits), split into 8 × 5-bit
 * chunks, map each chunk to one alphabet char. This gives a uniform
 * distribution that's correct by construction (no modulo bias).
 */
export function generateShareId(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)

  // Pack 5 bytes into a single 40-bit integer using BigInt to avoid
  // 32-bit-overflow truncation. Each 5-bit slice indexes the alphabet.
  let bits = 0n
  for (const b of bytes) bits = (bits << 8n) | BigInt(b)

  let out = ''
  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    const shift = BigInt((SHARE_ID_LENGTH - 1 - i) * 5)
    const idx = Number((bits >> shift) & 0x1fn)
    out += CROCKFORD_ALPHABET[idx]
  }
  return out
}

/**
 * Returns true iff `s` is a canonical 8-char Crockford-base32 share-id
 * (uppercase, no ambiguous chars).
 *
 * Use `normalizeShareId` first if the input may be lowercase.
 */
export function isValidShareId(s: unknown): boolean {
  return typeof s === 'string' && SHARE_ID_REGEX.test(s)
}

/**
 * Case-fold to canonical uppercase form. Does not validate — pair with
 * `isValidShareId` if needed.
 */
export function normalizeShareId(s: string): string {
  return s.toUpperCase()
}
