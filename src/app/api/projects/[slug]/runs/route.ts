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

    // Transform runs for response
    const transformedRuns = actualRuns.map((run) => {
      return {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt?.toISOString() || null,
        completedAt: run.completedAt?.toISOString() || null,
        duration: run.duration,
        error: run.error,
        triggeredBy: "manual", // Default for now - could be enhanced with proper tracking
        createdAt: run.createdAt.toISOString(),
        task: {
          id: run.task.id,
          displayName: run.task.name, // Display name from name field
          name: run.task.handler, // Machine name from handler field
        },
      };
    });

    const response = {
      data: transformedRuns,
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

    // Simulate the run
    const simulation = simulateRun(project.id, task, input, "manual");

    // Create the run with steps and logs
    const result = await prisma.run.create({
      data: {
        projectId: simulation.run.projectId,
        taskId: simulation.run.taskId,
        status: simulation.run.status,
        input: simulation.run.input as any,
        output: simulation.run.output as any,
        error: simulation.run.error,
        duration: simulation.run.duration,
        startedAt: simulation.run.startedAt,
        completedAt: simulation.run.completedAt,
        createdBy: user.id,
        traces: {
          create: simulation.steps.map(step => ({
            name: step.name,
            type: step.type,
            startTime: step.startTime,
            endTime: step.endTime,
            duration: step.duration,
            status: step.status,
            parentId: step.parentId,
            metadata: step.metadata || {},
          })),
        },
        logs: {
          create: simulation.logs.map(log => ({
            level: log.level,
            message: log.message,
            metadata: log.metadata || {},
            timestamp: log.timestamp,
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