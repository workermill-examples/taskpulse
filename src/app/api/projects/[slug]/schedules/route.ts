import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseExpression } from "cron-parser";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { createScheduleSchema, cursorPaginationSchema } from "@/lib/validations";

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
    };

    if (cursor) {
      whereClause.id = {
        lt: cursor,
      };
    }

    // Get schedules with task information
    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // Take one extra to check if there are more
      include: {
        task: {
          select: {
            id: true,
            name: true, // Display name
            handler: true, // Machine name
            description: true,
          },
        },
      },
    });

    const hasMore = schedules.length > limit;
    const actualSchedules = hasMore ? schedules.slice(0, -1) : schedules;

    // Transform schedules to include task displayName
    const schedulesWithTaskInfo = actualSchedules.map(schedule => ({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      cronExpression: schedule.cronExpr,
      timezone: schedule.timezone,
      enabled: schedule.status === "ACTIVE",
      nextRunAt: schedule.nextRunAt?.toISOString() || null,
      lastRunAt: schedule.lastRunAt?.toISOString() || null,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      task: {
        id: schedule.task.id,
        name: schedule.task.handler, // Machine name
        displayName: schedule.task.name, // Display name
        description: schedule.task.description,
      },
    }));

    const response = {
      data: schedulesWithTaskInfo,
      hasMore,
      cursor: hasMore ? actualSchedules[actualSchedules.length - 1].id : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Check project access - need MEMBER+ to create schedules
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid schedule data: " + validationResult.error.message },
        { status: 400 }
      );
    }

    const { taskId, cronExpression, description, timezone, enabled } = validationResult.data;

    // Validate cron expression
    let parsedCron;
    try {
      parsedCron = parseExpression(cronExpression, {
        tz: timezone,
        utc: timezone === 'UTC'
      });
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid cron expression: " + (error as Error).message },
        { status: 400 }
      );
    }

    // Verify task exists and belongs to project
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        projectId: project.id,
        isActive: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Calculate next run time
    const nextRunAt = enabled ? parsedCron.next().toDate() : null;

    // Create the schedule
    const schedule = await prisma.schedule.create({
      data: {
        name: description || `Schedule for ${task.name}`,
        description,
        cronExpr: cronExpression,
        timezone,
        status: enabled ? "ACTIVE" : "DISABLED",
        nextRunAt,
        projectId: project.id,
        taskId: task.id,
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            handler: true,
            description: true,
          },
        },
      },
    });

    // Return the schedule with correct field mapping
    const response = {
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      cronExpression: schedule.cronExpr,
      timezone: schedule.timezone,
      enabled: schedule.status === "ACTIVE",
      nextRunAt: schedule.nextRunAt?.toISOString() || null,
      lastRunAt: schedule.lastRunAt?.toISOString() || null,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      task: {
        id: schedule.task.id,
        name: schedule.task.handler, // Machine name
        displayName: schedule.task.name, // Display name
        description: schedule.task.description,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}