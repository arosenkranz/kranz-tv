/**
 * Syncs observability/dashboard.json to Datadog.
 *
 * Idempotent: finds an existing dashboard by title and updates it,
 * or creates a new one if not found.
 *
 * Usage:
 *   DD_API_KEY=xxx DD_APP_KEY=xxx npx tsx scripts/sync-dashboard.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DD_API_BASE = 'https://api.datadoghq.com/api/v1'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function ddHeaders(apiKey: string, appKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'DD-API-KEY': apiKey,
    'DD-APPLICATION-KEY': appKey,
  }
}

async function findDashboardByTitle(
  title: string,
  apiKey: string,
  appKey: string,
): Promise<string | null> {
  const res = await fetch(`${DD_API_BASE}/dashboard`, {
    headers: ddHeaders(apiKey, appKey),
  })
  if (!res.ok) throw new Error(`Failed to list dashboards: ${res.status}`)

  const data = (await res.json()) as {
    dashboards?: Array<{ id: string; title: string }>
  }
  const match = data.dashboards?.find((d) => d.title === title)
  return match?.id ?? null
}

async function createDashboard(
  body: unknown,
  apiKey: string,
  appKey: string,
): Promise<string> {
  const res = await fetch(`${DD_API_BASE}/dashboard`, {
    method: 'POST',
    headers: ddHeaders(apiKey, appKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create dashboard (${res.status}): ${text}`)
  }
  const data = (await res.json()) as { id: string }
  return data.id
}

async function updateDashboard(
  id: string,
  body: unknown,
  apiKey: string,
  appKey: string,
): Promise<void> {
  const res = await fetch(`${DD_API_BASE}/dashboard/${id}`, {
    method: 'PUT',
    headers: ddHeaders(apiKey, appKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to update dashboard (${res.status}): ${text}`)
  }
}

async function main(): Promise<void> {
  const apiKey = requireEnv('DD_API_KEY')
  const appKey = requireEnv('DD_APP_KEY')

  const dashboardPath = join(
    import.meta.dirname,
    '../observability/dashboard.json',
  )
  const dashboard = JSON.parse(readFileSync(dashboardPath, 'utf-8')) as {
    title: string
  }

  console.log(`Syncing dashboard: "${dashboard.title}"`)

  const existingId = await findDashboardByTitle(dashboard.title, apiKey, appKey)

  if (existingId) {
    console.log(`Found existing dashboard (${existingId}), updating...`)
    await updateDashboard(existingId, dashboard, apiKey, appKey)
    console.log(`✓ Updated: https://app.datadoghq.com/dashboard/${existingId}`)
  } else {
    console.log('No existing dashboard found, creating...')
    const newId = await createDashboard(dashboard, apiKey, appKey)
    console.log(`✓ Created: https://app.datadoghq.com/dashboard/${newId}`)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
