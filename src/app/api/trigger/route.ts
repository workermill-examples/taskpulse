import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { simulateRun } from "@/lib/run-simulator";
import { externalTriggerSchema } from "@/lib/validations";

/**
 * External trigger endpoint with API key authentication
 *
 * Authenticates via Bearer token, finds task by name, and creates a simulated run.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Extract and validate Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const bearerToken = authHeader.substring(7); // Remove "Bearer " prefix
    if (!bearerToken || bearerToken.length < 16) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 401 }
      );
    }

    // 2. Efficient API key lookup using prefix
    const keyPrefix = bearerToken.substring(0, 16);
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        keyPrefix: keyPrefix,
      },
      include: {
        project: true,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // 3. Verify the full API key with bcrypt
    const isValidKey = await bcrypt.compare(bearerToken, apiKey.keyHash);
    if (!isValidKey) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // 4. Check if API key is expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "API key expired" },
        { status: 401 }
      );
    }

    // 5. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const validation = externalTriggerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { task: taskName, input } = validation.data;

    // 6. Find task by name in the project
    const task = await prisma.task.findFirst({
      where: {
        name: taskName,
        projectId: apiKey.projectId,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // 7. Simulate the run execution
    const simulatedRun = simulateRun(
      apiKey.projectId,
      task,
      input || {},
      "api"
    );

    // 8. Create the run in the database with nested steps and logs
    const run = await prisma.run.create({
      data: {
        ...simulatedRun.run,
        createdBy: apiKey.createdBy, // Use the API key creator as the run creator
        traces: {
          create: simulatedRun.steps.map(step => ({
            ...step,
            runId: undefined, // Let Prisma handle the relation
          })),
        },
        logs: {
          create: simulatedRun.logs.map(log => ({
            ...log,
            runId: undefined, // Let Prisma handle the relation
          })),
        },
      },
      include: {
        task: {
          select: {
            name: true,
            description: true,
          },
        },
        traces: {
          orderBy: { startTime: "asc" },
        },
        logs: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    // 9. Update API key last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // 10. Return run summary
    const response = {
      id: run.id,
      status: run.status,
      task: {
        name: run.task.name,
        description: run.task.description,
      },
      input: run.input,
      output: run.output,
      error: run.error,
      duration: run.duration,
      stepCount: run.traces.length,
      logCount: run.logs.length,
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      createdAt: run.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error("External trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}