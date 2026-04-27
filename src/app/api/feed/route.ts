import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHANNELS, type Channel } from "@/lib/channels";
import { fetchAllShorts } from "@/lib/youtube";

// Per-request feed: do not let intermediaries cache personalized JSON.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      channels?: Channel[];
    };
    const channels =
      body.channels && body.channels.length > 0
        ? body.channels
        : DEFAULT_CHANNELS;

    const videos = await fetchAllShorts(channels, 15);
    return NextResponse.json(
      { videos, fetchedAt: Date.now() },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const videos = await fetchAllShorts(DEFAULT_CHANNELS, 15);
    return NextResponse.json(
      { videos, fetchedAt: Date.now() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
