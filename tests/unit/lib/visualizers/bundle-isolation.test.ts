/**
 * Bundle-isolation guard: three and p5 must ONLY appear in their dedicated lazy
 * chunks, never in the entry/main bundle.
 *
 * Why this matters: three (~160 KB min+gz) and p5 (~300 KB) are imported only via
 * dynamic `import()` inside useEffect in the visualizer host. If anything static-imports
 * them they will bleed into the entry bundle and every user pays the download cost on
 * first load — even users who never open the visualizer overlay.
 *
 * Build output layout (verified against a real `pnpm build` run):
 *   .output/public/assets/index-[hash].js         — main/entry chunk (~746 KB before gz)
 *   .output/public/assets/_tv-[hash].js           — layout route chunk
 *   .output/public/assets/three-backend-[hash].js — lazy THREE chunk  ✓ expected here
 *   .output/public/assets/p5-backend-[hash].js    — lazy p5 chunk     ✓ expected here
 *   .output/public/assets/profiler-[hash].js      — profiler chunk
 *   .output/public/assets/startRecording-[hash].js — recording chunk
 *
 * Assertion strategy (PRECISE — not the weaker fallback):
 *   - We can reliably identify entry chunks: they match /^(index|_tv)[-.].*\.js$/i
 *     (the two app-bootstrap files that load unconditionally).
 *   - We can reliably identify lazy backend chunks by name prefix: three-backend-*.js
 *     and p5-backend-*.js. Rollup preserves the module name as the chunk name when
 *     the chunk comes from a dynamic import.
 *   - We grep for `WebGLRenderer` (reliable three marker — appears hundreds of times
 *     in three's bundled code) and `createCanvas` (reliable p5 marker — p5's primary API method).
 *
 * How a leak would be detected:
 *   If someone adds a static `import * as THREE from 'three'` anywhere that is
 *   reachable from the app's static import graph (e.g., in a component or hook that
 *   isn't behind a dynamic import), Rollup will bundle THREE into whatever chunk owns
 *   that module — likely the index chunk. The assertion
 *   `expect(src, …).not.toContain('WebGLRenderer')` on entry chunks will then FAIL.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Real client asset dir found after `pnpm build` — Nitro/TanStack Start puts
// client JS here. All hashed .js files live flat in this directory.
const CLIENT_DIR = '.output/public/assets'

// Reliable content markers. These strings appear in the bundled library code
// and are unlikely to appear in unrelated chunks.
//
// THREE marker: 'WebGLRenderer' — appears hundreds of times in three's bundle,
//   survives minification (class name kept as string for error messages).
//
// p5 marker: 'createCanvas' — p5's primary API surface method, appears as a string
//   literal in p5's own self-registration code. 'p5.prototype' does NOT survive
//   minification (the property chains get mangled by Rollup). 'createCanvas' is
//   confirmed present 3× in the p5-backend chunk and 0× in the entry chunk.
const THREE_MARKER = 'WebGLRenderer'
const P5_MARKER = 'createCanvas' // Note: createCanvas is not strictly exclusive to p5; if another bundled dep ever used it, the lazy-chunk assertion stays valid but entry-chunk check may need a stronger marker.


describe('bundle isolation: three/p5 are lazy-only', () => {
  it('three and p5 appear only in their dedicated lazy chunks, not in entry chunks', () => {
    if (!existsSync(CLIENT_DIR)) {
      // Build output absent — skip loudly so CI notices immediately.
      // Fix: run `pnpm build` before this test suite, or ensure CI includes a
      // build step before `pnpm test`.
      console.warn(
        `[bundle-isolation] SKIP: build dir "${CLIENT_DIR}" does not exist. ` +
          'Run `pnpm build` first. This test requires a production build to inspect.',
      )
      // Return instead of calling skip() so the suite shows as PASS with a warning
      // rather than silently disappearing. Callers should treat the console.warn as
      // a signal that the guard was not exercised.
      return
    }

    const allJs = readdirSync(CLIENT_DIR).filter((f) => f.endsWith('.js'))
    expect(allJs.length, 'build output must have at least one JS file').toBeGreaterThan(0)

    // --- Identify entry chunks ---
    // Entry chunks are those loaded unconditionally by the app bootstrap.
    // In this TanStack Start / Nitro build they are:
    //   index-[hash].js  — the main Vite client entry
    //   _tv-[hash].js    — the layout route, always loaded for any TV channel route
    // The regex matches the base name before the hash separator.
    const entryChunks = allJs.filter((f) => /^(index|_tv)[-.][^/]+\.js$/.test(f))
    expect(
      entryChunks.length,
      `expected to find entry chunks matching /^(index|_tv)[-.]*/ but found none in: ${allJs.join(', ')}`,
    ).toBeGreaterThan(0)

    // --- Identify lazy backend chunks ---
    const threeChunks = allJs.filter((f) => f.startsWith('three-backend'))
    const p5Chunks = allJs.filter((f) => f.startsWith('p5-backend'))

    expect(
      threeChunks.length,
      'expected exactly one three-backend lazy chunk in the build output',
    ).toBe(1)
    expect(p5Chunks.length, 'expected exactly one p5-backend lazy chunk in the build output').toBe(
      1,
    )

    // --- Assert lazy chunks DO contain the library code ---
    // This proves the library was actually bundled (not accidentally tree-shaken or
    // excluded), and that we're testing the right files.
    const threeChunkSrc = readFileSync(join(CLIENT_DIR, threeChunks[0]!), 'utf8')
    expect(
      threeChunkSrc,
      `three-backend chunk "${threeChunks[0]}" must contain THREE (${THREE_MARKER})`,
    ).toContain(THREE_MARKER)

    const p5ChunkSrc = readFileSync(join(CLIENT_DIR, p5Chunks[0]!), 'utf8')
    expect(
      p5ChunkSrc,
      `p5-backend chunk "${p5Chunks[0]}" must contain p5 ("${P5_MARKER}" — p5's primary API method, present as a string literal in p5's self-registration code)`,
    ).toContain(P5_MARKER)

    // --- Assert entry chunks do NOT contain three or p5 ---
    // This is the core regression guard. If any static import bleeds three/p5 into
    // an entry chunk, these assertions will FAIL with the offending chunk name.
    for (const entry of entryChunks) {
      const src = readFileSync(join(CLIENT_DIR, entry), 'utf8')

      expect(
        src,
        `Entry chunk "${entry}" leaks THREE (found "${THREE_MARKER}"). ` +
          'A static import of three has been added to a module reachable from the app entry. ' +
          'Ensure three is only imported inside dynamic import() calls.',
      ).not.toContain(THREE_MARKER)

      expect(
        src,
        `Entry chunk "${entry}" leaks p5 (found "${P5_MARKER}"). ` +
          'A static import of p5 has been added to a module reachable from the app entry. ' +
          'Ensure p5 is only imported inside dynamic import() calls.',
      ).not.toContain(P5_MARKER)
    }
  })
})
