# KranzTV

A retro cable TV experience that turns YouTube playlists into live channels. Videos play on a deterministic schedule based on wall-clock time — everyone watching the same channel sees the same video at the same moment, just like real TV.

Inspired by [Channel Surfer](https://channelsurfer.tv/).

---

## How It Works

The core idea is a **pure scheduling function**:

```
getSchedulePosition(channel, timestamp) → { video, seekSeconds, slotStart, slotEnd }
```

1. Compute seconds elapsed since midnight UTC
2. Add a daily rotation seed `(daysSinceEpoch * 127) % totalDuration` — prevents the same video playing at the same time every day (127 is prime for good distribution)
3. Walk the playlist until the accumulated duration exceeds the cycle position
4. Return the current video and how many seconds in we are

Because it's a pure function with no server state, it runs identically on the client and server. No database, no sync, no on-demand playback — you tune in mid-show.

---

## Tech Stack

| Layer           | Technology                                |
| --------------- | ----------------------------------------- |
| Framework       | TanStack Start (Vinxi/Nitro)              |
| Language        | TypeScript (strict)                       |
| Styling         | Tailwind CSS v4                           |
| Player          | YouTube IFrame API                        |
| Data            | Static presets + YouTube Data API v3      |
| Validation      | Zod                                       |
| Testing         | Vitest (233 tests)                        |
| Observability   | dd-trace (APM) + Datadog Browser RUM/Logs |
| Container       | Docker + docker-compose                   |
| Orchestration   | K8s manifests                             |
| Package manager | pnpm                                      |

---

## Getting Started

```bash
cd ~/Code/kranz-tv
cp .env.example .env
pnpm install
pnpm dev
```

Open http://localhost:3000.

Without a YouTube API key, the player uses a 3-video mock channel so you can still test the UI and scheduling logic.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in what you need:

```bash
# Required for live channel data (VITE_ prefix exposes it to browser code)
VITE_YOUTUBE_API_KEY=

# Datadog APM (server-side)
DD_API_KEY=
DD_ENV=local
DD_SERVICE=kranz-tv
DD_VERSION=0.1.0
DD_AGENT_HOST=localhost

# Datadog Browser RUM (optional)
VITE_DD_RUM_APP_ID=
VITE_DD_RUM_CLIENT_TOKEN=
VITE_DD_ENV=local
VITE_DD_VERSION=0.1.0
```

---

## Keyboard Controls

| Key       | Action                  |
| --------- | ----------------------- |
| `↑` / `↓` | Change channel          |
| `G`       | Toggle TV guide         |
| `M`       | Mute / unmute           |
| `I`       | Import custom channels  |
| `?`       | Show keyboard shortcuts |
| `Esc`     | Close modal             |

---

## Project Structure

```
src/
├── lib/
│   ├── scheduling/
│   │   ├── types.ts          # Video, Channel, SchedulePosition, EpgEntry
│   │   ├── algorithm.ts      # Core scheduler — pure function
│   │   ├── time-utils.ts     # UTC helpers
│   │   └── epg-builder.ts    # Build EPG window for TV guide
│   ├── channels/
│   │   ├── presets.ts        # 12 curated channel presets
│   │   └── youtube-api.ts    # YouTube Data API v3 client
│   ├── player/
│   │   └── youtube-iframe.ts # YT IFrame API wrapper
│   ├── storage/
│   │   └── local-channels.ts # Custom channels via localStorage
│   └── datadog/
│       ├── tracer.ts         # Server APM (dd-trace)
│       ├── rum.ts            # Browser RUM + custom actions
│       └── logger.ts         # Browser log forwarding
├── components/
│   ├── tv-player.tsx         # YouTube player component
│   ├── info-overlay.tsx      # Channel/video info HUD
│   ├── toolbar.tsx           # Bottom bar with controls
│   ├── keyboard-help.tsx     # Keyboard shortcuts modal
│   └── tv-guide/
│       ├── guide-grid.tsx    # Full EPG grid
│       ├── guide-row.tsx     # Single channel row
│       ├── guide-cell.tsx    # Single program cell
│       └── time-header.tsx   # Time axis with now-indicator
├── hooks/
│   ├── use-current-program.ts    # Live schedule position (1s tick)
│   ├── use-channel-navigation.ts # Next/prev channel via router
│   ├── use-keyboard-controls.ts  # Global keyboard bindings
│   └── use-local-storage.ts      # SSR-safe localStorage hook
└── routes/
    ├── index.tsx                        # Splash screen
    ├── _tv.tsx                          # TV layout (70/30 split)
    ├── _tv.channel.$channelId.tsx       # Channel view
    └── api/channels.ts                  # GET /api/channels
```

---

## Commands

```bash
pnpm dev          # Dev server at http://localhost:3000
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm test         # Run all tests
pnpm lint         # ESLint
pnpm check        # Prettier + ESLint fix
```

---

## Docker

```bash
# Run app + Datadog Agent sidecar
docker compose up

# Build image only
docker build -t kranz-tv .
```

Requires `DD_API_KEY` in your environment.

The DD Agent sidecar handles APM trace collection, DogStatsD metrics, and log aggregation. `dd-trace` is initialized via `--require dd-trace/init` in the container CMD.

> **Note:** `dd-trace` native modules (`@datadog/native-metrics`, `@datadog/pprof`) require interactive approval via `pnpm approve-builds`. The tracer works without them; you just won't get runtime heap/GC metrics.

---

## Datadog Observability

### Server APM

- Auto-instrumented HTTP, DNS, and fetch via `dd-trace`
- Log injection for trace correlation

### Browser RUM

- Core Web Vitals, session replay (20% sample rate)
- Custom actions: `channel_switch`, `guide_toggle`, `import_started`, `keyboard_shortcut`
- APM trace correlation via `allowedTracingUrls`

### Metrics

Custom DogStatsD metrics (when DD Agent is running):

- `kranz_tv.channel.switch` — counter, tagged `from_channel` / `to_channel`
- `kranz_tv.video.playback` — counter, tagged `channel`, `video_id`

---

## Channels

12 curated preset channels, each backed by a real public YouTube playlist:

| #   | Channel    | Topic                        |
| --- | ---------- | ---------------------------- |
| 1   | Nature     | BBC Earth wildlife           |
| 2   | Space      | NASA videos                  |
| 3   | Retro Tech | Vintage computers            |
| 4   | Jazz       | Live jazz performances       |
| 5   | TED Talks  | Ideas worth spreading        |
| 6   | Lo-Fi      | Study/chill music            |
| 7   | Cooking    | Food & recipes               |
| 8   | Travel     | Geography & destinations     |
| 9   | Science    | Kurzgesagt explainers        |
| 10  | Comedy     | Sketch comedy                |
| 11  | History    | Historical documentaries     |
| 12  | Classical  | Classical music performances |

---

## What's Next (Phase 2)

- Import system — paste a YouTube playlist URL or JSON to add custom channels
- TV turn-on sound effect
- URL sharing with channel param
- Export custom channels as JSON
- WebSocket viewer count per channel
