# Feature Specification: Music Channel Visualizations

**Feature Branch**: `002-music-visualizations`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description: "I want to add different canvas WebGL / p5.js / Three.js visualizations to all of my Soundcloud powered channels, as they do not have a video component like the youtube channels do. Look on the internet for cool resources / inspiration. I want some cool trippy visualizations, graphics, and things like that."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Trippy visuals appear on every music channel (Priority: P1)

When a viewer tunes into a SoundCloud-powered music channel on any device, the previously empty/gradient video area is replaced by an animated, full-bleed "trippy" visualization that fills the same screen real estate a YouTube video would occupy. Audio continues uninterrupted. The visualization runs indefinitely while the channel is active, evolving over time so it never appears frozen.

**Why this priority**: This is the core value the user asked for — music channels currently feel half-finished because they lack a video component. Without visuals, the music channels look broken next to the rich, video-driven YouTube channels. Shipping any one signature animated style on a music channel already eliminates the "empty box" problem, so P1.

**Independent Test**: Tune into any SoundCloud channel (e.g. "Calming", "Deeply Disco") on desktop. Confirm the area where a YouTube video would normally play now shows a continuously animated, full-screen visual. Confirm audio still plays in sync. Confirm the visual continues to evolve over a 5-minute observation window (no freeze, no single-frame stall).

**Acceptance Scenarios**:

1. **Given** a viewer is on the home screen, **When** they tune into a SoundCloud-powered channel, **Then** an animated visualization fills the area normally occupied by a video player and persists for the entire viewing session.
2. **Given** a viewer is watching a music channel with a visualization active, **When** the SoundCloud track changes to the next track in the playlist, **Then** the visualization continues without interruption or flicker.
3. **Given** a viewer is watching a music channel, **When** they leave the channel running for 30 minutes, **Then** the visualization is still animating and has not visibly frozen, crashed, or degraded.

---

### User Story 2 - Multiple visualization styles to choose from (Priority: P1)

The viewer can choose from a library of distinctly different "trippy" visual styles (e.g. neon retrowave grid, kaleidoscope mandala, plasma blobs, starfield tunnel, etc.). The chosen style is applied globally across all music channels and is remembered across sessions so the viewer's preference sticks. At least six visually distinct styles are available at launch.

**Why this priority**: The user explicitly asked for "different visualizations" — variety is half the value. One style alone would feel monotonous; the user's reference to "p5.js / Three.js" implies they expect range. Co-equal P1 with story 1 because shipping a single style misses the user's stated intent.

**Independent Test**: With music playing on any SoundCloud channel, switch the visualization style through whatever picker mechanism is provided. Confirm at least 6 styles are available, that each looks visibly distinct from the others (not just recolors of the same animation), and that the selection persists after a full browser reload.

**Acceptance Scenarios**:

1. **Given** at least 6 visualization styles are available, **When** the viewer opens the style picker, **Then** all styles are listed with recognizable names and a way to preview or select each.
2. **Given** the viewer selects a new visualization style, **When** they navigate to a different music channel, **Then** the same selected style is active on the new channel.
3. **Given** the viewer has selected a non-default style, **When** they close and reopen the browser tab, **Then** their selected style is restored automatically.
4. **Given** the viewer is on a video (YouTube) channel, **When** the visualization style is set to any value, **Then** the YouTube video plays normally and the visualization does not appear over it.

---

### User Story 3 - Mobile viewers see music channels and visualizations (Priority: P1)

A viewer on a phone or tablet can tune into a SoundCloud music channel, hear the audio, and see the visualization fill the video region — the same as on desktop. The mobile experience does not crash, drain the battery aggressively, or render as a broken YouTube embed (which is the current behavior).

**Why this priority**: Mobile is currently broken for music channels (mobile always renders the YouTube player even when the channel is SoundCloud-backed). The user said "all my SoundCloud channels," which includes the mobile surface. Without this, the feature ships a regression in plain sight. P1 because it's required to honor the user's stated scope.

**Independent Test**: On a phone (or DevTools mobile emulation), tune into any SoundCloud channel. Confirm audio plays after the standard unmute gesture. Confirm a visualization fills the player region. Confirm the page does not warm noticeably above ambient after 5 minutes of viewing.

**Acceptance Scenarios**:

1. **Given** the viewer is on a mobile device, **When** they tune into a SoundCloud channel, **Then** the SoundCloud audio loads and plays (after any required unmute gesture) and a visualization renders in the player area.
2. **Given** a visualization is rendering on mobile, **When** the device's reduced-motion accessibility setting is enabled, **Then** the visualization presents as a held still frame (no animation) without breaking layout.
3. **Given** the viewer is watching a music channel on mobile, **When** they background the tab or lock the device, **Then** the visualization stops drawing frames (does not continue consuming GPU) and resumes when the tab returns to the foreground.

---

### User Story 4 - Honest, non-distracting fallbacks (Priority: P2)

When the device cannot run animated graphics — because the operating system signals reduced-motion preference, because the browser does not support the required graphics capability, or because the rendering context is lost — the music channel still presents a polished, non-broken visual instead of an empty box. The fallback is a single still frame or a tasteful static design consistent with the active style.

**Why this priority**: Without this, a non-trivial slice of viewers (motion-sensitive users, older Android browsers, locked-down enterprise machines, post-context-loss states) see a regression versus today's gradient backdrop. P2 because the P1 stories deliver the headline value; this prevents accessibility regressions.

**Independent Test**: In browser settings, enable "reduced motion." Tune into a SoundCloud channel. Confirm the visualization area shows a deliberate static frame (not a black void, not a console error). Separately, in DevTools force-lose the graphics context — confirm the page degrades gracefully.

**Acceptance Scenarios**:

1. **Given** the operating system reports a preference for reduced motion, **When** the viewer tunes into a music channel, **Then** a still-frame or static visual appears in place of the animated visualization with no animation playing.
2. **Given** the viewer's browser cannot initialize the required animated graphics surface, **When** they tune into a music channel, **Then** a static fallback visual is shown and audio continues normally.
3. **Given** the animated graphics context is lost during playback, **When** the viewer continues watching, **Then** the page recovers (either resumes animation or falls back to a static visual) without requiring a page reload.

---

### User Story 5 - Inline preview when picking styles (Priority: P3)

When the viewer opens the visualization picker, each style entry shows a small live or representative preview so they can choose by appearance rather than only by name. This makes discovery of styles enjoyable rather than a guessing game.

**Why this priority**: A nice-to-have that elevates the picker UX. Names alone (e.g. "kaleidoscope") are inadequate cues for a primarily visual choice. P3 because the picker functions without it — viewers can iterate through styles one at a time on the live channel and pick what they like.

**Independent Test**: Open the visualization picker. Confirm each entry shows a thumbnail or live preview. Confirm previews update or animate enough to convey the style's character.

**Acceptance Scenarios**:

1. **Given** the picker is open, **When** the viewer scans the list, **Then** each style entry shows a visual representation distinct from the others.
2. **Given** the picker is open on a low-power device, **When** thumbnails would be expensive to animate, **Then** the previews degrade to static images rather than blocking the picker from rendering.

---

### Edge Cases

- The viewer's device does not support the required animated graphics capability at all → US4 (static fallback).
- The viewer has enabled reduced-motion at the OS or browser level → US4 (held still frame).
- The viewer switches rapidly between music channels (e.g. holding the next-channel key) → visualization should not leak state, leak memory, or accumulate canvases; only one active canvas at a time.
- The viewer switches from a music channel to a YouTube channel → visualization stops cleanly; no canvas remains layered over the YouTube video.
- The viewer switches from a YouTube channel to a music channel → visualization starts from its initial state without flashes of empty/black/error content.
- The browser tab is backgrounded for a long time → visualization pauses frame draws; on return, it resumes (US3).
- The animated graphics context is lost (common on mobile Safari after backgrounding) → page recovers automatically (US4).
- The viewer's chosen style preference, persisted across sessions, refers to a style that no longer exists (renamed, removed) → application falls back to the default style without throwing.
- Two browser tabs render the same music channel simultaneously → each tab independently runs its own visualization; audio stays in sync with the deterministic schedule.
- The viewer is on a music channel but the music widget has not yet loaded a track → visualization runs from time `0` and looks reasonable on an empty/loading state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an animated, full-bleed visualization in the video region of every music-kind channel on both desktop and mobile.
- **FR-002**: System MUST NOT display the music-channel visualization on video-kind (YouTube) channels.
- **FR-003**: System MUST offer at least six visually distinct visualization styles at launch, each with a stable name (e.g. "neon retrowave", "kaleidoscope", "plasma", "starfield tunnel", "lo-fi blobs", "sacred geometry").
- **FR-004**: System MUST allow the viewer to switch the active visualization style at any time from a single user-facing control (e.g. picker, keybind, or dropdown), and the change MUST take effect within two seconds with no audio interruption.
- **FR-005**: System MUST apply the viewer's chosen style globally across all music channels (a single global preference, not per-channel).
- **FR-006**: System MUST persist the viewer's chosen style across browser sessions so the same style is restored on next visit without re-selection.
- **FR-007**: System MUST allow the viewer to override the active style for a single session via a deep link (URL parameter) without overwriting their persisted preference.
- **FR-008**: System MUST render the visualization in continuous animation while the music channel is in the foreground and a music channel is the active route.
- **FR-009**: System MUST pause visualization frame rendering when the browser tab is hidden and resume when it becomes visible again.
- **FR-010**: System MUST honor the viewer's operating-system or browser-level reduced-motion preference by displaying a single still frame instead of an animated visualization.
- **FR-011**: System MUST present a static fallback visual when the device cannot initialize the animated graphics surface, with audio continuing to play normally.
- **FR-012**: System MUST recover from a lost graphics context without requiring a page reload — by either resuming animation or transitioning to the static fallback.
- **FR-013**: System MUST clean up the active visualization (release graphics resources, stop frame loop) when the viewer navigates away from a music channel.
- **FR-014**: System MUST tear down and re-mount the visualization cleanly when the viewer switches from one music channel directly to another, with no leaked canvases or duplicated animation loops.
- **FR-015**: System MUST support tuning into a SoundCloud-powered music channel from a mobile device, with audio playback functional after any required unmute gesture and the visualization rendering in the player area.
- **FR-016**: System MUST drive visualization animation from elapsed playback time and the music widget's reported playback position, without requiring access to the underlying audio frequency spectrum.
- **FR-017**: System MUST silently fall back to the default style when a persisted or URL-supplied style identifier does not match any registered style.

### Key Entities

- **Visualization style**: A named, distinct animated visual treatment (e.g. "neon retrowave"). Attributes: stable identifier, human-readable display name, a representative preview asset for the picker, and a static fallback frame for reduced-motion / context-loss states.
- **Active selection**: The single viewer-scoped choice of which visualization style is currently active. Attributes: selected style identifier, persistence across sessions, override-by-URL behavior.
- **Music channel**: Existing entity from prior work. The visualization layer attaches to channels of this kind only; the entity itself does not gain new fields in this feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of music-kind channels display an animated visualization in the video region on both desktop and mobile (measured by manual smoke test of all six SoundCloud presets on a desktop browser and one mobile browser).
- **SC-002**: At launch the visualization library contains at least six visually distinct styles, and a side-by-side comparison of any two styles by an unfamiliar viewer is correctly identified as "different" 100% of the time.
- **SC-003**: Switching the active visualization style takes effect within 2 seconds and causes zero audio interruption (measured by listening for any glitch, dropout, or position jump during 20 rapid style switches).
- **SC-004**: A viewer's chosen style is restored on the next session 100% of the time, verified by selecting a non-default style, fully closing the browser, reopening, and tuning into a music channel.
- **SC-005**: When the operating system signals reduced-motion preference, the visualization area shows a still frame and no animation is rendered (verified by inspecting frame counts).
- **SC-006**: A mobile device viewing a music channel for 5 continuous minutes does not produce any visible UI freeze, crash, or audio dropout, and the device does not become noticeably warm relative to the same device idle on the home screen.
- **SC-007**: When a music channel is left running for 30 continuous minutes, the visualization continues animating and has not visibly frozen, error-thrown, or degraded.
- **SC-008**: Background tab CPU/GPU usage drops to effectively zero within 2 seconds of the tab being hidden, and resumes within 2 seconds of being shown again.

## Assumptions

- The existing music channel data model and SoundCloud playback pipeline are sufficient and will not be modified in this feature. Only the visual presentation layer is added/extended.
- The viewer's choice of visualization style is a viewer-personal preference, not a channel attribute — two different viewers of the same channel may see different visualizations, while their audio remains identical and in sync (consistent with KranzTV's existing deterministic-audio model).
- Real audio-frequency analysis (FFT) is out of scope. The hosting environment for music audio does not expose audio data to the surrounding page, so visualizations are driven by elapsed time and reported playback position. A future feature may layer in real frequency reactivity if the audio pipeline is restructured.
- "Trippy" is interpreted as a stylistic ceiling: motifs like kaleidoscope, plasma, neon grids, starfields, and color-shifting fractals are in-scope; calming gradients and minimalist designs may be included among the styles but are not the headline aesthetic.
- The mobile experience for music channels is currently degraded (the mobile player renders a non-music player for music channels). This feature corrects that as part of shipping mobile visualizations — the user's stated scope of "all my SoundCloud channels" is understood to include the mobile surface.
- Style preview thumbnails (User Story 5) may be static images rather than live animations, particularly on low-power devices.
- Adding visualizations does not change the deterministic scheduling guarantee for audio — viewers continue to hear the same track at the same moment on the same channel.

## Out of Scope

- Real audio-frequency-driven (FFT) visualizations. Deferred pending restructure of the music audio pipeline to a same-origin source.
- Per-channel locked visualization branding (e.g. "Disco channel always shows neon retrowave"). Visualization is a global viewer preference.
- Visualizations on video (YouTube) channels.
- User-uploaded or user-authored custom visualization styles. The launch library is curated.
- Visualizations on the EPG grid, info panel, home screen, or other non-channel-view surfaces.
