import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access - need ADMIN+ to delete API keys
    const accessResult = await requireProjectAccess(request, slug, "ADMIN");
    if (!accessResult || !('project' in accessResult)) {
      return accessResult as NextResponse;
    }

    const { project } = accessResult;

    // Check if API key exists and belongs to this project
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        projectId: project.id,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    // Hard delete the API key (revoke)
    await prisma.apiKey.delete({
      where: {
        id,
      },
    });

    return NextResponse.json(
      { message: "API key revoked successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}