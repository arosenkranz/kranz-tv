# Datadog query facts (verified 2026-07-30)

- RUM service: `kranz-tv`, env `production` (from event `tags`, e.g.
  `["env:production", "service:kranz-tv", "version:2.11.0", ...]` —
  `env` is not a top-level or `attributes.env` field in the raw event,
  it only appears in `tags`).
- Action name facet: `@action.target.name` (raw path
  `attributes.action.target.name`). Confirmed via a live
  `channel_build_time` custom action event. `attributes.action.name`
  holds the same value and would also work, but `action.target.name`
  is the canonical RUM facet path used by the Datadog UI/API.
  The old dashboards used `@action.name`, which is close but not the
  documented facet — prefer `@action.target.name` going forward.
- Custom action attributes (from `addAction(name, context)`) are
  queried as: `@context.<key>` (raw path `attributes.context.<key>`).
  This matches the brief's first hypothesis exactly — confirmed across
  10 distinct custom action types (`channel_build_time`,
  `player_resync`, `mobile_yt_one_tap`, `sc_channel_load`, `sc_cache`,
  `channel_switch`, `sc_realign`, `viz_preset_selected`,
  `music_visualizer_start`, `mobile_sc_autoplay`).
  **BROKEN PATTERN — baseline dashboards (15 occurrences across both
  files):** The old baseline widget specs use `@action.custom.<key>`
  (e.g., `@action.custom.channel_id`, `@action.custom.duration_ms`,
  `@action.custom.error_code`) in both `search.query` strings and
  `group_by[].facet` fields. This pattern does NOT resolve — use
  `@context.<key>` instead for all custom action attribute queries.
- **Key-casing is inconsistent across call sites** — this matters for
  any dashboard widget/monitor query built against a specific key:
  - snake_case: `channel_build_time` → `channel_id`, `duration_ms`,
    `video_count`; `channel_switch` → `from_channel`, `from_number`,
    `to_channel`, `to_number`.
  - camelCase: `sc_channel_load` → `channelId`, `durationMs`,
    `fromCache`; `sc_cache` → `channelId`, `outcome`; `sc_realign` →
    `channelId`, `driftSeconds`, `reason`, `trigger`.
  - Every custom action also carries a nested `viewer` object
    (`viewer.channel_count`, `viewer.device_type`) and a nested `git`
    object (`git.commit.sha`, currently always `"unknown"` in sampled
    events) — queried as `@context.viewer.<key>` /
    `@context.git.commit.sha` if ever needed.
  - The brief's example key `durationMs` is real (used by
    `sc_channel_load`), but `channel_build_time` uses `duration_ms`
    (snake_case) for the same concept — don't assume one casing
    applies to all actions; check the specific action's source before
    writing a query/monitor against it.
- `kranz_tv.server.*` metrics: submitted via HTTP API from the Worker
  (count + gauge → v2 series, latency → v1 distribution_points).
- **Dead-endpoint finding (2026-08-02):** the original server-metrics
  wiring (PR #106) instrumented `getChannels` in `src/routes/api/channels.ts`
  — post-merge verification found it had ZERO call sites (the client
  imports `CHANNEL_PRESETS` directly), so `channels_request` /
  `channels_ms` / `preset_channels` never emitted. The route was deleted
  and instrumentation moved to the routes with real traffic
  (`api/soundcloud.ts`, `api/youtube.ts`) via
  `src/lib/datadog/proxy-metrics.ts`. Current server metric names:
  - `kranz_tv.server.proxy_request` — count, tags
    `route:soundcloud|youtube`, `status:ok|error`
  - `kranz_tv.server.proxy_ms` — latency distribution, tag `route`
  The Reliability dashboard's Server Metrics section queries these
  (`sum:...proxy_request{*} by {route}.as_count()`, etc.). The old
  `channels_request`/`channels_ms`/`preset_channels` names are retired
  — do not build queries or monitors against them.
- `pup rum events` has no query flag — filter client-side.

## Monitors (created 2026-08-01, managed-by:repo)

- `310224556` — [KranzTV] Player errors spiking
  (`player_error` count > 5/1h; `docs/observability/monitors/player-error-spike.json`)
- `310224561` — [KranzTV] SoundCloud track repeatedly unplayable
  (`sc_track_unplayable` grouped by `@context.track_id`, >= 3/1d;
  `docs/observability/monitors/sc-track-unplayable-repeat.json`)
- `310224562` — [KranzTV] RUM telemetry absent — pipeline may be silently
  broken (`service:kranz-tv` count < 1/1d with notify_no_data; the API
  accepted the `< 1` comparator — no-data fallback not needed;
  `docs/observability/monitors/telemetry-absent-watchdog.json`)

Additional verified casing facts (2026-08-01, from `src/lib/datadog/rum.ts`
source — zero live events yet for these two actions across 1000 sampled
events/7d, they shipped v2.11.1/v2.11.2):

- `sc_track_unplayable` → snake_case: `channel_id`, `track_id`, `reason`,
  `source_url_correlation_id`, `retry_count` (unlike the camelCase `sc_*`
  load/cache/realign actions).
- `sc_early_finish` → snake_case: `channel_id`, `track_id`, `reason`,
  `shortfall_seconds`, `source_url_correlation_id`.
- `sc_realign` `reason` confirmed live (4 events in 7d sample).
- `player_error` confirmed live: `channel_id`, `error_code`, `video_id`.

## Sample raw event (channel_build_time)

```json
{
  "action": {
    "id": "800f7a5d-daea-44cb-b82f-99f8992b8bf7",
    "name": "channel_build_time",
    "target": { "name": "channel_build_time" },
    "type": "custom"
  },
  "context": {
    "channel_id": "bumbershoot-gardyloo",
    "duration_ms": 840.9999999999982,
    "git": { "commit": { "sha": "unknown" } },
    "video_count": 91,
    "viewer": { "channel_count": 35, "device_type": "mobile" }
  },
  "service": "kranz-tv",
  "type": "action"
}
```

(Full event stored during verification also contains standard RUM
envelope fields: `application`, `browser`, `device`, `display`, `geo`,
`os`, `session`, `tab`, `usr`, `view`, and `tags` with `env:production`.)
