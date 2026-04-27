import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHANNELS } from "@/lib/channels";
import { fetchAllShorts } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/**
 * Called every 5 minutes by Vercel Cron (see vercel.json).
 * Warms the cache so the next user load is instant.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const videos = await fetchAllShorts(DEFAULT_CHANNELS, 15);
    return NextResponse.json({ ok: true, count: videos.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
