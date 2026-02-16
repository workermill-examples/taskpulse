import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getUserProjectMembership } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import RunsPageClient from "./RunsPageClient";
import type { RunStatus } from "@/types";

interface RunListItem {
  id: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  triggeredBy: string;
  createdAt: string;
  task: {
    id: string;
    displayName: string;
    name: string;
  };
}

interface Task {
  id: string;
  name: string;
  displayName: string;
}

async function fetchInitialRunsData(projectId: string): Promise<{
  data: RunListItem[];
  hasMore: boolean;
  cursor?: string;
}> {
  try {
    const runs = await prisma.run.findMany({
      where: {
        projectId,
      },
      orderBy: { createdAt: "desc" },
      take: 21, // Take one extra to check if there are more
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

    const hasMore = runs.length > 20;
    const actualRuns = hasMore ? runs.slice(0, -1) : runs;

    const transformedRuns: RunListItem[] = actualRuns.map((run) => ({
      id: run.id,
      status: run.status as RunStatus,
      startedAt: run.startedAt?.toISOString() || null,
      completedAt: run.completedAt?.toISOString() || null,
      duration: run.duration,
      error: run.error,
      triggeredBy: "manual", // Default for now
      createdAt: run.createdAt.toISOString(),
      task: {
        id: run.task.id,
        displayName: run.task.name, // Display name from name field
        name: run.task.handler, // Machine name from handler field
      },
    }));

    return {
      data: transformedRuns,
      hasMore,
      cursor: hasMore ? actualRuns[actualRuns.length - 1].id : undefined,
    };
  } catch (error) {
    console.error("Error fetching runs:", error);
    return { data: [], hasMore: false };
  }
}

async function fetchTasks(projectId: string): Promise<Task[]> {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true, // Display name
        handler: true, // Machine name
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      name: task.handler, // Machine name from handler field
      displayName: task.name, // Display name from name field
    }));
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

export default async function RunsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectSlug } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check project access
  const membership = await getUserProjectMembership(projectSlug, session.user.id);
  if (!membership) {
    notFound();
  }

  // Fetch initial data server-side
  const [initialRuns, tasks] = await Promise.all([
    fetchInitialRunsData(membership.project.id),
    fetchTasks(membership.project.id),
  ]);

  return (
    <RunsPageClient
      projectSlug={projectSlug}
      initialData={{
        runs: initialRuns,
        tasks,
      }}
    />
  );
}