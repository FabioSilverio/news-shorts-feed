import type { Channel } from "./channels";

export type ShortVideo = {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  durationSec: number;
};

const YT_API = "https://www.googleapis.com/youtube/v3";

/**
 * Parse ISO 8601 duration (e.g. "PT58S", "PT1M2S") to seconds.
 */
function parseISODuration(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");
  const url = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    // Cache at the edge for 5 minutes; client also auto-refetches.
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

type SearchListResponse = {
  items: Array<{
    id: { videoId?: string };
    snippet: {
      publishedAt: string;
      channelId: string;
      channelTitle: string;
      title: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
  }>;
};

type VideosListResponse = {
  items: Array<{
    id: string;
    contentDetails: { duration: string };
    snippet?: {
      title: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: { high?: { url: string }; medium?: { url: string } };
    };
  }>;
};

/**
 * Fetch latest videos for a single channel and filter to "Shorts" (<= 65s).
 */
export async function fetchChannelShorts(
  channel: Channel,
  perChannel = 15,
): Promise<ShortVideo[]> {
  // 1. Search latest videos for the channel
  const search = await ytFetch<SearchListResponse>("search", {
    part: "snippet",
    channelId: channel.id,
    maxResults: String(perChannel),
    order: "date",
    type: "video",
    videoDuration: "short", // < 4 min, Shorts will be in this bucket
  });

  const ids = search.items
    .map((it) => it.id.videoId)
    .filter((v): v is string => Boolean(v));

  if (ids.length === 0) return [];

  // 2. Get contentDetails to filter only true shorts (<= 65s)
  const details = await ytFetch<VideosListResponse>("videos", {
    part: "contentDetails,snippet",
    id: ids.join(","),
  });

  const byId = new Map(details.items.map((v) => [v.id, v]));

  const shorts: ShortVideo[] = [];
  for (const it of search.items) {
    const vid = it.id.videoId;
    if (!vid) continue;
    const detail = byId.get(vid);
    if (!detail) continue;
    const dur = parseISODuration(detail.contentDetails.duration);
    if (dur === 0 || dur > 65) continue; // filter to actual Shorts
    shorts.push({
      id: vid,
      title: it.snippet.title,
      channelId: it.snippet.channelId,
      channelTitle: it.snippet.channelTitle,
      publishedAt: it.snippet.publishedAt,
      thumbnail:
        it.snippet.thumbnails.high?.url ||
        it.snippet.thumbnails.medium?.url ||
        it.snippet.thumbnails.default?.url ||
        "",
      durationSec: dur,
    });
  }
  return shorts;
}

/**
 * Fetch shorts from many channels in parallel and interleave them.
 */
export async function fetchAllShorts(
  channels: Channel[],
  perChannel = 15,
): Promise<ShortVideo[]> {
  const results = await Promise.allSettled(
    channels.map((c) => fetchChannelShorts(c, perChannel)),
  );

  const buckets: ShortVideo[][] = results
    .map((r) => (r.status === "fulfilled" ? r.value : []))
    // sort each channel by recency, newest first
    .map((arr) =>
      [...arr].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() -
          new Date(a.publishedAt).getTime(),
      ),
    );

  // Interleave round-robin so feed mixes channels
  const merged: ShortVideo[] = [];
  let added = true;
  let i = 0;
  while (added) {
    added = false;
    for (const bucket of buckets) {
      if (bucket[i]) {
        merged.push(bucket[i]);
        added = true;
      }
    }
    i++;
  }

  return merged;
}
