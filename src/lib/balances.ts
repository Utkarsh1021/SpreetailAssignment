import { SplitType } from "./types";
import { roundINR } from "./utils";

export type { SplitType };

export interface SplitInput {
  memberId: string;
  displayName: string;
  shareValue?: number;
}

export interface ComputedSplit {
  memberId: string;
  displayName: string;
  shareAmount: number;
  shareValue?: number;
}

/**
 * Compute per-member share amounts in INR.
 * Remainder paise go to the last participant (consistent rounding).
 */
export function computeSplits(
  amountInINR: number,
  splitType: SplitType,
  participants: SplitInput[],
  splitDetails?: { name: string; value: number }[]
): ComputedSplit[] {
  if (participants.length === 0) return [];

  const totalPaise = Math.round(amountInINR * 100);

  if (splitType === "equal") {
    const perPerson = Math.floor(totalPaise / participants.length);
    let remainder = totalPaise - perPerson * participants.length;
    return participants.map((p, i) => {
      const extra = i === participants.length - 1 ? remainder : 0;
      return {
        memberId: p.memberId,
        displayName: p.displayName,
        shareAmount: (perPerson + extra) / 100,
      };
    });
  }

  if (splitType === "unequal" && splitDetails?.length) {
    return participants.map((p) => {
      const detail = splitDetails.find(
        (d) => d.name.toLowerCase() === p.displayName.toLowerCase()
      );
      return {
        memberId: p.memberId,
        displayName: p.displayName,
        shareAmount: roundINR(detail?.value ?? 0),
        shareValue: detail?.value,
      };
    });
  }

  if (splitType === "percentage" && splitDetails?.length) {
    const totalPct = splitDetails.reduce((s, d) => s + d.value, 0);
    const normalized = totalPct !== 100 && totalPct > 0
      ? splitDetails.map((d) => ({ ...d, value: (d.value / totalPct) * 100 }))
      : splitDetails;

    let assigned = 0;
    return participants.map((p, i) => {
      const detail = normalized.find(
        (d) => d.name.toLowerCase() === p.displayName.toLowerCase()
      );
      const pct = detail?.value ?? 100 / participants.length;
      if (i === participants.length - 1) {
        return {
          memberId: p.memberId,
          displayName: p.displayName,
          shareAmount: (totalPaise - assigned) / 100,
          shareValue: pct,
        };
      }
      const share = Math.floor((totalPaise * pct) / 100);
      assigned += share;
      return {
        memberId: p.memberId,
        displayName: p.displayName,
        shareAmount: share / 100,
        shareValue: pct,
      };
    });
  }

  if (splitType === "share" && splitDetails?.length) {
    const totalShares = splitDetails.reduce((s, d) => s + d.value, 0);
    let assigned = 0;
    return participants.map((p, i) => {
      const detail = splitDetails.find(
        (d) => d.name.toLowerCase() === p.displayName.toLowerCase()
      );
      const shares = detail?.value ?? 1;
      if (i === participants.length - 1) {
        return {
          memberId: p.memberId,
          displayName: p.displayName,
          shareAmount: (totalPaise - assigned) / 100,
          shareValue: shares,
        };
      }
      const share = Math.floor((totalPaise * shares) / totalShares);
      assigned += share;
      return {
        memberId: p.memberId,
        displayName: p.displayName,
        shareAmount: share / 100,
        shareValue: shares,
      };
    });
  }

  // Fallback: equal
  return computeSplits(amountInINR, "equal", participants);
}

export interface BalanceEntry {
  memberId: string;
  displayName: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface ExpenseContribution {
  expenseId: string;
  description: string;
  date: string;
  paidBy: string;
  yourShare: number;
  youPaid: number;
  netEffect: number;
}

export interface SettlementSuggestion {
  from: string;
  fromId: string;
  to: string;
  toId: string;
  amount: number;
}

/**
 * Net balance: positive = others owe you, negative = you owe others.
 */
export function computeBalances(
  expenses: {
    id: string;
    description: string;
    date: Date;
    amountInINR: number;
    paidByMemberId: string | null;
    paidByName: string;
    splits: { memberId: string; displayName: string; shareAmount: number }[];
  }[],
  settlements: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    fromName: string;
    toName: string;
  }[]
): BalanceEntry[] {
  const map = new Map<string, BalanceEntry>();

  const ensure = (id: string, name: string) => {
    if (!map.has(id)) {
      map.set(id, { memberId: id, displayName: name, totalPaid: 0, totalOwed: 0, netBalance: 0 });
    }
    return map.get(id)!;
  };

  for (const exp of expenses) {
    if (exp.paidByMemberId) {
      const payer = ensure(exp.paidByMemberId, exp.paidByName);
      payer.totalPaid += Number(exp.amountInINR);
    }
    for (const split of exp.splits) {
      const member = ensure(split.memberId, split.displayName);
      member.totalOwed += Number(split.shareAmount);
    }
  }

  for (const s of settlements) {
    const from = ensure(s.fromMemberId, s.fromName);
    const to = ensure(s.toMemberId, s.toName);
    from.totalPaid += Number(s.amount);
    to.totalOwed += Number(s.amount);
  }

  for (const entry of Array.from(map.values())) {
    entry.netBalance = roundINR(entry.totalPaid - entry.totalOwed);
  }

  return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Minimal-cash-flow settlement suggestions (Aisha's request). */
export function suggestSettlements(balances: BalanceEntry[]): SettlementSuggestion[] {
  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ ...b, amount: -b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.netBalance > 0.01)
    .map((b) => ({ ...b, amount: b.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const suggestions: SettlementSuggestion[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay >= 0.01) {
      suggestions.push({
        from: debtors[i].displayName,
        fromId: debtors[i].memberId,
        to: creditors[j].displayName,
        toId: creditors[j].memberId,
        amount: roundINR(pay),
      });
    }
    debtors[i].amount = roundINR(debtors[i].amount - pay);
    creditors[j].amount = roundINR(creditors[j].amount - pay);
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return suggestions;
}

export function getMemberContributions(
  memberId: string,
  expenses: {
    id: string;
    description: string;
    date: Date;
    amountInINR: number;
    paidByMemberId: string | null;
    paidByName: string;
    splits: { memberId: string; shareAmount: number }[];
  }[]
): ExpenseContribution[] {
  return expenses
    .map((exp) => {
      const split = exp.splits.find((s) => s.memberId === memberId);
      if (!split) return null;
      const youPaid = exp.paidByMemberId === memberId ? Number(exp.amountInINR) : 0;
      const yourShare = Number(split.shareAmount);
      return {
        expenseId: exp.id,
        description: exp.description,
        date: exp.date.toISOString().slice(0, 10),
        paidBy: exp.paidByName,
        yourShare,
        youPaid,
        netEffect: roundINR(youPaid - yourShare),
      };
    })
    .filter((x): x is ExpenseContribution => x !== null);
}
