import { describe, it, expect } from 'vitest'
import {
  generateShareId,
  isValidShareId,
  normalizeShareId,
  CROCKFORD_ALPHABET,
  SHARE_ID_LENGTH,
} from '~/lib/shares/share-id'

// Crockford base32: 0-9, A-H, J, K, M, N, P-T, V-Z. Excludes I, L, O, U.
const CROCKFORD_REGEX = /^[0-9A-HJKMNP-TV-Z]+$/

describe('generateShareId', () => {
  it('returns exactly 8 characters', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShareId()
      expect(id).toHaveLength(SHARE_ID_LENGTH)
      expect(SHARE_ID_LENGTH).toBe(8)
    }
  })

  it('emits only Crockford alphabet characters (uppercase)', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateShareId()
      expect(id).toMatch(CROCKFORD_REGEX)
      expect(id).toBe(id.toUpperCase())
    }
  })

  it('does not emit ambiguous characters I, L, O, or U', () => {
    for (let i = 0; i < 200; i++) {
      const id = generateShareId()
      expect(id).not.toMatch(/[ILOU]/)
    }
  })

  it('produces high-entropy distinct outputs across calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(generateShareId())
    // 40 bits of entropy → 200 calls should give us 200 unique values with
    // overwhelming probability. If two collide, something is broken.
    expect(seen.size).toBe(200)
  })

  it('CROCKFORD_ALPHABET is exactly 32 chars and excludes I, L, O, U', () => {
    expect(CROCKFORD_ALPHABET).toHaveLength(32)
    expect(CROCKFORD_ALPHABET).not.toMatch(/[ILOU]/)
    // Spot-check a few canonical members
    expect(CROCKFORD_ALPHABET).toContain('0')
    expect(CROCKFORD_ALPHABET).toContain('9')
    expect(CROCKFORD_ALPHABET).toContain('A')
    expect(CROCKFORD_ALPHABET).toContain('Z')
  })
})

describe('isValidShareId', () => {
  it('accepts well-formed 8-char Crockford strings (uppercase)', () => {
    expect(isValidShareId('ABCDEFGH')).toBe(true)
    expect(isValidShareId('00000000')).toBe(true)
    expect(isValidShareId('Z9P3M7K2')).toBe(true)
  })

  it('rejects strings that are not exactly 8 chars', () => {
    expect(isValidShareId('')).toBe(false)
    expect(isValidShareId('ABC')).toBe(false)
    expect(isValidShareId('ABCDEFGHI')).toBe(false)
    expect(isValidShareId('ABCDEFG')).toBe(false)
  })

  it('rejects strings containing ambiguous chars (I, L, O, U)', () => {
    expect(isValidShareId('IIIIIIII')).toBe(false)
    expect(isValidShareId('LLLLLLLL')).toBe(false)
    expect(isValidShareId('OOOOOOOO')).toBe(false)
    expect(isValidShareId('UUUUUUUU')).toBe(false)
    expect(isValidShareId('ABCDIFGH')).toBe(false)
  })

  it('rejects lowercase input as not-canonical (use normalizeShareId first)', () => {
    expect(isValidShareId('abcdefgh')).toBe(false)
  })

  it('rejects strings with non-alphanumeric chars', () => {
    expect(isValidShareId('ABCDEF-1')).toBe(false)
    expect(isValidShareId('ABCDEF 1')).toBe(false)
    expect(isValidShareId('ABCDEF.1')).toBe(false)
  })

  it('rejects non-string inputs (defensive)', () => {
    expect(isValidShareId(null as unknown as string)).toBe(false)
    expect(isValidShareId(undefined as unknown as string)).toBe(false)
    expect(isValidShareId(12345678 as unknown as string)).toBe(false)
  })
})

describe('normalizeShareId', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeShareId('abcdefgh')).toBe('ABCDEFGH')
  })

  it('preserves already-uppercase input', () => {
    expect(normalizeShareId('ABCDEFGH')).toBe('ABCDEFGH')
  })

  it('mixes lower + upper cleanly', () => {
    expect(normalizeShareId('AbCdEfGh')).toBe('ABCDEFGH')
  })

  it('does not validate — returns whatever was passed (uppercase)', () => {
    // Validation is a separate concern. normalize is purely a case-fold.
    expect(normalizeShareId('hello!!!')).toBe('HELLO!!!')
  })
})
