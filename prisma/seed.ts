import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcrypt";

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 12);

  await prisma.user.upsert({
    where: { email: "demo@workermill.com" },
    update: {},
    create: {
      email: "demo@workermill.com",
      name: "Demo User",
      passwordHash,
    },
  });

  console.log("Seed complete: demo user created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());