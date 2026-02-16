import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskConfig from "@/components/tasks/TaskConfig";
import RunsTable from "@/components/runs/RunsTable";
import RunStatusBadge from "@/components/runs/RunStatusBadge";
import { formatRelativeTime } from "@/lib/utils";

interface TaskDetailPageProps {
  params: Promise<{ project: string; id: string }>;
}

// Helper function to get task detail with recent runs
async function getTaskDetail(projectSlug: string, taskId: string) {
  // Find project and verify access
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true, name: true },
  });

  if (!project) {
    return null;
  }

  // Find task and verify it belongs to the project
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
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
    return null;
  }

  // Get recent runs for this task (last 10)
  const recentRuns = await prisma.run.findMany({
    where: {
      taskId: task.id,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      duration: true,
      error: true,
      createdAt: true,
      triggeredBy: true,
      task: {
        select: {
          id: true,
          name: true,
          handler: true,
        },
      },
    },
  });

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

  // Transform task and runs for display
  const taskDetail = {
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
      status: task.runs[0].status as "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT",
      startedAt: task.runs[0].startedAt?.toISOString() || null,
      completedAt: task.runs[0].completedAt?.toISOString() || null,
    } : null,
  };

  const transformedRuns = recentRuns.map(run => ({
    id: run.id,
    status: run.status as "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT",
    startedAt: run.startedAt?.toISOString() || null,
    completedAt: run.completedAt?.toISOString() || null,
    duration: run.duration,
    error: run.error,
    triggeredBy: run.triggeredBy,
    createdAt: run.createdAt.toISOString(),
    task: {
      id: run.task.id,
      displayName: run.task.name,
      name: run.task.handler,
    },
  }));

  return {
    project,
    task: taskDetail,
    recentRuns: transformedRuns,
  };
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { project, id } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Get task detail
  const result = await getTaskDetail(project, id);
  if (!result) {
    notFound();
  }

  const { project: projectData, task, recentRuns } = result;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-gray-400">
        <Link
          href={`/${project}/tasks`}
          className="hover:text-violet-400 transition-colors"
        >
          Tasks
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-100">{task.displayName}</span>
      </nav>

      {/* Task Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">
              {task.displayName}
            </h1>
            <p className="text-sm text-gray-500 font-mono mb-4">
              {task.name}
            </p>
            {task.description && (
              <p className="text-gray-400 mb-6">{task.description}</p>
            )}
          </div>
          <Link
            href={`/${project}/runs?taskId=${task.id}`}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Trigger Run
          </Link>
        </div>

        {/* Task Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <div className="text-2xl font-bold text-gray-100">
              {task.runCounts.total}
            </div>
            <div className="text-sm text-gray-500">Total Runs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {task.runCounts.completed}
            </div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">
              {task.runCounts.failed}
            </div>
            <div className="text-sm text-gray-500">Failed</div>
          </div>
          <div className="flex items-center gap-2">
            {task.lastRun ? (
              <>
                <RunStatusBadge status={task.lastRun.status} size="sm" />
                <span className="text-sm text-gray-400">
                  {task.lastRun.startedAt
                    ? formatRelativeTime(new Date(task.lastRun.startedAt))
                    : "—"}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500">No runs yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Task Configuration */}
      <TaskConfig task={task} />

      {/* Recent Runs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100">
            Recent Runs ({recentRuns.length})
          </h2>
          {recentRuns.length > 0 && (
            <Link
              href={`/${project}/runs?taskId=${task.id}`}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              View All Runs →
            </Link>
          )}
        </div>

        {recentRuns.length > 0 ? (
          <RunsTable
            projectSlug={project}
            initialData={{
              data: recentRuns,
              hasMore: false,
              cursor: undefined,
            }}
            tasks={[{
              id: task.id,
              name: task.name,
              displayName: task.displayName,
            }]}
          />
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No runs have been triggered for this task yet.</p>
            <Link
              href={`/${project}/runs`}
              className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Trigger First Run
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}