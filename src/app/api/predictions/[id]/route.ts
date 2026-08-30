import { NextResponse } from "next/server";
import { getPredictionById } from "@/lib/predictions";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const item = await getPredictionById(params.id);
  if (!item) {
    return NextResponse.json({ error: "prediction_not_found" }, { status: 404 });
  }
  return NextResponse.json(item);
}