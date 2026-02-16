import { NextRequest, NextResponse } from "next/server";
import { parseExpression } from "cron-parser";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { updateScheduleSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access
    const accessResult = await requireProjectAccess(request, slug, "VIEWER");
    if (!accessResult || !('project' in accessResult)) {
      return accessResult as NextResponse;
    }

    const { project } = accessResult;

    // Find the schedule
    const schedule = await prisma.schedule.findFirst({
      where: {
        id,
        projectId: project.id,
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

    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Transform schedule with correct field mapping
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need MEMBER+ to update schedules
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
    if (!accessResult || !('project' in accessResult)) {
      return accessResult as NextResponse;
    }

    const { project } = accessResult;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateScheduleSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid schedule data: " + validationResult.error.message },
        { status: 400 }
      );
    }

    const { cronExpression, description, timezone, enabled } = validationResult.data;

    // Find the existing schedule
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id,
        projectId: project.id,
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

    if (!existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (description !== undefined) {
      updateData.description = description;
      // Update name if description changes and no custom name was set
      if (existingSchedule.name === `Schedule for ${existingSchedule.task.name}` || !existingSchedule.name) {
        updateData.name = description || `Schedule for ${existingSchedule.task.name}`;
      }
    }

    let nextRunAt = existingSchedule.nextRunAt;

    // Handle cron expression or timezone changes
    if (cronExpression !== undefined || timezone !== undefined) {
      const finalCronExpr = cronExpression || existingSchedule.cronExpr;
      const finalTimezone = timezone || existingSchedule.timezone;
      const finalEnabled = enabled !== undefined ? enabled : existingSchedule.status === "ACTIVE";

      // Validate cron expression if provided
      try {
        const parsedCron = parseExpression(finalCronExpr, {
          tz: finalTimezone,
          utc: finalTimezone === 'UTC'
        });
        // Recalculate next run time if enabled
        nextRunAt = finalEnabled ? parsedCron.next().toDate() : null;
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid cron expression: " + (error as Error).message },
          { status: 400 }
        );
      }

      if (cronExpression !== undefined) {
        updateData.cronExpr = cronExpression;
      }
      if (timezone !== undefined) {
        updateData.timezone = timezone;
      }
      updateData.nextRunAt = nextRunAt;
    }

    // Handle enabled/disabled state
    if (enabled !== undefined) {
      updateData.status = enabled ? "ACTIVE" : "DISABLED";

      // If disabling, set nextRunAt to null
      // If enabling and we haven't already calculated nextRunAt above, calculate it
      if (!enabled) {
        updateData.nextRunAt = null;
      } else if (nextRunAt === existingSchedule.nextRunAt) {
        // We haven't recalculated nextRunAt yet, so do it now
        try {
          const parsedCron = parseExpression(existingSchedule.cronExpr, {
            tz: existingSchedule.timezone,
            utc: existingSchedule.timezone === 'UTC'
          });
          updateData.nextRunAt = parsedCron.next().toDate();
        } catch (error) {
          return NextResponse.json(
            { error: "Invalid cron expression: " + (error as Error).message },
            { status: 400 }
          );
        }
      }
    }

    // Update the schedule
    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
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

    // Return the updated schedule with correct field mapping
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need ADMIN+ to delete schedules
    const accessResult = await requireProjectAccess(request, slug, "ADMIN");
    if (!accessResult || !('project' in accessResult)) {
      return accessResult as NextResponse;
    }

    const { project } = accessResult;

    // Find the schedule first to verify it exists and belongs to project
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id,
        projectId: project.id,
      },
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Delete the schedule
    await prisma.schedule.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}