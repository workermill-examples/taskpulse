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

    // Check if we've exceeded retry limit
    const inputString = originalRun.input ? JSON.stringify(originalRun.input) : null;
    const allRuns = await prisma.run.findMany({
      where: {
        taskId: originalRun.taskId,
      },
      select: {
        input: true,
      },
    });

    const matchingRuns = allRuns.filter(r => {
      const runInputString = r.input ? JSON.stringify(r.input) : null;
      return runInputString === inputString;
    });

    const currentAttemptCount = matchingRuns.length;

    if (currentAttemptCount >= originalRun.task.retryLimit + 1) { // +1 because first attempt isn't a retry
      return NextResponse.json(
        { error: "Retry limit exceeded for this task" },
        { status: 400 }
      );
    }

    // Use transaction to create retry run with all related data atomically
    const result = await prisma.$transaction(async (tx) => {
      // Calculate new attempt number (use the count from above)
      const attemptCount = currentAttemptCount;

      // Simulate the retry run
      const simulation = simulateRun(
        project.id,
        originalRun.task,
        originalRun.input,
        "retry"
      );

      // Create the retry run with steps and logs
      const retryRun = await tx.run.create({
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
            create: [
              // Add initial retry log
              {
                level: "INFO",
                message: `Retrying run ${originalRun.id} (attempt ${attemptCount + 1})`,
                metadata: {
                  originalRunId: originalRun.id,
                  originalStatus: originalRun.status,
                  attemptNumber: attemptCount + 1,
                  retriedAt: new Date().toISOString(),
                } as any,
                timestamp: new Date(),
              },
              // Add simulated logs
              ...simulation.logs.map(log => ({
                ...log,
                runId: undefined, // Will be set by Prisma
                metadata: log.metadata as any || {},
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

      return {
        ...retryRun,
        attempt: attemptCount + 1,
      };
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
      attempt: result.attempt,
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