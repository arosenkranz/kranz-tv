// Codebase invariant: schedule and display layers MUST NOT import the share
// client. Per constitution Principle I, the schedule is computed entirely from
// channel data (which is already resolved) — the share registry is data-only.
//
// If this test fails, someone has inadvertently coupled the display path to
// the registry. Find another way: pass any registry-derived data through
// `Channel.shareRef` instead, then re-run.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const PROJECT_ROOT = resolve(__dirname, '..', '..', '..')

const DECOUPLED_DIRS = [
  'src/lib/scheduling',
  'src/lib/epg',
  'src/components/epg-overlay',
  'src/components/info-panel',
  'src/components/tv-guide',
  'src/hooks/use-current-program.ts',
]

const FORBIDDEN_PATTERNS = [
  /from\s+['"]~?\/?(?:src\/)?lib\/shares\/share-client/,
  /from\s+['"]\.\.?\/.*shares\/share-client/,
]

function walkAndRead(target: string): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = []
  const stat = statSync(target)
  if (stat.isFile()) {
    out.push({ path: target, content: readFileSync(target, 'utf-8') })
    return out
  }
  for (const name of readdirSync(target)) {
    const full = join(target, name)
    if (statSync(full).isDirectory()) {
      out.push(...walkAndRead(full))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push({ path: full, content: readFileSync(full, 'utf-8') })
    }
  }
  return out
}

describe('Schedule + display layers stay decoupled from the share registry', () => {
  for (const relPath of DECOUPLED_DIRS) {
    const fullPath = resolve(PROJECT_ROOT, relPath)
    it(`${relPath} does not import share-client`, () => {
      const files = walkAndRead(fullPath)
      const offenders: string[] = []
      for (const { path, content } of files) {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(content)) {
            offenders.push(path)
            break
          }
        }
      }
      expect(
        offenders,
        `Files importing share-client: ${offenders.join(', ')}`,
      ).toEqual([])
    })
  }
})
