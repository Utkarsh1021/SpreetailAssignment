import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { computeSplits } from "@/lib/balances";
import { getUsdToInrRate, roundINR } from "@/lib/utils";
import { SplitType } from "@/lib/types";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const expenses = await prisma.expense.findMany({
      where: { groupId: params.id, status: { in: ["active", "pending_review"] } },
      include: {
        paidBy: true,
        splits: { include: { member: true } },
      },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(expenses);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const createSchema = z.object({
  description: z.string(),
  date: z.string(),
  paidByMemberId: z.string(),
  amount: z.number(),
  currency: z.string().default("INR"),
  splitType: z.enum(["equal", "unequal", "percentage", "share"]),
  notes: z.string().optional(),
  splits: z.array(
    z.object({
      memberId: z.string(),
      shareValue: z.number().optional(),
      shareAmount: z.number().optional(),
    })
  ),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const body = createSchema.parse(await req.json());

    const currency = body.currency.toUpperCase();
    const rate = currency === "USD" ? getUsdToInrRate() : 1;
    const amountInINR = roundINR(body.amount * rate);

    const members = await prisma.groupMember.findMany({
      where: { id: { in: body.splits.map((s) => s.memberId) } },
    });

    const splitDetails = body.splits
      .filter((s) => s.shareValue !== undefined)
      .map((s) => ({
        name: members.find((m) => m.id === s.memberId)?.displayName || "",
        value: s.shareValue!,
      }));

    const computed = computeSplits(
      amountInINR,
      body.splitType as SplitType,
      body.splits.map((s) => ({
        memberId: s.memberId,
        displayName: members.find((m) => m.id === s.memberId)?.displayName || "",
        shareValue: s.shareValue,
      })),
      splitDetails.length ? splitDetails : undefined
    );

    const expense = await prisma.expense.create({
      data: {
        groupId: params.id,
        description: body.description,
        date: new Date(body.date),
        paidByMemberId: body.paidByMemberId,
        amountOriginal: body.amount,
        currency,
        amountInINR,
        exchangeRate: currency === "USD" ? rate : null,
        splitType: body.splitType,
        notes: body.notes,
        splits: {
          create: computed.map((s) => ({
            memberId: s.memberId,
            shareAmount: s.shareAmount,
            shareValue: s.shareValue ?? null,
          })),
        },
      },
      include: { splits: { include: { member: true } }, paidBy: true },
    });

    return NextResponse.json(expense);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
