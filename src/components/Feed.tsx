"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel } from "@/lib/channels";
import type { ShortVideo } from "@/lib/youtube";
import {
  loadChannels,
  loadQueue,
  loadWatched,
  saveChannels,
  saveQueue,
  saveWatched,
} from "@/lib/storage";
import VideoPlayer from "./VideoPlayer";
import Sidebar from "./Sidebar";
import HorizontalFeed from "./HorizontalFeed";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

type ApiResponse = {
  videos: ShortVideo[];
  fetchedAt: number;
  error?: string;
};

function buildSessionQueue(
  latestVideos: ShortVideo[],
  watchedIds: Set<string>,
  hideWatched: boolean,
  channels: Channel[],
) {
  if (!hideWatched) return latestVideos;

  const selectedChannelIds = new Set(channels.map((c) => c.id));
  const latestUnwatched = latestVideos.filter((v) => !watchedIds.has(v.id));
  const latestIds = new Set(latestUnwatched.map((v) => v.id));

  // Persisted queue = unwatched videos from previous sessions. It comes after
  // today's freshest uploads, preserving where the user left off.
  const carryOver = loadQueue().filter(
    (v) =>
      selectedChannelIds.has(v.channelId) &&
      !watchedIds.has(v.id) &&
      !latestIds.has(v.id),
  );

  const nextQueue = [...latestUnwatched, ...carryOver];
  saveQueue(nextQueue);

  // If the user watched everything, don't leave the page blank.
  return nextQueue.length > 0 ? nextQueue : latestVideos;
}

export default function Feed() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  // `videos` = raw data from API
  // `sessionVideos` = what's shown in the feed this session (stable, doesn't change when
  //  individual videos get marked as watched mid-playback — only updates on new fetch or
  //  when the user manually toggles hideWatched)
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [sessionVideos, setSessionVideos] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [section, setSection] = useState<"shorts" | "horizontal">("shorts");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hideWatched, setHideWatched] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollToTopOnNextRebuild = useRef(true);
  // Ref so we can read the current watched set inside effects without adding it as a dep
  const watchedRef = useRef(watched);
  watchedRef.current = watched;

  // Load persisted state on mount
  useEffect(() => {
    setChannels(loadChannels());
    setWatched(loadWatched());
  }, []);

  const fetchFeed = useCallback(
    async (chans: Channel[], scrollToTop = false) => {
      setError(null);
      try {
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channels: chans }),
        });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        scrollToTopOnNextRebuild.current = scrollToTop;
        setVideos(data.videos);
        setLastFetchedAt(data.fetchedAt);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Initial + when channels change
  useEffect(() => {
    if (channels.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchFeed(channels, true);
  }, [channels, fetchFeed]);

  // Auto-refresh every 5min
  useEffect(() => {
    if (channels.length === 0) return;
    const id = setInterval(() => fetchFeed(channels, false), REFRESH_MS);
    return () => clearInterval(id);
  }, [channels, fetchFeed]);

  // Refetch when tab becomes visible after >5min
  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "visible") return;
      if (!lastFetchedAt) return;
      if (Date.now() - lastFetchedAt > REFRESH_MS) {
        fetchFeed(channels, false);
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [channels, fetchFeed, lastFetchedAt]);

  // Rebuild the session list ONLY when new videos arrive from the API or when
  // the user flips the hideWatched toggle. Never rebuilds because of mid-session
  // watched updates — that's the key fix to stop the feed from jumping.
  useEffect(() => {
    if (videos.length === 0) {
      setSessionVideos([]);
      return;
    }
    const list = buildSessionQueue(
      videos,
      watchedRef.current,
      hideWatched,
      channels,
    );
    setSessionVideos(list);
    if (scrollToTopOnNextRebuild.current) {
      scrollToTopOnNextRebuild.current = false;
      setActiveIdx(0);
      containerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [videos, hideWatched, channels]); // intentionally excludes `watched`

  // IntersectionObserver to detect active video
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.idx ?? -1,
            );
            if (idx >= 0) setActiveIdx(idx);
          }
        }
      },
      { root, threshold: [0, 0.6, 1] },
    );
    itemRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sessionVideos]);

  const handleWatched = useCallback((id: string) => {
    setWatched((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveWatched(next);
      saveQueue(loadQueue().filter((v) => v.id !== id));
      return next;
    });
  }, []);

  const updateChannels = useCallback((next: Channel[]) => {
    setChannels(next);
    saveChannels(next);
  }, []);

  const resetWatched = useCallback(() => {
    const empty = new Set<string>();
    setWatched(empty);
    saveWatched(empty);
  }, []);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-black">
      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="pointer-events-auto rounded-full bg-black/50 p-2.5 backdrop-blur hover:bg-black/70"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="pointer-events-auto rounded-full bg-black/60 p-1 text-xs backdrop-blur">
          <button
            onClick={() => setSection("shorts")}
            className={`rounded-full px-3 py-1.5 font-semibold transition ${
              section === "shorts"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white"
            }`}
          >
            TikTok
          </button>
          <button
            onClick={() => setSection("horizontal")}
            className={`rounded-full px-3 py-1.5 font-semibold transition ${
              section === "horizontal"
                ? "bg-white text-black"
                : "text-white/70 hover:text-white"
            }`}
          >
            Horizontais
          </button>
        </div>
        {section === "shorts" ? (
          <button
            onClick={() => {
              scrollToTopOnNextRebuild.current = true;
              setHideWatched((v) => !v);
            }}
            className={`pointer-events-auto rounded-full px-3 py-1.5 text-xs backdrop-blur ${
              hideWatched ? "bg-white text-black" : "bg-black/50 text-white"
            }`}
            title={hideWatched ? "Hiding watched videos" : "Showing all videos"}
          >
            {hideWatched ? "Hide watched" : "Show all"}
          </button>
        ) : (
          <div className="w-[88px]" />
        )}
      </header>

      {/* Feed */}
      {section === "horizontal" && <HorizontalFeed channels={channels} />}

      {section === "shorts" && loading && (
        <div className="flex h-full w-full items-center justify-center text-white/60">
          Loading feed…
        </div>
      )}

      {section === "shorts" && !loading && error && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-red-300">Failed to load feed</div>
          <pre className="max-w-full overflow-auto rounded bg-white/5 p-3 text-xs text-white/70">
            {error}
          </pre>
          <button
            onClick={() => fetchFeed(channels, true)}
            className="rounded bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Retry
          </button>
        </div>
      )}

      {section === "shorts" && !loading && !error && sessionVideos.length === 0 && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-white/70">
            No videos found. Add channels from the menu.
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Open menu
          </button>
        </div>
      )}

      {section === "shorts" && !loading && !error && sessionVideos.length > 0 && (
        <div
          ref={containerRef}
          className="no-scrollbar h-full w-full snap-y snap-mandatory overflow-y-scroll"
        >
          {sessionVideos.map((v, idx) => (
            <div
              key={v.id}
              data-idx={idx}
              ref={(el) => {
                if (el) itemRefs.current.set(idx, el);
                else itemRefs.current.delete(idx);
              }}
            >
              <VideoPlayer
                video={v}
                active={idx === activeIdx}
                onWatched={handleWatched}
              />
            </div>
          ))}
        </div>
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        channels={channels}
        onChange={updateChannels}
        watchedCount={watched.size}
        onResetWatched={resetWatched}
      />
    </div>
  );
}
