# Feature Specification: Music Channels

**Feature Branch**: `001-music-channels`
**Created**: 2026-05-03
**Status**: Draft
**Input**: Music-only channels sourced from SoundCloud playlists with procedural WebGL visualizers replacing the video frame.

---

## User Scenarios & Testing

### User Story 1 — Watch a Music Channel (Priority: P1)

As a viewer, I tune to a music channel and see/hear a continuous music stream from a SoundCloud playlist accompanied by an animated visualizer, just like flipping to a music TV station on cable. If I joined mid-track, I hear the track from where it would be playing right now — not from the start.

**Why this priority**: This is the core value proposition. Without it, no other story matters. It also proves the synchronized-viewing invariant survives the new media type.

**Independent Test**: Import one SoundCloud playlist as a music channel, navigate to it, verify audio plays from the correct deterministic position based on current time, and the visualizer canvas renders.

**Acceptance Scenarios**:

1. **Given** a music channel exists, **When** the viewer navigates to it, **Then** audio begins playing within 4 seconds (subject to autoplay policy and SoundCloud Widget cold-load) and a visualizer renders full-bleed in place of the video frame.
2. **Given** two viewers tune to the same music channel within the same minute, **When** both see the "now playing" indicator, **Then** they see the same track title, and after the in-flight resync settles their audio elapsed positions match within 3 seconds (p95).
3. **Given** a viewer joins a music channel 90 seconds into a 4-minute track, **When** the audio starts, **Then** it begins within 3 seconds of the deterministic 90-second mark; if the initial seek lands more than 3 seconds early due to widget latency, a single drift-correction seek fires within 10 seconds to converge.
4. **Given** a track ends, **When** the schedule advances, **Then** the next scheduled track begins automatically with no manual interaction.

---

### User Story 2 — Import a SoundCloud Playlist as a Channel (Priority: P1)

As an owner of the KranzTV instance, I paste a SoundCloud playlist URL into the existing import modal and the system auto-detects it as a SoundCloud playlist, fetches the track list with durations, and creates a new music channel that appears in the EPG and channel list.

**Why this priority**: Without this, a music channel cannot exist. Tied with Story 1 as P1.

**Independent Test**: Open the import wizard, paste a SoundCloud playlist URL with ≤50 tracks, submit, and verify the channel appears in the channel list with the correct number of tracks and accurate total duration.

**Acceptance Scenarios**:

1. **Given** the import wizard is open, **When** the user pastes a SoundCloud playlist URL with an exact-match SoundCloud host (`soundcloud.com`, `www.soundcloud.com`, `m.soundcloud.com`, or `on.soundcloud.com`), **Then** the wizard displays a "SoundCloud Playlist" badge and the submit button enables.
2. **Given** the user submits a valid SoundCloud playlist URL with ≤50 tracks, **When** the import completes, **Then** a new channel appears in the guide with the playlist's title as the channel name and tracks ordered as on SoundCloud.
3. **Given** the user pastes a YouTube playlist URL into the same wizard, **When** they submit, **Then** the existing YouTube import flow runs unchanged.
4. **Given** a SoundCloud URL is invalid, the playlist is private, the playlist exceeds 50 tracks, the import takes longer than 15 seconds, or the user cancels, **When** the import does not complete cleanly, **Then** the wizard surfaces a specific error message ("Playlist not found", "Playlist exceeds 50-track limit for v1", "Import timed out — try again", etc.) and does not create a partial channel.
5. **Given** a maliciously-crafted URL like `https://soundcloud.com.attacker.com/sets/x` or `javascript:void(0)`, **When** the user pastes it, **Then** detection rejects the URL and the SoundCloud badge does not appear.

---

### User Story 3 — Music Channel in the EPG and Channel List (Priority: P2)

As a viewer browsing channels, I see music channels in the EPG grid alongside video channels, distinguishable at a glance, with the currently-playing track shown as "Track Title — Artist" rather than just a title. I can navigate to them with the same ↑↓ keys.

**Why this priority**: Required for music channels to feel like first-class citizens, but the channel could exist and be navigable by URL without it (P1 covers minimal viewing).

**Independent Test**: With both video and music channels imported, open the EPG and navigate via keyboard. Verify both channel types appear, music channels show "Track — Artist" labels, and channel-up/down cycles through both types in number order.

**Acceptance Scenarios**:

1. **Given** the EPG is open and at least one music channel exists, **When** the viewer scans the grid, **Then** the music channel's row shows current and upcoming tracks formatted as "Track Title — Artist".
2. **Given** the viewer is on a video channel, **When** they press ↑/↓, **Then** the next channel in number order — whether video or music — loads.
3. **Given** the viewer is on a music channel, **When** they open the info panel, **Then** the panel shows the track title, artist, artwork, and an "OPEN ON SOUNDCLOUD" deep link.

---

### User Story 4 — Ambient Backdrop Variety and Selection (Priority: P3)

As a viewer, I can choose between several visual styles for music channels (spectrum, particles, kaleidoscope, oscilloscope) so the experience does not get visually stale. The visuals are described in the UI as **"ambient backdrops"** — they are time-driven, not waveform-analyzed.

**Why this priority**: Useful but not required for the feature to ship. v1 ships all four presets accessible via URL parameter and localStorage default; a UI picker can come later.

**Independent Test**: Append `?viz=particles` to a music channel URL and verify the particle backdrop renders instead of the default spectrum backdrop. Refresh and verify the choice persists via localStorage.

**Acceptance Scenarios**:

1. **Given** a music channel is open with the default backdrop, **When** the user appends `?viz=kaleidoscope` to the URL and reloads, **Then** the kaleidoscope backdrop renders.
2. **Given** the user has chosen a backdrop via URL parameter, **When** they navigate to a different music channel, **Then** the same choice persists.
3. **Given** any backdrop is active, **When** a CRT or VHS overlay mode is also active, **Then** both render correctly with the overlay layered on top of the backdrop.
4. **Given** the user has `prefers-reduced-motion: reduce` set, **When** they navigate to a music channel, **Then** the animated backdrop is replaced by a still gradient and the Now Playing card.
5. **Given** a CRT/VHS overlay is active alongside a heavy backdrop (`particles` or `kaleidoscope`), **When** the device is mid-tier mobile, **Then** the backdrop auto-downgrades to `spectrum` (cheapest) or 15fps to preserve overall frame rate.

---

### Edge Cases

- **WebGL2 unavailable**: Static CSS gradient + visible Now Playing card. Audio still plays. No error toast — backdrop is enhancement, not core.
- **SoundCloud Widget API fails to load** (SC outage, CSP block, ad blocker): "Music channel unavailable" with retry button. Other channels still work.
- **`getSounds()` returns incomplete metadata** (lazy-hydration issue with playlists ≥10 tracks): Adapter polls `getSounds()` every 250ms until every entry has a defined `duration`, with a 10-second ceiling. If still incomplete, reject the import with a clear error.
- **Playlist exceeds 50-track ceiling**: Reject at import with explicit message. Documented as a v1 limitation.
- **Track removed from SoundCloud after import**: KranzTV marks the track as "Unavailable" in the Now Playing card and **short-circuits the slot** — advances to next scheduled track immediately rather than holding dead air for the slot's full duration.
- **Playlist mutated after import** (owner adds, removes, or reorders tracks): KranzTV continues to play the snapshot. A "Refresh playlist" action is available in the channel info panel; it re-runs the adapter and replaces the snapshot atomically.
- **Autoplay blocked**: Same tap-to-unmute toast pattern as existing YouTube path. Backdrop renders silently until interaction.
- **Tab switch / browser sleep**: On `visibilitychange → visible`, recompute `getSchedulePosition()` and resync. A single drift-correction seek fires within 10 seconds if drift exceeds 3 seconds. postMessage commands debounced at 250ms.
- **Single-track playlist** (90s loop): On Widget `FINISH` event, explicitly call `play()` after `seekTo(0)` — Widget ignores `seekTo` alone in `FINISH` state.
- **Rapid channel mash** (↑/↓ held down): Navigation debounced at 250ms. Superseded player mounts are aborted; audio from previous channel is stopped before unmount.
- **Mixed channel list**: All channel-list components render both video and music channels without a "channel type filter" UI.
- **Persisted channel without `kind` field** (existing TV channels): Schema preprocess injects `kind: 'video'` so they continue to load unchanged.
- **localStorage quota exceeded**: Track arrays stored in IndexedDB (not localStorage). Wizard catches `QuotaExceededError` distinctly and surfaces a human-readable message.
- **Tampered persisted data**: All persisted URLs re-validated against the same allow-list on rehydration. Tampered channels are marked unrecoverable and offered for deletion.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST support importing SoundCloud playlist URLs through the existing channel import flow, auto-detecting the source from the URL.
- **FR-002**: System MUST persist imported music channel metadata to localStorage and music track arrays to IndexedDB. Both MUST rehydrate on page load alongside video channels.
- **FR-003**: System MUST schedule music tracks using the same deterministic algorithm as video channels, such that all viewers of the same channel converge on the same scheduled position over time. Initial seek + drift-correction MUST achieve p95 sync within 3 seconds of the deterministic position.
- **FR-004**: System MUST render an animated ambient backdrop in place of the video frame when the active channel is a music channel.
- **FR-005**: System MUST start audio muted on initial channel load and provide a clear tap/click affordance to unmute, matching the existing video channel behavior.
- **FR-006**: System MUST display the currently-playing track's title, artist name, and artwork in the Now Playing area for music channels.
- **FR-007**: System MUST display music channels in the EPG grid with track titles and artists, distinguishable from video channel programming.
- **FR-008**: System MUST allow channel-up/down keyboard navigation to cycle through video and music channels in channel-number order without modal differentiation. Navigation MUST be debounced to prevent rapid-fire mounts.
- **FR-009**: System MUST advance to the next scheduled track when the current track ends, without user interaction. Single-track playlists MUST loop cleanly via explicit `play()` after `seekTo(0)`.
- **FR-010**: System MUST resynchronize playback position to the deterministic schedule when the browser tab regains focus after being hidden, with a single drift-correction seek if the initial seek lands more than 3 seconds off-target.
- **FR-011**: System MUST provide at least four ambient backdrop presets (spectrum, particles, kaleidoscope, oscilloscope) selectable via URL parameter, with the choice persisted to localStorage. The backdrop MUST be replaced by a still gradient when `prefers-reduced-motion: reduce` is set.
- **FR-012**: System MUST gracefully degrade to a non-WebGL fallback visual when WebGL2 is unavailable, while keeping audio playback functional.
- **FR-013**: System MUST surface a specific, actionable error to the user when a SoundCloud import fails (private/deleted playlist, playlist exceeds 50-track v1 ceiling, network failure, import timeout >15s) and MUST NOT create a partially-imported channel.
- **FR-014**: System MUST allow importing both YouTube and SoundCloud URLs from the same import entry point — no separate "Add Music Channel" button.
- **FR-015 (security)**: System MUST validate inbound `postMessage` events from the SoundCloud Widget by exact `event.origin === 'https://w.soundcloud.com'` match before processing any payload.
- **FR-016 (security)**: System MUST validate SoundCloud playlist URLs by exact host match against an allow-list (`soundcloud.com`, `www.soundcloud.com`, `m.soundcloud.com`, `on.soundcloud.com`) and protocol `https:` only. URLs with `javascript:`, `data:`, `blob:`, `file:` schemes MUST be rejected at parse time.
- **FR-017 (security)**: System MUST re-validate every persisted URL field (`sourceUrl`, `embedUrl`) against the same allow-list on rehydration from storage. Persisted data MUST be treated as untrusted input.
- **FR-018 (security)**: SoundCloud-embedding iframes MUST set `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"` (explicitly NOT `allow-top-navigation`), `allow="autoplay; encrypted-media"`, and `referrerpolicy="strict-origin-when-cross-origin"`.
- **FR-019 (security)**: Datadog RUM events for music channels MUST log only non-identifying fields (`source: 'soundcloud'`, `track_count: number`, and a SHA-256 prefix of `sourceUrl` for correlation). Raw URLs, raw track titles, and raw artist names MUST NOT be sent to RUM.
- **FR-020 (security)**: Any oEmbed metadata fetch MUST execute client-side only. If a server-side fetch is ever added, the URL MUST be re-validated against the allow-list before `fetch()` to prevent SSRF.

### Key Entities

- **Channel** (existing, generalized): Now a discriminated union of `VideoChannel` (`kind: 'video'`, existing shape) and `MusicChannel` (`kind: 'music'`). Both share `id`, `number`, `name`, `description?`, `totalDurationSeconds`. Channel numbers are unique across both kinds.
- **VideoChannel**: Existing fields preserved — `playlistId`, `videos: ReadonlyArray<Video>`.
- **MusicChannel**: New — `source: 'soundcloud'`, `sourceUrl: string` (canonical playlist URL), `tracks: ReadonlyArray<Track>` (loaded from IndexedDB on hydrate; metadata-only shape in localStorage).
- **Track**: New — `id`, `title`, `artist`, `durationSeconds`, `embedUrl`. `artworkUrl` derived at render time from track `id` using SoundCloud's predictable URL pattern.
- **ScheduleItem** (new view-model): `id`, `primaryLabel` (track title or video title), `secondaryLabel?` (artist for music, undefined for video), `durationSeconds`, `thumbnailUrl`. Consumed by EPG, info panel, and Now Playing components so they never branch on channel kind directly.
- **MediaSource** (new abstraction): Adapter interface with `id`, `displayName`, `matchesUrl(url)`, `importPlaylist(url)`, `createPlayer(args)`. v1 implementations: `youtube`, `soundcloud`. Shaped to accommodate a future direct-MP3 adapter that exposes a `MediaElementSource` for true Web Audio FFT reactivity.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can import a public SoundCloud playlist URL (≤50 tracks) and have a working music channel in under 30 seconds end-to-end.
- **SC-002**: When two viewers tune to the same music channel within a 5-second window, after the in-flight resync settles their audio elapsed positions match within 3 seconds at p95 on typical broadband. A single drift-correction seek converges to within 1 second within 10 seconds.
- **SC-003**: Music channel pages reach interactive (backdrop rendering, audio loaded, first play attempt issued) within 4 seconds at p95 on typical broadband.
- **SC-004**: At least 95% of imported SoundCloud playlists with public access and ≤50 tracks succeed on first attempt. Failures are limited to genuine platform-level errors.
- **SC-005**: Tab-switch resync places audio within 3 seconds of the deterministic position at p95, with at most one drift-correction seek required to converge.
- **SC-006**: Test coverage for new code remains at or above the project-wide 80% threshold (lines, functions, branches, statements).
- **SC-007 (perf)**: Backdrop GPU frame budget ≤4ms at 0.5x DPR on a CrUX P75 mid-tier mobile device. When a retro overlay is also active, backdrop auto-downgrades to `spectrum` or 15fps.
- **SC-008 (storage)**: Importing 10 SoundCloud playlists at the 50-track ceiling consumes <500 KB of localStorage (metadata only) and <2 MB of IndexedDB (track arrays). No `QuotaExceededError` under typical use.

---

## Assumptions

- **SoundCloud Widget API availability**: The Widget API (`w.soundcloud.com/player/api.js`) and `getSounds()` remain available. If SoundCloud changes the API, **existing music channels keep playing** because per-track metadata is snapshotted at import time. Only new imports are affected.
- **Playlist size ceiling for v1**: 50 tracks. SoundCloud Widget lazy-hydrates larger playlists as playback progresses, making a complete one-shot snapshot unreliable above this ceiling. Documented as a hard v1 limit.
- **Backdrops are honestly named**: UI labels the animated visuals as "ambient backdrops" rather than "audio visualizers" to avoid implying beat-responsive waveform analysis that v1 does not perform.
- **Web Audio reactivity is permanent for SoundCloud, not for the project**: SoundCloud iframe sandboxing is a hard browser security boundary. The `MediaSource` adapter interface accommodates a future direct-MP3 source (Internet Archive, Bandcamp, podcast hosts with `Access-Control-Allow-Origin: *`) that can feed an `AnalyserNode` for true reactive backdrops. Out of v1 scope.
- **Mixcloud is deferred to v2**: The same `MediaSource` adapter interface accommodates Mixcloud without architectural changes. No Mixcloud code ships in v1.
- **Cloudflare Workers compatibility**: All new code avoids Node-runtime-only APIs. SoundCloud iframe lives in the browser; oEmbed fetches use Web `fetch` from the client. No Worker code paths affected.
- **Feature-flag with explicit disabled state**: `VITE_ENABLE_MUSIC_CHANNELS=false` suppresses imports and renders a "Music channels disabled" placeholder on music channel routes — it does not crash by passing a `MusicChannel` to the video player.
- **Existing YouTube player race conditions are fixed alongside this feature**: The `AbortController` / mount-token discipline introduced for the SoundCloud player applies retroactively to the YouTube player to prevent rapid-channel-switch audio bleed that already exists but is exposed by this feature.
