import Link from "next/link";
import { cn, formatRelativeTime, formatDuration } from "@/lib/utils";
import RunStatusBadge from "@/components/runs/RunStatusBadge";

interface TaskCardProps {
  task: {
    id: string;
    name: string; // machine name
    displayName: string;
    description?: string | null;
    stepTemplates: Array<{ name: string; avgDuration: number }>;
    runCounts: {
      total: number;
      completed: number;
      failed: number;
      executing: number;
      queued: number;
    };
    lastRun?: {
      id: string;
      status: "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
      startedAt: string | null;
      completedAt: string | null;
    } | null;
  };
  projectSlug: string;
  className?: string;
}

export default function TaskCard({ task, projectSlug, className }: TaskCardProps) {
  // Calculate success rate
  const successRate = task.runCounts.total > 0
    ? Math.round((task.runCounts.completed / task.runCounts.total) * 100)
    : 0;

  // Calculate average duration from step templates
  const avgDuration = task.stepTemplates.length > 0
    ? task.stepTemplates.reduce((sum, step) => sum + step.avgDuration, 0)
    : null;

  return (
    <Link href={`/${projectSlug}/tasks/${task.id}`}>
      <div className={cn(
        "bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer group",
        className
      )}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-100 group-hover:text-violet-400 transition-colors truncate">
              {task.displayName}
            </h3>
            <p className="text-sm text-gray-500 font-mono mt-1">
              {task.name}
            </p>
          </div>
          {task.stepTemplates.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-800 text-gray-300 rounded-full ml-2 flex-shrink-0">
              {task.stepTemplates.length} step{task.stepTemplates.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-gray-400 mb-4 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-100">
              {task.runCounts.total}
            </div>
            <div className="text-xs text-gray-500">Total Runs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {successRate}%
            </div>
            <div className="text-xs text-gray-500">Success Rate</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-300">
              {avgDuration ? formatDuration(avgDuration) : "—"}
            </div>
            <div className="text-xs text-gray-500">Avg Duration</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-300">
              {task.lastRun?.startedAt
                ? formatRelativeTime(new Date(task.lastRun.startedAt))
                : "—"}
            </div>
            <div className="text-xs text-gray-500">Last Run</div>
          </div>
        </div>

        {/* Last Run Status */}
        {task.lastRun && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">Latest run:</span>
            <RunStatusBadge status={task.lastRun.status} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}