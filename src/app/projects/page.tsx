import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProjectsClient } from "./ProjectsClient";
import { ProjectListItem } from "@/types";

export default async function ProjectsPage() {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's projects with aggregated data
  const projects = await prisma.project.findMany({
    where: {
      members: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      members: {
        select: { id: true }
      },
      tasks: {
        select: { id: true }
      },
      runs: {
        select: {
          id: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      _count: {
        select: {
          runs: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Transform projects for client
  const projectsData: ProjectListItem[] = projects.map(project => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    memberCount: project.members.length,
    taskCount: project.tasks.length,
    recentRunCount: project._count.runs,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Projects</h1>
            <p className="text-gray-400 mt-2">
              Manage your TaskPulse projects and monitor task execution
            </p>
          </div>
        </div>

        <ProjectsClient projects={projectsData} />
      </div>
    </div>
  );
}