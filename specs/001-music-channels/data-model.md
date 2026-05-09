# Data Model: Music Channels

**Feature**: 001-music-channels
**Status**: Phase 1 design

---

## Entity Overview

```
Channel (discriminated union)
├── VideoChannel  (kind: 'video')  ← existing, unchanged shape
└── MusicChannel  (kind: 'music')  ← new
     └── tracks: Track[]           ← new (persisted in IndexedDB, not localStorage)

Track                              ← new
ScheduleItem                       ← new view-model (replaces direct Video usage in UI)
MediaSource (interface)            ← new abstraction
```

---

## Channel (discriminated union)

The existing `Channel` type in `src/lib/scheduling/types.ts` becomes a union. TypeScript narrows on `channel.kind`.

### VideoChannel

```typescript
interface VideoChannel {
  readonly kind: 'video' // NEW — injected by Zod preprocess for legacy records
  readonly id: string
  readonly number: number
  readonly name: string
  readonly playlistId: string // YouTube playlist ID
  readonly videos: ReadonlyArray<Video>
  readonly totalDurationSeconds: number
  readonly description?: string
}
```

**Migration**: All existing `Channel` records lack `kind`. The Zod schema adds:

```typescript
z.preprocess(
  (raw) =>
    typeof raw === 'object' && raw !== null && !('kind' in raw)
      ? { ...raw, kind: 'video' }
      : raw,
  z.discriminatedUnion('kind', [VideoChannelSchema, MusicChannelSchema]),
)
```

### MusicChannel

```typescript
interface MusicChannel {
  readonly kind: 'music'
  readonly id: string
  readonly number: number
  readonly name: string
  readonly source: 'soundcloud' // v1 only; v2 adds 'mixcloud'
  readonly sourceUrl: string // canonical playlist URL (validated, https: only)
  readonly totalDurationSeconds: number
  readonly trackCount: number // denormalized — available without loading IndexedDB
  readonly description?: string
  // NOTE: tracks NOT included here — loaded async from IndexedDB on hydrate
}
```

**localStorage shape** (what actually persists to `kranz-tv:custom-channels`): the `MusicChannel` above minus `tracks`. Channel numbers are unique across video and music channels.

**Dedup key** (replaces `playlistId`-based dedup):

```typescript
function dedupKey(channel: Channel): string {
  return channel.kind === 'video' ? channel.playlistId : channel.sourceUrl
}
```

---

## Track

```typescript
interface Track {
  readonly id: string // SoundCloud numeric track ID (as string)
  readonly title: string
  readonly artist: string // SoundCloud: user.username from getSounds()
  readonly durationSeconds: number // converted from Widget's milliseconds
  readonly embedUrl: string // https://w.soundcloud.com/player/?url=...
}
```

**Derived at render time** (not persisted — saves ~200 bytes/track):

- `artworkUrl`: `https://i1.sndcdn.com/artworks-${id}-{hash}-{size}.jpg`
  — NOTE: SC artwork URLs include a hash segment not predictable from track ID alone. Fall back to the Widget iframe's rendered artwork or omit.
  — **Revised**: persist `artworkUrl` after all (the hash is part of the SC response; cannot be derived from ID alone). Adds ~120 bytes/track — acceptable within the IndexedDB budget.
- `permalinkUrl`: `https://soundcloud.com/{user.permalink}/{slug}` — requires `user.permalink` and `slug` from `getSounds()` response. Persist these if available; otherwise omit the "Open on SoundCloud" link.

**Revised persisted Track shape**:

```typescript
interface Track {
  readonly id: string
  readonly title: string
  readonly artist: string
  readonly durationSeconds: number
  readonly embedUrl: string
  readonly artworkUrl?: string // from getSounds(); optional in case unavailable
  readonly permalinkUrl?: string // from getSounds(); optional
}
```

**Validation rules**:

- `id`: non-empty string
- `title`: non-empty string
- `artist`: non-empty string
- `durationSeconds`: positive number (converted from `duration` ms in Widget response)
- `embedUrl`: must pass the SoundCloud allow-list URL validator
- `artworkUrl`: must be `https://i1.sndcdn.com/...` if present
- `permalinkUrl`: must be `https://soundcloud.com/...` if present

**Storage**: `IndexedDB` store `tracks`, keyed by `channelId`. The full `Track[]` for a channel is stored as a single JSON document under `channelId`.

---

## Schedulable (interface)

Generalizes `getSchedulePosition()` to work with any media items that have an `id` and `durationSeconds`.

```typescript
interface SchedulableItem {
  readonly id: string
  readonly durationSeconds: number
}

interface Schedulable {
  readonly totalDurationSeconds: number
  readonly items: ReadonlyArray<SchedulableItem>
}
```

**Call-site adapter** (in `algorithm.ts` or at consumer):

```typescript
function toSchedulable(channel: Channel): Schedulable {
  return channel.kind === 'video'
    ? {
        totalDurationSeconds: channel.totalDurationSeconds,
        items: channel.videos,
      }
    : {
        totalDurationSeconds: channel.totalDurationSeconds,
        items: channel.tracks,
      }
}
```

The algorithm body (`getSchedulePosition`) is unchanged — it only reads `totalDurationSeconds` and walks `items[].durationSeconds`.

---

## ScheduleItem (view-model)

Produced by `toScheduleItem(channel, position)`. Consumed by EPG, info panel, and Now Playing components. These components never inspect `channel.kind` directly.

```typescript
interface ScheduleItem {
  readonly id: string
  readonly primaryLabel: string // video title OR track title
  readonly secondaryLabel?: string // undefined for video; artist for music
  readonly durationSeconds: number
  readonly thumbnailUrl?: string // video thumbnail OR track artworkUrl
  readonly deepLinkUrl?: string // YouTube watch URL OR SoundCloud permalinkUrl
  readonly deepLinkLabel?: string // 'WATCH ON YOUTUBE' | 'OPEN ON SOUNDCLOUD'
}
```

**Converter**:

```typescript
function toScheduleItem(
  channel: Channel,
  position: SchedulePosition,
): ScheduleItem {
  if (channel.kind === 'video') {
    return {
      id: position.video.id,
      primaryLabel: position.video.title,
      durationSeconds: position.video.durationSeconds,
      thumbnailUrl: position.video.thumbnailUrl,
      deepLinkUrl: `https://www.youtube.com/watch?v=${position.video.id}`,
      deepLinkLabel: 'WATCH ON YOUTUBE',
    }
  }
  const track = position.video as unknown as Track // SchedulePosition.video is the item
  return {
    id: track.id,
    primaryLabel: track.title,
    secondaryLabel: track.artist,
    durationSeconds: track.durationSeconds,
    thumbnailUrl: track.artworkUrl,
    deepLinkUrl: track.permalinkUrl,
    deepLinkLabel: track.permalinkUrl ? 'OPEN ON SOUNDCLOUD' : undefined,
  }
}
```

Note: `SchedulePosition.video` is typed as `Video` today. After the generalization, it should be typed as `SchedulableItem` and widened to `Video | Track` via a union or a generic parameter. The exact typing approach is an implementation decision; the view-model converter handles both branches regardless.

---

## MediaSource (adapter interface)

Lives in `src/lib/sources/types.ts`.

```typescript
type MediaSourceId = 'youtube' | 'soundcloud' // | 'mixcloud' in v2

interface ImportedPlaylist {
  readonly sourceUrl: string
  readonly title: string
  readonly description?: string
  readonly tracks: ReadonlyArray<Track>
}

interface MediaSourcePlayer {
  seekTo(seconds: number): void
  play(): Promise<void> // Rejects if blocked by autoplay policy
  pause(): void
  setVolume(volume: number): void // 0-100
  setMuted(muted: boolean): void
  destroy(): void
}

interface CreatePlayerArgs {
  containerId: string
  sourceUrl: string
  startSeconds: number
  onReady: () => void
  onEnded: () => void
  onError: (error: unknown) => void
  onNeedsInteraction: () => void // autoplay blocked
}

interface MediaSource {
  readonly id: MediaSourceId
  readonly displayName: string
  matchesUrl(url: string): boolean
  importPlaylist(url: string): Promise<ImportedPlaylist>
  createPlayer(args: CreatePlayerArgs): MediaSourcePlayer
}
```

**Registry** (`src/lib/sources/registry.ts`):

```typescript
function detectSource(url: string): MediaSource | null
function sourceFor(id: MediaSourceId): MediaSource
```

URL detection uses `URL` parsing and exact `host` comparison — never `includes` or `endsWith`.

---

## State Transitions

### Import flow

```
URL pasted
  → detectSource(url) → badge shown
  → user submits
  → adapter.importPlaylist(url)
      → hidden iframe created
      → READY event received (or 5s timeout → error)
      → getSounds() polled until complete (or 10s ceiling → error)
      → track count checked (>50 → error)
      → ImportedPlaylist returned
  → channelNumber assigned (getNextChannelNumber)
  → MusicChannel assembled
  → tracks saved to IndexedDB
  → MusicChannel metadata saved to localStorage
  → channel appears in guide
```

### Playback flow

```
Channel navigated to
  → loadedChannels.get(channelId) hit (or fresh buildChannel equivalent)
  → tracks loaded from IndexedDB
  → MusicChannelView mounted
  → mountToken = AbortController
  → getSchedulePosition(channel, now) → SchedulePosition
  → SoundCloud Widget iframe created (sandboxed, correct attributes)
  → READY event → widget.seekTo(position.seekSeconds * 1000) → widget.play()
  → t0 = performance.now()
  → first PLAY_PROGRESS event:
      → drift = |getSchedulePosition(now).seekSeconds - widget.position/1000|
      → if drift > 3s: widget.seekTo(corrected * 1000)  [one correction only]
  → on FINISH: getSchedulePosition(now) → seekTo + play for next track
  → on ERROR: mark unavailable, advance to next track
  → on unmount: widget.pause() → iframe.src = 'about:blank' → removeChild
```

### Tab visibility

```
visibilitychange → hidden: no action (Widget pauses automatically on some browsers)
visibilitychange → visible:
  → getSchedulePosition(now) → seekTo(newPosition * 1000)
  → await next PLAY_PROGRESS, apply drift correction if needed
```

---

## IndexedDB Schema

**Database name**: `kranz-tv`
**Store**: `channel-tracks`
**Key**: `channelId` (string)
**Value**: `{ channelId: string, tracks: Track[], updatedAt: number }`

```typescript
// src/lib/storage/track-db.ts
async function saveTracks(channelId: string, tracks: Track[]): Promise<void>
async function loadTracks(channelId: string): Promise<Track[] | null>
async function deleteTracks(channelId: string): Promise<void>
```

Errors from IndexedDB operations (including `QuotaExceededError`) are surfaced to the caller — not swallowed.

---

## Validation: Zod Schemas

### MusicChannelSchema (localStorage)

```typescript
const MusicChannelSchema = z.object({
  kind: z.literal('music'),
  id: z.string().min(1),
  number: z.number().int().positive(),
  name: z.string().min(1),
  source: z.literal('soundcloud'),
  sourceUrl: z
    .string()
    .refine(isSoundCloudUrl, 'Must be a valid SoundCloud playlist URL'),
  totalDurationSeconds: z.number().positive(),
  trackCount: z.number().int().nonneg(),
  description: z.string().optional(),
})
```

### TrackSchema (IndexedDB)

```typescript
const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  durationSeconds: z.number().positive(),
  embedUrl: z
    .string()
    .refine(isSoundCloudUrl, 'Must be a valid SoundCloud embed URL'),
  artworkUrl: z.string().startsWith('https://i1.sndcdn.com/').optional(),
  permalinkUrl: z.string().startsWith('https://soundcloud.com/').optional(),
})
```

### URL validator (reused in parser + hydration)

```typescript
const SC_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
])
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'blob:', 'file:'])

function isSoundCloudUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) return false
    if (parsed.protocol !== 'https:') return false
    return SC_HOSTS.has(parsed.host)
  } catch {
    return false
  }
}
```
