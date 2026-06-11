# Implementation Plan: Fix Mobile Playback Bugs

**Branch**: `003-fix-mobile-playback` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-fix-mobile-playback/spec.md`

## Summary

Fix two distinct mobile playback bugs and one security issue that must ship in the same PR:

1. **SoundCloud mobile (root cause)**: `MobilePlayerArea` wraps music channels in a second, prop-less `ScWidgetProvider` that shadows the hoisted one at `_tv.tsx`. Mobile reads this disconnected inner context, so `activeChannelId` is always `null`, `isLoading` is permanently `true`, and the widget never receives `setActiveChannel` calls. Fix: delete the nested provider. Once resolved, wire auto-play using `navigator.userActivation` so audio starts without a tap when the user has already interacted with the page.

2. **YouTube mobile (two-tap)**: The poster/play flow mounts `TvPlayer` *after* the first tap, consuming the gesture without starting video. Fix: pre-mount `TvPlayer` beneath the poster overlay; the poster button calls `player.playVideo()` directly via the YT IFrame API.

3. **Security (ships with #1)**: Per-track `embedUrl` validated only as `z.string().url()` — any URL passes. The provider hoist extends the SC iframe lifetime for the whole session. Add `isSoundCloudUrl()` validation to `TrackSchema` and `revalidateChannel()`. Remove `allow-popups-to-escape-sandbox`. Remove `document.body.click()` synthetic gesture.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: React 19, TanStack Start, Vite, Zod, SoundCloud Widget SDK, YouTube IFrame API  
**Storage**: `localStorage` for custom channels  
**Testing**: Vitest, 80% coverage threshold enforced  
**Target Platform**: Mobile browsers (iOS Safari, Android Chrome), Cloudflare Workers deploy  
**Project Type**: Web application  
**Performance Goals**: Audio/video starts within 1 user gesture on mobile  
**Constraints**: No Node-only APIs in Worker code paths; ESM only; `pointer-events: none` must remain on YT player wrapper for desktop  
**Scale/Scope**: 4 files changed, 1 file deleted (nested provider wrapper)

## Constitution Check

- [x] **I. Deterministic Scheduling** — This feature does not touch `src/lib/scheduling/`. No impact.
- [x] **II. Client-Side Data Fetching** — No new YouTube API calls. All SC widget interactions remain client-side. No server proxying.
- [x] **III. Test-First** — New pure logic: `isSoundCloudUrl` applied to `TrackSchema` (Zod refine — already pure and tested). `revalidateChannel` guard extension has existing tests. Auto-play gesture check (`navigator.userActivation.isActive`) is a browser API with no new pure functions. Tests are updated alongside code.
- [x] **IV. Observability** — Two new RUM actions: `mobile_sc_autoplay` (auto-play success vs. fallback tap) and `mobile_yt_one_tap` (single-tap YouTube start). Track both in `src/lib/datadog/rum.ts`.
- [x] **V. Immutability & File Size** — All changes return new objects. `sc-widget-context.tsx` (current ~230 lines), `mobile-player-area.tsx` (current ~120 lines), `schema.ts` (current ~180 lines) all stay well under 800 lines.
- [x] **Deployment Constraints** — `navigator.userActivation` is a browser API — not called in any server/Worker path. `MobilePlayerArea` and `MusicChannelView` are client components. No prerendering impact.

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-mobile-playback/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (files changed)

```text
src/
├── components/
│   ├── mobile/
│   │   └── mobile-player-area.tsx    # Remove nested ScWidgetProvider; pre-mount TvPlayer
│   ├── music-channel-view.tsx        # Wire auto-play on navigator.userActivation; remove body.click
│   └── tv-player.tsx                 # Expose playVideo ref for poster-overlay tap
├── lib/
│   ├── import/
│   │   └── schema.ts                 # Add isSoundCloudUrl refine to TrackSchema.embedUrl
│   ├── sources/soundcloud/
│   │   └── sc-widget-context.tsx     # Remove body.click(); remove allow-popups-to-escape-sandbox; add finite error retry
│   └── datadog/
│       └── rum.ts                    # Add trackMobileScAutoplay, trackMobileYtOneTap
└── lib/storage/
    └── local-channels.ts             # Extend revalidateChannel to validate per-track embedUrl

tests/
├── unit/
│   ├── schema.test.ts                # New: TrackSchema embedUrl allow-list cases
│   └── local-channels.test.ts       # New: revalidateChannel with invalid embedUrl
└── integration/
    └── sc-widget-context.test.ts     # Update: verify no body.click(), verify error-retry bound
```

## Complexity Tracking

No constitution violations. No complexity justification needed.

---

## Phase 0: Research

### Research findings

All unknowns resolved from reading the codebase. No external research needed.

**Decision: `navigator.userActivation` for auto-play detection**
- `navigator.userActivation.isActive` returns `true` if the current browsing context has a transient user activation (a recent gesture). `isActive` is the sticky bit — once `true` it stays `true` for the session in current browsers.
- Alternatives considered: `document.body.click()` (rejected — synthetic, not trusted), `hasPlayedRef` in `mobile-view.tsx` (already exists but only tracks the poster tap, not page-level gestures like toolbar or guide taps).
- **Rationale**: `navigator.userActivation` is the browser's own accounting of whether a real gesture has occurred. It is the correct primitive for "has the user touched this page yet?" iOS Safari 16.4+ and Android Chrome 72+ support it. Fallback: `isActive` is `undefined` on unsupported browsers → treat as `false` → show unmute button.

**Decision: Pre-mount `TvPlayer` on mobile, poster overlay on top**
- `TvPlayer` renders as `display: none` (or a zero-opacity absolute layer) beneath the poster. When the user taps the poster play button, the handler calls `playerRef.current.playVideo()` directly via the YT IFrame API *within the same event handler*. This is a synchronous API call in the same JS turn as the click event — it satisfies the browser's user-gesture requirement without the tap needing to reach the iframe physically.
- Alternatives considered: transparent click passthrough (rejected — iOS Safari does not reliably forward events through pointer-events layers to cross-origin iframes), removing poster (rejected — user wants to keep the thumbnail preview).
- **Rationale**: The YT IFrame API's `playVideo()` is a postMessage call — it does not require the iframe to be visible or interactive. Calling it synchronously inside a gesture handler is the documented pattern for autoplay bypass.

**Decision: `TrackSchema.embedUrl` Zod refine**
- `TrackSchema.embedUrl` changes from `z.string().url()` to `z.string().url().refine(isSoundCloudUrl, { message: 'embedUrl must be a valid SoundCloud URL' })`. `isSoundCloudUrl` already validates `https:` scheme and exact-match SoundCloud hostnames.
- `revalidateChannel` gains: `music.tracks?.some(t => !isSoundCloudUrl(t.embedUrl))` → return `null`.
- **Rationale**: Defense-in-depth at both the schema parse boundary and the rehydration boundary, consistent with the existing `sourceUrl` validation pattern.

**Decision: Error-retry bound (FR-008)**
- Add a `retryCountRef` inside `ScWidgetProvider`. On each `error` event, increment. If `retryCount >= channel.tracks.length`, set status to `'error'` and stop advancing. Reset on `setActiveChannel` with a new channel.
- **Rationale**: A simple counter bounded by track count. A 1-track channel or all-blocked channel produces exactly 1 retry (load → error → advance to same position → guard fires → stop). No infinite loop.

