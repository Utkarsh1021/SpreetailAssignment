import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const settlements = await prisma.settlement.findMany({
      where: { groupId: params.id },
      include: { fromMember: true, toMember: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(settlements);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const schema = z.object({
  fromMemberId: z.string(),
  toMemberId: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = schema.parse(await req.json());

    const settlement = await prisma.settlement.create({
      data: {
        groupId: params.id,
        fromMemberId: body.fromMemberId,
        toMemberId: body.toMemberId,
        amount: body.amount,
        date: new Date(body.date),
        notes: body.notes,
      },
      include: { fromMember: true, toMember: true },
    });

    return NextResponse.json(settlement);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}
