"use client";

import { useEffect, useRef, useState } from "react";
import type { ShortVideo } from "@/lib/youtube";

type Props = {
  video: ShortVideo;
  active: boolean;
  onWatched: (id: string) => void;
};

/**
 * One full-screen short. Uses YouTube IFrame embed.
 * Auto-plays when `active` is true (visible in viewport).
 */
export default function VideoPlayer({ video, active, onWatched }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const watchedSent = useRef(false);

  // Mount the iframe lazily once it becomes active for the first time.
  useEffect(() => {
    if (active && !loaded) setLoaded(true);
  }, [active, loaded]);

  // When active, play; otherwise pause via postMessage.
  useEffect(() => {
    if (!loaded) return;
    const f = iframeRef.current;
    if (!f) return;
    const cmd = active ? "playVideo" : "pauseVideo";
    f.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: cmd, args: [] }),
      "*",
    );
  }, [active, loaded]);

  // Mark as watched after 3s of being active.
  useEffect(() => {
    if (!active || watchedSent.current) return;
    const t = setTimeout(() => {
      watchedSent.current = true;
      onWatched(video.id);
    }, 3000);
    return () => clearTimeout(t);
  }, [active, video.id, onWatched]);

  const src = `https://www.youtube.com/embed/${video.id}?autoplay=${
    active ? 1 : 0
  }&playsinline=1&modestbranding=1&rel=0&controls=1&enablejsapi=1&loop=1&playlist=${video.id}`;

  return (
    <section className="relative h-dvh w-full snap-start snap-always bg-black">
      {/* Thumbnail behind iframe (instant feedback while loading) */}
      {video.thumbnail && (
        <img
          src={video.thumbnail}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60 blur-xl"
          aria-hidden
        />
      )}

      <div className="relative mx-auto flex h-full max-w-[480px] items-center justify-center">
        {loaded ? (
          <iframe
            ref={iframeRef}
            src={src}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Overlay info */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pb-8">
        <div className="text-sm font-semibold uppercase tracking-wide text-white/80">
          {video.channelTitle}
        </div>
        <h2 className="mt-1 line-clamp-3 text-base font-medium text-white">
          {video.title}
        </h2>
        <div className="mt-1 text-xs text-white/60">
          {new Date(video.publishedAt).toLocaleString()}
        </div>
      </div>
    </section>
  );
}
