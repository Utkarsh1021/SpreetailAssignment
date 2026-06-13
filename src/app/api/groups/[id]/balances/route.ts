import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import {
  computeBalances,
  getMemberContributions,
  suggestSettlements,
} from "@/lib/balances";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get("memberId");

    const expenses = await prisma.expense.findMany({
      where: { groupId: params.id, status: "active" },
      include: {
        paidBy: true,
        splits: { include: { member: true } },
      },
    });

    const settlements = await prisma.settlement.findMany({
      where: { groupId: params.id },
      include: { fromMember: true, toMember: true },
    });

    const expenseData = expenses.map((e) => ({
      id: e.id,
      description: e.description,
      date: e.date,
      amountInINR: Number(e.amountInINR),
      paidByMemberId: e.paidByMemberId,
      paidByName: e.paidBy?.displayName || "Unknown",
      splits: e.splits.map((s) => ({
        memberId: s.memberId,
        displayName: s.member.displayName,
        shareAmount: Number(s.shareAmount),
      })),
    }));

    const settlementData = settlements.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amount: Number(s.amount),
      fromName: s.fromMember.displayName,
      toName: s.toMember.displayName,
    }));

    const balances = computeBalances(expenseData, settlementData);
    const suggestions = suggestSettlements(balances);

    if (memberId) {
      const contributions = getMemberContributions(memberId, expenseData);
      return NextResponse.json({ balances, suggestions, contributions });
    }

    return NextResponse.json({ balances, suggestions });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
