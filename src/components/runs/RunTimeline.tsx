import { cn } from "@/lib/utils";
import RunStatusBadge from "./RunStatusBadge";
import type { RunStatus } from "@/types";

interface TraceStep {
  id: string;
  name: string;
  type: string;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  status: RunStatus;
  metadata?: Record<string, any> | null;
}

interface RunTimelineProps {
  traces: TraceStep[];
  runStartTime: string;
  runDuration?: number | null;
  className?: string;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatTimeOffset(stepStartTime: string, runStartTime: string): string {
  const stepTime = new Date(stepStartTime).getTime();
  const runTime = new Date(runStartTime).getTime();
  const offsetMs = stepTime - runTime;

  if (offsetMs < 1000) return `+${offsetMs}ms`;
  return `+${(offsetMs / 1000).toFixed(1)}s`;
}

function getBarColor(status: RunStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500";
    case "FAILED":
      return "bg-red-500";
    case "EXECUTING":
      return "bg-blue-500";
    case "QUEUED":
      return "bg-gray-500";
    case "CANCELLED":
      return "bg-gray-600";
    case "TIMED_OUT":
      return "bg-amber-500";
    default:
      return "bg-gray-500";
  }
}

export default function RunTimeline({
  traces,
  runStartTime,
  runDuration,
  className,
}: RunTimelineProps) {
  if (!traces || traces.length === 0) {
    return (
      <div className={cn("text-gray-400 text-center py-8", className)}>
        No execution steps found
      </div>
    );
  }

  // Calculate the total timeline duration for scaling bars
  const totalDuration = runDuration || Math.max(
    ...traces
      .filter(trace => trace.duration)
      .map(trace => {
        const stepStart = new Date(trace.startTime).getTime();
        const runStart = new Date(runStartTime).getTime();
        return (stepStart - runStart) + (trace.duration || 0);
      })
  );

  // Calculate animation delays based on step timing
  const runStartMs = new Date(runStartTime).getTime();
  const now = Date.now();
  const timeSinceRunStart = now - runStartMs;
  const isRecentRun = timeSinceRunStart <= 120000; // 2 minutes

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-sm text-gray-400 mb-4">
        Execution Timeline ({formatDuration(totalDuration)})
      </div>

      <div className="space-y-3">
        {traces.map((trace, index) => {
          const stepStart = new Date(trace.startTime).getTime();
          const offsetFromRunStart = stepStart - runStartMs;
          const stepDuration = trace.duration || 0;

          // Calculate bar width as percentage of total duration
          const barWidthPercent = totalDuration > 0 ? (stepDuration / totalDuration) * 100 : 0;

          // Animation delay for recent runs
          const animationDelay = isRecentRun ? offsetFromRunStart : 0;
          const shouldAnimate = isRecentRun && offsetFromRunStart <= timeSinceRunStart;

          return (
            <div
              key={trace.id}
              className={cn(
                "transition-all duration-300",
                shouldAnimate ? "opacity-100 translate-x-0" : isRecentRun ? "opacity-0 translate-x-4" : "opacity-100"
              )}
              style={
                shouldAnimate ? {} : isRecentRun ?
                  { transitionDelay: `${Math.min(animationDelay, 5000)}ms` } :
                  {}
              }
            >
              <div className="flex items-center gap-4">
                {/* Step name and status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-gray-100 truncate">
                      {trace.name}
                    </span>
                    <RunStatusBadge status={trace.status} size="sm" />
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTimeOffset(trace.startTime, runStartTime)}
                    </span>
                  </div>

                  {/* Duration bar */}
                  <div className="relative">
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-500 rounded-full",
                          getBarColor(trace.status)
                        )}
                        style={{
                          width: `${Math.max(barWidthPercent, 2)}%`,
                          transitionDelay: shouldAnimate ? `${Math.min(animationDelay + 200, 5200)}ms` : "0ms"
                        }}
                      />
                    </div>
                    <div className="absolute right-0 top-0 transform translate-y-full mt-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {formatDuration(stepDuration)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error message for failed steps */}
              {trace.status === "FAILED" && trace.metadata?.error && (
                <div className="mt-2 ml-4 p-3 bg-red-900/20 border border-red-800/50 rounded-md">
                  <div className="text-sm text-red-400 font-mono">
                    {typeof trace.metadata.error === "string"
                      ? trace.metadata.error
                      : JSON.stringify(trace.metadata.error, null, 2)
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}