import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { updateProjectSchema } from "@/lib/validations";
import type { ProjectListItem } from "@/types";

/**
 * GET /api/projects/[slug]
 * Returns project with member count, task count, recent run count
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
    // Get project with detailed stats
    const projectWithStats = await prisma.project.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
        runs: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!projectWithStats) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const projectResponse: ProjectListItem = {
      id: projectWithStats.id,
      name: projectWithStats.name,
      slug: projectWithStats.slug,
      description: projectWithStats.description,
      memberCount: projectWithStats._count.members,
      taskCount: projectWithStats._count.tasks,
      recentRunCount: projectWithStats.runs.length,
      createdAt: projectWithStats.createdAt.toISOString(),
      updatedAt: projectWithStats.updatedAt.toISOString(),
    };

    return NextResponse.json(projectResponse);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[slug]
 * Updates project (ADMIN+ required)
 */
export async function PUT(
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
    const validatedData = updateProjectSchema.parse(body);

    // Generate new slug if name is being updated
    let newSlug = slug;
    if (validatedData.name && validatedData.name !== project.name) {
      let baseSlug = validatedData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Ensure slug uniqueness (excluding current project)
      let candidateSlug = baseSlug;
      let counter = 1;
      while (true) {
        const existingProject = await prisma.project.findUnique({
          where: { slug: candidateSlug },
          select: { id: true },
        });

        if (!existingProject || existingProject.id === project.id) {
          newSlug = candidateSlug;
          break;
        }

        candidateSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(validatedData.name && { name: validatedData.name, slug: newSlug }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
      },
      include: {
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
        runs: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    const projectResponse: ProjectListItem = {
      id: updatedProject.id,
      name: updatedProject.name,
      slug: updatedProject.slug,
      description: updatedProject.description,
      memberCount: updatedProject._count.members,
      taskCount: updatedProject._count.tasks,
      recentRunCount: updatedProject.runs.length,
      createdAt: updatedProject.createdAt.toISOString(),
      updatedAt: updatedProject.updatedAt.toISOString(),
    };

    return NextResponse.json(projectResponse);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]
 * Deletes project (OWNER required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Check project access (OWNER required)
  const accessResult = await requireProjectAccess(request, slug, "OWNER");
  if (accessResult instanceof NextResponse) {
    return accessResult;
  }

  const { project } = accessResult;

  try {
    // Delete project (cascading deletes will handle related data)
    await prisma.project.delete({
      where: { id: project.id },
    });

    return NextResponse.json({}, { status: 204 });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}