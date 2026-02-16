import { chromium, FullConfig } from "@playwright/test";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcrypt";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  console.log("🔧 E2E Global Setup: Starting...");

  // Ensure DATABASE_URL is set for tests
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for E2E tests");
  }

  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = "test-secret-for-e2e";
  }

  if (!process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
  }

  if (!process.env.AUTH_TRUST_HOST) {
    process.env.AUTH_TRUST_HOST = "true";
  }

  console.log("✓ Environment variables configured");

  // Initialize Prisma client
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // Ensure database is ready
    console.log("📊 Checking database connection...");
    await prisma.$connect();
    console.log("✓ Database connection established");

    // Run seed script to ensure demo data exists
    console.log("🌱 Running seed script...");
    try {
      await execAsync("npm run db:seed", { cwd: process.cwd() });
      console.log("✓ Seed script completed successfully");
    } catch (seedError) {
      console.log("⚠️ Seed script had issues, but continuing (may be idempotent)");
      console.log(seedError);
    }

    // Verify demo user exists
    const demoUser = await prisma.user.findUnique({
      where: { email: "demo@workermill.com" }
    });

    if (!demoUser) {
      console.log("🔧 Creating demo user for E2E tests...");
      const passwordHash = await bcrypt.hash("demo1234", 12);
      await prisma.user.create({
        data: {
          email: "demo@workermill.com",
          name: "Demo User",
          passwordHash,
        },
      });
    }

    // Verify demo project exists
    const demoProject = await prisma.project.findUnique({
      where: { slug: "acme-backend" }
    });

    if (!demoProject) {
      console.log("🔧 Creating demo project for E2E tests...");
      const project = await prisma.project.create({
        data: {
          name: "Acme Backend Services",
          slug: "acme-backend",
          description: "E2E test project",
          settings: {
            theme: "dark",
            notifications: { email: true, webhook: false },
            retentionDays: 30
          },
        },
      });

      // Add membership if user exists
      if (demoUser) {
        await prisma.projectMember.create({
          data: {
            userId: demoUser.id,
            projectId: project.id,
            role: "OWNER",
          },
        });
      }
    }

    console.log("✓ Demo data verified");

  } catch (error) {
    console.error("❌ Database setup failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  console.log("🎉 E2E Global Setup: Completed successfully");
}

export default globalSetup;