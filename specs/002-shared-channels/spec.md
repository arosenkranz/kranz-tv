# Feature Specification: Shared Channels

**Feature Branch**: `002-shared-channels`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "Plan a future feature where some scheduling/state lives in a backend service so custom user-imported channels can be shared between viewers"

## Summary

Today, a viewer who imports a YouTube playlist as a custom channel keeps that channel in their browser's local storage only — there is no way to share it with anyone else. The viewer cannot send a friend a link that opens the same channel, and a viewer who clears browser data loses their custom channels permanently.

This feature introduces a **share** capability: any custom channel can be published to a shared registry and opened by other viewers via a link. Imported channels remain instantly available offline (the deterministic, no-coordination-required scheduling that defines KranzTV is preserved); the registry only resolves "what playlist + metadata does this share-id refer to."

The feature is the first step toward a small backend service for KranzTV. It is intentionally narrow: only shared channels are introduced. Live events, curator overrides, viewer presence, and analytics aggregation are explicitly **out of scope** and deferred to future features.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Sharer publishes a custom channel and gets a link (Priority: P1)

A viewer who has just imported a YouTube playlist as a custom channel wants to share that channel with a friend. They open the channel's controls, choose "share this channel," and receive a short URL they can paste into chat. The link captures everything the friend needs to receive the same channel — playlist source, channel name, description, and channel number — without the friend having to do their own import.

**Why this priority**: This is the foundational journey. Without it, no recipient flow exists to test, and the feature delivers no value. It is also the smallest meaningful slice — once a sharer can produce a URL, the rest of the work is "what happens when someone opens it."

**Independent Test**: A user imports a known public YouTube playlist as a custom channel, clicks "share," receives a URL in their clipboard, and the URL resolves to a record on the registry that contains the playlist source and channel metadata. Verifiable by inspecting the published record without ever opening the URL in another browser.

**Acceptance Scenarios**:

1. **Given** a viewer has at least one custom channel in their list, **When** they trigger the share action on that channel, **Then** they receive a short, copyable URL within 3 seconds and a confirmation that the link was copied.
2. **Given** a viewer shares the same custom channel twice, **When** they trigger share the second time, **Then** they receive the **same** URL as the first time (sharing is idempotent — no duplicate registry entries for the same channel from the same sharer).
3. **Given** the registry is unreachable, **When** a viewer triggers the share action, **Then** they see a clear error message ("could not publish — try again") and the channel remains unshared and unaffected locally.

---

### User Story 2 — Recipient opens a shared link and tunes in (Priority: P1)

A viewer receives a share URL from a friend, clicks it, and lands on KranzTV already tuned to the shared channel. The channel begins playing immediately — the recipient does not have to import anything, fetch a YouTube API key, or perform any setup. The shared channel appears in the recipient's channel list and remains available across page reloads.

**Why this priority**: This is the payoff for User Story 1 and the user-visible benefit of the feature. Without it, sharers can publish but no one can receive — the loop is incomplete. P1 alongside US1 because together they are the minimum viable feature.

**Independent Test**: Open a known share URL in a fresh browser session (no prior state). Within a few seconds the channel is loaded, playing on the deterministic schedule, and present in the channel list. Verifiable in a private/incognito window.

**Acceptance Scenarios**:

1. **Given** a valid share URL, **When** a viewer opens it in a browser without any prior KranzTV state, **Then** the shared channel loads within 5 seconds and begins playing on the same schedule any other viewer is currently seeing.
2. **Given** the recipient already had the same shared channel in their list, **When** they open the share URL again, **Then** no duplicate channel is added — the existing entry is reused and the channel tunes in.
3. **Given** a share URL whose registry entry has been deleted by the sharer, **When** the recipient opens it, **Then** they see a clear "this channel is no longer available" message and remain on the homepage.
4. **Given** the recipient has just opened a shared channel, **When** they reload the page or close and reopen the browser, **Then** the shared channel is still in their channel list and tunable without re-fetching from the registry.
5. **Given** the recipient is offline, **When** they open a share URL they have already received once before, **Then** the channel still loads from local cache and plays on schedule (the recipient's stored copy is consulted; no registry call is made; the URL bar may either redirect to the canonical channel URL or remain on the share URL — both are acceptable).

---

### User Story 3 — Sharer revokes a published channel (Priority: P2)

A sharer realizes they no longer want a previously shared channel to be discoverable, or imported a playlist by mistake. They can unpublish (revoke) their share. Existing recipients who have already saved the channel locally retain their copy, but new visitors to the share URL get the "no longer available" message.

**Why this priority**: Important for trust and basic privacy hygiene, but not on the critical path for the share-and-receive loop. Ships after P1 stories are working.

**Independent Test**: Publish a share, copy the URL, revoke the share, then visit the URL from a new browser and confirm the unavailable message. Existing local copies in the original recipient's browser still work.

**Acceptance Scenarios**:

1. **Given** a viewer has published a share, **When** they trigger revoke on that share, **Then** within 5 seconds the share URL no longer resolves to a registry entry.
2. **Given** a share has been revoked, **When** a recipient who already imported that share opens KranzTV from cache, **Then** their local copy of the channel continues to function indefinitely (no remote wipe).

---

### User Story 4 — Recipient retains shared channels offline-first (Priority: P2)

The recipient's experience continues to feel "no server required" after the initial share-link visit: subsequent uses of the channel do not require contacting the registry at all. The registry is consulted **once** to resolve a fresh share URL; after that, the channel is local data like any other custom channel.

**Why this priority**: Critical for preserving KranzTV's core feel. Without it, the backend becomes a hard runtime dependency for a normal viewing session, which contradicts the project's offline-friendly identity. P2 because it is a refinement of US2, not a separate flow.

**Independent Test**: After successfully opening a share URL once, disconnect the network and verify the channel still plays correctly on its deterministic schedule across page reloads.

**Acceptance Scenarios**:

1. **Given** a recipient has opened a share URL once, **When** they later use the channel, **Then** no further registry calls are made for normal playback or guide rendering.
2. **Given** a recipient has 10 shared channels in their list, **When** they load KranzTV, **Then** the homepage renders without waiting on registry calls for any of those channels.

---

### Edge Cases

- **Sharer is rate-limited**: If a single sharer attempts to publish many channels in a short window (e.g., scripted abuse), the registry rejects further publishes with a clear error and an indication of when they may try again.
- **Recipient opens a malformed or expired share URL**: A clear "this channel is no longer available or the link is invalid" message; never a generic crash.
- **Two sharers share the same underlying playlist**: Each sharer gets their own share record (different URL); the registry does not merge or deduplicate across sharers.
- **A shared channel's underlying YouTube playlist becomes private or is deleted**: The registry entry remains valid (it only stores the source URL and metadata), but playback degrades the same way it would for any unimportable playlist; this is consistent with current import behavior.
- **Shared channel name collision with the recipient's existing channels**: The recipient's local channel-number assignment may need to differ from the sharer's; the recipient sees the channel under the next available channel number locally.
- **Recipient is on a network that blocks the registry domain**: First-visit share URLs cannot resolve; the recipient sees a clear "could not load shared channel" message. Once received via any path, normal use continues without the registry.

## Requirements _(mandatory)_

### Functional Requirements

#### Sharer flow

- **FR-001**: A viewer MUST be able to publish any of their custom channels as a share with a single in-app action.
- **FR-002**: Publishing a share MUST produce a short, copyable URL that resolves uniquely to that share record.
- **FR-003**: Publishing the same custom channel a second time MUST return the same share URL (idempotent) rather than creating a new record.
- **FR-004**: A sharer MUST be able to revoke any share they previously published, after which the share URL stops resolving for new recipients.
- **FR-005**: The system MUST limit the rate at which a single sharer credential (see Key Entities → Sharer Credential) can publish new shares to prevent abuse, with a clear user-visible error including an indication of when the sharer may try again.

#### Recipient flow

- **FR-006**: Opening a valid share URL MUST tune the visitor in to the shared channel and begin playback on the same deterministic schedule any other viewer is currently seeing.
- **FR-007**: A shared channel received via URL MUST be persisted locally so that subsequent visits do not require contacting the registry.
- **FR-008**: After receiving a shared channel, all normal channel operations (guide rendering, current/next program lookup, channel up/down) MUST work without any registry calls.
- **FR-009**: Opening a share URL whose record has been revoked or never existed MUST display a clear "channel unavailable" message and leave the recipient on a usable state (homepage or last-watched channel).
- **FR-010**: If two viewers open the same share URL, they MUST see the same content playing at the same wall-clock moment as each other and as any other viewer of that channel.

#### Registry behavior

- **FR-011**: The registry MUST store, for each share, the minimum data needed to reconstruct the channel on a recipient: source playlist identifier, sharer-chosen channel name, optional description, and a stable share identifier.
- **FR-012**: The registry MUST NOT store any per-viewer state, watch history, or user identity. Sharers are identified only by an anonymous, browser-local credential sufficient to allow them to revoke their own shares.
- **FR-013**: The registry MUST tolerate brief outages without affecting playback for any recipient who has already imported the share at least once. Only first-time share-URL resolutions depend on registry availability.
- **FR-014**: The registry MUST validate published metadata (channel name length, description length, source URL format) and reject malformed payloads with a clear error message returned to the sharer.

#### Compatibility & migration

- **FR-015**: The feature MUST NOT change the behavior of preset channels or pre-existing locally imported channels for any current viewer who never opens a share URL.
- **FR-016**: The schedule for any channel — including shared channels — MUST be computed in the viewer's browser from the channel's playlist and the current wall-clock time. The registry MUST NOT compute, store, or return "what is currently playing" data; it only stores the channel definition.

### Key Entities

- **Shared Channel Record**: Represents a custom channel that has been published for sharing. Attributes: a stable share identifier (used in the URL), the source playlist URL, the sharer's chosen channel name, optional description, and timestamps for created and (if applicable) revoked. Holds no per-viewer data.
- **Sharer Credential**: An anonymous, per-browser credential that proves "this browser created this share record" so the same browser can later revoke it. Stored client-side; never tied to a real-world identity.
- **Local Custom Channel** (existing): Already exists today as a per-browser entry produced by the import wizard. After this feature, a local custom channel may have an optional reference to a Shared Channel Record indicating it was either received via share-URL or published by this browser.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A viewer can go from "I have a custom channel" to "I have a copyable link to share it" in under 5 seconds, including network round-trip.
- **SC-002**: A recipient opening a fresh share URL is watching the shared channel within 5 seconds on a typical broadband connection.
- **SC-003**: After a recipient has visited a share URL once, all subsequent uses of that channel complete with zero registry calls — verifiable by network inspection.
- **SC-004**: Two viewers opening the same share URL within the same minute see the same video playing at the same seek position, within 1 second of each other.
- **SC-005**: A registry outage of up to 1 hour does not cause any user-visible regression for any viewer who has already imported the relevant shares — preset channels, pre-existing local custom channels, and previously-received shared channels all continue to work normally.
- **SC-006**: 95% of share publishes complete successfully under normal conditions (excluding deliberate rate-limiting).
- **SC-007**: A recipient who clears their browser data and then re-opens a share URL recovers the shared channel without the sharer having to take any action.
- **SC-008**: Registry hosting cost is $0/month at zero shares published, and remains under $5/month at 10,000 active shares (measured against the chosen hosting platform's published pricing).

## Assumptions

- **Identity model**: Sharers are anonymous; there is no login, account, or email collection. The first-pass anti-abuse measure is rate-limiting by browser-local credential, not user identity. If serious abuse emerges, this can be tightened later without breaking the share URL format.
- **Source coverage**: Both YouTube and SoundCloud (music channels) custom channels can be shared. Music channels share their SoundCloud playlist URL the same way video channels share a YouTube playlist URL.
- **Content moderation**: The registry does not screen shared content; it stores only a source URL and metadata. Moderation, if needed, is deferred to a future feature and is not part of v1.
- **Geographic scope**: A single global registry is sufficient for v1. Per-region replicas, geo-routing, or compliance-driven data residency are out of scope.
- **Authentication**: There is no signed-in user concept in KranzTV today, and this feature does not introduce one. Browser-local sharer credentials are the only auth primitive.
- **Discoverability**: There is no public directory of shared channels, no search, and no "trending shares" surface in v1. The only way to receive a shared channel is via a URL someone explicitly sent you.
- **Storage scope**: Existing per-browser custom channels are unaffected; received shares slot into the same local list and use the same browser-local storage already in use for custom channels and music tracks today.
- **Versioning**: The share URL format is opaque to recipients (a single share identifier). The registry can evolve its internal schema freely as long as previously-published share URLs continue to resolve.
- **Platform target**: Same as KranzTV today — modern desktop and mobile browsers; offline-friendly after first content load.
- **Out of scope for v1**: Live events / scheduled premieres, curator overrides, viewer presence ("X watching now"), aggregated analytics, server-side EPG computation, account creation, channel editing after publish (only revoke + re-publish), and any per-viewer state on the registry.
