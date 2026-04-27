"use client";

import type { Channel } from "./channels";
import { DEFAULT_CHANNELS } from "./channels";
import type { ShortVideo } from "./youtube";

const KEY_WATCHED = "nsf:watched:v1";
const KEY_CHANNELS = "nsf:channels:v1";
const KEY_CHANNELS_DEFAULTS_VERSION = "nsf:channels-defaults-version:v1";
const KEY_QUEUE = "nsf:queue:v1";
const CHANNELS_DEFAULTS_VERSION = "2026-04-27-extra-news-channels";

// ---------- Watched videos ----------

export function loadWatched(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY_WATCHED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function saveWatched(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Cap size so localStorage doesn't blow up over time.
    const arr = Array.from(ids).slice(-5000);
    localStorage.setItem(KEY_WATCHED, JSON.stringify(arr));
  } catch {
    /* ignore quota errors */
  }
}

// ---------- Persistent unwatched queue ----------

export function loadQueue(): ShortVideo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_QUEUE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ShortVideo[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveQueue(videos: ShortVideo[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_QUEUE, JSON.stringify(videos.slice(0, 1000)));
  } catch {
    /* ignore quota errors */
  }
}

// ---------- Channels ----------

export function loadChannels(): Channel[] {
  if (typeof window === "undefined") return DEFAULT_CHANNELS;
  try {
    const raw = localStorage.getItem(KEY_CHANNELS);
    if (!raw) {
      localStorage.setItem(
        KEY_CHANNELS_DEFAULTS_VERSION,
        CHANNELS_DEFAULTS_VERSION,
      );
      return DEFAULT_CHANNELS;
    }
    const arr = JSON.parse(raw) as Channel[];
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_CHANNELS;

    const defaultsVersion = localStorage.getItem(KEY_CHANNELS_DEFAULTS_VERSION);
    if (defaultsVersion !== CHANNELS_DEFAULTS_VERSION) {
      const existingIds = new Set(arr.map((c) => c.id));
      const merged = [
        ...arr,
        ...DEFAULT_CHANNELS.filter((c) => !existingIds.has(c.id)),
      ];
      localStorage.setItem(KEY_CHANNELS, JSON.stringify(merged));
      localStorage.setItem(
        KEY_CHANNELS_DEFAULTS_VERSION,
        CHANNELS_DEFAULTS_VERSION,
      );
      return merged;
    }

    return arr;
  } catch {
    return DEFAULT_CHANNELS;
  }
}

export function saveChannels(channels: Channel[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_CHANNELS, JSON.stringify(channels));
    localStorage.setItem(
      KEY_CHANNELS_DEFAULTS_VERSION,
      CHANNELS_DEFAULTS_VERSION,
    );
  } catch {
    /* ignore */
  }
}
