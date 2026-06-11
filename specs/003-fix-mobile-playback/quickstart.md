# Quickstart: Fix Mobile Playback Bugs

**Feature**: `003-fix-mobile-playback`  
**Date**: 2026-05-26

## Testing the fixes manually

### Prerequisites

```bash
pnpm dev   # starts at http://localhost:3000
```

For mobile testing, use Chrome DevTools mobile emulation (iPhone 12 Pro or similar) or a real iOS/Android device pointed at your local IP.

### Test 1 — SoundCloud auto-play (no unmute tap)

1. Open any music channel (e.g., channel 8 or 9 in the guide)
2. **Before the fix**: status badge shows `● mounting` forever; button reads "LOADING… TAP TO UNMUTE"
3. **After the fix**: status badge transitions to `● playing` within ~6s; if you've already tapped anything on the page, audio plays automatically with no button tap required

### Test 2 — SoundCloud fallback unmute (strict autoplay)

1. Open an incognito tab → navigate directly to a music channel URL (simulates zero prior gestures)
2. **After the fix**: button reads "TAP TO UNMUTE" (not "LOADING… TAP TO UNMUTE"); one tap starts audio

### Test 3 — YouTube single-tap

1. Open any video channel on mobile emulation
2. **Before the fix**: tap the green play button → poster disappears, black screen → tap again → video plays
3. **After the fix**: tap the green play button → video starts immediately

### Test 4 — Channel navigation between music channels

1. Start on a music channel, confirm audio playing
2. Swipe up to the next music channel
3. **After the fix**: widget status transitions cleanly to the new channel — no reset to "LOADING…"

### Test 5 — Security: malformed embedUrl rejection

```bash
# In browser console on any page:
localStorage.setItem('kranz-tv:custom-channels', JSON.stringify([{
  kind: 'music', id: 'test', number: 99, name: 'Test', source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/test', totalDurationSeconds: 100,
  trackCount: 1,
  tracks: [{ id: '1', title: 'Test', artist: '', durationSeconds: 100,
             embedUrl: 'https://evil.com/track' }]
}]))
```

Reload the page. The channel should not appear in the guide — `revalidateChannel` rejects it.

### Debug mode

Append `?debug-sc` to any URL to make the SoundCloud iframe visible in the bottom-right corner. The status badge on music channels reflects the hoisted provider's real state.

## Key files

| File | What changed |
|------|-------------|
| `src/components/mobile/mobile-player-area.tsx` | Removed nested `ScWidgetProvider`; pre-mounts `TvPlayer` |
| `src/components/music-channel-view.tsx` | Auto-play on `userActivation.isActive`; removed `body.click()` |
| `src/components/tv-player.tsx` | Added `onPlayerReady` callback prop |
| `src/lib/sources/soundcloud/sc-widget-context.tsx` | Removed `body.click()`; removed `allow-popups-to-escape-sandbox`; finite error retry |
| `src/lib/import/schema.ts` | `TrackSchema.embedUrl` validated against `isSoundCloudUrl` |
| `src/lib/storage/local-channels.ts` | `revalidateChannel` checks per-track `embedUrl` |
| `src/lib/datadog/rum.ts` | Added `trackMobileScAutoplay`, `trackMobileYtOneTap` |
