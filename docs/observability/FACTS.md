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
- `pup rum events` has no query flag — filter client-side.

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
