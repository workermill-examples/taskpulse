import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcrypt";
import { subDays, startOfDay, addHours } from "date-fns";
import { simulateRun, simulateQueuedRun, simulateExecutingRun } from "../src/lib/run-simulator";

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting expanded seed data generation...");

  // 1. Create demo user (idempotent)
  console.log("Creating demo user...");
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@workermill.com" },
    update: {},
    create: {
      email: "demo@workermill.com",
      name: "Demo User",
      passwordHash,
    },
  });

  console.log(`✓ Demo user: ${demoUser.email} (${demoUser.id})`);

  // 2. Create "Acme Backend Services" project (idempotent)
  console.log("Creating demo project...");
  const project = await prisma.project.upsert({
    where: { slug: "acme-backend" },
    update: {},
    create: {
      name: "Acme Backend Services",
      slug: "acme-backend",
      description: "Background processing for Acme Corp's core services including payments, notifications, and reporting",
      settings: {
        theme: "dark",
        notifications: {
          email: true,
          webhook: false
        },
        retentionDays: 30
      },
    },
  });

  console.log(`✓ Project: ${project.name} (${project.id})`);

  // 3. Add demo user as project OWNER (idempotent)
  const membership = await prisma.projectMember.upsert({
    where: {
      userId_projectId: {
        userId: demoUser.id,
        projectId: project.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      projectId: project.id,
      role: "OWNER",
    },
  });

  console.log(`✓ Project membership: ${demoUser.name} as OWNER`);

  // 4. Create 5 TaskDefinitions with stepTemplates
  console.log("Creating task definitions...");

  const taskDefinitions = [
    {
      name: "process-payment",
      description: "Process customer payments and update billing records",
      handler: "payments.processPayment",
      config: {
        stepTemplates: [
          { name: "validate-payment-data", avgDuration: 2000 },
          { name: "charge-payment-method", avgDuration: 4000 },
          { name: "update-billing-record", avgDuration: 1500 },
          { name: "send-confirmation-email", avgDuration: 1000 },
        ]
      },
      timeout: 30000,
      retryLimit: 3,
      priority: 5,
      tags: ["payment", "billing", "critical"],
    },
    {
      name: "send-notification-email",
      description: "Send transactional emails to users",
      handler: "emails.sendNotification",
      config: {
        stepTemplates: [
          { name: "validate-recipient", avgDuration: 800 },
          { name: "render-email-template", avgDuration: 2000 },
          { name: "send-via-provider", avgDuration: 3000 },
          { name: "track-delivery", avgDuration: 500 },
        ]
      },
      timeout: 20000,
      retryLimit: 2,
      priority: 3,
      tags: ["email", "notification"],
    },
    {
      name: "generate-monthly-report",
      description: "Generate comprehensive monthly analytics reports",
      handler: "reports.generateMonthly",
      config: {
        stepTemplates: [
          { name: "collect-analytics-data", avgDuration: 8000 },
          { name: "calculate-metrics", avgDuration: 12000 },
          { name: "generate-charts", avgDuration: 6000 },
          { name: "compile-pdf-report", avgDuration: 4000 },
          { name: "upload-to-storage", avgDuration: 2000 },
        ]
      },
      timeout: 120000,
      retryLimit: 1,
      priority: 2,
      tags: ["reporting", "analytics", "monthly"],
    },
    {
      name: "sync-inventory-data",
      description: "Synchronize product inventory with external systems",
      handler: "inventory.syncData",
      config: {
        stepTemplates: [
          { name: "fetch-external-inventory", avgDuration: 5000 },
          { name: "validate-data-format", avgDuration: 1500 },
          { name: "update-local-inventory", avgDuration: 3000 },
          { name: "notify-stakeholders", avgDuration: 1000 },
        ]
      },
      timeout: 45000,
      retryLimit: 2,
      priority: 4,
      tags: ["inventory", "sync", "integration"],
    },
    {
      name: "process-image-uploads",
      description: "Process and optimize user-uploaded images",
      handler: "images.processUpload",
      config: {
        stepTemplates: [
          { name: "validate-image-format", avgDuration: 1000 },
          { name: "resize-and-optimize", avgDuration: 8000 },
          { name: "generate-thumbnails", avgDuration: 3000 },
          { name: "upload-to-cdn", avgDuration: 2000 },
        ]
      },
      timeout: 60000,
      retryLimit: 1,
      priority: 1,
      tags: ["images", "processing", "cdn"],
    },
  ];

  const createdTasks = [];
  for (const taskDef of taskDefinitions) {
    // Check if task already exists first
    let task = await prisma.task.findFirst({
      where: {
        projectId: project.id,
        name: taskDef.name,
      },
    });

    if (!task) {
      task = await prisma.task.create({
        data: {
          ...taskDef,
          projectId: project.id,
          createdBy: demoUser.id,
        },
      });
    }

    createdTasks.push(task);
    console.log(`✓ Task: ${task.name}`);
  }

  // 5. Generate 50 runs distributed over 7 days
  console.log("Generating run data...");

  // Distribution: payment (15), email (12), report (10), inventory (8), image (5)
  const runDistribution = [
    { task: createdTasks[0], count: 15 }, // process-payment
    { task: createdTasks[1], count: 12 }, // send-notification-email
    { task: createdTasks[2], count: 10 }, // generate-monthly-report
    { task: createdTasks[3], count: 8 },  // sync-inventory-data
    { task: createdTasks[4], count: 5 },  // process-image-uploads
  ];

  // Status distribution: 35 COMPLETED, 8 FAILED, 4 EXECUTING, 3 QUEUED
  const statusDistribution = [
    { status: 'COMPLETED', count: 35 },
    { status: 'FAILED', count: 8 },
    { status: 'EXECUTING', count: 4 },
    { status: 'QUEUED', count: 3 },
  ];

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);

  let runCounter = 0;
  const allRuns = [];

  // Generate runs for each status type
  for (const statusConfig of statusDistribution) {
    for (let i = 0; i < statusConfig.count; i++) {
      // Pick a random task based on distribution
      const taskDistIndex = Math.floor(Math.random() * runDistribution.length);
      const selectedTask = runDistribution[taskDistIndex].task;

      // Create a random timestamp within the 7-day range
      const randomDay = Math.floor(Math.random() * 7);
      const randomHour = Math.floor(Math.random() * 24);
      const randomMinute = Math.floor(Math.random() * 60);

      const runDate = addHours(
        startOfDay(subDays(now, randomDay)),
        randomHour + (randomMinute / 60)
      );

      // Generate sample input data based on task type
      let inputData = null;
      if (selectedTask.name === 'process-payment') {
        inputData = {
          customerId: `cust_${Math.random().toString(36).substring(7)}`,
          amount: Math.floor(Math.random() * 50000) + 1000, // $10-$500
          currency: 'USD',
          paymentMethodId: `pm_${Math.random().toString(36).substring(7)}`,
        };
      } else if (selectedTask.name === 'send-notification-email') {
        inputData = {
          recipientId: `user_${Math.random().toString(36).substring(7)}`,
          templateId: ['welcome', 'password-reset', 'invoice'][Math.floor(Math.random() * 3)],
          variables: {
            userName: `User${Math.floor(Math.random() * 1000)}`,
            actionUrl: 'https://example.com/action',
          },
        };
      } else if (selectedTask.name === 'generate-monthly-report') {
        inputData = {
          reportType: 'analytics',
          month: Math.floor(Math.random() * 12) + 1,
          year: 2024,
          recipients: ['admin@acme.com', 'analytics@acme.com'],
        };
      } else if (selectedTask.name === 'sync-inventory-data') {
        inputData = {
          storeId: `store_${Math.floor(Math.random() * 10) + 1}`,
          syncType: 'full',
          categories: ['electronics', 'clothing', 'books'],
        };
      } else if (selectedTask.name === 'process-image-uploads') {
        inputData = {
          imageId: `img_${Math.random().toString(36).substring(7)}`,
          userId: `user_${Math.random().toString(36).substring(7)}`,
          originalFilename: `photo-${Date.now()}.jpg`,
          targetSizes: [100, 300, 800],
        };
      }

      let runData;

      if (statusConfig.status === 'COMPLETED' || statusConfig.status === 'FAILED') {
        // Use simulateRun for terminal states
        runData = simulateRun(project.id, selectedTask, inputData, 'manual');
        // Override the status if we want a failed run
        if (statusConfig.status === 'FAILED') {
          runData.run.status = 'FAILED';
          runData.run.error = runData.run.error || "Simulated failure for demo data";
        }
      } else if (statusConfig.status === 'EXECUTING') {
        runData = simulateExecutingRun(project.id, selectedTask, inputData, 'manual');
      } else if (statusConfig.status === 'QUEUED') {
        runData = simulateQueuedRun(project.id, selectedTask, inputData, 'manual');
      } else {
        throw new Error(`Unknown status: ${statusConfig.status}`);
      }

      // Override createdBy and timestamps
      runData.run.createdBy = demoUser.id;

      // Create the run with nested traces and logs
      const createdRun = await prisma.run.create({
        data: {
          ...runData.run,
          createdAt: runDate,
          traces: {
            create: runData.steps.map(step => ({
              ...step,
              runId: undefined, // Will be auto-set by Prisma
            })),
          },
          logs: {
            create: runData.logs.map(log => ({
              ...log,
              runId: undefined, // Will be auto-set by Prisma
            })),
          },
        },
        include: {
          traces: true,
          logs: true,
        },
      });

      allRuns.push(createdRun);
      runCounter++;

      if (runCounter % 10 === 0) {
        console.log(`✓ Generated ${runCounter} runs...`);
      }
    }
  }

  console.log(`✓ Generated ${runCounter} total runs`);

  // 6. Create 2 Schedules
  console.log("Creating schedules...");

  const schedules = [
    {
      name: "Nightly Analytics Report",
      description: "Generate and send daily analytics reports to stakeholders",
      cronExpr: "0 2 * * *", // 2 AM daily
      timezone: "UTC",
      input: {
        reportType: "daily",
        recipients: ["analytics@acme.com", "ceo@acme.com"],
        includeCharts: true,
      },
      taskId: createdTasks[2].id, // generate-monthly-report
      nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow at 2 AM
    },
    {
      name: "Inventory Sync",
      description: "Synchronize inventory data every 4 hours",
      cronExpr: "0 */4 * * *", // Every 4 hours
      timezone: "UTC",
      input: {
        storeId: "store_main",
        syncType: "incremental",
        categories: ["all"],
      },
      taskId: createdTasks[3].id, // sync-inventory-data
      nextRunAt: new Date(now.getTime() + 4 * 60 * 60 * 1000), // In 4 hours
    },
  ];

  for (const scheduleData of schedules) {
    // Check if schedule already exists first
    let schedule = await prisma.schedule.findFirst({
      where: {
        projectId: project.id,
        name: scheduleData.name,
      },
    });

    if (!schedule) {
      schedule = await prisma.schedule.create({
        data: {
          ...scheduleData,
          projectId: project.id,
        },
      });
    }

    console.log(`✓ Schedule: ${schedule.name}`);
  }

  // 7. Create 2 API Keys
  console.log("Creating API keys...");

  // Generate API keys with bcrypt hashes
  const productionKey = "ak_live_" + Array.from({length: 32}, () =>
    Math.random().toString(36).charAt(0)).join('');
  const stagingKey = "ak_test_" + Array.from({length: 32}, () =>
    Math.random().toString(36).charAt(0)).join('');

  const apiKeys = [
    {
      name: "Production API",
      key: productionKey,
      permissions: {
        scopes: ["run:create", "run:read", "task:read"],
        rateLimit: 1000,
        allowedTasks: ["process-payment", "send-notification-email"],
      },
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
    {
      name: "Staging Environment",
      key: stagingKey,
      permissions: {
        scopes: ["*"],
        rateLimit: 100,
        allowedTasks: ["*"],
      },
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  ];

  for (const keyData of apiKeys) {
    const keyHash = await bcrypt.hash(keyData.key, 12);
    const keyPreview = "..." + keyData.key.slice(-4); // Last 4 chars for UI display

    // Check if API key already exists by name in this project
    let apiKey = await prisma.apiKey.findFirst({
      where: {
        projectId: project.id,
        name: keyData.name,
      },
    });

    if (!apiKey) {
      apiKey = await prisma.apiKey.create({
        data: {
          name: keyData.name,
          keyHash,
          keyPreview,
          permissions: keyData.permissions,
          expiresAt: keyData.expiresAt,
          projectId: project.id,
          createdBy: demoUser.id,
        },
      });
    }

    console.log(`✓ API Key: ${apiKey.name} (${keyData.key})`);
  }

  console.log("\n🎉 Expanded seed data generation completed!");
  console.log(`
📊 Summary:
  • User: demo@workermill.com / demo1234
  • Project: Acme Backend Services (acme-backend)
  • Tasks: ${createdTasks.length} task definitions
  • Runs: ${allRuns.length} runs (${allRuns.filter(r => r.status === 'COMPLETED').length} completed, ${allRuns.filter(r => r.status === 'FAILED').length} failed, ${allRuns.filter(r => r.status === 'EXECUTING').length} executing, ${allRuns.filter(r => r.status === 'QUEUED').length} queued)
  • Schedules: ${schedules.length} scheduled tasks
  • API Keys: ${apiKeys.length} API keys
  `);

  // Display API keys for reference
  console.log("🔑 API Keys for testing:");
  console.log(`  Production: ${productionKey}`);
  console.log(`  Staging: ${stagingKey}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });