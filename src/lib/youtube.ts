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

type VideoDurationFilter = "any" | "long" | "medium" | "short";

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
 * Fetch latest non-Shorts videos for a single channel (normal horizontal feed).
 */
export async function fetchChannelVideos(
  channel: Channel,
  perChannel = 12,
): Promise<ShortVideo[]> {
  const videos = await fetchChannelVideosByDuration(
    channel,
    perChannel,
    "medium",
  );

  if (videos.length > 0) return videos;

  return fetchChannelVideosByDuration(channel, perChannel, "long");
}

async function fetchChannelVideosByDuration(
  channel: Channel,
  perChannel: number,
  videoDuration: VideoDurationFilter,
): Promise<ShortVideo[]> {
  const search = await ytFetch<SearchListResponse>("search", {
    part: "snippet",
    channelId: channel.id,
    maxResults: String(perChannel),
    order: "date",
    type: "video",
    videoDuration,
  });

  const ids = search.items
    .map((it) => it.id.videoId)
    .filter((v): v is string => Boolean(v));

  if (ids.length === 0) return [];

  const details = await ytFetch<VideosListResponse>("videos", {
    part: "contentDetails,snippet",
    id: ids.join(","),
  });

  const byId = new Map(details.items.map((v) => [v.id, v]));
  const videos: ShortVideo[] = [];

  for (const it of search.items) {
    const vid = it.id.videoId;
    if (!vid) continue;
    const detail = byId.get(vid);
    if (!detail) continue;
    const dur = parseISODuration(detail.contentDetails.duration);
    if (dur <= 65) continue; // keep normal videos; shorts stay in the TikTok feed
    videos.push({
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
    if (videos.length >= perChannel) break;
  }

  return videos;
}

/**
 * Fetch shorts from many channels in parallel, then sort everything
 * by publishedAt descending so the feed is strictly chronological (newest first).
 */
export async function fetchAllShorts(
  channels: Channel[],
  perChannel = 15,
): Promise<ShortVideo[]> {
  const results = await Promise.allSettled(
    channels.map((c) => fetchChannelShorts(c, perChannel)),
  );

  const all: ShortVideo[] = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  // Global sort: newest first across all channels
  all.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return all;
}

/**
 * Fetch normal videos from many channels and sort newest first globally.
 */
export async function fetchAllVideos(
  channels: Channel[],
  perChannel = 12,
): Promise<ShortVideo[]> {
  const results = await Promise.allSettled(
    channels.map((c) => fetchChannelVideos(c, perChannel)),
  );

  const failures = results.filter((r) => r.status === "rejected");
  const all: ShortVideo[] = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  if (all.length === 0 && failures.length > 0) {
    const first = failures[0] as PromiseRejectedResult;
    const message =
      first.reason instanceof Error
        ? first.reason.message
        : "Failed to load horizontal videos";
    throw new Error(message);
  }

  all.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return all;
}
