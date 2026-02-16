"use client";

import { useState } from "react";
import RunsTable from "@/components/runs/RunsTable";
import TriggerRunDialog from "@/components/runs/TriggerRunDialog";
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

interface Task {
  id: string;
  name: string;
  displayName: string;
}

interface RunsPageClientProps {
  projectSlug: string;
  initialData: {
    runs: {
      data: RunListItem[];
      hasMore: boolean;
      cursor?: string;
    };
    tasks: Task[];
  };
}

function PlayIcon({ className }: { className?: string }) {
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
        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m1-10a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default function RunsPageClient({ projectSlug, initialData }: RunsPageClientProps) {
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
            <PlayIcon className="w-6 h-6 text-violet-400" />
            Runs
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor and manage your task executions
          </p>
        </div>
        <button
          onClick={() => setShowTriggerDialog(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md font-medium transition-colors focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          Trigger Run
        </button>
      </div>

      {/* Table */}
      <RunsTable
        projectSlug={projectSlug}
        initialData={initialData.runs}
        tasks={initialData.tasks}
      />

      {/* Trigger Run Dialog */}
      <TriggerRunDialog
        isOpen={showTriggerDialog}
        onClose={() => setShowTriggerDialog(false)}
        projectSlug={projectSlug}
      />
    </div>
  );
}