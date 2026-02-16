"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogPanel, DialogTitle, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  inputSchema?: any;
}

interface TriggerRunDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
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

export default function TriggerRunDialog({
  isOpen,
  onClose,
  projectSlug,
}: TriggerRunDialogProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [jsonInput, setJsonInput] = useState("{}");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  // Fetch tasks when dialog opens
  useEffect(() => {
    if (isOpen && !tasks.length) {
      fetchTasks();
    }
  }, [isOpen]);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/tasks`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      const result = await response.json();
      setTasks(result.data || []);

      // Auto-select first task if available
      if (result.data && result.data.length > 0) {
        setSelectedTask(result.data[0]);
      }
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) {
      setError("Please select a task");
      return;
    }

    let parsedInput;
    try {
      parsedInput = JSON.parse(jsonInput);
    } catch (err) {
      setError("Invalid JSON input");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const response = await fetch(`/api/projects/${projectSlug}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: selectedTask.id,
          input: parsedInput,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to trigger run");
      }

      const result = await response.json();

      // Navigate to the new run's detail page
      router.push(`/${projectSlug}/runs/${result.id}`);
      onClose();
    } catch (err) {
      console.error("Error triggering run:", err);
      setError(err instanceof Error ? err.message : "Failed to trigger run");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedTask(null);
      setJsonInput("{}");
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
        <DialogPanel className="mx-auto max-w-md w-full rounded-lg bg-gray-900 border border-gray-800 p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-100 mb-4">
            Trigger Run
          </DialogTitle>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Task Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Task
              </label>
              <div className="relative">
                <Listbox value={selectedTask} onChange={setSelectedTask} disabled={isLoading}>
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
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  </ListboxButton>
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
                </Listbox>
              </div>
            </div>

            {/* JSON Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Input (JSON)
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 font-mono text-sm placeholder-gray-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none"
                placeholder="{}"
                rows={6}
                disabled={isSubmitting}
              />
              {selectedTask?.inputSchema && (
                <p className="text-xs text-gray-500 mt-1">
                  Expected schema: {JSON.stringify(selectedTask.inputSchema)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
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
                {isSubmitting ? "Triggering..." : "Trigger Run"}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}