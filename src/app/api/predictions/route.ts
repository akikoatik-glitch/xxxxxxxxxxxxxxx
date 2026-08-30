import { NextResponse, type NextRequest } from "next/server";
import { getUpcomingPredictions, filterPredictions } from "@/lib/predictions";

export const revalidate = 1800;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") ?? undefined;
  const minConfidence = Number(searchParams.get("minConfidence") ?? "0");
  const search = searchParams.get("q") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "0");

  const items = filterPredictions(await getUpcomingPredictions(), {
    league,
    minConfidence: Number.isFinite(minConfidence) ? minConfidence : 0,
    search,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined
  });

  return NextResponse.json({
    count: items.length,
    predictions: items
  });
}