/**
 * Run import test: npx tsx scripts/test-import.ts
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { importCsvToGroup } from "../src/lib/import/importer";

const prisma = new PrismaClient();

async function main() {
  const csvPath = path.join(process.cwd(), "expenses_export.csv");
  const content = fs.readFileSync(csvPath, "utf-8");

  let user = await prisma.user.findUnique({ where: { email: "aisha@flat.test" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "aisha@flat.test",
        passwordHash: await bcrypt.hash("password123", 10),
        name: "Aisha",
      },
    });
  }

  // Clean previous test data
  await prisma.importAnomaly.deleteMany({});
  await prisma.expenseSplit.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.importSession.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});

  const group = await prisma.group.create({
    data: {
      name: "Flatmates",
      description: "Feb–Apr 2026 shared expenses",
      createdById: user.id,
      members: {
        create: [
          { displayName: "Aisha", joinedAt: new Date("2026-02-01") },
          { displayName: "Rohan", joinedAt: new Date("2026-02-01") },
          { displayName: "Priya", joinedAt: new Date("2026-02-01") },
          { displayName: "Meera", joinedAt: new Date("2026-02-01"), leftAt: new Date("2026-03-31") },
          { displayName: "Dev", joinedAt: new Date("2026-02-08"), leftAt: new Date("2026-03-14") },
          { displayName: "Sam", joinedAt: new Date("2026-04-08") },
        ],
      },
    },
  });

  const result = await importCsvToGroup(group.id, content, "expenses_export.csv");

  console.log("\n=== IMPORT REPORT ===");
  console.log(`Imported: ${result.imported}`);
  console.log(`Settlements: ${result.settlements}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Pending approval: ${result.pendingApproval}`);
  console.log(`Anomalies: ${result.anomalies.length}\n`);

  const byType = new Map<string, number>();
  for (const a of result.anomalies) {
    byType.set(a.anomalyType, (byType.get(a.anomalyType) || 0) + 1);
  }
  console.log("Anomaly types:");
  for (const [type, count] of Array.from(byType.entries()).sort()) {
    console.log(`  ${type}: ${count}`);
  }

  console.log("\nDetailed anomalies:");
  for (const a of result.anomalies) {
    console.log(`  Row ${a.rowNumber} [${a.anomalyType}] ${a.action}: ${a.description}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
