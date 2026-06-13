import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { importCsvToGroup } from "@/lib/import/importer";
import { prisma } from "@/lib/db";
import { CANONICAL_MEMBERS } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const content = await file.text();
    const result = await importCsvToGroup(params.id, content, file.name);

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const sessions = await prisma.importSession.findMany({
      where: { groupId: params.id },
      include: { anomalies: { orderBy: { rowNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sessions);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Bootstrap flatmates group with canonical members */
export async function PUT(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    for (const info of Object.values(CANONICAL_MEMBERS)) {
      const existing = await prisma.groupMember.findFirst({
        where: { groupId: params.id, displayName: info.name },
      });
      if (!existing) {
        await prisma.groupMember.create({
          data: {
            groupId: params.id,
            displayName: info.name,
            joinedAt: new Date(info.joinedAt),
            leftAt: info.leftAt ? new Date(info.leftAt) : null,
            userId: info.name.toLowerCase() === user.name.toLowerCase() ? user.id : null,
          },
        });
      }
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: params.id },
    });
    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: "Failed to setup members" }, { status: 500 });
  }
}
