"use client";

import { useCallback, useEffect, useState } from "react";
import type { Channel } from "@/lib/channels";
import type { ShortVideo } from "@/lib/youtube";

const REFRESH_MS = 5 * 60 * 1000;

type ApiResponse = {
  videos: ShortVideo[];
  fetchedAt: number;
  error?: string;
};

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HorizontalFeed({ channels }: { channels: Channel[] }) {
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    if (channels.length === 0) {
      setVideos([]);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setVideos(data.videos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [channels]);

  useEffect(() => {
    setLoading(true);
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    const id = setInterval(fetchVideos, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchVideos]);

  return (
    <main className="h-full overflow-y-auto bg-black pt-16 text-white">
      <div className="mx-auto w-full max-w-3xl px-3 pb-8 sm:px-4">
        <div className="mb-4 rounded-2xl bg-neutral-950 p-4 shadow-xl ring-1 ring-white/10">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-red-400">
            Videos horizontais
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Mural de videos dos canais
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Videos normais dos mesmos canais cadastrados, em ordem cronologica: mais recentes primeiro.
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl bg-neutral-950 p-6 text-center text-sm text-white/50 shadow-xl ring-1 ring-white/10">
            Carregando videos...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl bg-neutral-950 p-6 text-center shadow-xl ring-1 ring-white/10">
            <div className="font-semibold text-red-400">Falha ao carregar</div>
            <pre className="mt-3 overflow-auto rounded bg-white/5 p-3 text-left text-xs text-white/70">
              {error}
            </pre>
            <button
              onClick={fetchVideos}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="rounded-2xl bg-neutral-950 p-6 text-center text-sm text-white/50 shadow-xl ring-1 ring-white/10">
            Nenhum video horizontal encontrado nos canais selecionados.
          </div>
        )}

        <div className="space-y-4">
          {videos.map((video) => (
            <article
              key={video.id}
              className="overflow-hidden rounded-2xl bg-neutral-950 shadow-xl ring-1 ring-white/10"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {video.channelTitle}
                  </div>
                  <div className="text-xs text-white/50">
                    {timeAgo(video.publishedAt)} · {new Date(video.publishedAt).toLocaleString()}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/70">
                  {formatDuration(video.durationSec)}
                </span>
              </div>

              <div className="aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${video.id}?playsinline=1&modestbranding=1&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>

              <div className="p-4">
                <h2 className="text-base font-semibold leading-snug">
                  {video.title}
                </h2>
                <a
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
                >
                  Abrir no YouTube
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
