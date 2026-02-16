import { cn, formatDuration } from "@/lib/utils";

interface TaskConfigProps {
  task: {
    id: string;
    name: string; // machine name
    displayName: string;
    retryLimit: number;
    retryDelay: number;
    timeout: number;
    concurrency: number;
    inputSchema?: any;
    stepTemplates: Array<{ name: string; avgDuration: number }>;
    createdAt: string;
    updatedAt: string;
  };
  className?: string;
}

export default function TaskConfig({ task, className }: TaskConfigProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Configuration Settings */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-300 mb-1">Machine Name</dt>
              <dd className="text-sm text-gray-100 font-mono bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {task.name}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-300 mb-1">Retry Limit</dt>
              <dd className="text-sm text-gray-100 font-mono bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {task.retryLimit}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-300 mb-1">Retry Delay</dt>
              <dd className="text-sm text-gray-100 font-mono bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {formatDuration(task.retryDelay)}
              </dd>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-300 mb-1">Timeout</dt>
              <dd className="text-sm text-gray-100 font-mono bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {formatDuration(task.timeout)}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-300 mb-1">Concurrency</dt>
              <dd className="text-sm text-gray-100 font-mono bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {task.concurrency}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-300 mb-1">Version</dt>
              <dd className="text-sm text-gray-400 font-mono bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {new Date(task.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Step Templates */}
      {task.stepTemplates.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Step Templates ({task.stepTemplates.length})
          </h3>

          <div className="space-y-2">
            {task.stepTemplates.map((step, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700"
              >
                <span className="text-sm font-medium text-gray-100">
                  {step.name}
                </span>
                <span className="text-sm text-gray-400 font-mono">
                  ~{formatDuration(step.avgDuration)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Schema */}
      {task.inputSchema && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Input Schema</h3>

          <div className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {JSON.stringify(task.inputSchema, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Metadata</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-300 mb-1">Created At</dt>
            <dd className="text-sm text-gray-400 font-mono">
              {new Date(task.createdAt).toLocaleString()}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-300 mb-1">Last Updated</dt>
            <dd className="text-sm text-gray-400 font-mono">
              {new Date(task.updatedAt).toLocaleString()}
            </dd>
          </div>
        </div>
      </div>
    </div>
  );
}