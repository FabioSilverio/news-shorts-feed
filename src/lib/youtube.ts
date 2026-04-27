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
const YT_RSS = "https://www.youtube.com/feeds/videos.xml";

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

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : "";
}

function readXmlAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`));
  return match ? decodeXml(match[1]) : "";
}

function parseYoutubeRss(xml: string, channel: Channel): ShortVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];

  return entries.flatMap((entry) => {
    const id = readXmlTag(entry, "yt:videoId");
    if (!id) return [];

    return [
      {
        id,
        title: readXmlTag(entry, "title"),
        channelId: readXmlTag(entry, "yt:channelId") || channel.id,
        channelTitle: readXmlTag(entry, "name") || channel.name,
        publishedAt: readXmlTag(entry, "published") || readXmlTag(entry, "updated"),
        thumbnail: readXmlAttr(entry, "media:thumbnail", "url"),
        durationSec: 0,
      },
    ];
  });
}

/** How many recent uploads to scan for Shorts (RSS = newest first). */
const RSS_SCAN_FOR_SHORTS = 50;

/**
 * Fetch latest videos for a single channel and filter to "Shorts" (<= 65s).
 *
 * Uses the channel upload RSS feed (newest first) + `videos.list` for duration.
 * The Search API with `videoDuration: "short"` has been unreliable for actual
 * Shorts vs chronology; RSS matches the horizontal feed and stays current.
 */
export async function fetchChannelShorts(
  channel: Channel,
  perChannel = 15,
): Promise<ShortVideo[]> {
  const url = new URL(YT_RSS);
  url.searchParams.set("channel_id", channel.id);

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube RSS failed (${res.status}): ${body}`);
  }

  const xml = await res.text();
  const candidates = parseYoutubeRss(xml, channel).slice(0, RSS_SCAN_FOR_SHORTS);
  if (candidates.length === 0) return [];

  const byId = new Map<string, VideosListResponse["items"][0]>();
  for (let i = 0; i < candidates.length; i += 50) {
    const chunk = candidates.slice(i, i + 50);
    const details = await ytFetch<VideosListResponse>("videos", {
      part: "contentDetails,snippet",
      id: chunk.map((c) => c.id).join(","),
    });
    for (const item of details.items) {
      byId.set(item.id, item);
    }
  }

  const shorts: ShortVideo[] = [];
  for (const cand of candidates) {
    if (shorts.length >= perChannel) break;
    const detail = byId.get(cand.id);
    if (!detail) continue;
    const dur = parseISODuration(detail.contentDetails.duration);
    if (dur === 0 || dur > 65) continue;

    const sn = detail.snippet;
    shorts.push({
      id: cand.id,
      title: sn?.title ?? cand.title,
      channelId: sn?.channelId ?? cand.channelId,
      channelTitle: sn?.channelTitle ?? cand.channelTitle,
      publishedAt: sn?.publishedAt ?? cand.publishedAt,
      thumbnail:
        sn?.thumbnails?.high?.url ||
        sn?.thumbnails?.medium?.url ||
        cand.thumbnail ||
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
  const url = new URL(YT_RSS);
  url.searchParams.set("channel_id", channel.id);

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube RSS failed (${res.status}): ${body}`);
  }

  const xml = await res.text();
  return parseYoutubeRss(xml, channel).slice(0, perChannel);
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
