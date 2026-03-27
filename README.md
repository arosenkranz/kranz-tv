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
| Testing         | Vitest                                    |
| Observability   | dd-trace (APM) + Datadog Browser RUM/Logs |
| Container       | Docker + docker-compose                   |
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
| `N`       | Now playing info        |
| `H`       | Go home                 |
| `F`       | Toggle fullscreen       |
| `V`       | Cycle overlay effect    |
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
│   │   ├── presets.ts        # 6 curated channel presets
│   │   └── youtube-api.ts    # YouTube Data API v3 client
│   ├── import/
│   │   ├── parser.ts         # Extract playlist ID from URL or bare ID
│   │   ├── schema.ts         # Zod form schema, channelToPreset, getNextChannelNumber
│   │   └── import-channel.ts # Fetch playlist + video details, return ImportResult
│   ├── player/
│   │   └── youtube-iframe.ts # YT IFrame API wrapper
│   ├── storage/
│   │   ├── local-channels.ts     # Custom channels via localStorage
│   │   └── preset-channel-cache.ts # 24h TTL cache for preset channel data
│   └── datadog/
│       ├── tracer.ts         # Server APM (dd-trace)
│       ├── rum.ts            # Browser RUM + custom actions
│       └── logger.ts         # Browser log forwarding
├── components/
│   ├── tv-player.tsx         # YouTube player component
│   ├── keyboard-help.tsx     # Keyboard shortcuts modal
│   ├── epg-overlay/
│   │   ├── epg-overlay.tsx       # Full-screen or inline EPG container
│   │   ├── epg-overlay-header.tsx # Header with self-ticking clock
│   │   ├── epg-row.tsx           # Single channel row
│   │   ├── epg-cell.tsx          # Single program cell
│   │   └── epg-time-header.tsx   # Time axis with now-indicator
│   ├── info-panel/
│   │   └── info-panel.tsx        # Desktop right-panel with channel/video info
│   └── import-wizard/
│       └── import-modal.tsx      # Import custom channel modal
├── hooks/
│   ├── use-current-program.ts    # Live schedule position (1s tick)
│   ├── use-channel-navigation.ts # Next/prev channel via router
│   ├── use-keyboard-controls.ts  # Global keyboard bindings
│   ├── use-is-desktop.ts         # Media query hook for 1024px+ breakpoint
│   ├── use-is-mobile.ts          # Media query hook for mobile breakpoint
│   └── use-local-storage.ts      # SSR-safe localStorage hook
└── routes/
    ├── index.tsx                        # Splash screen
    ├── _tv.tsx                          # TV layout — three-panel (desktop) or full-width (tablet/fullscreen)
    ├── _tv.channel.$channelId.tsx       # Channel view
    └── api/channels.ts                  # Server function (call getChannels() directly from client)
```

---

## Layout

On **desktop** (1024px+, normal mode): three-panel layout — video (left 2/3) + info panel (right 1/3) + inline EPG guide (bottom, toggleable with G).

On **tablet** or in **fullscreen**: full-width video only. Guide opens as a full-screen overlay.

On **mobile**: simplified layout with player, now-playing bar, and channel list.

---

## YouTube API & Quota

Channel data is fetched from the YouTube Data API v3 using `VITE_YOUTUBE_API_KEY`. Requests are batched (up to 50 video IDs per call) to minimize quota usage.

**Caching:** Fetched channel data is stored in localStorage with a 24-hour TTL. An in-memory Map prevents duplicate fetches within a session.

**Quota exhaustion:** If the API returns a 403 quota error, the app switches all channels to a 3-video mock playlist and displays a "Technical Difficulties" banner. The quota flag auto-clears after the YouTube daily reset (midnight PT). You can test this state with `?quota_test=1` in the URL.

**No API key:** The app runs fully without a key using mock channel data — useful for testing UI and scheduling logic.

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

6 curated preset channels, each backed by a real public YouTube playlist:

| #   | Channel          | Topic                             |
| --- | ---------------- | --------------------------------- |
| 1   | Skate Vids       | Skateboarding clips and edits     |
| 2   | Music Videos     | Music videos from the collection  |
| 3   | Party Background | Background vibes for any occasion |
| 4   | Favorites        | All-time favorite videos          |
| 5   | Entertainment    | Entertainment picks from the web  |
| 6   | Club Krünz       | The club never closes             |

Custom channels can be added by pasting any YouTube playlist URL via the Import button (`I`).

---

## What's Next

- TV turn-on sound effect
- URL sharing with channel param
- Export custom channels as JSON
- WebSocket viewer count per channel
