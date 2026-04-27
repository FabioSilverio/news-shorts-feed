"use client";

import { useState } from "react";
import type { Channel } from "@/lib/channels";
import { DEFAULT_CHANNELS } from "@/lib/channels";

type Props = {
  open: boolean;
  onClose: () => void;
  channels: Channel[];
  onChange: (channels: Channel[]) => void;
  watchedCount: number;
  onResetWatched: () => void;
};

export default function Sidebar({
  open,
  onClose,
  channels,
  onChange,
  watchedCount,
  onResetWatched,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function remove(id: string) {
    onChange(channels.filter((c) => c.id !== id));
  }

  function add() {
    setError(null);
    const name = newName.trim();
    const id = newId.trim();
    if (!name || !id) {
      setError("Name and channel ID are required");
      return;
    }
    if (!/^UC[\w-]{20,}$/.test(id)) {
      setError("Channel ID must start with 'UC' (24 chars)");
      return;
    }
    if (channels.some((c) => c.id === id)) {
      setError("Channel already added");
      return;
    }
    onChange([...channels, { id, name }]);
    setNewName("");
    setNewId("");
  }

  function resetDefaults() {
    onChange(DEFAULT_CHANNELS);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[360px] overflow-y-auto bg-neutral-950 p-5 shadow-2xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Channels</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <ul className="mb-6 space-y-2">
          {channels.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{c.name}</div>
                {c.handle && (
                  <div className="truncate text-xs text-white/50">{c.handle}</div>
                )}
              </div>
              <button
                onClick={() => remove(c.id)}
                className="ml-3 rounded p-1.5 text-white/50 hover:bg-red-500/20 hover:text-red-300"
                aria-label={`Remove ${c.name}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                </svg>
              </button>
            </li>
          ))}
          {channels.length === 0 && (
            <li className="rounded bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
              No channels. Add one below or reset defaults.
            </li>
          )}
        </ul>

        <div className="mb-6 rounded-lg border border-white/10 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
            Add channel
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name (e.g. Reuters)"
            className="mb-2 w-full rounded bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:bg-white/15"
          />
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Channel ID (UC...)"
            className="mb-2 w-full rounded bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:bg-white/15"
          />
          <p className="mb-2 text-[11px] leading-snug text-white/40">
            Find a channel ID at{" "}
            <a
              href="https://commentpicker.com/youtube-channel-id.php"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/70"
            >
              commentpicker.com
            </a>
            . Must start with <code className="rounded bg-white/10 px-1">UC</code>.
          </p>
          {error && (
            <p className="mb-2 text-xs text-red-400">{error}</p>
          )}
          <button
            onClick={add}
            className="w-full rounded bg-white py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Add
          </button>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <button
            onClick={resetDefaults}
            className="w-full rounded bg-white/10 py-2 text-sm hover:bg-white/15"
          >
            Reset to default channels
          </button>
          <button
            onClick={onResetWatched}
            className="w-full rounded bg-white/10 py-2 text-sm hover:bg-white/15"
          >
            Clear watched history ({watchedCount})
          </button>
        </div>
      </aside>
    </>
  );
}
