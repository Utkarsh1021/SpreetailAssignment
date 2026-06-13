import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        _count: { select: { expenses: true, settlements: true } },
      },
    });
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(group);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = await req.json();
    const group = await prisma.group.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
      },
    });
    return NextResponse.json(group);
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
