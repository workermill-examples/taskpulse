import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { registerTaskSchema } from "@/lib/validations";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access
    const accessResult = await requireProjectAccess(request, slug, "VIEWER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Find task and verify it belongs to the project
    const task = await prisma.task.findFirst({
      where: {
        id,
        projectId: project.id,
        isActive: true,
      },
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
          take: 1,
        },
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get detailed run counts
    const runCounts = await prisma.run.groupBy({
      by: ['status'],
      where: {
        taskId: task.id,
      },
      _count: {
        id: true,
      },
    });

    // Parse step templates from config
    let stepTemplates: Array<{ name: string; avgDuration: number }> = [];
    if (task.config && typeof task.config === 'object' && task.config !== null) {
      const config = task.config as Record<string, any>;
      stepTemplates = config.stepTemplates || [];
    }

    // Calculate run counts
    const runCountsByStatus = {
      total: runCounts.reduce((sum, count) => sum + count._count.id, 0),
      completed: runCounts.find(c => c.status === 'COMPLETED')?._count.id || 0,
      failed: runCounts.find(c => c.status === 'FAILED')?._count.id || 0,
      executing: runCounts.find(c => c.status === 'EXECUTING')?._count.id || 0,
      queued: runCounts.find(c => c.status === 'QUEUED')?._count.id || 0,
    };

    // Return task with correct field mapping
    const response = {
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need MEMBER+ to update tasks
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Find task and verify it belongs to the project
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        projectId: project.id,
        isActive: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Parse and validate request body (partial update)
    const body = await request.json();
    const updateSchema = registerTaskSchema.partial();
    const validationResult = updateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid task data: " + validationResult.error.message },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // If updating machine name (handler), check for conflicts
    if (updateData.name && updateData.name !== existingTask.handler) {
      const conflictingTask = await prisma.task.findFirst({
        where: {
          projectId: project.id,
          handler: updateData.name, // Check handler field for machine name uniqueness
          isActive: true,
          id: { not: id }, // Exclude current task
        },
      });

      if (conflictingTask) {
        return NextResponse.json(
          { error: "Task name already exists" },
          { status: 409 }
        );
      }
    }

    // Build update data with correct field mapping
    const updateFields: any = {};

    if (updateData.displayName) {
      updateFields.name = updateData.displayName; // Store display name in name field
    }

    if (updateData.name) {
      updateFields.handler = updateData.name; // Store machine name in handler field
    }

    if (updateData.description !== undefined) {
      updateFields.description = updateData.description;
    }

    if (updateData.retryLimit !== undefined) {
      updateFields.retryLimit = updateData.retryLimit;
    }

    if (updateData.timeout !== undefined) {
      updateFields.timeout = updateData.timeout;
    }

    // Update config if any config fields are provided
    const currentConfig = (existingTask.config as Record<string, any>) || {};
    let updatedConfig = { ...currentConfig };
    let configChanged = false;

    if (updateData.retryDelay !== undefined) {
      updatedConfig.retryDelay = updateData.retryDelay;
      configChanged = true;
    }

    if (updateData.concurrency !== undefined) {
      updatedConfig.concurrency = updateData.concurrency;
      configChanged = true;
    }

    if (updateData.inputSchema !== undefined) {
      updatedConfig.inputSchema = updateData.inputSchema;
      configChanged = true;
    }

    if (updateData.stepTemplates !== undefined) {
      updatedConfig.stepTemplates = updateData.stepTemplates;
      configChanged = true;
    }

    if (configChanged) {
      updateFields.config = updatedConfig;
    }

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateFields,
    });

    // Parse updated config
    let stepTemplates: Array<{ name: string; avgDuration: number }> = [];
    if (updatedTask.config && typeof updatedTask.config === 'object' && updatedTask.config !== null) {
      const config = updatedTask.config as Record<string, any>;
      stepTemplates = config.stepTemplates || [];
    }

    // Return updated task with correct field mapping
    const response = {
      id: updatedTask.id,
      name: updatedTask.handler, // Machine name from handler field
      displayName: updatedTask.name, // Display name from name field
      description: updatedTask.description,
      retryLimit: updatedTask.retryLimit,
      retryDelay: (updatedTask.config as any)?.retryDelay || 5000,
      timeout: updatedTask.timeout || 300000,
      concurrency: (updatedTask.config as any)?.concurrency || 1,
      inputSchema: (updatedTask.config as any)?.inputSchema || null,
      stepTemplates,
      createdAt: updatedTask.createdAt.toISOString(),
      updatedAt: updatedTask.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need ADMIN+ to delete tasks
    const accessResult = await requireProjectAccess(request, slug, "ADMIN");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Find task and verify it belongs to the project
    const task = await prisma.task.findFirst({
      where: {
        id,
        projectId: project.id,
        isActive: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Soft delete the task by setting isActive to false
    await prisma.task.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}