# RUM tracker coverage sweep

Method: for every exported `track*`/`set*` helper in
`src/lib/datadog/rum.ts`, grepped `src/` (excluding `rum.ts` itself)
for real call sites, then cross-referenced the 7-day live RUM audit
(`docs/observability/FACTS.md`) for action names actually observed
firing. Helpers with zero call sites outside `rum.ts` and its tests
were deleted (YAGNI) rather than spec-wired, per the task brief's
default. Date: 2026-08-01.

## Firing (seen in the 7-day live audit)

| Helper | Action name | Call site(s) |
| --- | --- | --- |
| `trackChannelBuildTime` | `channel_build_time` | `src/lib/channels/youtube-api.ts:77` |
| `trackScCacheEvent` | `sc_cache` | `src/lib/storage/preset-channel-cache.ts:106`, `src/routes/_tv.tsx:550` |
| `trackScChannelLoad` | `sc_channel_load` | `src/routes/_tv.tsx:470` |
| `trackChannelSwitch` | `channel_switch` | `src/routes/_tv.channel.$channelId.tsx:145` |
| `trackSwipeChannelChange` | `swipe_channel_change` | `src/components/mobile/mobile-view.tsx:126,132` |
| `trackScRealign` | `sc_realign` | `src/lib/sources/soundcloud/sc-widget-context.tsx:498,502` |
| `trackPlayerError` | `player_error` | `src/components/tv-player.tsx:184` |
| `trackPlayerResync` | `player_resync` | `src/components/tv-player.tsx:131` |
| `trackVizPresetSelected` | `viz_preset_selected` | `src/components/visualizer-host.tsx:117` |
| `trackMusicVisualizerStart` | `music_visualizer_start` | `src/components/music-channel-view.tsx:99` |
| `trackMusicBackdropSelected` | `music_backdrop_selected` | `src/routes/_tv.tsx:225` |
| `trackMobileScAutoplay` | `mobile_sc_autoplay` | `src/components/music-channel-view.tsx:120,122` |
| `trackMobileYtOneTap` | `mobile_yt_one_tap` | `src/components/mobile/mobile-player-area.tsx:196` |
| `trackGuideSheetOpen` | `guide_sheet_open` | `src/components/mobile/mobile-view.tsx:140` |
| `trackOverlayChange` | `overlay_change` | `src/routes/_tv.tsx:738` |

## Wired-but-rare (real call site, plausibly rare — keep)

| Helper | Action name | Call site(s) | Why rare |
| --- | --- | --- | --- |
| `trackGuideToggle` | `guide_toggle` | `src/routes/_tv.tsx:619` | Desktop-only guide open/close toggle |
| `trackImportStarted` | `import_started` | `src/routes/_tv.tsx:626` | Fires only when import wizard opened |
| `trackKeyboardShortcut` | `keyboard_shortcut` | `src/routes/_tv.channel.$channelId.tsx:511` | Keyboard-only usage path |
| `trackExportChannels` | `export_channels` | `src/components/import-wizard/manage-tab.tsx:174` | Manage-tab export action, low frequency |
| `trackImportJson` | `import_json` | `src/components/import-wizard/manage-tab.tsx:196` | JSON re-import path, rare |
| `trackImportComplete` | `import_complete` | `src/lib/import/import-channel.ts:28,40,59,63,70,78,105,111,119` | Fires per import attempt; imports are infrequent |
| `trackShareChannel` | `share_channel` | `src/routes/_tv.tsx:867`, `src/routes/_tv.channel.$channelId.tsx:232` | Share action, low frequency |
| `trackLandscapeFullscreen` | `landscape_fullscreen` | `src/components/mobile/mobile-view.tsx:121` | Mobile landscape rotation only |
| `trackViewModeChange` | `view_mode_change` | `src/routes/_tv.tsx:340` | Theater/fullscreen toggle, infrequent |
| `trackEpgChannelSelect` | `epg_channel_select` | `src/components/epg-overlay/epg-overlay.tsx:73,83` | EPG overlay selection, one of several nav paths |
| `setViewerContext` | (global context, not an action) | `src/routes/_tv.tsx:785` | Sets context properties once per session, not an action event |
| `trackScChannelFailed` | `sc_channel_failed` | `src/routes/_tv.tsx:502` | Error path for SC channel load failure |
| `trackScChannelRetry` | `sc_channel_retry` | `src/routes/_tv.channel.$channelId.tsx:206` | Retry path, only fires on transient failure |
| `trackScTrackUnplayable` | `sc_track_unplayable` | `src/lib/sources/soundcloud/sc-widget-context.tsx:262,511` | Error path (deleted/geo-blocked/non-streamable tracks) |
| `trackScEarlyFinish` | `sc_early_finish` | `src/lib/sources/soundcloud/sc-widget-context.tsx:289,365` | Edge case: stream ends before scheduled slot |
| `trackMusicVisualizerFallback` | `music_visualizer_fallback` | `src/components/music-channel-view.tsx:107` | WebGL2-unavailable/context-lost fallback, rare |
| `trackVizFallback` | `viz_fallback` | `src/components/visualizer-host.tsx:58` | Same fallback condition as above, visualizer-host path |

## Orphaned (zero call sites — deleted)

| Helper | Action name | Disposition |
| --- | --- | --- |
| `trackYouTubeApiLatency` | `youtube_api_latency` | Deleted from `src/lib/datadog/rum.ts` and its tests in `tests/unit/datadog/rum-tracking.test.ts`. Also referenced by a widget in `docs/observability/dashboards/reliability.json` ("YouTube API Latency (ms) by Endpoint") — widget removed and the adjacent "Channel Build Time" widget widened to fill the row; `reliability.baseline.json` left untouched. Pushed live via `pup dashboards update mr2-f6c-cbc` on 2026-08-01. |
| `trackMobileToolbarAction` | `mobile_toolbar_action` | Deleted from `rum.ts`; had no test coverage to remove. No dashboard references. |
| `trackMusicChannelPlay` | `music_channel_play` | Deleted from `rum.ts` and its tests in `rum-tracking.test.ts`. No dashboard references. |
| `trackMusicChannelImport` | `music_channel_import` | Deleted from `rum.ts` and its tests in `rum-tracking.test.ts`. No dashboard references. |
| `trackVizLazyLoad` | `viz_lazy_load` | Deleted from `rum.ts` and its test in `tests/unit/datadog/rum-viz.test.ts`. No dashboard references. |

`viewer-behavior.json` was checked for all five orphaned action names —
no references found, no changes needed there.
