# Feature Specification: Fix Mobile Playback Bugs

**Feature Branch**: `003-fix-mobile-playback`  
**Created**: 2026-05-26  
**Status**: Draft (revised after adversarial review)  
**Input**: User description: "I want to fix all of the mobile bugs on soundcloud powered channels. I also noticed that youtube channels require multiple clicks to play. I think we could trigger it better."

## Root Cause Summary

Two distinct bugs, separate fixes:

**SoundCloud (mobile):** A `ScWidgetProvider` is already hoisted at the layout level (`_tv.tsx`), but `MobilePlayerArea` wraps music channels in a *second, nested* provider with no props. Mobile's `MusicChannelView` reads this inner context, where `activeChannelId` is always `null` — making `isLoading` permanently `true`, the unmute button perpetually says "LOADING…", and the route's `setActiveChannel` calls drive a provider no mobile component is listening to. The fix is removing the duplicate nested provider from `MobilePlayerArea`.

**YouTube (mobile):** The poster/play-button flow in `MobilePlayerArea` mounts `TvPlayer` *after* the first tap (setting `isPlaying=true`). The browser's autoplay gesture requirement is consumed by the poster tap, but `TvPlayer` mounts fresh at that point — requiring a *second* tap inside the iframe to start video. The fix is ensuring a single tap simultaneously satisfies the gesture requirement and starts the player.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — SoundCloud channels play reliably on mobile (Priority: P1)

A user on a mobile device navigates to a SoundCloud-powered music channel. The audio starts playing (or prompts a single unmute tap) without requiring multiple interactions, page refreshes, or getting stuck in a stuck "LOADING…" state.

**Why this priority**: The nested-provider bug makes the mobile SC experience completely broken — stuck loading forever.

**Independent Test**: Navigate to a music channel on mobile after any prior tap on the page. Confirm audio starts automatically — no unmute prompt required.

**Acceptance Scenarios**:

1. **Given** a user opens a music channel on mobile after any prior interaction on the page, **When** the SC widget reaches `ready`, **Then** audio begins playing automatically without any unmute prompt.
2. **Given** a user opens a music channel on mobile with zero prior page interactions (strict-autoplay browser), **When** the widget is ready, **Then** a "TAP TO UNMUTE" fallback button appears — it reads "TAP TO UNMUTE" (not "LOADING… TAP TO UNMUTE") — and a single tap starts audio.
3. **Given** the user navigates to a different music channel, **When** the route loads, **Then** the widget switches tracks using the already-mounted provider — no new iframe, no reset to "LOADING…".
4. **Given** the user navigates away from a music channel to a video channel and back, **When** they return, **Then** audio resumes automatically (or via single tap fallback) without a stuck loading state.
5. **Given** a track is geo-blocked or unavailable (up to all tracks in the channel), **When** the widget errors, **Then** it advances to the next available track automatically, or surfaces an error state if all tracks are exhausted — never loops infinitely.

---

### User Story 2 — YouTube channels start playing with a single tap on mobile (Priority: P2)

A user on a mobile device taps the play button on a YouTube channel and video starts playing. They do not need to tap twice.

**Why this priority**: The current poster flow costs one gesture to mount the player, then a second gesture for the iframe. One-tap is the expected mobile experience.

**Independent Test**: Open a YouTube channel on mobile, tap the play button once, confirm video starts playing with that tap.

**Acceptance Scenarios**:

1. **Given** a YouTube channel is loaded on mobile with the poster/thumbnail showing, **When** the user taps the play button, **Then** video starts playing without requiring an additional tap on the iframe.
2. **Given** video is playing, **When** the user mutes via the toolbar, **Then** audio mutes without pausing or requiring another interaction.
3. **Given** the user switches channels via swipe gesture, **When** the new channel loads, **Then** the poster is shown immediately and a single tap starts the new channel.

---

### User Story 3 — Visualizer renders correctly within the mobile player area (Priority: P3)

The WebGL music visualizer fills the mobile player container (40dvh in portrait mode) without overflowing into other UI elements.

**Why this priority**: Lower risk — overflow is clipped by `overflow-hidden`, but if the canvas size is miscomputed, animations can appear distorted or performance may degrade.

**Independent Test**: Open a music channel on mobile portrait, confirm the visualizer fills the player area and does not cause layout shifts.

**Acceptance Scenarios**:

1. **Given** a music channel is active on mobile in portrait mode, **When** the visualizer is rendering, **Then** it fills the 40dvh player container without causing overflow or layout shift in adjacent elements.
2. **Given** the device is in landscape mode with fullscreen active, **When** the visualizer is rendering, **Then** it scales to fill the full viewport.
3. **Given** WebGL is unavailable, **When** the fallback background renders, **Then** the fallback fills the player area on mobile without visual artifacts.

---

### Edge Cases

- What happens when a user switches rapidly (< 1 second) from a SoundCloud channel to a YouTube channel? The shared provider's deferred `play()` timers must be cancelled before the non-music channel renders — `cancelPendingTimers` exists but must be wired to the unmount/navigation path.
- What if the browser blocks autoplay entirely? The unmute button must appear immediately (not behind a stuck `isLoading` guard) so the user always has a path to audio.
- What happens with a single-track channel or one where all tracks are geo-blocked? The error-advance loop must have a terminal state rather than cycling infinitely.
- What happens if the user taps fullscreen exit while the SC widget is mid-load? Provider cleanup must cancel pending timers without leaving a dangling deferred `play()` on the old channel.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The nested `ScWidgetProvider` inside `MobilePlayerArea` MUST be removed. Mobile components must read from the existing hoisted provider in `_tv.tsx`, which already receives `isMuted` and `volume` props.
- **FR-002**: After removing the nested provider, `MusicChannelView`'s `isLoading` condition (`activeChannelId !== channel.id || status === 'mounting'`) MUST correctly resolve to `false` once the hoisted provider's `setActiveChannel` fires — which already happens in `_tv.channel.$channelId.tsx`.
- **FR-003**: On SoundCloud channels on mobile, once the SC widget is `ready` and the user has performed any prior page interaction, audio MUST begin playing automatically — no "TAP TO UNMUTE" prompt required. The widget starts muted per browser autoplay policy, but MUST unmute and play as soon as a prior user gesture has been recorded in the session. The unmute button remains as a fallback only for strict-autoplay browsers where no prior gesture exists.
- **FR-004**: On YouTube channels on mobile, `TvPlayer` MUST be mounted immediately on channel load (hidden behind the poster overlay), so the poster play button tap calls `player.playVideo()` via the YT IFrame API directly — satisfying the browser autoplay gesture and starting video in a single tap. The poster overlay (thumbnail + green play button) remains visible on top until the tap occurs; `TvPlayer` renders beneath it.
- **FR-005**: The `isLoading` guard in `MusicChannelView` MUST NOT permanently block the unmute fallback button. If `activeChannelId` has not resolved within 6 seconds of the channel loading, the button MUST become tappable regardless.
- **FR-006**: The music visualizer canvas size MUST be derived from the player container element's measured dimensions, not `window` dimensions, on mobile. This is subject to verification during implementation — if the canvas already uses container dimensions, this requirement is satisfied without change.
- **FR-007**: On navigation from a music channel to a non-music channel, `setActiveChannel(null)` MUST be called (already implemented in `_tv.channel.$channelId.tsx`) and any pending widget timers MUST be cancelled before the new channel view renders.
- **FR-008**: The error-advance path in the SC widget MUST have a finite retry bound — if all tracks in a channel are unavailable, the widget MUST surface an `error` status rather than looping silently.
- **FR-009** _(security — MUST land with FR-001)_: Each track's `embedUrl` MUST be validated against the SoundCloud URL allow-list (`isSoundCloudUrl()`) both at import time (in `TrackSchema`) and on rehydration from `localStorage`. The hoisted provider extends the SC iframe's lifetime for the entire session; an unvalidated `embedUrl` from a tampered custom-channel import would give an attacker-controlled URL a persistent, same-origin-capable iframe. This is required before or alongside the provider hoist — not after.
- **FR-010** _(security)_: The `allow-popups-to-escape-sandbox` attribute MUST be removed from the SoundCloud iframe unless a specific feature requires it. It allows popups spawned by the widget to run fully unsandboxed; no current feature needs this permission.
- **FR-011**: The `document.body.click()` synthetic gesture call in `sc-widget-context.tsx` (`doSeek` path) MUST be removed. It does not satisfy mobile autoplay policy (browsers require a real user gesture on the target element, not a synthetic event on `body`) and fires a trusted-looking event into global click listeners.

### Key Entities

- **ScWidgetProvider** (`_tv.tsx:194`): The single correct provider instance. Already hoisted; the fix is removing the duplicate in `MobilePlayerArea`.
- **MobilePlayerArea** (`mobile-player-area.tsx:55`): Contains the duplicate nested `ScWidgetProvider` that is the root cause of the SC mobile bugs.
- **MusicChannelView** (`music-channel-view.tsx:124`): The `isLoading` condition will work correctly once it reads from the hoisted provider — no changes needed to this component beyond verifying the fix.
- **TvPlayer** (`tv-player.tsx`): The YouTube iframe wrapper — the poster mount strategy in `MobilePlayerArea` needs to change so a single tap starts playback.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user hears audio on a SoundCloud music channel on mobile automatically — with zero taps — when any prior page interaction has occurred in the session. On strict-autoplay browsers with no prior gesture, audio starts within 1 tap of the fallback unmute button. The "LOADING…" prefix on the unmute button MUST NOT appear after the channel finishes loading.
- **SC-002**: A user can watch video on a YouTube channel on mobile within 1 tap of the play button — not 2 or more.
- **SC-003**: Navigating between two SoundCloud music channels never leaves the status badge stuck on `mounting` — status resolves to `ready` or `playing` within 6 seconds of each channel switch.
- **SC-004**: The visualizer fills the mobile player area on a 375px-wide portrait viewport without overflow or layout shift.
- **SC-005**: All existing unit and integration tests pass at 80%+ coverage after changes.

## Assumptions

- The SoundCloud widget's autoplay behavior on mobile is subject to browser autoplay policy. "Prior page interaction" means any `click`, `touchstart`, or `keydown` that occurred earlier in the session — this is what browsers track internally as the activation state. The auto-play behavior targets this case; the unmute button fallback covers browsers that require a gesture on the audio element itself.
- Pre-mounting `TvPlayer` (YouTube) on mobile means the YouTube IFrame API loads immediately on channel render. This is acceptable — the API script is already loaded globally; pre-mounting only creates the iframe earlier.
- The YouTube poster overlay approach MUST NOT change the desktop path. `pointer-events: none` on the `TvPlayer` wrapper remains in place for desktop so arrow keys reach the React listener.
- The security fix (FR-009 — `embedUrl` allow-list) and the provider hoist (FR-001) ship in the same PR. The hoist without the allow-list validation would extend the SC iframe's lifetime and amplify the untrusted-URL attack surface.
- The existing `cancelPendingTimers` mechanism in `ScWidgetProvider` is sufficient to handle rapid channel switches once the duplicate provider is removed.
- The SC provider's `isMuted`/`volume` props at the layout level (`_tv.tsx:194`) are the source of truth — the nested provider's absence of these props was the root cause of the silent/broken mobile experience.
