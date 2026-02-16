import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import RunStatusBadge from "@/components/runs/RunStatusBadge";
import RunTimeline from "@/components/runs/RunTimeline";
import RunLogs from "@/components/runs/RunLogs";
import { cn } from "@/lib/utils";
import type { RunStatus } from "@/types";

interface RunDetail {
  id: string;
  status: RunStatus;
  input: any;
  output: any;
  error: string | null;
  duration: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  task: {
    id: string;
    displayName: string;
    name: string;
    retryLimit: number;
    timeout: number | null;
  };
  traces: Array<{
    id: string;
    name: string;
    type: string;
    startTime: string;
    endTime?: string | null;
    duration?: number | null;
    status: RunStatus;
    metadata?: Record<string, any> | null;
  }>;
  logs: Array<{
    id: string;
    level: "DEBUG" | "INFO" | "WARN" | "ERROR";
    message: string;
    metadata?: Record<string, any> | null;
    timestamp: string;
  }>;
}

async function fetchRunDetails(projectSlug: string, runId: string): Promise<RunDetail> {
  const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/projects/${projectSlug}/runs/${runId}`;

  const response = await fetch(url, {
    headers: {
      'Cookie': '', // Server-side fetch doesn't automatically include cookies
    },
    cache: 'no-store', // Always fetch fresh data
  });

  if (!response.ok) {
    if (response.status === 404) {
      notFound();
    }
    throw new Error(`Failed to fetch run details: ${response.status}`);
  }

  return response.json();
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project, id } = await params;

  // Check authentication
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  let run: RunDetail;
  try {
    run = await fetchRunDetails(project, id);
  } catch (error) {
    console.error("Error fetching run details:", error);
    notFound();
  }

  const canRetry = run.status === "FAILED";
  const canCancel = run.status === "QUEUED" || run.status === "EXECUTING";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Breadcrumb */}
        <nav className="text-sm">
          <ol className="flex items-center space-x-2">
            <li>
              <a href={`/${project}/runs`} className="text-violet-400 hover:text-violet-300">
                Runs
              </a>
            </li>
            <li className="text-gray-500">/</li>
            <li className="text-gray-400">Run {id.slice(0, 8)}</li>
          </ol>
        </nav>

        {/* Run Header */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <RunStatusBadge status={run.status} size="md" />
                <h1 className="text-2xl font-semibold text-gray-100">
                  {run.task.displayName}
                </h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-gray-400">Run ID</dt>
                  <dd className="text-gray-200 font-mono">{id}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Task Name</dt>
                  <dd className="text-gray-200 font-mono">{run.task.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Started</dt>
                  <dd className="text-gray-200">{formatDateTime(run.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Duration</dt>
                  <dd className="text-gray-200">{formatDuration(run.duration)}</dd>
                </div>
                {run.completedAt && (
                  <div>
                    <dt className="text-gray-400">Completed</dt>
                    <dd className="text-gray-200">{formatDateTime(run.completedAt)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-400">Retry Limit</dt>
                  <dd className="text-gray-200">{run.task.retryLimit}</dd>
                </div>
                {run.task.timeout && (
                  <div>
                    <dt className="text-gray-400">Timeout</dt>
                    <dd className="text-gray-200">{formatDuration(run.task.timeout)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-400">Traces</dt>
                  <dd className="text-gray-200">{run.traces.length}</dd>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {canRetry && (
                <form action={`/api/projects/${project}/runs/${id}/retry`} method="post">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Retry
                  </button>
                </form>
              )}
              {canCancel && (
                <form action={`/api/projects/${project}/runs/${id}/cancel`} method="post">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Error message for failed runs */}
          {run.status === "FAILED" && run.error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-md">
              <h3 className="text-sm font-medium text-red-400 mb-2">Error Details</h3>
              <pre className="text-sm text-red-300 whitespace-pre-wrap overflow-x-auto">
                {run.error}
              </pre>
            </div>
          )}
        </div>

        {/* Timeline Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <RunTimeline
            traces={run.traces}
            runStartTime={run.startedAt || run.createdAt}
            runDuration={run.duration}
          />
        </div>

        {/* Logs Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <RunLogs
            projectSlug={project}
            runId={id}
            initialLogs={run.logs}
          />
        </div>

        {/* Input/Output Section */}
        {(run.input || run.output) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {run.input && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Input</h3>
                <pre className="text-sm text-gray-300 bg-gray-950 border border-gray-800 rounded p-4 overflow-x-auto">
                  {typeof run.input === 'string' ? run.input : JSON.stringify(run.input, null, 2)}
                </pre>
              </div>
            )}

            {run.output && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Output</h3>
                <pre className="text-sm text-gray-300 bg-gray-950 border border-gray-800 rounded p-4 overflow-x-auto">
                  {typeof run.output === 'string' ? run.output : JSON.stringify(run.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}