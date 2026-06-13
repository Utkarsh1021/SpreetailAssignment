import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  displayName: z.string(),
  joinedAt: z.string(),
  leftAt: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = schema.parse(await req.json());

    const member = await prisma.groupMember.create({
      data: {
        groupId: params.id,
        displayName: body.displayName,
        joinedAt: new Date(body.joinedAt),
        leftAt: body.leftAt ? new Date(body.leftAt) : null,
      },
    });
    return NextResponse.json(member);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = await req.json();
    const member = await prisma.groupMember.update({
      where: { id: body.memberId },
      data: {
        leftAt: body.leftAt ? new Date(body.leftAt) : null,
      },
    });
    return NextResponse.json(member);
  } catch {
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}
