# News Shorts

A TikTok-style vertical feed of YouTube Shorts from news channels (CNN, MSNBC, Fox News, BBC News, CBS News, NBC News by default).

- Vertical scroll-snap feed with autoplay on the active video
- Side menu to add/remove channels (saved in `localStorage`)
- Tracks watched videos so you don't see them again
- Auto-refreshes every 5 minutes (and a Vercel Cron warms the cache)

## Tech

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- YouTube Data API v3 (server-side)
- Deploy on Vercel

## Setup

1. Install deps:
   ```bash
   npm install
   ```

2. Get a YouTube Data API v3 key at https://console.cloud.google.com/apis/credentials and enable the YouTube Data API v3.

3. Create `.env.local`:
   ```env
   YOUTUBE_API_KEY=AIzaSy...
   # Optional, used to protect the cron endpoint:
   CRON_SECRET=any-random-string
   ```

4. Run:
   ```bash
   npm run dev
   ```

   Open http://localhost:3000

## How it works

- `src/lib/youtube.ts` — talks to YouTube Data API: `search.list` (latest videos per channel, `videoDuration=short`) → `videos.list` to filter by real Shorts duration (≤ 65s).
- `src/app/api/feed/route.ts` — the client calls this; returns interleaved short videos, cached for 5 min on the edge.
- `src/app/api/cron/refresh/route.ts` — invoked by Vercel Cron every 5 min (see `vercel.json`) to keep the cache warm.
- `src/components/Feed.tsx` — orchestrates state, scroll-snap container, IntersectionObserver to detect active video, refetches every 5 min on the client too.
- `src/components/VideoPlayer.tsx` — YouTube IFrame embed with `enablejsapi`; play/pause via `postMessage`. Marks video as watched after 3s of viewing.
- `src/components/Sidebar.tsx` — add/remove channels by YouTube channel ID (UC…).

## Deploy

```bash
# 1. Push to GitHub (already configured if you ran the gh commands)
# 2. Import the repo on https://vercel.com/new
# 3. Add env var YOUTUBE_API_KEY in Vercel project settings
# 4. (Optional) Add CRON_SECRET — same value here and in vercel.json bearer
```

The cron in `vercel.json` runs every 5 minutes on production deployments.

## Quota note

YouTube Data API v3 free tier: 10,000 units/day. Each feed fetch uses roughly:

- `search.list` × N channels = 100 × N units
- `videos.list` × 1 batch ≈ 1 unit

With 6 default channels: ~601 units per uncached fetch. Cron warms cache once per 5 minutes (~173k cached requests/day) at a cost of ~601 × 288 = 173k... wait, no — cron triggers a single warm fetch every 5 min, so ~6 × 100 = 600 units × 288 = ~173,000 units/day. **Too much.** In practice the cron + per-user fetches share the 5-min cache, so:

- 288 cron warms/day × ~601 units = 173k units/day → exceeds free quota.

**To stay under quota**, consider one of:
1. Reduce cron to every 15 min → drop `vercel.json` schedule to `*/15 * * * *` (~70k units/day, still over).
2. Or reduce default channels to 3 and cron to every 15 min (~35k/day, still over the 10k free tier).
3. Or just let the cache fill on demand (remove cron) — most efficient.

Recommended: **remove the cron** for personal use; the in-memory edge cache (5 min) is enough. Keep cron only if you have a paid YouTube quota or apply for higher limits.

## License

MIT
