import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Asserts that the share-related routes are NOT statically prerendered.
// Both routes read runtime state — `s.$shareId.tsx` calls `resolveShare` which
// hits Cloudflare KV; `api/shares.ts` exposes server functions that mutate KV.
// Prerendering either would 404 at runtime or serve stale data.
//
// The test runs against the production build output. If the build hasn't run
// yet, the test is skipped with a hint — CI runs `pnpm build` before tests so
// this guard catches accidental prerender regressions in CI specifically.

const PROJECT_ROOT = resolve(__dirname, '..', '..')
const OUTPUT_DIR = resolve(PROJECT_ROOT, '.output', 'public')

const FORBIDDEN_PATHS = [
  // Recipient landing route — must read KV at request time.
  's',
  // Server-function route — must execute at request time.
  join('api', 'shares'),
]

function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return []
  const entries: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = full.slice(base.length + 1)
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full, base))
    } else {
      entries.push(rel)
    }
  }
  return entries
}

describe('Build configuration: share routes are not prerendered', () => {
  if (!existsSync(OUTPUT_DIR)) {
    it.skip('skipped — run `pnpm build` first to populate .output/public/', () => {})
    return
  }

  const allFiles = walk(OUTPUT_DIR)

  it('no static HTML emitted for /s/<shareId>', () => {
    const offenders = allFiles.filter(
      (f) => f.startsWith('s/') || f === 's.html' || f === 's/index.html',
    )
    expect(offenders).toEqual([])
  })

  it('no static HTML emitted for /api/shares', () => {
    const offenders = allFiles.filter(
      (f) => f.startsWith('api/shares') || f === 'api/shares.html',
    )
    expect(offenders).toEqual([])
  })

  it('prerender manifest (if present) does not list share routes', () => {
    const manifestPath = resolve(PROJECT_ROOT, '.output', 'nitro.json')
    if (!existsSync(manifestPath)) return
    const manifest = readFileSync(manifestPath, 'utf-8')
    for (const path of FORBIDDEN_PATHS) {
      expect(
        manifest.includes(`"/${path}"`),
        `prerender manifest contains "/${path}" — route must be dynamic`,
      ).toBe(false)
    }
  })
})
