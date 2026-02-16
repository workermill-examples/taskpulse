"use client";

import { parseExpression } from "cron-parser";
import cronstrue from "cronstrue";

interface CronDisplayProps {
  cronExpression: string;
  timezone?: string;
}

export default function CronDisplay({ cronExpression, timezone = "UTC" }: CronDisplayProps) {
  let humanReadable = "";
  let nextRuns: string[] = [];
  let error: string | null = null;

  try {
    // Generate human-readable description
    humanReadable = cronstrue.toString(cronExpression);

    // Calculate next 3 upcoming execution times
    const parsedCron = parseExpression(cronExpression, {
      tz: timezone,
      utc: timezone === "UTC",
    });

    nextRuns = [];
    for (let i = 0; i < 3; i++) {
      const nextRun = parsedCron.next();
      nextRuns.push(nextRun.toDate().toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }));
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Invalid cron expression";
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        <span>Invalid cron expression: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Human-readable description */}
      <div className="text-gray-300 text-sm">
        {humanReadable}
      </div>

      {/* Next execution times */}
      <div className="text-xs text-gray-400">
        <div className="font-medium mb-1">Next executions:</div>
        <ul className="space-y-1">
          {nextRuns.map((time, index) => (
            <li key={index} className="text-gray-500">
              {index === 0 && "• "}{index === 1 && "• "}{index === 2 && "• "}{time}
            </li>
          ))}
        </ul>
      </div>

      {/* Raw cron expression */}
      <div className="text-gray-500 font-mono text-xs border-t border-gray-800 pt-2">
        {cronExpression}
      </div>
    </div>
  );
}