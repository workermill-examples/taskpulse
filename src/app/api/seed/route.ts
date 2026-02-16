import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";

const exec = promisify(require("child_process").exec);

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

    // Execute the expanded seed script
    console.log("Running expanded seed script...");
    const { stdout, stderr } = await exec("npm run db:seed", {
      cwd: process.cwd(),
      env: process.env,
    });

    console.log("Seed stdout:", stdout);
    if (stderr) {
      console.warn("Seed stderr:", stderr);
    }

    return NextResponse.json(
      {
        message: "Expanded seed completed successfully",
        output: stdout,
        warnings: stderr || null
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        error: "Seed execution failed",
        details: error.message,
        output: error.stdout || null,
        errorOutput: error.stderr || null
      },
      { status: 500 }
    );
  }
}