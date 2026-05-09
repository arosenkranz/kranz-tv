import { describe, it, expect } from 'vitest'
import {
  ShareRecordSchema,
  PublicShareRecordSchema,
  PublishPayloadSchema,
  RevokePayloadSchema,
  ResolvePayloadSchema,
  normalizeSourceUrl,
} from '~/lib/shares/share-record'

const validVideoRecord = {
  shareId: 'ABCDEFGH',
  kind: 'video' as const,
  sourceUrl:
    'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
  name: 'Skate Vids',
  description: 'Mellow skate footage.',
  createdAt: 1715299200000,
  revokedAt: null,
  credentialHash: 'a'.repeat(64),
}

const validMusicRecord = {
  shareId: 'Z9P3M7K2',
  kind: 'music' as const,
  sourceUrl: 'https://soundcloud.com/some-user/sets/some-playlist',
  name: 'Lo-fi Beats',
  description: null,
  createdAt: 1715299200000,
  revokedAt: null,
  credentialHash: 'b'.repeat(64),
}

const validCredential = 'A'.repeat(43) // 43 base64url chars

describe('ShareRecordSchema', () => {
  it('accepts a valid video record', () => {
    const r = ShareRecordSchema.safeParse(validVideoRecord)
    expect(r.success).toBe(true)
  })

  it('accepts a valid music record', () => {
    const r = ShareRecordSchema.safeParse(validMusicRecord)
    expect(r.success).toBe(true)
  })

  it('rejects a record with empty name', () => {
    const r = ShareRecordSchema.safeParse({ ...validVideoRecord, name: '' })
    expect(r.success).toBe(false)
  })

  it('rejects a record with name > 80 chars', () => {
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      name: 'x'.repeat(81),
    })
    expect(r.success).toBe(false)
  })

  it('accepts a record with name exactly 80 chars', () => {
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      name: 'x'.repeat(80),
    })
    expect(r.success).toBe(true)
  })

  it('rejects a record with description > 280 chars', () => {
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      description: 'y'.repeat(281),
    })
    expect(r.success).toBe(false)
  })

  it('accepts null description', () => {
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      description: null,
    })
    expect(r.success).toBe(true)
  })

  it('rejects malformed shareId', () => {
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      shareId: 'abc!@#',
    })
    expect(r.success).toBe(false)
  })

  it('rejects malformed credentialHash (must be 64-char hex lowercase)', () => {
    expect(
      ShareRecordSchema.safeParse({
        ...validVideoRecord,
        credentialHash: 'short',
      }).success,
    ).toBe(false)
    expect(
      ShareRecordSchema.safeParse({
        ...validVideoRecord,
        credentialHash: 'A'.repeat(64), // uppercase
      }).success,
    ).toBe(false)
  })

  it('rejects video record with non-YouTube sourceUrl', () => {
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      sourceUrl: 'https://example.com/notyoutube',
    })
    expect(r.success).toBe(false)
  })

  it('rejects music record with non-SoundCloud sourceUrl', () => {
    const r = ShareRecordSchema.safeParse({
      ...validMusicRecord,
      sourceUrl: 'https://www.youtube.com/playlist?list=PLxxx',
    })
    expect(r.success).toBe(false)
  })

  it('rejects sourceUrl > 2048 chars', () => {
    const huge = 'https://www.youtube.com/playlist?list=' + 'a'.repeat(2050)
    const r = ShareRecordSchema.safeParse({
      ...validVideoRecord,
      sourceUrl: huge,
    })
    expect(r.success).toBe(false)
  })
})

describe('PublicShareRecordSchema', () => {
  it('strips credentialHash from the canonical record shape', () => {
    const { credentialHash: _drop, ...publicRecord } = validVideoRecord
    void _drop
    const r = PublicShareRecordSchema.safeParse(publicRecord)
    expect(r.success).toBe(true)
  })

  it('rejects a record that includes credentialHash', () => {
    // PublicShareRecord must NOT contain credentialHash. Strict parse rejects.
    const r = PublicShareRecordSchema.safeParse(validVideoRecord)
    expect(r.success).toBe(false)
  })
})

describe('PublishPayloadSchema', () => {
  const validPayload = {
    channel: {
      kind: 'video' as const,
      sourceUrl: validVideoRecord.sourceUrl,
      name: 'Skate Vids',
      description: 'Mellow skate footage.',
    },
    credential: validCredential,
  }

  it('accepts a valid publish payload', () => {
    const r = PublishPayloadSchema.safeParse(validPayload)
    expect(r.success).toBe(true)
  })

  it('rejects an invalid credential format', () => {
    const r = PublishPayloadSchema.safeParse({
      ...validPayload,
      credential: 'not-base64url',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an oversize name', () => {
    const r = PublishPayloadSchema.safeParse({
      ...validPayload,
      channel: { ...validPayload.channel, name: 'x'.repeat(81) },
    })
    expect(r.success).toBe(false)
  })

  it('accepts payload without description', () => {
    const noDesc = {
      ...validPayload,
      channel: {
        kind: 'video' as const,
        sourceUrl: validPayload.channel.sourceUrl,
        name: 'Skate Vids',
      },
    }
    const r = PublishPayloadSchema.safeParse(noDesc)
    expect(r.success).toBe(true)
  })
})

describe('RevokePayloadSchema', () => {
  it('accepts a valid revoke payload', () => {
    const r = RevokePayloadSchema.safeParse({
      shareId: 'ABCDEFGH',
      credential: validCredential,
    })
    expect(r.success).toBe(true)
  })

  it('rejects bad shareId format', () => {
    const r = RevokePayloadSchema.safeParse({
      shareId: 'bad!',
      credential: validCredential,
    })
    expect(r.success).toBe(false)
  })

  it('rejects missing credential', () => {
    const r = RevokePayloadSchema.safeParse({ shareId: 'ABCDEFGH' })
    expect(r.success).toBe(false)
  })
})

describe('ResolvePayloadSchema', () => {
  it('accepts uppercase shareId', () => {
    const r = ResolvePayloadSchema.safeParse({ shareId: 'ABCDEFGH' })
    expect(r.success).toBe(true)
  })

  it('accepts lowercase shareId (will be normalized server-side)', () => {
    // Resolve is the only public-facing entry point that case-normalizes.
    // The schema itself should accept either case; the handler normalizes
    // before lookup.
    const r = ResolvePayloadSchema.safeParse({ shareId: 'abcdefgh' })
    expect(r.success).toBe(true)
  })

  it('rejects malformed shareId', () => {
    const r = ResolvePayloadSchema.safeParse({ shareId: 'too-short' })
    expect(r.success).toBe(false)
  })
})

describe('normalizeSourceUrl', () => {
  it('lowercases the host on YouTube URLs', () => {
    expect(
      normalizeSourceUrl(
        'https://WWW.YouTube.com/playlist?list=PLxxx',
        'video',
      ),
    ).toBe('https://www.youtube.com/playlist?list=PLxxx')
  })

  it('strips trailing slash on YouTube URLs', () => {
    expect(
      normalizeSourceUrl(
        'https://www.youtube.com/playlist/?list=PLxxx',
        'video',
      ),
    ).toBe('https://www.youtube.com/playlist?list=PLxxx')
  })

  it('keeps only the list= query param on YouTube URLs', () => {
    const got = normalizeSourceUrl(
      'https://www.youtube.com/playlist?list=PLxxx&utm_source=facebook&v=abc',
      'video',
    )
    expect(got).toBe('https://www.youtube.com/playlist?list=PLxxx')
  })

  it('passes SoundCloud URLs through with host lowercased and trailing slash removed', () => {
    expect(
      normalizeSourceUrl('https://SoundCloud.com/user/sets/playlist/', 'music'),
    ).toBe('https://soundcloud.com/user/sets/playlist')
  })

  it('preserves the SoundCloud path verbatim (does not strip query)', () => {
    // SoundCloud's playlist URLs sometimes have meaningful query params
    // (e.g., secret tokens for private sets). Preserve them.
    expect(
      normalizeSourceUrl(
        'https://soundcloud.com/user/sets/playlist?secret=abc',
        'music',
      ),
    ).toBe('https://soundcloud.com/user/sets/playlist?secret=abc')
  })

  it('produces the same canonical form regardless of trailing slash + casing variations', () => {
    const a = normalizeSourceUrl(
      'https://WWW.YouTube.com/playlist/?list=PLxxx',
      'video',
    )
    const b = normalizeSourceUrl(
      'https://www.youtube.com/playlist?list=PLxxx',
      'video',
    )
    expect(a).toBe(b)
  })

  it('returns the original (best-effort) when the URL is malformed', () => {
    // Don't throw — this is called from a hot path. Caller validates via Zod.
    const got = normalizeSourceUrl('not-a-url', 'video')
    expect(typeof got).toBe('string')
  })
})
