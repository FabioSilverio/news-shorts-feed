import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHANNELS, type Channel } from "@/lib/channels";
import { fetchAllVideos } from "@/lib/youtube";

export const revalidate = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      channels?: Channel[];
    };
    const channels =
      body.channels && body.channels.length > 0
        ? body.channels
        : DEFAULT_CHANNELS;

    const videos = await fetchAllVideos(channels, 12);
    return NextResponse.json(
      { videos, fetchedAt: Date.now() },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const videos = await fetchAllVideos(DEFAULT_CHANNELS, 12);
    return NextResponse.json({ videos, fetchedAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
