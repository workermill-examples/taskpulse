import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { triggerRunSchema, runFilterSchema, cursorPaginationSchema } from "@/lib/validations";
import { simulateRun } from "@/lib/run-simulator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  try {
    // Validate pagination parameters
    const paginationResult = cursorPaginationSchema.safeParse({
      cursor: searchParams.get("cursor") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    });

    if (!paginationResult.success) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 });
    }

    const { cursor, limit } = paginationResult.data;

    // Validate filter parameters
    const filterResult = runFilterSchema.safeParse({
      status: searchParams.get("status") || undefined,
      taskId: searchParams.get("taskId") || undefined,
      triggeredBy: searchParams.get("triggeredBy") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    if (!filterResult.success) {
      return NextResponse.json({ error: "Invalid filter parameters" }, { status: 400 });
    }

    const filters = filterResult.data;

    // Check project access
    const accessResult = await requireProjectAccess(request, slug, "VIEWER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Build query conditions
    const whereClause: any = {
      projectId: project.id,
    };

    if (cursor) {
      whereClause.id = {
        lt: cursor,
      };
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.taskId) {
      whereClause.taskId = filters.taskId;
    }

    if (filters.from || filters.to) {
      whereClause.createdAt = {};
      if (filters.from) {
        whereClause.createdAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        whereClause.createdAt.lte = new Date(filters.to);
      }
    }

    // Get runs with task information
    const runs = await prisma.run.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Take one extra to check if there are more
      include: {
        task: {
          select: {
            id: true,
            name: true, // Display name
            handler: true, // Machine name
          },
        },
      },
    });

    const hasMore = runs.length > limit;
    const actualRuns = hasMore ? runs.slice(0, -1) : runs;

    // Calculate attempt numbers for each run
    const runsWithAttempts = await Promise.all(
      actualRuns.map(async (run) => {
        // Calculate attempt number by counting previous runs with same task and input
        const inputString = run.input ? JSON.stringify(run.input) : null;

        const allRunsForTask = await prisma.run.findMany({
          where: {
            taskId: run.taskId,
          },
          select: {
            input: true,
            createdAt: true,
          },
        });

        const matchingRuns = allRunsForTask.filter(r => {
          const runInputString = r.input ? JSON.stringify(r.input) : null;
          return runInputString === inputString && r.createdAt <= run.createdAt;
        });

        const attemptCount = matchingRuns.length;

        return {
          id: run.id,
          status: run.status,
          startedAt: run.startedAt?.toISOString() || null,
          completedAt: run.completedAt?.toISOString() || null,
          duration: run.duration,
          error: run.error,
          triggeredBy: "manual", // Default for now - could be enhanced with proper tracking
          attempt: attemptCount,
          createdAt: run.createdAt.toISOString(),
          task: {
            id: run.task.id,
            displayName: run.task.name, // Display name from name field
            name: run.task.handler, // Machine name from handler field
          },
        };
      })
    );

    const response = {
      data: runsWithAttempts,
      hasMore,
      cursor: hasMore ? actualRuns[actualRuns.length - 1].id : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching runs:", error);
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Check project access - need MEMBER+ to trigger runs
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { user, project } = accessResult;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = triggerRunSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid run data: " + validationResult.error.message },
        { status: 400 }
      );
    }

    const { taskId, input } = validationResult.data;

    // Verify task exists and belongs to project
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId: project.id,
        isActive: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Use transaction to create run with all related data atomically
    const result = await prisma.$transaction(async (tx) => {
      // Calculate attempt number
      const attemptCount = await tx.run.count({
        where: {
          taskId: task.id,
          input: input ? JSON.parse(JSON.stringify(input)) : null,
        },
      });

      // Simulate the run
      const simulation = simulateRun(project.id, task, input, "manual");

      // Create the run with steps and logs
      const run = await tx.run.create({
        data: {
          ...simulation.run,
          createdBy: user.id,
          input: simulation.run.input as any,
          traces: {
            create: simulation.steps.map(step => ({
              ...step,
              runId: undefined, // Will be set by Prisma
              metadata: step.metadata as any || {},
            })),
          },
          logs: {
            create: simulation.logs.map(log => ({
              ...log,
              runId: undefined, // Will be set by Prisma
              metadata: log.metadata as any || {},
            })),
          },
        },
        include: {
          task: {
            select: {
              id: true,
              name: true, // Display name
              handler: true, // Machine name
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

      return {
        ...run,
        attempt: attemptCount + 1,
      };
    });

    // Return the run with correct field mapping
    const response = {
      id: result.id,
      status: result.status,
      input: result.input,
      output: result.output,
      error: result.error,
      duration: result.duration,
      startedAt: result.startedAt?.toISOString() || null,
      completedAt: result.completedAt?.toISOString() || null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      attempt: result.attempt,
      task: {
        id: result.task.id,
        displayName: result.task.name, // Display name from name field
        name: result.task.handler, // Machine name from handler field
      },
      traces: result.traces.map(trace => ({
        id: trace.id,
        name: trace.name,
        type: trace.type,
        startTime: trace.startTime.toISOString(),
        endTime: trace.endTime?.toISOString() || null,
        duration: trace.duration,
        status: trace.status,
        metadata: trace.metadata,
      })),
      logs: result.logs.map(log => ({
        id: log.id,
        level: log.level,
        message: log.message,
        metadata: log.metadata,
        timestamp: log.timestamp.toISOString(),
      })),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error triggering run:", error);
    return NextResponse.json({ error: "Failed to trigger run" }, { status: 500 });
  }
}