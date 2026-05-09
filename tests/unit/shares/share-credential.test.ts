import { describe, it, expect, beforeEach } from 'vitest'
import {
  getOrCreateCredential,
  hashCredential,
  CREDENTIAL_STORAGE_KEY,
} from '~/lib/shares/share-credential'

const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/
const HEX_64 = /^[0-9a-f]{64}$/

describe('getOrCreateCredential', () => {
  beforeEach(() => {
    // jsdom test env — clear localStorage between tests.
    window.localStorage.clear()
  })

  it('uses the documented localStorage key', () => {
    expect(CREDENTIAL_STORAGE_KEY).toBe('kranz.tv.sharer.credential.v1')
  })

  it('generates a fresh 43-char base64url token when none exists', () => {
    const token = getOrCreateCredential()
    expect(token).toMatch(BASE64URL_43)
  })

  it('persists the token to localStorage under the documented key', () => {
    const token = getOrCreateCredential()
    expect(window.localStorage.getItem(CREDENTIAL_STORAGE_KEY)).toBe(token)
  })

  it('is idempotent — second call returns the same token', () => {
    const a = getOrCreateCredential()
    const b = getOrCreateCredential()
    expect(a).toBe(b)
  })

  it('preserves a pre-existing token (does not regenerate)', () => {
    // Simulate a token written by a previous session.
    const preexisting = 'a'.repeat(43)
    window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, preexisting)
    expect(getOrCreateCredential()).toBe(preexisting)
  })

  it('regenerates when the stored value is malformed', () => {
    window.localStorage.setItem(CREDENTIAL_STORAGE_KEY, 'too-short')
    const fresh = getOrCreateCredential()
    expect(fresh).toMatch(BASE64URL_43)
    expect(fresh).not.toBe('too-short')
  })

  it('emits cryptographically-distinct tokens across browsers', () => {
    // Simulate three separate "browsers" by clearing between calls.
    const tokens = new Set<string>()
    for (let i = 0; i < 5; i++) {
      window.localStorage.clear()
      tokens.add(getOrCreateCredential())
    }
    expect(tokens.size).toBe(5)
  })
})

describe('hashCredential', () => {
  it('returns a 64-char lowercase hex SHA-256 digest', async () => {
    const hash = await hashCredential('hello')
    expect(hash).toMatch(HEX_64)
  })

  it('matches the canonical SHA-256 for "hello" (test vector)', async () => {
    // Test vector: SHA-256("hello") =
    // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const hash = await hashCredential('hello')
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })

  it('is deterministic — same input → same hash', async () => {
    const a = await hashCredential('alpha-bravo-charlie')
    const b = await hashCredential('alpha-bravo-charlie')
    expect(a).toBe(b)
  })

  it('produces different hashes for different inputs', async () => {
    const a = await hashCredential('input-a')
    const b = await hashCredential('input-b')
    expect(a).not.toBe(b)
  })
})
