import { parse } from "csv-parse/sync";
import { prisma } from "../db";
import { computeSplits, SplitType } from "../balances";
import {
  CANONICAL_MEMBERS,
  fuzzyMatchDescription,
  getUsdToInrRate,
  isKnownMember,
  isSettlementDescription,
  memberActiveOnDate,
  normalizeName,
  parseAmount,
  parseDate,
  dateKey,
  parseSplitDetails,
  parseSplitWith,
  roundINR,
} from "../utils";
import { AnomalyAction, ExpenseStatus } from "../types";

export interface RawCsvRow {
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

export interface DetectedAnomaly {
  rowNumber: number;
  anomalyType: string;
  description: string;
  action: AnomalyAction;
  actionDetail: string;
  requiresApproval: boolean;
  rawRow: RawCsvRow;
}

export interface ImportResult {
  sessionId: string;
  imported: number;
  settlements: number;
  skipped: number;
  pendingApproval: number;
  anomalies: DetectedAnomaly[];
}

function detectSplitType(raw: string, details: string): SplitType {
  const t = raw?.trim().toLowerCase();
  if (t === "unequal") return "unequal";
  if (t === "percentage") return "percentage";
  if (t === "share") return "share";
  if (t === "equal" && details?.trim()) {
    // equal with share details — treat as share if numeric shares present
    const parsed = parseSplitDetails(details, "share");
    if (parsed.length > 0 && parsed.every((p) => p.value > 0)) return "share";
  }
  return "equal";
}

export function parseCsvContent(content: string): RawCsvRow[] {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as RawCsvRow[];
  return records;
}

export function analyzeRows(rows: RawCsvRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const seenDescriptions: { row: number; desc: string; payer: string; amount: number; date: Date | null }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // header is row 1

    // Missing payer
    if (!row.paid_by?.trim()) {
      anomalies.push({
        rowNumber,
        anomalyType: "MISSING_PAYER",
        description: `Row ${rowNumber}: No payer specified for "${row.description}"`,
        action: AnomalyAction.pending_approval,
        actionDetail: "Expense held for review until payer is assigned",
        requiresApproval: true,
        rawRow: row,
      });
    }

    // Name normalization
    if (row.paid_by?.trim()) {
      const normalized = normalizeName(row.paid_by);
      if (normalized !== row.paid_by.trim()) {
        anomalies.push({
          rowNumber,
          anomalyType: "NAME_NORMALIZED",
          description: `Payer "${row.paid_by.trim()}" normalized to "${normalized}"`,
          action: AnomalyAction.auto_fixed,
          actionDetail: `Mapped to canonical name ${normalized}`,
          requiresApproval: false,
          rawRow: row,
        });
      }
    }

    // Comma in amount
    if (row.amount?.includes(",")) {
      anomalies.push({
        rowNumber,
        anomalyType: "COMMA_FORMATTED_AMOUNT",
        description: `Amount "${row.amount}" contains comma separator`,
        action: AnomalyAction.auto_fixed,
        actionDetail: `Parsed as ${parseAmount(row.amount)}`,
        requiresApproval: false,
        rawRow: row,
      });
    }

    const amount = parseAmount(row.amount);
    if (amount === null && row.amount?.trim()) {
      anomalies.push({
        rowNumber,
        anomalyType: "INVALID_AMOUNT",
        description: `Cannot parse amount "${row.amount}"`,
        action: AnomalyAction.skipped,
        actionDetail: "Row skipped",
        requiresApproval: false,
        rawRow: row,
      });
    }

    // Zero amount
    if (amount === 0) {
      anomalies.push({
        rowNumber,
        anomalyType: "ZERO_AMOUNT",
        description: `Zero amount expense "${row.description}" — likely duplicate fix entry`,
        action: AnomalyAction.skipped,
        actionDetail: "Skipped per notes indicating duplicate correction",
        requiresApproval: true,
        rawRow: row,
      });
    }

    // Negative amount (refund)
    if (amount !== null && amount < 0) {
      anomalies.push({
        rowNumber,
        anomalyType: "NEGATIVE_AMOUNT",
        description: `Negative amount ${amount} ${row.currency || "INR"} — treating as refund/credit`,
        action: AnomalyAction.auto_fixed,
        actionDetail: "Imported as negative expense reducing group cost",
        requiresApproval: false,
        rawRow: row,
      });
    }

    // Settlement as expense
    if (isSettlementDescription(row.description, row.split_type, row.notes)) {
      anomalies.push({
        rowNumber,
        anomalyType: "SETTLEMENT_AS_EXPENSE",
        description: `"${row.description}" appears to be a debt settlement, not a shared expense`,
        action: AnomalyAction.converted,
        actionDetail: "Converted to settlement record (Rohan → Aisha)",
        requiresApproval: false,
        rawRow: row,
      });
    }

    // Date parsing
    const dateResult = parseDate(row.date);
    if (!dateResult.date) {
      anomalies.push({
        rowNumber,
        anomalyType: "INVALID_DATE",
        description: `Cannot parse date "${row.date}"`,
        action: AnomalyAction.skipped,
        actionDetail: "Row skipped",
        requiresApproval: false,
        rawRow: row,
      });
    } else if (dateResult.ambiguous) {
      anomalies.push({
        rowNumber,
        anomalyType: "AMBIGUOUS_DATE",
        description: dateResult.note || `Ambiguous date "${row.date}"`,
        action: AnomalyAction.flagged,
        actionDetail: "Using DD-MM-YYYY (Indian format). User can override.",
        requiresApproval: true,
        rawRow: row,
      });
    }

    if (row.date.match(/^[A-Za-z]{3}-\d/)) {
      anomalies.push({
        rowNumber,
        anomalyType: "ALTERNATE_DATE_FORMAT",
        description: `Non-standard date format "${row.date}" parsed as ${dateResult.date?.toISOString().slice(0, 10)}`,
        action: AnomalyAction.auto_fixed,
        actionDetail: "Converted Mon-DD to full date in 2026",
        requiresApproval: false,
        rawRow: row,
      });
    }

    // Missing currency
    if (!row.currency?.trim()) {
      anomalies.push({
        rowNumber,
        anomalyType: "MISSING_CURRENCY",
        description: `No currency specified, defaulting to INR`,
        action: AnomalyAction.auto_fixed,
        actionDetail: "Assumed INR per group default",
        requiresApproval: false,
        rawRow: row,
      });
    }

    // USD conversion
    const currency = (row.currency?.trim() || "INR").toUpperCase();
    if (currency === "USD" && amount !== null) {
      const rate = getUsdToInrRate();
      anomalies.push({
        rowNumber,
        anomalyType: "FOREIGN_CURRENCY",
        description: `${amount} USD converted to INR at rate ${rate}`,
        action: AnomalyAction.auto_fixed,
        actionDetail: `Stored as ${roundINR(amount * rate)} INR (original ${amount} USD preserved)`,
        requiresApproval: false,
        rawRow: row,
      });
    }

    // Percentage split validation
    if (row.split_type?.trim().toLowerCase() === "percentage" && row.split_details?.trim()) {
      const pcts = parseSplitDetails(row.split_details, "percentage");
      const total = pcts.reduce((s, p) => s + p.value, 0);
      if (Math.abs(total - 100) > 0.01) {
        anomalies.push({
          rowNumber,
          anomalyType: "PERCENTAGE_MISMATCH",
          description: `Percentages sum to ${total}% (expected 100%)`,
          action: AnomalyAction.auto_fixed,
          actionDetail: `Normalized proportionally to 100%`,
          requiresApproval: false,
          rawRow: row,
        });
      }
    }

    // Equal with share details
    if (row.split_type?.trim().toLowerCase() === "equal" && row.split_details?.trim()) {
      anomalies.push({
        rowNumber,
        anomalyType: "SPLIT_TYPE_MISMATCH",
        description: `split_type is "equal" but split_details provided — using share split`,
        action: AnomalyAction.auto_fixed,
        actionDetail: "Treated as share split based on provided shares",
        requiresApproval: false,
        rawRow: row,
      });
    }

    // Unknown participants
    const participants = parseSplitWith(row.split_with);
    for (const p of participants) {
      if (!isKnownMember(p)) {
        anomalies.push({
          rowNumber,
          anomalyType: "UNKNOWN_PARTICIPANT",
          description: `"${p}" is not a flatmate — excluded from split`,
          action: AnomalyAction.auto_fixed,
          actionDetail: `Cost redistributed among known members only`,
          requiresApproval: false,
          rawRow: row,
        });
      }
    }

    // Inactive member in split
    if (dateResult.date) {
      for (const p of participants) {
        const name = normalizeName(p);
        if (isKnownMember(p) && !memberActiveOnDate(name, dateResult.date)) {
          anomalies.push({
            rowNumber,
            anomalyType: "INACTIVE_MEMBER_IN_SPLIT",
            description: `${name} was not an active member on ${dateResult.date.toISOString().slice(0, 10)} but listed in split`,
            action: AnomalyAction.auto_fixed,
            actionDetail: `${name} removed from split; amount redistributed among active members`,
            requiresApproval: false,
            rawRow: row,
          });
        }
      }
    }

    // Duplicate detection
    if (amount !== null && amount > 0 && dateResult.date) {
      const payer = normalizeName(row.paid_by || "");
      for (const seen of seenDescriptions) {
        if (
          seen.date &&
          dateResult.date &&
          dateKey(seen.date) === dateKey(dateResult.date) &&
          Math.abs(seen.amount - amount) < 0.01 &&
          fuzzyMatchDescription(seen.desc, row.description)
        ) {
          anomalies.push({
            rowNumber,
            anomalyType: "POSSIBLE_DUPLICATE",
            description: `"${row.description}" may duplicate row ${seen.row} ("${seen.desc}")`,
            action: AnomalyAction.pending_approval,
            actionDetail: "Held for Meera's approval before import",
            requiresApproval: true,
            rawRow: row,
          });
          break;
        }
      }
      seenDescriptions.push({
        row: rowNumber,
        desc: row.description,
        payer,
        amount,
        date: dateResult.date,
      });
    }

    // Conflicting duplicate (same event, different amounts)
    if (dateResult.date && amount !== null && amount > 0) {
      for (const seen of seenDescriptions) {
        if (
          seen.date &&
          dateKey(seen.date) === dateKey(dateResult.date) &&
          fuzzyMatchDescription(seen.desc, row.description) &&
          Math.abs(seen.amount - amount) > 0.01
        ) {
          anomalies.push({
            rowNumber,
            anomalyType: "CONFLICTING_DUPLICATE",
            description: `"${row.description}" (${amount}) conflicts with row ${seen.row} (${seen.amount}) for same event`,
            action: AnomalyAction.pending_approval,
            actionDetail: "Both held for approval — user picks which to keep",
            requiresApproval: true,
            rawRow: row,
          });
        }
      }
    }

    // Decimal precision
    if (amount !== null && amount.toString().includes(".") && amount.toString().split(".")[1]?.length > 2) {
      anomalies.push({
        rowNumber,
        anomalyType: "DECIMAL_PRECISION",
        description: `Amount ${amount} has extra decimal precision`,
        action: AnomalyAction.auto_fixed,
        actionDetail: `Rounded to ${roundINR(amount)} INR`,
        requiresApproval: false,
        rawRow: row,
      });
    }
  });

  return anomalies;
}

export async function importCsvToGroup(
  groupId: string,
  content: string,
  filename: string
): Promise<ImportResult> {
  const rows = parseCsvContent(content);
  const anomalies = analyzeRows(rows);

  const session = await prisma.importSession.create({
    data: {
      groupId,
      filename,
      status: "processing",
    },
  });

  // Persist anomalies
  for (const a of anomalies) {
    await prisma.importAnomaly.create({
      data: {
        importSessionId: session.id,
        rowNumber: a.rowNumber,
        anomalyType: a.anomalyType,
        description: a.description,
        action: a.action,
        actionDetail: a.actionDetail,
        rawRow: JSON.stringify(a.rawRow),
        requiresApproval: a.requiresApproval,
      },
    });
  }

  // Build member map
  const memberRecords = await prisma.groupMember.findMany({ where: { groupId } });
  const memberByName = new Map(
    memberRecords.map((m) => [m.displayName.toLowerCase(), m])
  );

  async function getOrCreateMember(name: string, date: Date) {
    const normalized = normalizeName(name);
    const key = normalized.toLowerCase();
    let member = memberByName.get(key);
    if (!member) {
      const info = Object.values(CANONICAL_MEMBERS).find(
        (m) => m.name.toLowerCase() === key
      );
      member = await prisma.groupMember.create({
        data: {
          groupId,
          displayName: normalized,
          joinedAt: info ? new Date(info.joinedAt) : date,
          leftAt: info?.leftAt ? new Date(info.leftAt) : null,
        },
      });
      memberByName.set(key, member);
    }
    return member;
  }

  const pendingRows = new Set(
    anomalies
      .filter((a) => a.requiresApproval && a.action === AnomalyAction.pending_approval)
      .map((a) => a.rowNumber)
  );
  const skipRows = new Set(
    anomalies
      .filter((a) => a.action === AnomalyAction.skipped)
      .map((a) => a.rowNumber)
  );
  const settlementRows = new Set(
    anomalies
      .filter((a) => a.anomalyType === "SETTLEMENT_AS_EXPENSE")
      .map((a) => a.rowNumber)
  );

  let imported = 0;
  let settlements = 0;
  let skipped = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 2;

    if (skipRows.has(rowNumber)) {
      skipped++;
      continue;
    }

    // Settlement conversion
    if (settlementRows.has(rowNumber)) {
      const amount = parseAmount(row.amount);
      const dateResult = parseDate(row.date);
      if (amount && dateResult.date && row.paid_by && row.split_with) {
        const fromMember = await getOrCreateMember(row.paid_by, dateResult.date);
        const toNames = parseSplitWith(row.split_with);
        if (toNames.length > 0) {
          const toMember = await getOrCreateMember(toNames[0], dateResult.date);
          await prisma.settlement.create({
            data: {
              groupId,
              fromMemberId: fromMember.id,
              toMemberId: toMember.id,
              amount: roundINR(amount),
              date: dateResult.date,
              notes: row.notes || row.description,
              importRowNumber: rowNumber,
            },
          });
          settlements++;
        }
      }
      continue;
    }

    if (pendingRows.has(rowNumber)) {
      // Create pending expense for approval
      const amount = parseAmount(row.amount);
      const dateResult = parseDate(row.date);
      if (amount && dateResult.date) {
        const currency = (row.currency?.trim() || "INR").toUpperCase();
        const rate = currency === "USD" ? getUsdToInrRate() : 1;
        const amountInINR = roundINR(amount * rate);
        const payer = row.paid_by?.trim()
          ? await getOrCreateMember(row.paid_by, dateResult.date)
          : null;

        await prisma.expense.create({
          data: {
            groupId,
            date: dateResult.date,
            description: row.description,
            paidByMemberId: payer?.id ?? null,
            amountOriginal: amount,
            currency,
            amountInINR,
            exchangeRate: currency === "USD" ? rate : null,
            splitType: detectSplitType(row.split_type, row.split_details),
            notes: row.notes,
            status: ExpenseStatus.pending_review,
            importRowNumber: rowNumber,
            importSessionId: session.id,
          },
        });
      }
      continue;
    }

    // Normal import
    const amount = parseAmount(row.amount);
    const dateResult = parseDate(row.date);
    if (!amount || !dateResult.date) {
      skipped++;
      continue;
    }

    const currency = (row.currency?.trim() || "INR").toUpperCase();
    const rate = currency === "USD" ? getUsdToInrRate() : 1;
    const amountInINR = roundINR(amount * rate);
    const splitType = detectSplitType(row.split_type, row.split_details);

    if (!row.paid_by?.trim()) {
      skipped++;
      continue;
    }

    const payer = await getOrCreateMember(row.paid_by, dateResult.date);

    // Filter participants: known + active on date
    let participantNames = parseSplitWith(row.split_with)
      .map(normalizeName)
      .filter((n) => isKnownMember(n))
      .filter((n) => memberActiveOnDate(n, dateResult.date!));

    if (participantNames.length === 0) {
      participantNames = parseSplitWith(row.split_with).map(normalizeName);
    }

    const participants = await Promise.all(
      participantNames.map((n) => getOrCreateMember(n, dateResult.date!))
    );

    const splitDetails = parseSplitDetails(row.split_details, splitType);
    const computed = computeSplits(
      amountInINR,
      splitType,
      participants.map((p) => ({ memberId: p.id, displayName: p.displayName })),
      splitDetails
    );

    const expense = await prisma.expense.create({
      data: {
        groupId,
        date: dateResult.date,
        description: row.description,
        paidByMemberId: payer.id,
        amountOriginal: amount,
        currency,
        amountInINR,
        exchangeRate: currency === "USD" ? rate : null,
        splitType,
        notes: row.notes,
        status: ExpenseStatus.active,
        importRowNumber: rowNumber,
        importSessionId: session.id,
        splits: {
          create: computed.map((s) => ({
            memberId: s.memberId,
            shareAmount: s.shareAmount,
            shareValue: s.shareValue ?? null,
          })),
        },
      },
    });

    imported++;
    void expense;
  }

  const pendingApproval = pendingRows.size;

  await prisma.importSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      summary: JSON.stringify({
        totalRows: rows.length,
        imported,
        settlements,
        skipped,
        pendingApproval,
        anomalyCount: anomalies.length,
      }),
    },
  });

  return {
    sessionId: session.id,
    imported,
    settlements,
    skipped,
    pendingApproval,
    anomalies,
  };
}

export async function approveAnomaly(
  anomalyId: string,
  approved: boolean
): Promise<void> {
  const anomaly = await prisma.importAnomaly.findUniqueOrThrow({
    where: { id: anomalyId },
    include: { importSession: true },
  });

  await prisma.importAnomaly.update({
    where: { id: anomalyId },
    data: { approved, approvedAt: new Date() },
  });

  if (!approved) {
    // Reject related pending expense
    const expense = await prisma.expense.findFirst({
      where: {
        importSessionId: anomaly.importSessionId,
        importRowNumber: anomaly.rowNumber,
        status: ExpenseStatus.pending_review,
      },
    });
    if (expense) {
      await prisma.expense.update({
        where: { id: expense.id },
        data: { status: ExpenseStatus.rejected },
      });
    }
    return;
  }

  // On approval, activate pending expense and compute splits
  const expense = await prisma.expense.findFirst({
    where: {
      importSessionId: anomaly.importSessionId,
      importRowNumber: anomaly.rowNumber,
      status: ExpenseStatus.pending_review,
    },
  });

  if (!expense) return;

  const rawRow = JSON.parse(anomaly.rawRow) as RawCsvRow;
  const dateResult = parseDate(rawRow.date);
  if (!dateResult.date) return;

  const groupId = anomaly.importSession.groupId;
  const memberRecords = await prisma.groupMember.findMany({ where: { groupId } });
  const memberByName = new Map(
    memberRecords.map((m) => [m.displayName.toLowerCase(), m])
  );

  async function getMember(name: string) {
    const normalized = normalizeName(name);
    let m = memberByName.get(normalized.toLowerCase());
    if (!m) {
      m = await prisma.groupMember.create({
        data: {
          groupId,
          displayName: normalized,
          joinedAt: dateResult.date!,
        },
      });
      memberByName.set(normalized.toLowerCase(), m);
    }
    return m;
  }

  let participantNames = parseSplitWith(rawRow.split_with)
    .map(normalizeName)
    .filter((n) => isKnownMember(n))
    .filter((n) => memberActiveOnDate(n, dateResult.date!));

  if (participantNames.length === 0) {
    participantNames = parseSplitWith(rawRow.split_with).map(normalizeName);
  }

  const participants = await Promise.all(participantNames.map(getMember));
  const splitType = detectSplitType(rawRow.split_type, rawRow.split_details);
  const splitDetails = parseSplitDetails(rawRow.split_details, splitType);
  const computed = computeSplits(
    Number(expense.amountInINR),
    splitType,
    participants.map((p) => ({ memberId: p.id, displayName: p.displayName })),
    splitDetails
  );

  if (rawRow.paid_by?.trim() && !expense.paidByMemberId) {
    const payer = await getMember(rawRow.paid_by);
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        paidByMemberId: payer.id,
        status: ExpenseStatus.active,
        splits: {
          create: computed.map((s) => ({
            memberId: s.memberId,
            shareAmount: s.shareAmount,
            shareValue: s.shareValue ?? null,
          })),
        },
      },
    });
  } else {
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        status: ExpenseStatus.active,
        splits: {
          create: computed.map((s) => ({
            memberId: s.memberId,
            shareAmount: s.shareAmount,
            shareValue: s.shareValue ?? null,
          })),
        },
      },
    });
  }
}
