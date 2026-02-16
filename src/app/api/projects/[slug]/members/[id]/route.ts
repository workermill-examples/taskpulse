import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, hasPermission } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { MemberWithUser, MemberRole } from "@/types";

const updateMemberSchema = z.object({
  role: z.enum(["VIEWER", "MEMBER", "ADMIN", "OWNER"]),
});

/**
 * PUT /api/projects/[slug]/members/[id]
 * Updates member role (ADMIN+ required)
 * Business rules:
 * - Cannot demote the last OWNER
 * - Only OWNERs can manage other OWNERs
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  // Check project access (ADMIN+ required)
  const accessResult = await requireProjectAccess(request, slug, "ADMIN");
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  const { project, user: currentUser, membership: currentMembership } = accessResult;

  try {
    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    // Find the target member
    const targetMember = await prisma.projectMember.findUnique({
      where: {
        id,
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
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Business rule: Only OWNERs can manage other OWNERs
    if (targetMember.role === "OWNER" && currentMembership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions to manage owner" },
        { status: 403 }
      );
    }

    // Business rule: Cannot demote the last OWNER
    if (targetMember.role === "OWNER" && validatedData.role !== "OWNER") {
      const ownerCount = await prisma.projectMember.count({
        where: {
          projectId: project.id,
          role: "OWNER",
        },
      });

      if (ownerCount === 1) {
        return NextResponse.json(
          { error: "Cannot demote the last owner" },
          { status: 400 }
        );
      }
    }

    // Business rule: Only OWNERs can promote to OWNER
    if (validatedData.role === "OWNER" && currentMembership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions to promote to owner" },
        { status: 403 }
      );
    }

    // Update member role
    const updatedMember = await prisma.projectMember.update({
      where: { id },
      data: { role: validatedData.role },
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
      id: updatedMember.id,
      role: updatedMember.role,
      createdAt: updatedMember.createdAt.toISOString(),
      updatedAt: updatedMember.updatedAt.toISOString(),
      user: {
        id: updatedMember.user.id,
        email: updatedMember.user.email,
        name: updatedMember.user.name,
      },
    };

    return NextResponse.json(memberResponse);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]/members/[id]
 * Removes member from project (ADMIN+ or self)
 * Business rules:
 * - Members can self-remove (any role)
 * - Cannot remove the last OWNER
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  // Check project access (VIEWER minimum for self-removal check)
  const accessResult = await requireProjectAccess(request, slug, "VIEWER");
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  const { project, user: currentUser, membership: currentMembership } = accessResult;

  try {
    // Find the target member
    const targetMember = await prisma.projectMember.findUnique({
      where: {
        id,
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
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const isSelfRemoval = targetMember.userId === currentUser.id;

    // Check permissions: ADMIN+ can remove others, anyone can remove themselves
    if (!isSelfRemoval && !hasPermission(currentMembership.role, "ADMIN")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Business rule: Only OWNERs can remove other OWNERs (unless self-removal)
    if (targetMember.role === "OWNER" && !isSelfRemoval && currentMembership.role !== "OWNER") {
      return NextResponse.json(
        { error: "Insufficient permissions to remove owner" },
        { status: 403 }
      );
    }

    // Business rule: Cannot remove the last OWNER
    if (targetMember.role === "OWNER") {
      const ownerCount = await prisma.projectMember.count({
        where: {
          projectId: project.id,
          role: "OWNER",
        },
      });

      if (ownerCount === 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner" },
          { status: 400 }
        );
      }
    }

    // Remove member
    await prisma.projectMember.delete({
      where: { id },
    });

    return NextResponse.json({}, { status: 204 });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}