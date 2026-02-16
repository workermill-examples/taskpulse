import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Check for SEED_TOKEN authorization
    const authHeader = request.headers.get("Authorization");
    const seedToken = process.env.SEED_TOKEN;

    if (!seedToken) {
      return NextResponse.json(
        { error: "Seed token not configured" },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    if (token !== seedToken) {
      return NextResponse.json(
        { error: "Invalid seed token" },
        { status: 401 }
      );
    }

    // Create demo user (idempotent - uses upsert)
    const passwordHash = await bcrypt.hash("demo1234", 12);

    const user = await prisma.user.upsert({
      where: { email: "demo@workermill.com" },
      update: {},
      create: {
        email: "demo@workermill.com",
        name: "Demo User",
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Seed completed successfully", user },
      { status: 200 }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}