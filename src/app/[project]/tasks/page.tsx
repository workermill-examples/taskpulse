import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskCard from "@/components/tasks/TaskCard";
import EmptyState from "@/components/shared/EmptyState";

interface TasksPageProps {
  params: Promise<{ project: string }>;
}

// Helper function to get tasks for a project
async function getTasksForProject(projectSlug: string) {
  // Find project and verify access
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true, name: true },
  });

  if (!project) {
    return null;
  }

  // Get tasks with run counts
  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
      isActive: true,
    },
    orderBy: { name: "asc" }, // Order by display name
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

  // Get detailed run counts for each task
  const taskIds = tasks.map((task: any) => task.id);
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
  const tasksWithCounts = tasks.map((task: any) => {
    // Parse step templates from config
    let stepTemplates: Array<{ name: string; avgDuration: number }> = [];
    if (task.config && typeof task.config === 'object' && task.config !== null) {
      const config = task.config as Record<string, any>;
      stepTemplates = config.stepTemplates || [];
    }

    // Calculate run counts for this task
    const taskRunCounts = runCounts.filter((count: any) => count.taskId === task.id);
    const runCountsByStatus = {
      total: taskRunCounts.reduce((sum: number, count: any) => sum + count._count.id, 0),
      completed: taskRunCounts.find((c: any) => c.status === 'COMPLETED')?._count.id || 0,
      failed: taskRunCounts.find((c: any) => c.status === 'FAILED')?._count.id || 0,
      executing: taskRunCounts.find((c: any) => c.status === 'EXECUTING')?._count.id || 0,
      queued: taskRunCounts.find((c: any) => c.status === 'QUEUED')?._count.id || 0,
    };

    return {
      id: task.id,
      name: task.handler, // Machine name from handler field
      displayName: task.name, // Display name from name field
      description: task.description,
      stepTemplates,
      runCounts: runCountsByStatus,
      lastRun: task.runs[0] ? {
        id: task.runs[0].id,
        status: task.runs[0].status as "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT",
        startedAt: task.runs[0].startedAt?.toISOString() || null,
        completedAt: task.runs[0].completedAt?.toISOString() || null,
      } : null,
    };
  });

  return {
    project,
    tasks: tasksWithCounts,
  };
}

export default async function TasksPage({ params }: TasksPageProps) {
  const { project } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Get tasks data
  const result = await getTasksForProject(project);
  if (!result) {
    redirect("/projects");
  }

  const { project: projectData, tasks } = result;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Tasks</h1>
          <p className="text-gray-400 mt-1">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} registered
          </p>
        </div>
      </div>

      {/* Tasks Grid */}
      {tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tasks.map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              projectSlug={project}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <EmptyState
            title="No tasks found"
            description="No tasks have been registered yet. Tasks are automatically registered when your application starts up."
          />
        </div>
      )}
    </div>
  );
}