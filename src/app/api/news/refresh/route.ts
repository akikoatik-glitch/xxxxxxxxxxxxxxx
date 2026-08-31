import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { refreshNews } from "@/lib/news";

export const dynamic = "force-dynamic";

/**
 * News refresh, called by the Vercel cron (see /vercel.json). Re-fetches every
 * source feed (bypassing the TTL cache), refreshes the in-memory news store and
 * invalidates ISR caches so the news pages show fresh articles. Guarded to only
 * accept Vercel cron requests or a secret.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.XWHIZ_SYNC_SECRET;
  const authorized =
    req.headers.get("x-vercel-cron") === "1" ||
    (!secret && process.env.NODE_ENV !== "production") ||
    (secret !== undefined && req.headers.get("x-whiz-sync-key") === secret);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const report = await refreshNews();
    revalidatePath("/news");
    revalidatePath("/");
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "news sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "POST only" });
}
