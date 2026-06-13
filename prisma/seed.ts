import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "aisha@flat.test" },
    update: {},
    create: {
      email: "aisha@flat.test",
      passwordHash,
      name: "Aisha",
    },
  });

  console.log("Seeded user:", user.email, "/ password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
