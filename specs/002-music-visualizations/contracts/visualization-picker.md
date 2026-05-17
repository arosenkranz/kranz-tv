# Contract: Visualization Style Picker

**Type**: UI component + keybind + URL override
**Feature**: [Music Channel Visualizations](../spec.md)
**Date**: 2026-05-17

## Purpose

The visualization picker is the user-facing surface for choosing the active WebGL visualization style on music channels. It manifests on three surfaces:

1. **Info panel section** (desktop right-panel, visible when a music channel is active)
2. **Z keybind** (desktop keyboard, cycles to next style in order)
3. **Mobile toolbar button or overlay** (mobile, opens a bottom sheet or inline selector)

## Behavior Contract

### State

| Property        | Type               | Source         | Persisted |
| --------------- | ------------------ | -------------- | --------- |
| `activePreset`  | `VisualizerPreset` | `resolvePreset(searchParams)` | localStorage |
| `availableStyles` | `VisualizerStyleMeta[]` | `VISUALIZER_STYLES` (compile-time constant) | N/A |

### Actions

| Action | Trigger | Effect |
| ------ | ------- | ------ |
| `selectStyle(id)` | Click/tap a style in picker | Sets `activePreset = id`; calls `savePreset(id)`; calls `renderer.setPreset(id)`; emits `trackMusicBackdropSelected(id)` |
| `cycleStyle()` | Press `Z` | `selectStyle(nextInOrder(activePreset, VISUALIZER_PRESETS))` |
| `urlOverride(id)` | `?viz=<id>` in URL on load | Sets `activePreset = id` for session; does NOT call `savePreset` |
| `invalidFallback()` | Invalid persisted or URL `id` | `activePreset = DEFAULT_VISUALIZER`; no error thrown |

### Invariants

- The picker and Z keybind are only active when the route's active channel is `kind === 'music'`. When a YouTube channel is active, the picker is hidden and Z does nothing.
- Switching styles does NOT restart the audio. `renderer.setPreset(id)` swaps the WebGL program in-place; no canvas teardown.
- Only one `VisualizerRenderer` instance exists per music channel view. The renderer is created on mount and disposed on unmount.
- Style switching takes effect within the next animation frame (≤16ms at 60fps), well within the 2-second spec requirement (SC-003).

### Component API (draft)

```typescript
interface VisualizerPickerProps {
  activePreset: VisualizerPreset
  styles: readonly VisualizerStyleMeta[]
  onChange: (preset: VisualizerPreset) => void
}
```

The picker renders a compact grid or list:
- Each cell: `<button>` with `style={{ background: meta.previewGradient }}` thumbnail + `meta.displayName` label
- Active style: visually highlighted (border or check indicator)
- Reduced motion: thumbnails are static anyway (CSS gradients); no special handling needed

### Error states

| Condition | Behavior |
| --------- | -------- |
| WebGL2 not available | Canvas not rendered; static gradient backdrop shown; `trackMusicVisualizerFallback('webgl2-unavailable')` emitted; picker is still shown and operable (style preference is saved for future sessions where WebGL works) |
| WebGL context lost | Canvas transitions to static backdrop; picker remains; `trackMusicVisualizerFallback('context-lost')` emitted |
| Style not found in registry | `resolvePreset` returns `DEFAULT_VISUALIZER`; picker shows default as active |

## RUM events emitted by picker interactions

| Event | When | Properties |
| ----- | ---- | ---------- |
| `music_backdrop_selected` | `selectStyle(id)` called | `{ preset: id }` |
| `music_visualizer_start` | Canvas mounts + `renderer.start()` succeeds | `{ preset: activePreset, platform: 'mobile' \| 'desktop' }` |
| `music_visualizer_fallback` | WebGL2 init fails or context-lost path | `{ reason: 'webgl2-unavailable' \| 'context-lost' }` |
| `keyboard_shortcut` | Z key pressed | `{ key: 'z' }` (existing trackKeyboardShortcut) |
