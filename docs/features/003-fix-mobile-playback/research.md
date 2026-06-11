# Research: Fix Mobile Playback Bugs

**Feature**: `003-fix-mobile-playback`  
**Date**: 2026-05-26

## Resolved Unknowns

### 1. Root cause of SC "stuck loading" on mobile

**Finding**: `MobilePlayerArea` (`src/components/mobile/mobile-player-area.tsx:55`) wraps music channels in a second `ScWidgetProvider` with no `isMuted`/`volume` props. React context resolves to the *inner* provider — so `MusicChannelView` reads `activeChannelId: null` and `status: 'mounting'` from a provider that never receives `setActiveChannel`. The route's `setActiveChannel` drives the *outer* hoisted provider (`_tv.tsx:194`) which nothing on mobile reads.

**Fix**: Delete `<ScWidgetProvider>` and `</ScWidgetProvider>` wrapper lines from `MobilePlayerArea` (lines 55 and 65). Mobile will then read from the outer provider, which already receives correct `isMuted`/`volume` props and is wired to route lifecycle.

### 2. Auto-play without unmute prompt

**Finding**: `navigator.userActivation.isActive` reflects whether the page has received a transient user activation. On mobile, any tap (toolbar, guide, play button) sets this. The SC widget's `setVolume()` + `play()` call satisfies autoplay when called synchronously within a gesture handler *or* when `userActivation.isActive` is already `true`.

**Implementation**: In `sc-widget-context.tsx`'s `doSeek()` callback (fires on first `PLAY_PROGRESS` after load), check `navigator.userActivation?.isActive`. If `true`, call `setVolume(volume)` + `play()` immediately. If `false` or unsupported, leave muted and let the unmute button handle it. Remove `document.body.click()` — it is neither a real gesture nor effective on mobile.

### 3. YouTube single-tap on mobile

**Finding**: The current flow in `MobilePlayerArea` gates `TvPlayer` behind `isPlaying` state. Tap 1 → `setIsPlaying(true)` → `TvPlayer` mounts → tap 2 → YT iframe receives gesture → plays. The gesture from tap 1 is consumed by the React state update; by the time `TvPlayer` mounts (next render), the gesture window is closed.

**Fix**: Pre-mount `TvPlayer` unconditionally (behind the poster). The poster button tap calls `playerRef.current.playVideo()` synchronously — a postMessage to the already-live YT IFrame — within the same gesture event. The poster overlay hides beneath `display:none` on `isPlaying`. A ref from `TvPlayer` exposes the `YT.Player` instance to the parent's tap handler.

**Key constraint**: `pointer-events: none` on the `TvPlayer` wrapper must only apply on desktop. On mobile, `allowInteraction={true}` is already passed (but will be set via the pre-mount path regardless).

### 4. `embedUrl` security gap

**Finding**: `TrackSchema.embedUrl` is `z.string().url()` — accepts any valid URL. `revalidateChannel` in `local-channels.ts` only rejects old widget-format URLs (`https://w.soundcloud.com/player/?url=...`). A tampered `localStorage` entry or malicious imported channel JSON can plant any `https://` URL as `embedUrl`, which is then loaded into the SoundCloud widget iframe and rendered as an `<a href>` in `NowPlayingCard`.

**Fix**: Add `.refine(isSoundCloudUrl, ...)` to `TrackSchema.embedUrl`. Extend `revalidateChannel` to reject channels where any track fails `isSoundCloudUrl(t.embedUrl)`.

### 5. `allow-popups-to-escape-sandbox` removal

**Finding**: The SC widget iframe at `sc-widget-context.tsx:283` has `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`. The `allow-popups-to-escape-sandbox` permission lets popups opened by the widget run fully unsandboxed. No KranzTV feature requires this. Removing it shrinks the blast radius for free.

**Fix**: Remove `allow-popups-to-escape-sandbox` from the sandbox attribute. Keep `allow-popups` (SC widget may open links) but popups remain sandboxed.

### 6. Error-retry bound

**Finding**: The `error` handler in `sc-widget-context.tsx` advances to the next track whenever a track errors. On a single-track channel, `nextTrack.embedUrl === currentTrackUrlRef.current` (the guard at line 180) stops the advance — but on a 2-track channel with both tracks blocked, it alternates between the two tracks forever, never stopping.

**Fix**: Add a `retryCountRef` reset on `setActiveChannel`. On each `error` event, if `retryCount >= Math.max(channel.tracks.length, 1)`, set status to `'error'` and return without advancing. The UI already shows `● error` in the status badge.

## Non-Research Items (confirmed from code)

- `cancelPendingTimers` is called on `setActiveChannel` — deferred play timers are already cancelled on channel switch. No change needed here; removing the nested provider means only one provider's timers exist.
- `playsinline: 1` is already set in `createPlayer`'s `playerVars` — required for iOS inline play.
- `hasPlayedRef` in `mobile-view.tsx` tracks the first poster tap. Once `TvPlayer` is pre-mounted, this ref drives the `onPlay()` call (which triggers the parent's mute-on-first-play logic) — it can be called on the same tap that calls `playVideo()`.
