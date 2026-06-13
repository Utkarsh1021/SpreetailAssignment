import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { approveAnomaly } from "@/lib/import/importer";

export async function PATCH(req: Request) {
  try {
    await requireAuth();
    const { anomalyId, approved } = await req.json();
    await approveAnomaly(anomalyId, approved);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
  }
}
