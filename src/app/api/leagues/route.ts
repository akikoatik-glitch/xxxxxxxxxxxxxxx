import { NextResponse } from "next/server";
import { LEAGUES } from "@/lib/data/leagues";

export async function GET() {
  return NextResponse.json({ count: LEAGUES.length, leagues: LEAGUES });
}
