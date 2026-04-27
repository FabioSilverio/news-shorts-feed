"use client";

import type { Channel } from "./channels";
import { DEFAULT_CHANNELS } from "./channels";

const KEY_WATCHED = "nsf:watched:v1";
const KEY_CHANNELS = "nsf:channels:v1";

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

// ---------- Channels ----------

export function loadChannels(): Channel[] {
  if (typeof window === "undefined") return DEFAULT_CHANNELS;
  try {
    const raw = localStorage.getItem(KEY_CHANNELS);
    if (!raw) return DEFAULT_CHANNELS;
    const arr = JSON.parse(raw) as Channel[];
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_CHANNELS;
    return arr;
  } catch {
    return DEFAULT_CHANNELS;
  }
}

export function saveChannels(channels: Channel[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_CHANNELS, JSON.stringify(channels));
  } catch {
    /* ignore */
  }
}
