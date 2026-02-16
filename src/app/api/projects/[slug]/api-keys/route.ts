import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";
import { createApiKeySchema } from "@/lib/validations";
import bcrypt from "bcrypt";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Check project access - need ADMIN+ to view API keys
    const accessResult = await requireProjectAccess(request, slug, "ADMIN");
    if (!accessResult || !('project' in accessResult)) {
      return accessResult as NextResponse;
    }

    const { project } = accessResult;

    // Get API keys for the project
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        projectId: project.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        keyPreview: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: apiKeys });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    // Check project access - need ADMIN+ to create API keys
    const accessResult = await requireProjectAccess(request, slug, "ADMIN");
    if (!accessResult || !('project' in accessResult)) {
      return accessResult as NextResponse;
    }

    const { user, project } = accessResult;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createApiKeySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid API key data: " + validationResult.error.message },
        { status: 400 }
      );
    }

    const { name, expiresAt } = validationResult.data;

    // Generate API key: tp_live_ + 32 random hex chars
    const apiKey = "tp_live_" + crypto.randomBytes(16).toString("hex");

    // Create key hash for storage
    const keyHash = await bcrypt.hash(apiKey, 12);

    // Store first 16 chars as prefix for display and lookup
    const keyPrefix = apiKey.substring(0, 16);

    // Store last 4 chars as preview for UI display
    const keyPreview = apiKey.slice(-4);

    // Create the API key record
    const createdApiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        keyPrefix,
        keyPreview,
        permissions: {}, // Default empty permissions
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        projectId: project.id,
        createdBy: user.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        keyPreview: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the created API key with the full key (only shown once)
    return NextResponse.json(
      {
        ...createdApiKey,
        key: apiKey, // Full key returned only once
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}