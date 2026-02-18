import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;

  try {
    // Check project access
    const accessResult = await requireProjectAccess(request, slug, "VIEWER");
    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { project } = accessResult;

    // Find run and verify it belongs to the project
    const run = await prisma.run.findFirst({
      where: {
        id,
        projectId: project.id,
      },
      include: {
        logs: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream({
      start(controller) {
        const subscriptionStartTime = Date.now();
        const isRecentRun = run.createdAt && (Date.now() - run.createdAt.getTime()) <= 30000; // 30 seconds

        // Helper function to send SSE event
        const sendEvent = (type: string, data: any) => {
          if (closed) return;

          const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        };

        // Helper function to send keep-alive ping
        const sendPing = () => {
          if (closed) return;

          const ping = `event: ping\ndata: {}\n\n`;
          controller.enqueue(encoder.encode(ping));
        };

        // Set up keep-alive interval (every 15 seconds)
        const keepAliveInterval = setInterval(sendPing, 15000);

        // Cleanup function
        const cleanup = () => {
          closed = true;
          clearInterval(keepAliveInterval);
          controller.close();
        };

        if (isRecentRun && run.logs.length > 0) {
          // Recent run: Emit logs progressively with delays matching their timestamp offsets
          let logIndex = 0;

          const emitNextLog = () => {
            if (closed || logIndex >= run.logs.length) {
              // All logs emitted, send final status and close
              sendEvent("status", {
                status: run.status,
                duration: run.duration,
              });
              cleanup();
              return;
            }

            const log = run.logs[logIndex];
            const logEvent = {
              type: "log",
              data: {
                id: log.id,
                level: log.level,
                message: log.message,
                metadata: log.metadata,
                timestamp: log.timestamp.toISOString(),
              },
            };

            sendEvent("log", logEvent.data);
            logIndex++;

            if (logIndex < run.logs.length) {
              // Calculate delay for next log based on timestamp difference
              const currentLogTime = log.timestamp.getTime();
              const nextLogTime = run.logs[logIndex].timestamp.getTime();
              const runStartTime = run.startedAt?.getTime() || run.createdAt.getTime();

              // Calculate how much time has elapsed since subscription started
              const elapsedSinceSubscription = Date.now() - subscriptionStartTime;
              const nextLogOffsetFromStart = nextLogTime - runStartTime;

              // Calculate delay: how long to wait before emitting the next log
              const delay = Math.max(0, nextLogOffsetFromStart - elapsedSinceSubscription);

              setTimeout(emitNextLog, Math.min(delay, 5000)); // Cap delays at 5 seconds for UX
            } else {
              // Last log, send final status
              setTimeout(() => {
                sendEvent("status", {
                  status: run.status,
                  duration: run.duration,
                });
                cleanup();
              }, 500);
            }
          };

          // Start emitting logs
          emitNextLog();
        } else {
          // Historical run or no logs: Emit all logs immediately, then close
          for (const log of run.logs) {
            sendEvent("log", {
              id: log.id,
              level: log.level,
              message: log.message,
              metadata: log.metadata,
              timestamp: log.timestamp.toISOString(),
            });
          }

          // Send final status event
          sendEvent("status", {
            status: run.status,
            duration: run.duration,
          });

          // Close stream after a short delay
          setTimeout(cleanup, 100);
        }

        // Handle client disconnect
        request.signal.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });

  } catch (error) {
    console.error("Error streaming run logs:", error);
    return NextResponse.json({ error: "Failed to stream run logs" }, { status: 500 });
  }
}