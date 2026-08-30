import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { refresh } from "@/data/service";
import { invalidateMatchCaches } from "@/lib/data/matches";
import { LEAGUES } from "@/lib/data/leagues";
import { getAllTeamSlugs } from "@/lib/data/teams";

export const dynamic = "force-dynamic";

/**
 * Daily data sync, called by the Vercel cron (see /vercel.json). Rebuilds the in-memory
 * index from openfootball's current files and invalidates ISR caches so pages pick up
 * fresh fixtures and results. Guarded to only accept Vercel cron requests or a secret.
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
    const report = await refresh();
    invalidateMatchCaches();

    revalidatePath("/");
    revalidatePath("/predictions");
    revalidatePath("/stats");
    revalidatePath("/teams");
    revalidatePath("/leagues");
    for (const league of LEAGUES) {
      revalidatePath(`/leagues/${league.slug}`);
    }
    for (const slug of getAllTeamSlugs().slice(0, 240)) {
      revalidatePath(`/teams/${slug}`);
    }

    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "POST only" });
}