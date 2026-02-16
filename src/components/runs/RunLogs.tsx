"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import useSSE from "@/hooks/useSSE";
import type { LogLevel } from "@/types";

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any> | null;
  timestamp: string;
}

interface RunLogsProps {
  projectSlug: string;
  runId: string;
  initialLogs?: LogEntry[];
  className?: string;
}

const LOG_LEVEL_COLORS = {
  DEBUG: "text-gray-500",
  INFO: "text-gray-300",
  WARN: "text-amber-400",
  ERROR: "text-red-400",
};

const LOG_LEVEL_FILTERS = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as const;
type LogLevelFilter = typeof LOG_LEVEL_FILTERS[number];

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

export default function RunLogs({
  projectSlug,
  runId,
  initialLogs = [],
  className,
}: RunLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // SSE connection for live log updates
  const streamUrl = `/api/projects/${projectSlug}/runs/${runId}/stream`;
  const { lastMessage, connectionState } = useSSE(streamUrl);

  // Handle new SSE messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const eventData = JSON.parse(lastMessage.data);

      if (lastMessage.type === "log") {
        setLogs(prevLogs => {
          // Avoid duplicates
          const existingIds = new Set(prevLogs.map(log => log.id));
          if (existingIds.has(eventData.id)) {
            return prevLogs;
          }

          return [...prevLogs, eventData];
        });
      }
    } catch (error) {
      console.warn("Failed to parse SSE message:", error);
    }
  }, [lastMessage]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Handle manual scroll to detect if user scrolled up
  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const container = logsContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

    if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    } else if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  // Filter logs based on selected level
  const filteredLogs = useMemo(() => {
    if (levelFilter === "ALL") return logs;
    return logs.filter(log => log.level === levelFilter);
  }, [logs, levelFilter]);

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header with filters and connection status */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-100">Logs</h3>
          <span className="text-sm text-gray-400">({filteredLogs.length})</span>

          {/* Connection status indicator */}
          <div className="ml-4 flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                connectionState === "open" ? "bg-green-400" :
                connectionState === "connecting" ? "bg-yellow-400 animate-pulse" :
                "bg-gray-500"
              )}
            />
            <span className="text-xs text-gray-500">
              {connectionState === "open" ? "Live" :
               connectionState === "connecting" ? "Connecting..." :
               "Offline"}
            </span>
          </div>
        </div>

        {/* Level filters */}
        <div className="flex items-center gap-1">
          {LOG_LEVEL_FILTERS.map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                levelFilter === level
                  ? "bg-violet-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Logs container */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="bg-gray-950 rounded-lg border border-gray-800 p-4 overflow-y-auto max-h-96 min-h-64"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {levelFilter === "ALL" ? "No logs yet" : `No ${levelFilter} logs found`}
          </div>
        ) : (
          <div className="space-y-1 font-mono text-sm">
            {filteredLogs.map(log => (
              <div key={log.id} className="group">
                <div className="flex items-start gap-3">
                  {/* Timestamp */}
                  <span className="text-gray-500 text-xs mt-0.5 flex-shrink-0">
                    [{formatTimestamp(log.timestamp)}]
                  </span>

                  {/* Level */}
                  <span
                    className={cn(
                      "text-xs font-bold mt-0.5 flex-shrink-0 w-12",
                      LOG_LEVEL_COLORS[log.level]
                    )}
                  >
                    [{log.level}]
                  </span>

                  {/* Message */}
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-200 break-words">
                      {log.message}
                    </span>

                    {/* Metadata toggle */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <button
                        onClick={() => toggleLogExpansion(log.id)}
                        className="ml-2 text-xs text-violet-400 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {expandedLogs.has(log.id) ? "hide" : "show"} metadata
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded metadata */}
                {expandedLogs.has(log.id) && log.metadata && (
                  <div className="mt-2 ml-16 p-2 bg-gray-900 border border-gray-700 rounded text-xs">
                    <pre className="text-gray-400 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll controls */}
      {!autoScroll && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-md transition-colors"
          >
            Resume auto-scroll
          </button>
        </div>
      )}
    </div>
  );
}