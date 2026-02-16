import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import type { MemberRole } from "@/generated/prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

export interface ProjectMembership {
  id: string;
  role: MemberRole;
  userId: string;
  projectId: string;
  user: AuthenticatedUser;
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
}

export interface ProjectAccessResult {
  user: AuthenticatedUser;
  membership: ProjectMembership;
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
}

/**
 * Gets user's project membership and role
 */
export async function getUserProjectMembership(
  projectSlug: string,
  userId: string
): Promise<ProjectMembership | null> {
  return await prisma.projectMember.findFirst({
    where: {
      userId,
      project: {
        slug: projectSlug,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      },
    },
  });
}

/**
 * Checks if user has required permission level
 * Role hierarchy: VIEWER=0 < MEMBER=1 < ADMIN=2 < OWNER=3
 */
export function hasPermission(userRole: MemberRole, requiredRole: MemberRole): boolean {
  const roleHierarchy: Record<MemberRole, number> = {
    VIEWER: 0,
    MEMBER: 1,
    ADMIN: 2,
    OWNER: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Middleware function to require project access with optional role requirement
 * Returns 401 if not authenticated, 404 if project not found, 403 if insufficient permissions
 */
export async function requireProjectAccess(
  request: NextRequest,
  projectSlug: string,
  requiredRole: MemberRole = "VIEWER"
): Promise<ProjectAccessResult | NextResponse> {
  // Check authentication via NextAuth session
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const user: AuthenticatedUser = {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name || null,
  };

  // Get user's membership in the project
  const membership = await getUserProjectMembership(projectSlug, user.id);

  if (!membership) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  // Check if user has sufficient permissions
  if (!hasPermission(membership.role, requiredRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return {
    user,
    membership,
    project: membership.project,
  };
}