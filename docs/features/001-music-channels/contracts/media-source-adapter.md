# Contract: MediaSource Adapter Interface

**Feature**: 001-music-channels
**Type**: Internal interface contract — used by import flow and player layer

This contract governs how media-source adapters (SoundCloud v1, Mixcloud v2, future direct-MP3) plug into KranzTV's channel import and playback systems.

---

## Interface: MediaSource

```typescript
interface MediaSource {
  /** Stable identifier used in MusicChannel.source and registry lookup */
  readonly id: MediaSourceId

  /** Human-readable name shown in UI badges ("SoundCloud Playlist") */
  readonly displayName: string

  /**
   * Returns true if this adapter can handle the given URL.
   * MUST use exact host comparison — substring matching is forbidden (security).
   * MUST reject javascript:, data:, blob:, file: schemes.
   */
  matchesUrl(url: string): boolean

  /**
   * Fetches the full track list from the source.
   * All I/O is client-side only (no server proxy).
   * Rejects with ImportError on: private playlist, network failure,
   * timeout (>15s), incomplete metadata, track count >50.
   */
  importPlaylist(url: string): Promise<ImportedPlaylist>

  /**
   * Creates a media player for the given source URL.
   * The returned player is attached to containerId in the DOM.
   */
  createPlayer(args: CreatePlayerArgs): MediaSourcePlayer
}
```

## Interface: MediaSourcePlayer

```typescript
interface MediaSourcePlayer {
  /** Seeks to the given position. Must be called after player is ready. */
  seekTo(seconds: number): void

  /**
   * Attempts to play. Rejects if blocked by browser autoplay policy.
   * Caller should catch the rejection and call onNeedsInteraction.
   */
  play(): Promise<void>

  pause(): void

  /** Volume: 0-100 */
  setVolume(volume: number): void

  setMuted(muted: boolean): void

  /**
   * Stops audio, detaches from DOM, removes event listeners.
   * MUST be idempotent — safe to call multiple times.
   * MUST set iframe.src = 'about:blank' before removeChild to prevent audio bleed.
   */
  destroy(): void
}
```

## Interface: ImportedPlaylist

```typescript
interface ImportedPlaylist {
  /** Canonical normalized URL as returned from the source */
  readonly sourceUrl: string
  readonly title: string
  readonly description?: string
  /** Ordered as they appear in the source playlist */
  readonly tracks: ReadonlyArray<Track>
}
```

## Error types

```typescript
type ImportErrorReason =
  | 'PRIVATE_PLAYLIST'
  | 'NOT_FOUND'
  | 'NETWORK_FAILURE'
  | 'TIMEOUT'
  | 'INCOMPLETE_METADATA'
  | 'EXCEEDS_TRACK_LIMIT' // >50 tracks in v1
  | 'INVALID_URL'

class ImportError extends Error {
  constructor(
    public readonly reason: ImportErrorReason,
    message: string,
  ) {
    super(message)
  }
}
```

---

## Behavioral Contracts (adapter implementors must honor)

### matchesUrl

- MUST return `false` for any URL whose parsed `protocol` is `javascript:`, `data:`, `blob:`, or `file:`.
- MUST return `false` if the URL is not parseable by `new URL()`.
- MUST return `false` if `parsed.protocol !== 'https:'`.
- MUST compare `parsed.host` using strict equality against a fixed allow-list — not `includes` or `endsWith`.

### importPlaylist

- MUST be entirely client-side. No server-side `fetch` of the target URL.
- MUST reject with `ImportError('TIMEOUT', ...)` if metadata is not fully resolved within 15 seconds.
- MUST reject with `ImportError('EXCEEDS_TRACK_LIMIT', ...)` if the source returns more than 50 tracks.
- MUST NOT return a partial result — either returns a complete `ImportedPlaylist` or rejects.
- MUST validate all returned `Track` field values before resolving:
  - `durationSeconds` must be a positive number.
  - `embedUrl` must pass the source's URL validator.
  - `title` and `artist` must be non-empty strings.

### createPlayer / destroy

- `destroy()` MUST be idempotent.
- `destroy()` MUST prevent further audio output before returning (set iframe `src` to `about:blank` for iframe-based players).
- `destroy()` MUST remove all `window.addEventListener('message', ...)` listeners added during player lifecycle.
- The player MUST NOT call any callback after `destroy()` is invoked.
- `play()` MUST resolve once audio is actively playing, or reject (not hang indefinitely).

### postMessage (iframe-based adapters only)

- MUST validate `event.origin` against the expected origin before processing any inbound `message` event.
- SoundCloud: `event.origin === 'https://w.soundcloud.com'`

---

## iframe Attributes (iframe-based adapters only)

All iframes created by `createPlayer` MUST set:

```html
sandbox="allow-scripts allow-same-origin allow-popups
allow-popups-to-escape-sandbox" allow="autoplay; encrypted-media"
referrerpolicy="strict-origin-when-cross-origin"
```

`allow-top-navigation` MUST NOT appear in the sandbox attribute.

---

## Registry Contract

```typescript
// src/lib/sources/registry.ts
function detectSource(url: string): MediaSource | null
function sourceFor(id: MediaSourceId): MediaSource // throws if not registered
```

`detectSource` calls `adapter.matchesUrl(url)` for each registered adapter in registration order. Returns the first match or `null`.

---

## Adding a New Adapter (v2+)

1. Create `src/lib/sources/{name}/adapter.ts` implementing `MediaSource`.
2. Create `src/lib/sources/{name}/parser.ts` with the host allow-list for that source.
3. Register in `src/lib/sources/registry.ts`.
4. Add `'{name}'` to the `MediaSourceId` union in `types.ts`.
5. Add `MusicChannel.source` literal in `scheduling/types.ts`.
6. Tests required: `parser.test.ts` (including negative cases for spoofed hosts), `adapter.test.ts` (mocked player lifecycle, import flow, postMessage origin check).

No other files require changes for a new adapter.
