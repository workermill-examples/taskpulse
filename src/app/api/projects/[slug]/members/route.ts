import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { inviteMemberSchema } from "@/lib/validations";
import type { MemberWithUser } from "@/types";

/**
 * GET /api/projects/[slug]/members
 * Returns list of project members with user info
 * Requires project membership (any role)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Check project access (any role required)
  const accessResult = await requireProjectAccess(request, slug, "VIEWER");
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  const { project } = accessResult;

  try {
    // Get project members with user info
    const members = await prisma.projectMember.findMany({
      where: {
        projectId: project.id,
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
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      user: {
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
      },
    }));

    return NextResponse.json(membersResponse);
  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/members
 * Invites a new member to the project (ADMIN+ required)
 * Business rule: Cannot invite existing members (409)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Check project access (ADMIN+ required)
  const accessResult = await requireProjectAccess(request, slug, "ADMIN");
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  const { project } = accessResult;

  try {
    const body = await request.json();
    const validatedData = inviteMemberSchema.parse(body);

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: project.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "User is already a member of this project" },
        { status: 409 }
      );
    }

    // Create membership
    const newMember = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: project.id,
        role: validatedData.role,
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
    });

    const memberResponse: MemberWithUser = {
      id: newMember.id,
      role: newMember.role,
      createdAt: newMember.createdAt.toISOString(),
      updatedAt: newMember.updatedAt.toISOString(),
      user: {
        id: newMember.user.id,
        email: newMember.user.email,
        name: newMember.user.name,
      },
    };

    return NextResponse.json(memberResponse, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    console.error("Error inviting member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}