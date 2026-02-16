"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { formatDuration, formatRelativeTime, cn } from "@/lib/utils";
import RunStatusBadge from "./RunStatusBadge";
import EmptyState from "@/components/shared/EmptyState";
import type { RunStatus } from "@/types";

interface RunListItem {
  id: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  triggeredBy: string;
  createdAt: string;
  task: {
    id: string;
    displayName: string;
    name: string;
  };
}

interface RunsTableData {
  data: RunListItem[];
  hasMore: boolean;
  cursor?: string;
}

interface Task {
  id: string;
  name: string;
  displayName: string;
}

interface RunsTableProps {
  projectSlug: string;
  initialData: RunsTableData;
  tasks: Task[];
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-gray-700 border-t-gray-400",
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="w-20 h-5 bg-gray-800 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="w-32 h-4 bg-gray-800 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="w-16 h-4 bg-gray-800 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="w-20 h-4 bg-gray-800 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="w-16 h-4 bg-gray-800 rounded"></div>
      </td>
      <td className="px-6 py-4">
        <div className="w-24 h-4 bg-gray-800 rounded"></div>
      </td>
    </tr>
  );
}

function RunsTableContent({ projectSlug, initialData, tasks }: RunsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<RunListItem[]>(initialData.data);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [cursor, setCursor] = useState<string | undefined>(initialData.cursor);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter states
  const [selectedStatuses, setSelectedStatuses] = useState<RunStatus[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const statusOptions: { value: RunStatus; label: string }[] = [
    { value: "QUEUED", label: "Queued" },
    { value: "EXECUTING", label: "Executing" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "TIMED_OUT", label: "Timed Out" },
  ];

  // Update URL search params when filters change
  const updateUrl = (params: Record<string, string | string[] | undefined>) => {
    const newSearchParams = new URLSearchParams();

    // Add current non-filter params
    searchParams.forEach((value, key) => {
      if (!["status", "taskId", "from", "to"].includes(key)) {
        newSearchParams.set(key, value);
      }
    });

    // Add new filter params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0)) {
        if (Array.isArray(value)) {
          value.forEach(v => newSearchParams.append(key, v));
        } else {
          newSearchParams.set(key, value);
        }
      }
    });

    const newUrl = `${pathname}?${newSearchParams.toString()}`;
    router.push(newUrl, { scroll: false });
  };

  // Fetch runs with filters
  const fetchRuns = async (resetData = true, loadMoreCursor?: string) => {
    try {
      if (resetData) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const params = new URLSearchParams();
      if (selectedStatuses.length > 0) {
        selectedStatuses.forEach(status => params.append("status", status));
      }
      if (selectedTaskId) {
        params.set("taskId", selectedTaskId);
      }
      if (dateFrom) {
        params.set("from", dateFrom);
      }
      if (dateTo) {
        params.set("to", dateTo);
      }
      if (loadMoreCursor) {
        params.set("cursor", loadMoreCursor);
      }

      const response = await fetch(`/api/projects/${projectSlug}/runs?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch runs");
      }

      const result: RunsTableData = await response.json();

      if (resetData) {
        setRuns(result.data);
      } else {
        setRuns(prev => [...prev, ...result.data]);
      }

      setHasMore(result.hasMore);
      setCursor(result.cursor);
    } catch (error) {
      console.error("Error fetching runs:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Apply filters
  const applyFilters = () => {
    updateUrl({
      status: selectedStatuses,
      taskId: selectedTaskId || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    });
    fetchRuns(true);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedTaskId("");
    setDateFrom("");
    setDateTo("");
    updateUrl({});
    fetchRuns(true);
  };

  // Load more runs
  const loadMore = () => {
    if (cursor && hasMore && !isLoadingMore) {
      fetchRuns(false, cursor);
    }
  };

  // Navigate to run detail
  const handleRunClick = (runId: string) => {
    router.push(`/${projectSlug}/runs/${runId}`);
  };

  // Status filter handlers
  const toggleStatus = (status: RunStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const hasActiveFilters = selectedStatuses.length > 0 || selectedTaskId || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {statusOptions.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(option.value)}
                    onChange={() => toggleStatus(option.value)}
                    className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-gray-900"
                  />
                  <span className="ml-2 text-sm text-gray-300">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Task Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Task
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="">All Tasks</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={applyFilters}
              disabled={isLoading}
              className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                disabled={isLoading}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <XIcon className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <span className="text-sm text-gray-400">
              {selectedStatuses.length > 0 && `${selectedStatuses.length} status${selectedStatuses.length !== 1 ? 'es' : ''}`}
              {selectedStatuses.length > 0 && (selectedTaskId || dateFrom || dateTo) && ", "}
              {selectedTaskId && "1 task"}
              {selectedTaskId && (dateFrom || dateTo) && ", "}
              {(dateFrom || dateTo) && "date range"}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-300">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-100">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-100">Task</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-100">Triggered By</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-100">Started</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-100">Duration</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-100">Run ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {Array.from({ length: 5 }, (_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : runs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-300">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-100">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-100">Task</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-100">Triggered By</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-100">Started</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-100">Duration</th>
                    <th className="px-6 py-3 text-left font-medium text-gray-100">Run ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => handleRunClick(run.id)}
                      className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <RunStatusBadge status={run.status} size="sm" />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-100">
                            {run.task.displayName}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {run.task.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 capitalize">
                        {run.triggeredBy}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {run.startedAt
                          ? formatRelativeTime(new Date(run.startedAt))
                          : "—"
                        }
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {run.duration
                          ? formatDuration(run.duration)
                          : "—"
                        }
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded">
                          {run.id.slice(0, 8)}...
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="border-t border-gray-800 p-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {isLoadingMore ? (
                    <>
                      <LoadingSpinner className="w-4 h-4" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8">
            <EmptyState
              title="No runs found"
              description={
                hasActiveFilters
                  ? "Try adjusting your filters to see more runs."
                  : "No runs have been triggered yet. Create your first run to get started."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RunsTable(props: RunsTableProps) {
  return (
    <Suspense
      fallback={
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
          <div className="flex items-center justify-center">
            <LoadingSpinner className="w-6 h-6" />
          </div>
        </div>
      }
    >
      <RunsTableContent {...props} />
    </Suspense>
  );
}