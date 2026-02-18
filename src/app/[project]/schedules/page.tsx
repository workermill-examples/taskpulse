import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SchedulesPageClient from "./SchedulesPageClient";
import EmptyState from "@/components/shared/EmptyState";

interface SchedulesPageProps {
  params: Promise<{ project: string }>;
}

// Helper function to get schedules for a project
async function getSchedulesForProject(projectSlug: string, userId: string) {
  // Find project and verify access
  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      members: {
        some: {
          userId: userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      members: {
        where: { userId: userId },
        select: { role: true },
      },
    },
  });

  if (!project) {
    return null;
  }

  const userRole = project.members[0]?.role;

  // Get schedules with task information
  const schedules = await prisma.schedule.findMany({
    where: {
      projectId: project.id,
    },
    orderBy: { createdAt: "desc" },
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

  // Transform schedules to include task displayName
  const schedulesWithTaskInfo = schedules.map(schedule => ({
    id: schedule.id,
    name: schedule.name,
    description: schedule.description || undefined,
    cronExpression: schedule.cronExpr, // Map cronExpr to cronExpression for frontend
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
      description: schedule.task.description || undefined,
    },
  }));

  return {
    project,
    schedules: schedulesWithTaskInfo,
    userRole,
  };
}

export default async function SchedulesPage({ params }: SchedulesPageProps) {
  const { project } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get schedules data
  const result = await getSchedulesForProject(project, session.user.id);
  if (!result) {
    redirect("/projects");
  }

  const { project: projectData, schedules, userRole } = result;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Schedules</h1>
        <p className="text-gray-400 mt-1">
          {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} configured
        </p>
      </div>

      {/* Schedules List + Actions */}
      <SchedulesPageClient
        schedules={schedules}
        projectSlug={project}
        userRole={userRole}
      />

      {schedules.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <EmptyState
            title="No schedules configured"
            description="Create your first schedule to run tasks automatically on a cron schedule."
          />
        </div>
      )}
    </div>
  );
}