export const CANONICAL_MEMBERS: Record<string, { name: string; joinedAt: string; leftAt?: string }> = {
  aisha: { name: "Aisha", joinedAt: "2026-02-01" },
  rohan: { name: "Rohan", joinedAt: "2026-02-01" },
  priya: { name: "Priya", joinedAt: "2026-02-01" },
  meera: { name: "Meera", joinedAt: "2026-02-01", leftAt: "2026-03-31" },
  dev: { name: "Dev", joinedAt: "2026-02-08", leftAt: "2026-03-14" },
  sam: { name: "Sam", joinedAt: "2026-04-08" },
};

const NAME_ALIASES: Record<string, string> = {
  "priya s": "priya",
  priya: "priya",
  "rohan ": "rohan",
  rohan: "rohan",
};

export function normalizeName(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const alias = NAME_ALIASES[trimmed];
  if (alias) return CANONICAL_MEMBERS[alias].name;
  for (const [key, info] of Object.entries(CANONICAL_MEMBERS)) {
    if (key === trimmed || info.name.toLowerCase() === trimmed) {
      return info.name;
    }
  }
  return raw.trim();
}

export function isKnownMember(name: string): boolean {
  const normalized = normalizeName(name).toLowerCase();
  return Object.values(CANONICAL_MEMBERS).some(
    (m) => m.name.toLowerCase() === normalized
  );
}

export function parseAmount(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseDate(raw: string): {
  date: Date | null;
  ambiguous: boolean;
  note?: string;
} {
  const trimmed = raw.trim();

  const monthDay = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monthDay) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const m = months[monthDay[1].toLowerCase()];
    const d = parseInt(monthDay[2], 10);
    if (m !== undefined) {
      return { date: new Date(Date.UTC(2026, m, d, 12)), ambiguous: false };
    }
  }

  const dmy = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const monthNum = parseInt(dmy[2], 10);

    // Only flag when BOTH parts ≤ 12 (could be DD-MM or MM-DD)
    const ambiguous = day <= 12 && monthNum <= 12;
    return {
      date: new Date(Date.UTC(year, month, day, 12)),
      ambiguous,
      note: ambiguous
        ? `Date "${trimmed}" could be ${day}/${monthNum}/${year} (DD-MM) or ${monthNum}/${day}/${year} (MM-DD). Using DD-MM-YYYY (Indian format).`
        : undefined,
    };
  }

  return { date: null, ambiguous: false };
}

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseSplitWith(raw: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(";").map((s) => s.trim()).filter(Boolean);
}

export function parseSplitDetails(
  raw: string,
  splitType: string
): { name: string; value: number }[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(";").map((s) => s.trim()).filter(Boolean);

  return parts.map((part) => {
    const unequalMatch = part.match(/^(.+?)\s+([\d.]+)$/);
    const pctMatch = part.match(/^(.+?)\s+([\d.]+)%$/);
    const shareMatch = part.match(/^(.+?)\s+(\d+)$/);

    if (splitType === "percentage" && pctMatch) {
      return { name: pctMatch[1].trim(), value: parseFloat(pctMatch[2]) };
    }
    if (splitType === "unequal" && unequalMatch) {
      return { name: unequalMatch[1].trim(), value: parseFloat(unequalMatch[2]) };
    }
    if (shareMatch) {
      return { name: shareMatch[1].trim(), value: parseInt(shareMatch[2], 10) };
    }
    return { name: part, value: 0 };
  });
}

export function fuzzyMatchDescription(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.length >= 5 && nb.length >= 5) {
    if (na.includes(nb) || nb.includes(na)) return true;
    // Word overlap: if 2+ significant words match (len > 3)
    const wordsA = na.split(" ").filter((w) => w.length > 3);
    const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
    const overlap = wordsA.filter((w) => wordsB.has(w)).length;
    if (overlap >= 2) return true;
    if (overlap >= 1 && wordsA.length <= 2 && wordsB.size <= 2) return true;
  }
  return false;
}

export function isSettlementDescription(desc: string, splitType: string, notes: string): boolean {
  const text = `${desc} ${notes}`.toLowerCase();
  if (splitType === "" && text.includes("settlement")) return true;
  if (text.includes("paid") && text.includes("back")) return true;
  if (text.includes("settlement not an expense")) return true;
  if (text.match(/paid .+ back/)) return true;
  return false;
}

export function roundINR(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function getUsdToInrRate(): number {
  return parseFloat(process.env.USD_TO_INR_RATE || "83.00");
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function memberActiveOnDate(
  displayName: string,
  date: Date
): boolean {
  const key = displayName.toLowerCase();
  const info = Object.entries(CANONICAL_MEMBERS).find(
    ([, v]) => v.name.toLowerCase() === key
  )?.[1];
  if (!info) return true;

  const expenseDay = dateKey(date);
  if (expenseDay < info.joinedAt) return false;
  if (info.leftAt && expenseDay > info.leftAt) return false;
  return true;
}
