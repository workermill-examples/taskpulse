import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";

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

    // Find run and verify it belongs to the project
    const run = await prisma.run.findFirst({
      where: {
        id,
        projectId: project.id,
      },
      include: {
        task: {
          select: {
            id: true,
            name: true, // Display name
            handler: true, // Machine name
            retryLimit: true,
            timeout: true,
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

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Calculate attempt number
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

    // Return run with correct field mapping and full details
    const response = {
      id: run.id,
      status: run.status,
      input: run.input,
      output: run.output,
      error: run.error,
      duration: run.duration,
      startedAt: run.startedAt?.toISOString() || null,
      completedAt: run.completedAt?.toISOString() || null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      attempt: attemptCount,
      task: {
        id: run.task.id,
        displayName: run.task.name, // Display name from name field
        name: run.task.handler, // Machine name from handler field
        retryLimit: run.task.retryLimit,
        timeout: run.task.timeout,
      },
      traces: run.traces.map(trace => ({
        id: trace.id,
        name: trace.name,
        type: trace.type,
        startTime: trace.startTime.toISOString(),
        endTime: trace.endTime?.toISOString() || null,
        duration: trace.duration,
        status: trace.status,
        metadata: trace.metadata,
      })),
      logs: run.logs.map(log => ({
        id: log.id,
        level: log.level,
        message: log.message,
        metadata: log.metadata,
        timestamp: log.timestamp.toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching run:", error);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}