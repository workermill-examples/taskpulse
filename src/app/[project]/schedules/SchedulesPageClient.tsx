"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import ScheduleForm from "@/components/schedules/ScheduleForm";
import CronDisplay from "@/components/schedules/CronDisplay";
import { MemberRole } from "@/types";

interface Task {
  id: string;
  name: string;
  displayName: string;
  description?: string;
}

interface Schedule {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  task: Task;
}

interface SchedulesPageClientProps {
  schedules: Schedule[];
  projectSlug: string;
  userRole: MemberRole;
}

function PlusIcon({ className }: { className?: string }) {
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
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
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
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-violet-600' : 'bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`${
          enabled ? 'translate-x-6' : 'translate-x-1'
        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
      />
    </button>
  );
}

export default function SchedulesPageClient({
  schedules,
  projectSlug,
  userRole,
}: SchedulesPageClientProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [togglingSchedule, setTogglingSchedule] = useState<string | null>(null);
  const router = useRouter();

  const canCreateSchedule = ["OWNER", "ADMIN", "MEMBER"].includes(userRole);
  const canEditSchedule = ["OWNER", "ADMIN", "MEMBER"].includes(userRole);
  const canDeleteSchedule = ["OWNER", "ADMIN"].includes(userRole);

  const handleToggleEnabled = async (schedule: Schedule) => {
    if (!canEditSchedule) return;

    try {
      setTogglingSchedule(schedule.id);
      const response = await fetch(`/api/projects/${projectSlug}/schedules/${schedule.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: !schedule.enabled,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to update schedule");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating schedule:", error);
      // TODO: Show error toast
    } finally {
      setTogglingSchedule(null);
    }
  };

  const handleDelete = async (schedule: Schedule) => {
    if (!canDeleteSchedule) return;

    if (confirm(`Are you sure you want to delete the schedule "${schedule.name || schedule.task.displayName}"?`)) {
      try {
        const response = await fetch(`/api/projects/${projectSlug}/schedules/${schedule.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to delete schedule");
        }

        router.refresh();
      } catch (error) {
        console.error("Error deleting schedule:", error);
        // TODO: Show error toast
      }
    }
  };

  const handleFormSuccess = () => {
    router.refresh();
  };

  return (
    <>
      {/* Create Schedule Button */}
      {canCreateSchedule && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Schedule
          </button>
        </div>
      )}

      {/* Schedules List */}
      {schedules.length > 0 && (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-100">
                        {schedule.name || `Schedule for ${schedule.task.displayName}`}
                      </h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-sm text-gray-400">
                          Task: <span className="font-mono">{schedule.task.displayName}</span>
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className={`text-sm font-medium ${
                          schedule.enabled ? "text-green-400" : "text-gray-500"
                        }`}>
                          {schedule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      {schedule.description && (
                        <p className="text-sm text-gray-400 mt-1">
                          {schedule.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Toggle */}
                      {canEditSchedule && (
                        <ToggleSwitch
                          enabled={schedule.enabled}
                          onChange={() => handleToggleEnabled(schedule)}
                          disabled={togglingSchedule === schedule.id}
                        />
                      )}

                      {/* Edit */}
                      {canEditSchedule && (
                        <button
                          onClick={() => setEditingSchedule(schedule)}
                          className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-md transition-colors"
                          title="Edit schedule"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete */}
                      {canDeleteSchedule && (
                        <button
                          onClick={() => handleDelete(schedule)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-md transition-colors"
                          title="Delete schedule"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cron Display */}
                  <div className="bg-gray-800/50 rounded-md p-4 mb-4">
                    <CronDisplay
                      cronExpression={schedule.cronExpression}
                      timezone={schedule.timezone}
                    />
                  </div>

                  {/* Run Times */}
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div>
                      <span className="font-medium">Last run:</span>{" "}
                      {schedule.lastRunAt
                        ? formatRelativeTime(new Date(schedule.lastRunAt))
                        : "Never"}
                    </div>
                    <div>
                      <span className="font-medium">Next run:</span>{" "}
                      {schedule.nextRunAt && schedule.enabled
                        ? formatRelativeTime(new Date(schedule.nextRunAt))
                        : schedule.enabled
                        ? "Calculating..."
                        : "Disabled"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <ScheduleForm
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        projectSlug={projectSlug}
        onSuccess={handleFormSuccess}
      />

      {/* Edit Dialog */}
      <ScheduleForm
        isOpen={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        projectSlug={projectSlug}
        schedule={editingSchedule || undefined}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}