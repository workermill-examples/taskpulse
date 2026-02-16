import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need MEMBER+ to cancel runs
    const accessResult = await requireProjectAccess(request, slug, "MEMBER");
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
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Can only cancel runs that are QUEUED or EXECUTING
    if (run.status !== "QUEUED" && run.status !== "EXECUTING") {
      return NextResponse.json(
        { error: "Run cannot be cancelled in its current state" },
        { status: 400 }
      );
    }

    // Use transaction to update run and create cancellation log
    const updatedRun = await prisma.$transaction(async (tx) => {
      // Update run status
      const updated = await tx.run.update({
        where: { id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          error: "Run was cancelled by user",
        },
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

      // Add cancellation log entry
      await tx.log.create({
        data: {
          runId: id,
          level: "WARN",
          message: "Run was cancelled by user",
          metadata: {
            previousStatus: run.status,
            cancelledAt: new Date().toISOString(),
          },
          timestamp: new Date(),
        },
      });

      return updated;
    });

    // Return updated run with correct field mapping
    const response = {
      id: updatedRun.id,
      status: updatedRun.status,
      input: updatedRun.input,
      output: updatedRun.output,
      error: updatedRun.error,
      duration: updatedRun.duration,
      startedAt: updatedRun.startedAt?.toISOString() || null,
      completedAt: updatedRun.completedAt?.toISOString() || null,
      createdAt: updatedRun.createdAt.toISOString(),
      updatedAt: updatedRun.updatedAt.toISOString(),
      task: {
        id: updatedRun.task.id,
        displayName: updatedRun.task.name, // Display name from name field
        name: updatedRun.task.handler, // Machine name from handler field
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error cancelling run:", error);
    return NextResponse.json({ error: "Failed to cancel run" }, { status: 500 });
  }
}