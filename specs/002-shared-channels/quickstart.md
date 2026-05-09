# Quickstart — Shared Channels

This is a developer-facing how-to-run for the shared-channels feature. It assumes you already have a working KranzTV dev environment (`pnpm install`, `pnpm dev` works for the existing app).

## One-time setup

### 1. Create a Cloudflare KV namespace

```bash
# Production namespace
pnpm wrangler kv namespace create SHARED_CHANNELS_KV

# Local-dev preview namespace (used by `wrangler dev`)
pnpm wrangler kv namespace create SHARED_CHANNELS_KV --preview
```

Wrangler prints two namespace IDs. Add both to `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "SHARED_CHANNELS_KV",
      "id": "<production-id>",
      "preview_id": "<preview-id>",
    },
  ],
}
```

The `binding` name (`SHARED_CHANNELS_KV`) is what the server functions use; `env.SHARED_CHANNELS_KV.get(...)` etc.

### 2. Verify the binding locally

```bash
pnpm wrangler dev
# In another terminal, hit a publish endpoint via curl or via the app at http://localhost:8787
```

Wrangler dev binds a local SQLite-backed KV emulator — no remote calls in dev.

## Running tests

### Unit tests (pure helpers)

```bash
pnpm test -- --run tests/unit/shares/
```

These tests have no Cloudflare dependency. They cover `share-id.ts`, `share-credential.ts`, `share-url.ts`, and the Zod schemas.

### Integration tests (server functions with stub KV)

```bash
pnpm test -- --run tests/integration/api/shares.test.ts
```

These tests import the server function handlers directly and pass an in-memory KV stub via the request context. No `wrangler dev` required.

### E2E test (full publish + receive loop)

```bash
pnpm exec playwright test tests/e2e/shares.spec.ts
```

Spins up `wrangler dev` (the existing CI-friendly script `pnpm e2e:dev` does this) and exercises the UI: import a known YouTube playlist, click share, copy the URL, open it in a fresh browser context, verify the channel appears and tunes in.

## Manual smoke test

After deploying to staging:

1. Open the app, import any public YouTube playlist as a custom channel.
2. Click the **Share** button in the channel controls. Copy the URL from the toast.
3. Paste the URL into a private/incognito window. Confirm:
   - The channel loads within ~5 seconds.
   - It appears in the channel list.
   - It plays on the deterministic schedule.
4. Reload the incognito tab. Confirm no `/api/shares` calls happen on reload (DevTools → Network).
5. **Offline-after-receive verification**: in the incognito tab, open DevTools → Network → check "Offline". Reload the channel route directly (e.g., `/channel/share-AB12CD34`). The channel should still tune in normally — playback proceeds, EPG renders. Re-enable network when done.
6. Back in the original (sharer) window: revoke the share via the channel controls.
7. Open the share URL in a _third_ fresh browser. Confirm "channel unavailable" message.
8. The original incognito tab — which already received the channel — continues to work.

## Observability checks

After production deploy:

```bash
# Datadog: search RUM for the new actions
@action.name:share_publish_completed
@action.name:share_resolve_completed
@action.name:share_resolve_failed

# Datadog: check server metrics
kranz_tv.share.publish{outcome:success}
kranz_tv.share.resolve.95percentile (target: < 200ms)
```

The deploy is healthy when:

- `share_publish_failed{reason:kv_unavailable}` is near zero.
- `share_resolve_completed` matches the expected click-through rate from share publishes.
- p95 latencies for both operations are within the targets defined in `plan.md`.

## Common gotchas

- **Wrangler dev resets KV between sessions** unless you use `--persist`. For multi-day local testing, run `pnpm wrangler dev --persist`.
- **The `s.$shareId.tsx` route MUST NOT be statically prerendered** — it reads KV at request time. Prerendering would 404 every share. Verify after any TanStack Start config change.
- **Local credentials don't transfer between browsers**. Testing the "revoke as a different browser" path requires either two physical browsers, two profiles, or manually clearing localStorage.
- **The KV preview namespace is shared between all developers using `wrangler dev`** if the same `preview_id` is committed. For private-data testing, set a personal preview ID in `.dev.vars` (gitignored).

## What you do NOT need

- A YouTube API key on the server: server-side never calls YouTube.
- A separate backend project: everything lives in this repo.
- Cloudflare credentials in CI for unit/integration tests: only the E2E job needs them, and only against a dedicated CI namespace.
