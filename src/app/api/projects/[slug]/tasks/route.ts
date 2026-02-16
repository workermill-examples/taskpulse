import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { registerTaskSchema, cursorPaginationSchema } from "@/lib/validations";

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

    // Check project access
    const accessResult = await requireProjectAccess(request, slug, "VIEWER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Build query conditions
    const whereClause: any = {
      projectId: project.id,
      isActive: true,
    };

    if (cursor) {
      whereClause.id = {
        lt: cursor,
      };
    }

    // Get tasks with run counts
    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { name: "asc" }, // Order by display name
      take: limit + 1, // Take one extra to check if there are more
      include: {
        runs: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1, // Get latest run for each task
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });

    const hasMore = tasks.length > limit;
    const actualTasks = hasMore ? tasks.slice(0, -1) : tasks;

    // Get detailed run counts for each task
    const taskIds = actualTasks.map(task => task.id);
    const runCounts = await prisma.run.groupBy({
      by: ['taskId', 'status'],
      where: {
        taskId: { in: taskIds },
      },
      _count: {
        id: true,
      },
    });

    // Transform tasks to include run counts and correct field mapping
    const tasksWithCounts = actualTasks.map(task => {
      // Parse step templates from config
      let stepTemplates: Array<{ name: string; avgDuration: number }> = [];
      if (task.config && typeof task.config === 'object' && task.config !== null) {
        const config = task.config as Record<string, any>;
        stepTemplates = config.stepTemplates || [];
      }

      // Calculate run counts for this task
      const taskRunCounts = runCounts.filter(count => count.taskId === task.id);
      const runCountsByStatus = {
        total: taskRunCounts.reduce((sum, count) => sum + count._count.id, 0),
        completed: taskRunCounts.find(c => c.status === 'COMPLETED')?._count.id || 0,
        failed: taskRunCounts.find(c => c.status === 'FAILED')?._count.id || 0,
        executing: taskRunCounts.find(c => c.status === 'EXECUTING')?._count.id || 0,
        queued: taskRunCounts.find(c => c.status === 'QUEUED')?._count.id || 0,
      };

      return {
        id: task.id,
        name: task.handler, // Machine name from handler field
        displayName: task.name, // Display name from name field
        description: task.description,
        retryLimit: task.retryLimit,
        retryDelay: (task.config as any)?.retryDelay || 5000,
        timeout: task.timeout || 300000,
        concurrency: (task.config as any)?.concurrency || 1,
        inputSchema: (task.config as any)?.inputSchema || null,
        stepTemplates,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        runCounts: runCountsByStatus,
        lastRun: task.runs[0] ? {
          id: task.runs[0].id,
          status: task.runs[0].status,
          startedAt: task.runs[0].startedAt?.toISOString() || null,
          completedAt: task.runs[0].completedAt?.toISOString() || null,
        } : null,
      };
    });

    const response = {
      data: tasksWithCounts,
      hasMore,
      cursor: hasMore ? actualTasks[actualTasks.length - 1].id : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Check project access - need MEMBER+ to register tasks
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { user, project } = accessResult;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = registerTaskSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid task data: " + validationResult.error.message },
        { status: 400 }
      );
    }

    const {
      name: machineNameFromClient, // This is the machine name (handler)
      displayName,
      description,
      retryLimit,
      retryDelay,
      timeout,
      concurrency,
      inputSchema,
      stepTemplates,
    } = validationResult.data;

    // Check if task handler (machine name) already exists in this project
    const existingTask = await prisma.task.findFirst({
      where: {
        projectId: project.id,
        handler: machineNameFromClient, // Check handler field for machine name uniqueness
        isActive: true,
      },
    });

    if (existingTask) {
      return NextResponse.json(
        { error: "Task name already exists" },
        { status: 409 }
      );
    }

    // Create the task with correct field mapping
    const task = await prisma.task.create({
      data: {
        name: displayName || machineNameFromClient, // Store display name in name field, fallback to machine name
        handler: machineNameFromClient, // Store machine name in handler field
        description,
        projectId: project.id,
        createdBy: user.id,
        retryLimit: retryLimit ?? 0,
        timeout: timeout,
        config: {
          retryDelay: retryDelay,
          concurrency: concurrency,
          inputSchema: inputSchema,
          stepTemplates: stepTemplates,
        },
      },
    });

    // Return the task with correct field mapping
    const response = {
      id: task.id,
      name: task.handler, // Return machine name as name
      displayName: task.name, // Return display name as displayName
      description: task.description,
      retryLimit: task.retryLimit,
      retryDelay,
      timeout: task.timeout || 300000,
      concurrency,
      inputSchema,
      stepTemplates,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}