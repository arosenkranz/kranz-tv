// Zod schemas + types for the shares feature.
//
// Source of truth for ShareRecord shape: data-model.md Entity 1.
// Source of truth for payloads: contracts/shares-api.md.

import { z } from 'zod'
import { extractPlaylistId } from '~/lib/import/parser'
import { isSoundCloudUrl } from '~/lib/import/schema'

// ── primitive schemas ───────────────────────────────────────────────────

const ShareIdSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{8}$/, 'shareId must be 8-char Crockford base32')

const ShareIdCaseInsensitiveSchema = z
  .string()
  .regex(
    /^[0-9A-HJKMNP-TV-Zhjkmnp-tv-z]{8}$/i,
    'shareId must be 8-char Crockford base32 (case-insensitive)',
  )

const CredentialHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'credentialHash must be 64-char lowercase hex')

const CredentialSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'credential must be 43-char base64url')

const SourceUrlSchema = z
  .string()
  .min(1)
  .max(2048, 'sourceUrl exceeds 2048 chars')

// ── ShareRecord (server-side, KV) ───────────────────────────────────────

const ShareRecordCommonSchema = z.object({
  shareId: ShareIdSchema,
  name: z.string().trim().min(1, 'name required').max(80, 'name too long'),
  description: z
    .string()
    .max(280, 'description too long')
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  createdAt: z.number().int().nonnegative(),
  revokedAt: z.number().int().nonnegative().nullable(),
  credentialHash: CredentialHashSchema,
})

const VideoShareRecordSchema = ShareRecordCommonSchema.extend({
  kind: z.literal('video'),
  sourceUrl: SourceUrlSchema.refine((url) => extractPlaylistId(url) !== null, {
    message: 'sourceUrl must be a YouTube playlist URL',
  }),
})

const MusicShareRecordSchema = ShareRecordCommonSchema.extend({
  kind: z.literal('music'),
  sourceUrl: SourceUrlSchema.refine(isSoundCloudUrl, {
    message: 'sourceUrl must be a valid https SoundCloud URL',
  }),
})

export const ShareRecordSchema = z.discriminatedUnion('kind', [
  VideoShareRecordSchema,
  MusicShareRecordSchema,
])

export type ShareRecord = z.infer<typeof ShareRecordSchema>

// ── PublicShareRecord (returned to clients — credentialHash stripped) ───

const PublicShareRecordCommonSchema = ShareRecordCommonSchema.omit({
  credentialHash: true,
}).strict() // strict so credentialHash leakage is caught by tests

const VideoPublicShareRecordSchema = PublicShareRecordCommonSchema.extend({
  kind: z.literal('video'),
  sourceUrl: SourceUrlSchema,
})

const MusicPublicShareRecordSchema = PublicShareRecordCommonSchema.extend({
  kind: z.literal('music'),
  sourceUrl: SourceUrlSchema,
})

export const PublicShareRecordSchema = z.discriminatedUnion('kind', [
  VideoPublicShareRecordSchema,
  MusicPublicShareRecordSchema,
])

export type PublicShareRecord = z.infer<typeof PublicShareRecordSchema>

// ── Wire payloads ───────────────────────────────────────────────────────

const PublishChannelSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('video'),
    sourceUrl: SourceUrlSchema.refine(
      (url) => extractPlaylistId(url) !== null,
      { message: 'sourceUrl must be a YouTube playlist URL' },
    ),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(280).optional(),
  }),
  z.object({
    kind: z.literal('music'),
    sourceUrl: SourceUrlSchema.refine(isSoundCloudUrl, {
      message: 'sourceUrl must be a valid https SoundCloud URL',
    }),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(280).optional(),
  }),
])

export const PublishPayloadSchema = z.object({
  channel: PublishChannelSchema,
  credential: CredentialSchema,
})

export type PublishPayload = z.infer<typeof PublishPayloadSchema>

export const RevokePayloadSchema = z.object({
  shareId: ShareIdSchema,
  credential: CredentialSchema,
})

export type RevokePayload = z.infer<typeof RevokePayloadSchema>

export const ResolvePayloadSchema = z.object({
  shareId: ShareIdCaseInsensitiveSchema,
})

export type ResolvePayload = z.infer<typeof ResolvePayloadSchema>

// ── Result envelope ─────────────────────────────────────────────────────

export type ShareErrorCode =
  | 'invalid_payload'
  | 'rate_limited'
  | 'not_found'
  | 'unauthorized'
  | 'kv_unavailable'

export type ShareResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: ShareErrorCode
      message?: string
      retryAfterMs?: number
    }

// ── Source-URL normalization ────────────────────────────────────────────

/**
 * Produce a canonical form of the source URL for idempotency keying.
 *
 * - YouTube: lowercase host, strip trailing slash, retain only `list=` query
 *   param.
 * - SoundCloud: lowercase host, strip trailing slash, preserve full query
 *   (some SC URLs carry meaningful tokens).
 * - Malformed input: return the original string (caller is responsible
 *   for upstream validation; this helper never throws).
 */
export function normalizeSourceUrl(
  url: string,
  kind: 'video' | 'music',
): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  parsed.hostname = parsed.hostname.toLowerCase()

  // Strip trailing slash from pathname (but keep root '/' as '/').
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  if (kind === 'video') {
    const list = parsed.searchParams.get('list')
    parsed.search = list ? `?list=${list}` : ''
    parsed.hash = ''
  } else {
    parsed.hash = ''
  }

  return parsed.toString()
}
