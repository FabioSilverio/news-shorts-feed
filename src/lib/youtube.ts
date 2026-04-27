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

type ChannelsListResponse = {
  items: Array<{
    id: string;
    contentDetails: {
      relatedPlaylists: { uploads?: string };
    };
  }>;
};

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      resourceId?: { kind?: string; videoId?: string };
    };
  }>;
};

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

const VIDEO_ID_CHUNK = 50;
/** YouTube channel RSS is ~15 items; we must paginate the uploads playlist instead. */
const MAX_UPLOADS_TO_SCAN = 200;
/** How many channel fetches run at once to reduce 403 / quota bursts on serverless. */
const SHORTS_FETCH_CONCURRENCY = 4;
const RSS_MAX_SHORTS = 15;
const SEARCH_CANDIDATES = 50;

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

async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  const data = await ytFetch<ChannelsListResponse>("channels", {
    part: "contentDetails",
    id: channelId,
  });
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

async function detailsMapFromIds(
  orderedIds: string[],
): Promise<Map<string, VideosListResponse["items"][0]>> {
  const byId = new Map<string, VideosListResponse["items"][0]>();
  for (let i = 0; i < orderedIds.length; i += VIDEO_ID_CHUNK) {
    const chunk = orderedIds.slice(i, i + VIDEO_ID_CHUNK);
    if (chunk.length === 0) break;
    const details = await ytFetch<VideosListResponse>("videos", {
      part: "contentDetails,snippet",
      id: chunk.join(","),
    });
    for (const item of details.items ?? []) {
      byId.set(item.id, item);
    }
  }
  return byId;
}

function shortsFromDetailsMap(
  orderedIds: string[],
  byId: Map<string, VideosListResponse["items"][0]>,
  perChannel: number,
): ShortVideo[] {
  const shorts: ShortVideo[] = [];
  for (const vid of orderedIds) {
    if (shorts.length >= perChannel) break;
    const detail = byId.get(vid);
    if (!detail) continue;
    const dur = parseISODuration(detail.contentDetails.duration);
    if (dur === 0 || dur > 65) continue;
    const sn = detail.snippet;
    if (!sn) continue;
    shorts.push({
      id: vid,
      title: sn.title,
      channelId: sn.channelId,
      channelTitle: sn.channelTitle,
      publishedAt: sn.publishedAt,
      thumbnail:
        sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || "",
      durationSec: dur,
    });
  }
  return shorts;
}

async function fetchChannelShortsFromRss(
  channel: Channel,
  perChannel: number,
): Promise<ShortVideo[]> {
  const url = new URL(YT_RSS);
  url.searchParams.set("channel_id", channel.id);
  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const candidates = parseYoutubeRss(await res.text(), channel).slice(0, RSS_MAX_SHORTS);
  if (candidates.length === 0) return [];
  const byId = await detailsMapFromIds(candidates.map((c) => c.id));
  return shortsFromDetailsMap(
    candidates.map((c) => c.id),
    byId,
    perChannel,
  );
}

async function fetchChannelShortsFromSearch(
  channel: Channel,
  perChannel: number,
): Promise<ShortVideo[]> {
  const search = await ytFetch<SearchListResponse>("search", {
    part: "snippet",
    channelId: channel.id,
    maxResults: String(SEARCH_CANDIDATES),
    order: "date",
    type: "video",
    videoDuration: "short",
  });
  const ids = (search.items ?? [])
    .map((it) => it.id.videoId)
    .filter((v): v is string => Boolean(v));
  if (ids.length === 0) return [];
  const byId = await detailsMapFromIds(ids);
  return shortsFromDetailsMap(ids, byId, perChannel);
}

/**
 * Video IDs in upload order (newest first) from the channel uploads playlist.
 */
async function listUploadVideoIds(
  uploadsPlaylistId: string,
  maxItems: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < maxItems) {
    const data = await ytFetch<PlaylistItemsResponse>("playlistItems", {
      part: "snippet",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    for (const it of data.items ?? []) {
      const vid = it.snippet?.resourceId?.videoId;
      if (vid) ids.push(vid);
      if (ids.length >= maxItems) break;
    }

    if (ids.length >= maxItems) break;
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return ids;
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

/**
 * True Shorts (≤ 65s): uploads playlist (best depth), then RSS, then `search` if needed.
 * Failures in an earlier step fall through so a burst 403 on one call does not empty the whole feed.
 */
export async function fetchChannelShorts(
  channel: Channel,
  perChannel = 15,
): Promise<ShortVideo[]> {
  // 1) Uploads playlist — walk past the ~15-item RSS cap
  try {
    const uploads = await getUploadsPlaylistId(channel.id);
    if (uploads) {
      const orderedIds = await listUploadVideoIds(uploads, MAX_UPLOADS_TO_SCAN);
      if (orderedIds.length > 0) {
        const byId = await detailsMapFromIds(orderedIds);
        const s = shortsFromDetailsMap(orderedIds, byId, perChannel);
        if (s.length > 0) return s;
      }
    }
  } catch {
    // quota / network — try cheaper paths
  }

  // 2) RSS (no search quota) — at least 15 most recent video IDs
  try {
    const s = await fetchChannelShortsFromRss(channel, perChannel);
    if (s.length > 0) return s;
  } catch {
    /* ignore */
  }

  // 3) Search API — 100 units; last resort
  try {
    return await fetchChannelShortsFromSearch(channel, perChannel);
  } catch {
    return [];
  }
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
  const all: ShortVideo[] = [];
  for (let i = 0; i < channels.length; i += SHORTS_FETCH_CONCURRENCY) {
    const slice = channels.slice(i, i + SHORTS_FETCH_CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map((c) => fetchChannelShorts(c, perChannel)),
    );
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value);
    }
  }

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
