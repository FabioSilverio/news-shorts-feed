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
  // Short-form / digital-first
  { id: "UCgRvm1yLFoaQKhmaTqXk9SA", name: "NowThis", handle: "@nowthis" },
  {
    id: "UCn4sPeUomNGIr26bElVdDYg",
    name: "NowThis Impact",
    handle: "@nowthisimpact",
  },
  // Wires & US outlets
  {
    id: "UC52X5wxOL_s5yw0dQk7NtgA",
    name: "Associated Press",
    handle: "@AssociatedPress",
  },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters", handle: "@Reuters" },
  { id: "UCP6HGa63sBC7-KHtkme-p-g", name: "USA TODAY", handle: "@USATODAY" },
  { id: "UCPWXiRWZ29zrxPFIQT7eHSA", name: "The Hill", handle: "@thehill" },
  { id: "UCLXo7UDZvByw2ixzpQCufnA", name: "Vox", handle: "@Vox" },
  {
    id: "UCIRYBXDze5krPDzAEOxFGVA",
    name: "Guardian News",
    handle: "@guardiannews",
  },
  { id: "UC6ZFN9Tx6xh-skXCuRHCDpQ", name: "PBS NewsHour", handle: "@PBSNewsHour" },
  // International
  {
    id: "UCNye-wNBqNL5ZzHSJj3l8Bg",
    name: "Al Jazeera English",
    handle: "@aljazeeraenglish",
  },
  { id: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News", handle: "@dwnews" },
  { id: "UCSrZ3UV4jOidv8ppoVuvW9Q", name: "euronews", handle: "@euronews" },
];
