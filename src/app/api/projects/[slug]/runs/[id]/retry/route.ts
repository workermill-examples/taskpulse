import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { simulateRun } from "@/lib/run-simulator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need MEMBER+ to retry runs
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { user, project } = accessResult;

    // Find original run and verify it belongs to the project
    const originalRun = await prisma.run.findFirst({
      where: {
        id,
        projectId: project.id,
      },
      include: {
        task: true,
      },
    });

    if (!originalRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Can only retry runs that are in terminal states (FAILED, CANCELLED, TIMED_OUT)
    if (!["FAILED", "CANCELLED", "TIMED_OUT"].includes(originalRun.status)) {
      return NextResponse.json(
        { error: "Run cannot be retried in its current state" },
        { status: 400 }
      );
    }

    // Simulate the retry run
    const simulation = simulateRun(
      project.id,
      originalRun.task,
      originalRun.input,
      "retry"
    );

    // Create the retry run with steps and logs
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
          create: [
            // Add initial retry log
            {
              level: "INFO",
              message: `Retrying run ${originalRun.id}`,
              metadata: {
                originalRunId: originalRun.id,
                originalStatus: originalRun.status,
                retriedAt: new Date().toISOString(),
              },
              timestamp: new Date(),
            },
            // Add simulated logs
            ...simulation.logs.map(log => ({
              level: log.level,
              message: log.message,
              metadata: log.metadata || {},
              timestamp: log.timestamp,
            })),
          ],
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

    // Return the new retry run with correct field mapping
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
      originalRunId: originalRun.id,
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
    console.error("Error retrying run:", error);
    return NextResponse.json({ error: "Failed to retry run" }, { status: 500 });
  }
}