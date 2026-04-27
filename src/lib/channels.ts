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
  {
    id: "UCDRIjKy6eZOvKtOELtTdeUA",
    name: "Breaking Points",
    handle: "@breakingpoints",
  },
  {
    id: "UCScvHKXwQyyGXLsoyqF6iHw",
    name: "Janta Ka Reporter",
    handle: "@JantaKaReporter",
  },
  {
    id: "UC-SJ6nODDmufqBzPBwCvYvQ",
    name: "CBS Mornings",
    handle: "@CBSMornings",
  },
  {
    id: "UCldfgbzNILYZA4dmDt4Cd6A",
    name: "Secular Talk (Kyle Kulinski)",
    handle: "@SecularTalk",
  },
  {
    id: "UCvdwhh_fDyWccR42-rReZLw",
    name: "CNN Brasil",
    handle: "@CNNBrasil",
  },
];
