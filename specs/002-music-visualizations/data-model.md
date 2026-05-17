# Data Model: Music Channel Visualizations

**Date**: 2026-05-17 | **Plan**: [plan.md](./plan.md)

## VisualizerPreset (expanded type union)

**Location**: `src/lib/visualizers/types.ts`

```typescript
export type VisualizerPreset =
  | 'spectrum'
  | 'kaleidoscope'
  | 'plasma'
  | 'starfield'
  | 'retrowave'
  | 'sacred-geometry'

export const VISUALIZER_PRESETS: readonly VisualizerPreset[] = [
  'spectrum',
  'kaleidoscope',
  'plasma',
  'starfield',
  'retrowave',
  'sacred-geometry',
]

export const DEFAULT_VISUALIZER: VisualizerPreset = 'spectrum'
export const VISUALIZER_STORAGE_KEY = 'kranz-tv:music-visualizer'
export const VISUALIZER_PARAM = 'viz'
```

**Breaking changes from prior type**:
- `'particles'` removed (was never a real shader; was a spectrum fallback)
- `'oscilloscope'` removed (same)
- `'plasma'`, `'starfield'`, `'retrowave'`, `'sacred-geometry'` added

**Migration**: Any stale `localStorage['kranz-tv:music-visualizer']` value of `'particles'` or `'oscilloscope'` will fail the `isVisualizerPreset` check and fall back to `'spectrum'` — the existing `resolvePreset` already handles this gracefully (FR-017).

---

## VisualizerStyleMeta (new)

**Location**: `src/lib/visualizers/types.ts`

```typescript
export interface VisualizerStyleMeta {
  readonly id: VisualizerPreset
  readonly displayName: string
  readonly previewGradient: string   // CSS `background` value for picker thumbnail
}

export const VISUALIZER_STYLES: readonly VisualizerStyleMeta[] = [
  {
    id: 'spectrum',
    displayName: 'Spectrum',
    previewGradient: 'linear-gradient(to top, #ff0088 0%, #00ffcc 50%, #0033ff 100%)',
  },
  {
    id: 'kaleidoscope',
    displayName: 'Kaleidoscope',
    previewGradient: 'conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #ff00ff)',
  },
  {
    id: 'plasma',
    displayName: 'Plasma',
    previewGradient: 'radial-gradient(ellipse at 30% 60%, #ff6060 0%, #cc00aa 40%, #1a0a2e 100%)',
  },
  {
    id: 'starfield',
    displayName: 'Starfield',
    previewGradient: 'radial-gradient(ellipse at center, #ffffff 0%, #334 20%, #000011 100%)',
  },
  {
    id: 'retrowave',
    displayName: 'Retrowave Grid',
    previewGradient: 'linear-gradient(to bottom, #ff69b4 0%, #1a0a2e 60%, #00c8ff 100%)',
  },
  {
    id: 'sacred-geometry',
    displayName: 'Sacred Geometry',
    previewGradient: 'radial-gradient(ellipse at center, #c8a032 0%, #1a1000 70%, #000 100%)',
  },
]
```

**Key attributes**:
- `id`: Stable identifier matching `VisualizerPreset` union. Used for localStorage persistence, URL param, and `SHADER_SOURCES` key.
- `displayName`: Human-readable label for picker UI.
- `previewGradient`: CSS `background` string representing the style's visual character. Used as `style={{ background: style.previewGradient }}` on picker thumbnail `<div>`.

---

## VisualizerRendererCallbacks (extended)

**Location**: `src/lib/visualizers/renderer.ts` (interface imported from `src/lib/overlays/shader-quad-renderer.ts`)

```typescript
// Extend existing ShaderQuadCallbacks in renderer.ts:
export type VisualizerRendererCallbacks = ShaderQuadCallbacks & {
  onStart?: (preset: VisualizerPreset) => void
  onFallback?: (reason: 'webgl2-unavailable' | 'context-lost') => void
}
```

**Usage**:
- `onStart(preset)` — fired after successful WebGL2 init and first `renderer.start()` call. Used by `MusicVisualizerCanvas` to emit `trackMusicVisualizerStart` RUM action.
- `onFallback(reason)` — fired when WebGL2 context creation throws (reason: `'webgl2-unavailable'`) or when `onContextRestored` fails to get a new context (reason: `'context-lost'`). Used by `MusicVisualizerCanvas` to emit `trackMusicVisualizerFallback` RUM action and to toggle a `hasFallback` state that shows the static gradient backdrop instead of the canvas.

---

## Active selection (no new entity — existing mechanism)

**Location**: `src/lib/visualizers/preset.ts` (no structural change, only `isVisualizerPreset` needs to pick up the new type union automatically since it calls `VISUALIZER_PRESETS.includes(value)`)

**Persistence**: `localStorage['kranz-tv:music-visualizer']` → `VisualizerPreset` string
**URL override**: `?viz=<id>` → session-only, does not write to storage
**Fallback**: Invalid value → `DEFAULT_VISUALIZER` (`'spectrum'`)

---

## Entities NOT added

- No new fields on `MusicChannelPreset` or `MusicChannel` — style is a viewer-global preference, not a channel attribute.
- No server storage — preferences are client-side only.
- No new route parameters — `?viz=` URL param already exists in `preset.ts`.
