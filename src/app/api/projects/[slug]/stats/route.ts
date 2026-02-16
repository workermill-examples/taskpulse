import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { DashboardStats, RunStatus } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Check project access
    const accessResult = await requireProjectAccess(request, slug, "VIEWER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Calculate date ranges
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for better performance
    const [
      runsByStatusResult,
      runsByTaskResult,
      runsOverTimeResult,
      avgDurationResult,
      totalRunsResult,
      failedRunsLast24hResult,
    ] = await Promise.all([
      // Runs by status
      prisma.run.groupBy({
        by: ["status"],
        where: { projectId: project.id },
        _count: { _all: true },
      }),

      // Runs by task
      prisma.run.groupBy({
        by: ["taskId"],
        where: { projectId: project.id },
        _count: { taskId: true },
        orderBy: { _count: { taskId: "desc" } },
        take: 10, // Top 10 tasks
      }),

      // Runs over time (last 30 days)
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM runs
        WHERE project_id = ${project.id}
          AND created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) ASC
      `,

      // Average duration (only for completed runs)
      prisma.run.aggregate({
        where: {
          projectId: project.id,
          status: "COMPLETED",
          duration: { not: null },
        },
        _avg: { duration: true },
      }),

      // Total runs count
      prisma.run.count({
        where: { projectId: project.id },
      }),

      // Failed runs in last 24 hours
      prisma.run.count({
        where: {
          projectId: project.id,
          status: "FAILED",
          createdAt: { gte: yesterday },
        },
      }),
    ]);

    // Get task information for runs by task
    const taskIds = runsByTaskResult.map(r => r.taskId);
    const tasks = taskIds.length > 0 ? await prisma.task.findMany({
      where: {
        id: { in: taskIds },
      },
      select: {
        id: true,
        name: true,     // Display name
        handler: true,  // Machine name
      },
    }) : [];

    // Create task lookup map
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    // Process runs by status
    const runsByStatus: Record<RunStatus, number> = {
      QUEUED: 0,
      EXECUTING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
      TIMED_OUT: 0,
    };

    for (const result of runsByStatusResult) {
      runsByStatus[result.status as RunStatus] = result._count._all;
    }

    // Process runs by task
    const runsByTask = runsByTaskResult.map(result => {
      const task = taskMap.get(result.taskId);
      return {
        taskName: (task as any)?.handler || "Unknown", // Machine name
        taskDisplayName: (task as any)?.name || "Unknown", // Display name
        count: result._count.taskId,
      };
    });

    // Process runs over time
    const runsOverTime = runsOverTimeResult.map(result => ({
      date: result.date,
      count: Number(result.count),
    }));

    // Fill in missing dates with 0 counts
    const completeRunsOverTime: Array<{ date: string; count: number }> = [];
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const existing = runsOverTime.find(r => r.date === dateStr);
      completeRunsOverTime.push({
        date: dateStr,
        count: existing?.count || 0,
      });
    }

    // Calculate success rate
    const completedRuns = runsByStatus.COMPLETED;
    const successRate = totalRunsResult > 0 ? (completedRuns / totalRunsResult) * 100 : 0;

    const stats: DashboardStats = {
      runsByStatus,
      runsByTask,
      runsOverTime: completeRunsOverTime,
      avgDuration: avgDurationResult._avg.duration,
      successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      totalRuns: totalRunsResult,
      failedRuns: failedRunsLast24hResult,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
}