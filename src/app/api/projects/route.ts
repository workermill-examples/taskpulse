import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/validations";
import type { ProjectListItem } from "@/types";

/**
 * GET /api/projects
 * Returns user's projects with membership counts and run counts
 * Ordered by most recent activity
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Get user's projects with stats
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
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
      orderBy: {
        updatedAt: "desc",
      },
    });

    const projectListItems: ProjectListItem[] = projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      memberCount: project._count.members,
      taskCount: project._count.tasks,
      recentRunCount: project.runs.length,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }));

    return NextResponse.json(projectListItems);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Creates project, auto-generates slug from name (lowercase, hyphens, dedup)
 * Creator becomes OWNER
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    // Generate slug from name
    let baseSlug = validatedData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Ensure slug uniqueness
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existingProject = await prisma.project.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existingProject) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create project with creator as owner
    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        slug,
        description: validatedData.description,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
    });

    const projectResponse: ProjectListItem = {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      memberCount: project._count.members,
      taskCount: project._count.tasks,
      recentRunCount: 0, // New project has no runs
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };

    return NextResponse.json(projectResponse, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      );
    }

    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}