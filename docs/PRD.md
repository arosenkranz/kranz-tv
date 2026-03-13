# KranzTV — PRD & Implementation Plan

## Context

KranzTV is a clone of [Channel Surfer](https://channelsurfer.tv/) — a retro TV experience that turns YouTube playlists into live cable TV channels. Videos play on a deterministic schedule based on wall-clock time, so everyone watching the same channel sees the same video at the same moment. Built with TanStack Start, containerized for Docker/K8s, and fully instrumented with Datadog.

**Project location:** `~/Code/kranz-tv`

---

## Core Concept

- YouTube playlists become "TV channels" with channel numbers
- A pure scheduling function maps `(channel, current_time) → (video_id, seek_seconds)`
- No on-demand playback — you "tune in" mid-show, just like real TV
- EPG-style TV guide grid shows what's on across all channels
- Retro CRT aesthetic with keyboard-driven channel surfing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (Vinxi/Nitro) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Player | YouTube IFrame API |
| Data | Static JSON presets + YouTube Data API v3 for metadata |
| Validation | Zod |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Observability | dd-trace (APM), @datadog/browser-rum, @datadog/browser-logs |
| Container | Docker + docker-compose (with DD Agent sidecar) |
| Orchestration | K8s manifests (optional) |
| Package manager | pnpm |

---

## Data Model

```typescript
interface Video {
  readonly id: string              // YouTube video ID
  readonly title: string
  readonly durationSeconds: number
  readonly thumbnailUrl: string
}

interface Channel {
  readonly id: string              // Slug: "ai-ml"
  readonly number: number          // Display: 2
  readonly name: string            // "AI & ML"
  readonly playlistId: string      // YouTube playlist ID
  readonly videos: ReadonlyArray<Video>
  readonly totalDurationSeconds: number
}

interface SchedulePosition {
  readonly video: Video
  readonly seekSeconds: number
  readonly slotStartTime: Date
  readonly slotEndTime: Date
}

interface EpgEntry {
  readonly video: Video
  readonly channelId: string
  readonly startTime: Date
  readonly endTime: Date
  readonly isCurrentlyPlaying: boolean
}
```

---

## Deterministic Scheduling Algorithm (Heart of the App)

```
getSchedulePosition(channel, timestamp) → { video, seekSeconds, slotStart, slotEnd }
```

1. **Normalize to seconds since midnight UTC**: `secSinceMidnight = (h * 3600) + (m * 60) + s`
2. **Add daily rotation seed**: `dayOffset = (daysSinceEpoch * 127) % totalDurationSeconds` — prevents same video at same time every day (127 is prime for good distribution)
3. **Find cycle position**: `cyclePos = (secSinceMidnight + dayOffset) % totalDurationSeconds`
4. **Walk playlist**: Accumulate video durations until `accumulated + video.duration > cyclePos`. That's the current video. Seek = `cyclePos - accumulated`.
5. **Compute slot times**: `slotStart = now - seekSeconds`, `slotEnd = slotStart + video.duration`

**Properties:** Pure function, no server state, runs identically on client and server, fully deterministic.

---

## Project Structure

```
~/Code/kranz-tv/
├── src/
│   ├── instrument.ts                 # dd-trace init (loaded first)
│   ├── entry-client.tsx              # Client entry + RUM init
│   ├── entry-server.tsx              # Server entry + dd-trace
│   ├── router.tsx                    # TanStack Router config
│   ├── routes/
│   │   ├── __root.tsx               # Root layout (dark theme, head tags)
│   │   ├── index.tsx                # Splash screen
│   │   ├── _tv.tsx                  # TV layout (player + guide split)
│   │   └── _tv.channel.$channelId.tsx
│   │   └── api/
│   │       └── channels.ts          # GET /api/channels
│   ├── lib/
│   │   ├── scheduling/
│   │   │   ├── types.ts
│   │   │   ├── algorithm.ts         # Core scheduler (TDD first!)
│   │   │   ├── time-utils.ts
│   │   │   └── epg-builder.ts
│   │   ├── channels/
│   │   │   ├── types.ts
│   │   │   ├── presets.ts           # 10-20 curated channels
│   │   │   └── youtube-api.ts       # Playlist data fetcher
│   │   ├── player/
│   │   │   └── youtube-iframe.ts    # YT IFrame API wrapper
│   │   ├── import/
│   │   │   ├── bookmarklet.ts
│   │   │   ├── schema.ts           # Zod validation
│   │   │   └── parser.ts
│   │   ├── storage/
│   │   │   └── local-channels.ts    # localStorage for custom channels
│   │   └── datadog/
│   │       ├── rum.ts, tracer.ts, metrics.ts, logger.ts
│   ├── components/
│   │   ├── splash-screen.tsx
│   │   ├── tv-player.tsx
│   │   ├── tv-guide/
│   │   │   ├── guide-grid.tsx, guide-row.tsx, time-header.tsx, guide-cell.tsx
│   │   ├── toolbar.tsx
│   │   ├── info-overlay.tsx
│   │   ├── import-wizard/
│   │   │   ├── import-modal.tsx, step-setup.tsx, step-import.tsx
│   │   └── keyboard-help.tsx
│   ├── hooks/
│   │   ├── use-keyboard-controls.ts
│   │   ├── use-current-program.ts
│   │   ├── use-channel-navigation.ts
│   │   └── use-local-storage.ts
│   └── styles/
│       ├── globals.css, tv-guide.css, animations.css
├── tests/
│   ├── unit/scheduling/, unit/import/
│   ├── integration/api/
│   └── e2e/
├── public/sounds/tv-on.mp3
├── Dockerfile
├── docker-compose.yml
├── k8s/
│   ├── deployment.yaml, service.yaml, configmap.yaml, ingress.yaml
└── .env.example
```

---

## Phased Implementation

### Phase 1: MVP — Scheduling + Playback + Guide ✅

**Goal: A working cable TV experience with 5-10 preset channels.**

1. ✅ **Project scaffolding** — TanStack Start + Vite + Tailwind + Vitest + ESLint/Prettier
2. ✅ **Data model + scheduling algorithm (TDD)** — Write tests first, then implement `getSchedulePosition()` and `buildEpgEntries()`
3. ✅ **Channel presets** — 12 hardcoded channels with video data fetched from YouTube API
4. ✅ **YouTube player component** — IFrame API, `start=seekSeconds`, handle video transitions
5. ✅ **Route structure** — Splash → TV layout → Channel view
6. ✅ **TV guide grid** — EPG with time header, channel rows, current-time indicator, click-to-tune
7. ✅ **Info overlay + toolbar** — Channel name/number, video title, time slot, keyboard hints
8. ✅ **Retro styling** — Dark CRT theme, retro fonts

### Phase 2: Polish — Import, Keyboard, UX

**Goal: Feature-complete matching Channel Surfer's UX.**

9. **Keyboard controls** — Arrow keys (channel), G (guide), M (mute), I (import), ? (help), Esc
10. **TV sound effects** — Turn-on sound (`public/sounds/tv-on.mp3`), optional channel switch sound
11. **Import system** — Three input methods:
    - Bookmarklet (`src/lib/import/bookmarklet.ts`) — drag to browser bar, click on any YouTube playlist page to send data to KranzTV
    - JSON paste — paste exported channel JSON directly into the import modal
    - YouTube playlist URL — enter a URL, fetch metadata via YouTube API, add as custom channel
    - Zod schema validation (`src/lib/import/schema.ts`) for all import payloads
    - Save to localStorage via `local-channels.ts`
    - Import wizard UI: `import-modal.tsx`, `step-setup.tsx`, `step-import.tsx`
12. **Channel expansion** — 20+ preset channels, YouTube API response caching (24h via localStorage)
13. **Share** — URL with `?channel=nature` param, JSON export of custom channels

### Phase 3: Deployment + Observability ✅

**Goal: Production-ready with best-in-class Datadog instrumentation.**

14. ✅ **dd-trace server APM** — `instrument.ts` loaded via `--require`, log injection, profiling
15. ✅ **Browser RUM** — Core Web Vitals, session replay (20%), APM trace correlation
16. ✅ **Browser Logs** — `@datadog/browser-logs`, forward errors
17. **Custom metrics** — DogStatsD: `kranz_tv.channel.switch`, `kranz_tv.video.playback`, `kranz_tv.viewers.active`
18. ✅ **RUM custom actions** — `channel_switch`, `guide_toggle`, `import_started`, `keyboard_shortcut`
19. ✅ **Docker** — Multi-stage Dockerfile, docker-compose with DD Agent sidecar, health checks
20. ✅ **K8s manifests** — Deployment, Service, Ingress, ConfigMap/Secrets, Unified Service Tags
21. **Dashboards** — Viewer Experience (RUM), Channel Analytics (custom metrics), Infrastructure

### Phase 4 (Future): Real-time + Social

22. **WebSocket viewer count** — `ws` library, per-channel heartbeat with reconnect logic, display live viewer count per channel in the guide and toolbar
23. **Shared custom channels** — Optional DB (Neon/Postgres) to persist and share custom channel configs across users
24. **Channel discovery** — Browse/search community-submitted playlists

---

## Keyboard Controls

| Key | Action |
|-----|--------|
| Arrow Up/Down | Change channel |
| G | Toggle guide |
| M | Mute/unmute |
| I | Import channels |
| ? | Keyboard shortcuts |
| Esc | Close modal |

---

## YouTube Integration

1. **Fetch playlist data**: YouTube Data API v3 `playlistItems.list` → get video IDs, then `videos.list` → get durations
2. **Embed player**: `new YT.Player()` with `autoplay: 1, controls: 0, start: seekSeconds, modestbranding: 1, rel: 0`
3. **Video transitions**: Call `player.loadVideoById({ videoId, startSeconds })` when scheduler detects next video
4. **Cache**: Fetch once at build/startup, cache 24h. YouTube API quota: ~40 units for 20 channels (10,000/day limit)

---

## Datadog Instrumentation Plan

**Server (dd-trace):**
- `NODE_OPTIONS="--require dd-trace/init"` in Docker
- `logInjection: true`, `runtimeMetrics: true`, `profiling: true`
- Custom spans wrapping YouTube API calls

**Client (RUM + Logs):**
- `allowedTracingUrls` connects browser traces to server APM
- `sessionReplaySampleRate: 20` for debugging
- Custom RUM actions for all user interactions
- `forwardErrorsToLogs: true`

**Custom Metrics (DogStatsD):**
- `kranz_tv.channel.switch` (counter, tags: from/to channel)
- `kranz_tv.video.playback` (counter, tags: channel, video_id)
- `kranz_tv.youtube_api.latency` (histogram, tags: endpoint)

**Dashboards:** Viewer Experience, Channel Analytics, Infrastructure

---

## Environment Variables

```bash
YOUTUBE_API_KEY=               # YouTube Data API v3
DD_API_KEY=                    # Datadog API key
DD_ENV=                        # local/staging/production
DD_SERVICE=kranz-tv
DD_VERSION=
DD_AGENT_HOST=
VITE_DD_RUM_APP_ID=
VITE_DD_RUM_CLIENT_TOKEN=
VITE_DD_ENV=
VITE_DD_VERSION=
WS_PORT=3001                   # Future: WebSocket server
```

---

## Verification

1. **Unit tests**: `pnpm test` — scheduling algorithm determinism, EPG builder, import schema validation
2. **Dev server**: `pnpm dev` — splash screen loads, click starts playback, guide shows schedule, channels switch
3. **Docker**: `docker compose up` — app + DD Agent running, traces appearing in Datadog APM
4. **E2E**: `pnpm test:e2e` — splash → playback, channel switching, guide navigation, keyboard controls
5. **Datadog**: Verify RUM sessions, APM traces, log correlation, custom metrics in Datadog UI
