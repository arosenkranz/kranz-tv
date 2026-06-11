# Data Model: Fix Mobile Playback Bugs

**Feature**: `003-fix-mobile-playback`  
**Date**: 2026-05-26

This feature has no new data models. The changes are behavioral (provider wiring, gesture handling) and validation (Zod schema tightening). Below documents the affected schema fields and state transitions.

## Modified Schema: TrackSchema

**File**: `src/lib/import/schema.ts`

| Field      | Before                     | After                                                     |
|------------|----------------------------|-----------------------------------------------------------|
| `embedUrl` | `z.string().url()`         | `z.string().url().refine(isSoundCloudUrl, { message: 'embedUrl must be a valid SoundCloud URL' })` |

**Validation rule**: `isSoundCloudUrl` accepts `https://soundcloud.com/*`, `https://www.soundcloud.com/*`, `https://m.soundcloud.com/*`, `https://on.soundcloud.com/*`. Rejects all other schemes and hostnames.

**Impact**: Any imported channel JSON or localStorage entry with a non-SoundCloud `embedUrl` is rejected at parse time. Existing valid channels are unaffected.

## Modified Rehydration Guard: `revalidateChannel`

**File**: `src/lib/storage/local-channels.ts`

| Check             | Before                                              | After                                                                             |
|-------------------|-----------------------------------------------------|-----------------------------------------------------------------------------------|
| `sourceUrl`       | `!isSoundCloudUrl(music.sourceUrl)` → return null   | unchanged                                                                         |
| Old widget URLs   | `.embedUrl.startsWith('https://w.soundcloud.com')` → return null | unchanged                                                       |
| Per-track `embedUrl` | not checked                                      | `music.tracks?.some(t => !isSoundCloudUrl(t.embedUrl))` → return null            |

## Modified State: `ScWidgetProvider`

**File**: `src/lib/sources/soundcloud/sc-widget-context.tsx`

New internal ref:

| Ref               | Type     | Purpose                                                  | Reset on          |
|-------------------|----------|----------------------------------------------------------|-------------------|
| `retryCountRef`   | `number` | Counts consecutive `error` events for current channel   | `setActiveChannel` call with any channel |

**State transition for error-retry**:

```
error event fires
  → retryCount++
  → if retryCount >= tracks.length: setStatus('error'), return
  → else: advance to next track via loadTrack()
```

## Removed State

- `document.body.click()` synthetic event in `doSeek()` — removed entirely.
- Nested `ScWidgetProvider` in `MobilePlayerArea` — entire wrapper removed.

## New Ref: `TvPlayer` (mobile pre-mount path)

**File**: `src/components/mobile/mobile-player-area.tsx`

The existing `TvPlayer` already holds `playerRef` internally. To enable the poster tap to call `playVideo()`, `TvPlayer` needs to forward the `YT.Player` instance to the parent. This uses a `forwardRef` + `useImperativeHandle` pattern, or alternatively a callback prop `onPlayerReady(player: YT.Player)`.

**Chosen approach**: `onPlayerReady` callback prop (simpler, no ref forwarding needed):

```typescript
// Added to TvPlayerProps:
onPlayerReady?: (player: YT.Player) => void
```

The `MobilePlayerArea` stores this in a `playerRef` and calls `playerRef.current?.playVideo()` from the poster button handler.

## iframe sandbox attribute change

**File**: `src/lib/sources/soundcloud/sc-widget-context.tsx`

| Before | After |
|--------|-------|
| `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"` | `sandbox="allow-scripts allow-same-origin allow-popups"` |

`allow-popups-to-escape-sandbox` removed. No feature regression.
