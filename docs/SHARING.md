# Shared Channels

KranzTV lets you share custom channels with anyone via short URLs like `/s/AB12CD34`. The recipient opens the link, the channel is added to their local list, and they tune in to the same deterministic schedule you do.

## How it works

When you share a custom channel, KranzTV publishes a small record to a registry — just the playlist URL, the channel name, and a description. The registry never knows what's currently playing on any channel; the schedule is computed in your browser from the channel data, exactly the same way preset channels work.

After someone opens a share URL once, their browser caches the channel locally. Subsequent visits never touch the registry — the channel keeps working even if the registry is unreachable.

## Publishing a share

1. Import a custom YouTube playlist or SoundCloud playlist as a channel (use the **Import** button or press `I`).
2. Open the channel.
3. Click the **SHARE** button in the top-right corner.
4. The share URL is copied to your clipboard.

Sharing the same channel twice from the same browser produces the same URL — re-sharing is idempotent.

## Receiving a share

Open a `/s/<id>` URL in any browser. KranzTV will:

1. Look up the share record.
2. Fetch the playlist details from YouTube or SoundCloud (using your local API key).
3. Add the channel to your local channels list.
4. Redirect you to the channel page.

If the share doesn't exist or has been revoked, you'll see a "this channel is no longer available" message.

## Revoking a share

1. Open the channel you previously shared.
2. The same button now reads **REVOKE**.
3. Click it and confirm.

After ~60 seconds (Cloudflare KV's eventual-consistency window), new visitors won't be able to receive the share. Recipients who already imported the channel keep their local copy — revoke does not reach into anyone else's browser.

## What gets stored where

| Data                        | Where                       | Why                                                                                    |
| --------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Share record (URL + name)   | Cloudflare KV               | So recipients can look up the share.                                                   |
| Sharer credential           | Your browser's localStorage | Proves you're the original sharer (so only you can revoke). Never leaves your browser. |
| Custom channel + `shareRef` | Your browser's localStorage | So the channel appears in your guide and works offline.                                |

The sharer credential is generated automatically the first time you share something. If you clear your browser data, you lose the ability to revoke any shares you previously published — the records remain, but you can't manage them anymore.

## Limits

- **10 publishes per hour per browser**: prevents accidental abuse. Resolves and revokes have no rate limit.
- **80 character channel name, 280 character description**.
- **Share IDs are 8 characters** (Crockford base32, no I/L/O/U), giving 40 bits of entropy.

## Privacy

- The registry only stores what you provide: the source URL, the name, the description, plus a one-way hash of your sharer credential (so we can verify revoke requests without storing the credential itself).
- The registry never sees: who's watching, what's playing, when you tuned in, or anything about the recipient.
- Anyone with a share URL can receive it. Treat share URLs like a "public link" — there are no per-recipient permissions in v1.

## Observability

Server-side metrics published to Datadog:

- `kranz_tv.share.publish` — counter, tagged `outcome:success|rate_limited|invalid|kv_error`
- `kranz_tv.share.resolve` — counter, tagged `outcome:hit|miss|revoked|kv_error`
- `kranz_tv.share.revoke` — counter, tagged `outcome:success|unauthorized|not_found|kv_error`
- `kranz_tv.share.publish_ms` / `resolve_ms` / `revoke_ms` — latency histograms

Browser RUM actions:

- `share_publish_started` / `share_publish_completed` (with `is_new` tag) / `share_publish_failed` (with `reason`)
- `share_resolve_started` / `share_resolve_completed` / `share_resolve_failed`
- `share_revoke_completed` / `share_revoke_failed`

A success-rate monitor on `kranz_tv.share.publish{outcome:success}` should alert if the rate falls below 95% over a 1-hour rolling window. See `infra/monitors/shares.json` for the monitor JSON.

## Why eventual-consistency on revoke is OK

Cloudflare KV propagates writes globally over ~60 seconds. After you revoke, a new visitor at a far-away edge might still successfully resolve the share for up to a minute. We accept this tradeoff because:

- The window is brief.
- Recipients who already imported the channel keep working — revoke is for _new_ visitors only.
- KV's eventual-consistency model gives us free-tier scalability that strong-consistency stores (D1, Durable Objects) wouldn't.

If your revoke is time-sensitive (e.g., you accidentally shared a private playlist), wait the ~60 seconds, then verify by opening the share URL in an incognito window.
