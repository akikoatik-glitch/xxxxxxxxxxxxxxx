import { NextResponse } from "next/server";
import { computeModelStats } from "@/lib/predictions";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await computeModelStats());
}