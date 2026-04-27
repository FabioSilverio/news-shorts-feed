export type Channel = {
  id: string; // YouTube channel ID (UC...)
  name: string;
  handle?: string;
};

// Default news channels (YouTube channel IDs)
export const DEFAULT_CHANNELS: Channel[] = [
  { id: "UCupvZG-5ko_eiXAupbDfxWw", name: "CNN", handle: "@CNN" },
  { id: "UCaXkIU1QidjPwiAYu6GcHjg", name: "MSNBC", handle: "@MSNBC" },
  { id: "UCXIJgqnII2ZOINSWNOGFThA", name: "Fox News", handle: "@FoxNews" },
  { id: "UC16niRr50-MSBwiO3YDb3RA", name: "BBC News", handle: "@BBCNews" },
  { id: "UC8p1vwvWtl6T73JiExfWs1g", name: "CBS News", handle: "@CBSNews" },
  { id: "UCeY0bbntWzzVIaj2z3QigXg", name: "NBC News", handle: "@NBCNews" },
];
