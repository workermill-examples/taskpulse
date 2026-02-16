"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogPanel, DialogTitle, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { cn } from "@/lib/utils";
import CronDisplay from "./CronDisplay";

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
  task: Task;
}

interface ScheduleFormProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
  schedule?: Schedule; // For edit mode
  onSuccess?: () => void;
}

// Common timezones
const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "US/Eastern", label: "US/Eastern" },
  { value: "US/Pacific", label: "US/Pacific" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
];

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

function CheckIcon({ className }: { className?: string }) {
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
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export default function ScheduleForm({
  isOpen,
  onClose,
  projectSlug,
  schedule,
  onSuccess,
}: ScheduleFormProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(schedule?.task || null);
  const [cronExpression, setCronExpression] = useState(schedule?.cronExpression || "0 9 * * *");
  const [description, setDescription] = useState(schedule?.description || "");
  const [selectedTimezone, setSelectedTimezone] = useState(
    TIMEZONES.find(tz => tz.value === schedule?.timezone) || TIMEZONES[0]
  );
  const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const isEditMode = !!schedule;

  // Fetch tasks when dialog opens
  useEffect(() => {
    if (isOpen && !tasks.length) {
      fetchTasks();
    }
  }, [isOpen]);

  // Reset form when schedule changes
  useEffect(() => {
    if (schedule) {
      setSelectedTask(schedule.task);
      setCronExpression(schedule.cronExpression);
      setDescription(schedule.description || "");
      setSelectedTimezone(TIMEZONES.find(tz => tz.value === schedule.timezone) || TIMEZONES[0]);
      setEnabled(schedule.enabled);
    }
  }, [schedule]);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/tasks`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      const result = await response.json();
      setTasks(result.data || []);

      // Auto-select first task if available and not in edit mode
      if (!isEditMode && result.data && result.data.length > 0) {
        setSelectedTask(result.data[0]);
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const validateCronExpression = (cron: string): boolean => {
    try {
      // Import dynamically to avoid server-side issues
      const { parseExpression } = require("cron-parser");
      parseExpression(cron);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) {
      setError("Please select a task");
      return;
    }

    if (!validateCronExpression(cronExpression)) {
      setError("Invalid cron expression");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const url = isEditMode
        ? `/api/projects/${projectSlug}/schedules/${schedule.id}`
        : `/api/projects/${projectSlug}/schedules`;

      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: selectedTask.id,
          cronExpression,
          description: description.trim() || undefined,
          timezone: selectedTimezone.value,
          enabled,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} schedule`);
      }

      // Success - close dialog and refresh
      onClose();
      onSuccess?.();
      router.refresh();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} schedule:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} schedule`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      if (!isEditMode) {
        setSelectedTask(tasks.length > 0 ? tasks[0] : null);
        setCronExpression("0 9 * * *");
        setDescription("");
        setSelectedTimezone(TIMEZONES[0]);
        setEnabled(true);
      }
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full rounded-lg bg-gray-900 border border-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-100 mb-4">
            {isEditMode ? "Edit Schedule" : "Create Schedule"}
          </DialogTitle>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Task Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Task
              </label>
              <div className="relative">
                <Listbox value={selectedTask} onChange={setSelectedTask} disabled={isLoading || isEditMode}>
                  <ListboxButton className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-left text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {isLoading ? (
                          <span className="text-gray-400">Loading tasks...</span>
                        ) : selectedTask ? (
                          <div>
                            <div className="font-medium text-gray-100">
                              {selectedTask.displayName}
                            </div>
                            <div className="text-sm text-gray-400 font-mono">
                              {selectedTask.name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Select a task</span>
                        )}
                      </div>
                      {!isEditMode && <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
                    </div>
                  </ListboxButton>
                  {!isEditMode && (
                    <ListboxOptions className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                      {tasks.map((task) => (
                        <ListboxOption key={task.id} value={task} className="group">
                          {({ focus, selected }) => (
                            <div
                              className={cn(
                                "px-3 py-2 cursor-pointer flex items-center justify-between",
                                focus && "bg-gray-700",
                                selected && "bg-violet-600/20"
                              )}
                            >
                              <div>
                                <div className="font-medium text-gray-100">
                                  {task.displayName}
                                </div>
                                <div className="text-sm text-gray-400 font-mono">
                                  {task.name}
                                </div>
                                {task.description && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {task.description}
                                  </div>
                                )}
                              </div>
                              {selected && (
                                <CheckIcon className="w-5 h-5 text-violet-400" />
                              )}
                            </div>
                          )}
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  )}
                </Listbox>
              </div>
            </div>

            {/* Cron Expression */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cron Expression
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 font-mono text-sm placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                placeholder="0 9 * * *"
                disabled={isSubmitting}
                required
              />
              {/* Live preview */}
              {cronExpression.trim() && (
                <div className="mt-2 p-3 bg-gray-800/50 rounded-md border border-gray-800">
                  <CronDisplay cronExpression={cronExpression} timezone={selectedTimezone.value} />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 text-sm placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none"
                placeholder="Describe this schedule..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {/* Timezone Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Timezone
              </label>
              <div className="relative">
                <Listbox value={selectedTimezone} onChange={setSelectedTimezone} disabled={isSubmitting}>
                  <ListboxButton className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-left text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50">
                    <div className="flex items-center justify-between">
                      <span>{selectedTimezone.label}</span>
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </ListboxButton>
                  <ListboxOptions className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
                    {TIMEZONES.map((timezone) => (
                      <ListboxOption key={timezone.value} value={timezone} className="group">
                        {({ focus, selected }) => (
                          <div
                            className={cn(
                              "px-3 py-2 cursor-pointer flex items-center justify-between",
                              focus && "bg-gray-700",
                              selected && "bg-violet-600/20"
                            )}
                          >
                            <span className="text-gray-100">{timezone.label}</span>
                            {selected && (
                              <CheckIcon className="w-5 h-5 text-violet-400" />
                            )}
                          </div>
                        )}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </Listbox>
              </div>
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center space-x-3">
              <input
                id="enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 text-violet-600 bg-gray-800 border-gray-700 rounded focus:ring-violet-500 focus:ring-2"
                disabled={isSubmitting}
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-300">
                Enabled
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedTask || isSubmitting}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                {isSubmitting ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Schedule" : "Create Schedule")}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}