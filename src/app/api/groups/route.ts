import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();
    const groups = await prisma.group.findMany({
      where: { createdById: user.id },
      include: { _count: { select: { members: true, expenses: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(groups);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  members: z.array(
    z.object({
      displayName: z.string(),
      joinedAt: z.string(),
      leftAt: z.string().optional(),
    })
  ).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = createSchema.parse(await req.json());

    const group = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description,
        createdById: user.id,
        members: {
          create: (body.members || []).map((m) => ({
            displayName: m.displayName,
            joinedAt: new Date(m.joinedAt),
            leftAt: m.leftAt ? new Date(m.leftAt) : null,
            userId: m.displayName.toLowerCase() === user.name.toLowerCase() ? user.id : null,
          })),
        },
      },
      include: { members: true },
    });

    return NextResponse.json(group);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
