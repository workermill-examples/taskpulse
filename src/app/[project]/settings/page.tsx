import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserProjectMembership, hasPermission } from "@/lib/middleware";
import type { MemberWithUser, MemberRole } from "@/types";
import SettingsClient from "./SettingsClient";

interface SettingsPageProps {
  params: Promise<{ project: string }>;
}

// Helper function to get project settings data
async function getProjectSettings(projectSlug: string, userId: string) {
  // Get user's membership in the project
  const membership = await getUserProjectMembership(projectSlug, userId);

  if (!membership) {
    return null;
  }

  // Get all project members
  const members = await prisma.projectMember.findMany({
    where: {
      projectId: membership.project.id,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: [
      { role: "desc" }, // OWNER first, then ADMIN, etc.
      { createdAt: "asc" }, // Earliest members first within same role
    ],
  });

  const membersResponse: MemberWithUser[] = members.map((member) => ({
    id: member.id,
    role: member.role as MemberRole,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    user: {
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
    },
  }));

  return {
    project: membership.project,
    currentUserMembership: {
      id: membership.id,
      role: membership.role as MemberRole,
      userId: membership.userId,
    },
    members: membersResponse,
  };
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { project } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Get project settings data
  const result = await getProjectSettings(project, session.user.id);
  if (!result) {
    redirect("/projects");
  }

  const { project: projectData, currentUserMembership, members } = result;

  // Check if user can edit settings (ADMIN+ required)
  const canEditSettings = hasPermission(currentUserMembership.role, "ADMIN");

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage project settings, members, and configuration
        </p>
      </div>

      <SettingsClient
        project={projectData}
        currentUserMembership={currentUserMembership}
        members={members}
        canEditSettings={canEditSettings}
      />
    </div>
  );
}