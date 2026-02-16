"use client";

import { cn } from "@/lib/utils";
import type { RunStatus } from "@/types";

interface RunStatusBadgeProps {
  status: RunStatus;
  size?: "sm" | "md";
  className?: string;
}

// Icon components using inline SVG (no @heroicons/react dependency)
function ClockIcon({ className }: { className?: string }) {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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

function SlashIcon({ className }: { className?: string }) {
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
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
  );
}

function ClockAlertIcon({ className }: { className?: string }) {
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
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PulseDot({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
      <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-75"></div>
    </div>
  );
}

const statusConfig = {
  QUEUED: {
    icon: ClockIcon,
    label: "Queued",
    className: "text-gray-400 bg-gray-400/10",
  },
  EXECUTING: {
    icon: PulseDot,
    label: "Executing",
    className: "text-blue-400 bg-blue-400/10",
  },
  COMPLETED: {
    icon: CheckIcon,
    label: "Completed",
    className: "text-emerald-400 bg-emerald-400/10",
  },
  FAILED: {
    icon: XIcon,
    label: "Failed",
    className: "text-red-400 bg-red-400/10",
  },
  CANCELLED: {
    icon: SlashIcon,
    label: "Cancelled",
    className: "text-gray-500 bg-gray-500/10",
  },
  TIMED_OUT: {
    icon: ClockAlertIcon,
    label: "Timed Out",
    className: "text-amber-400 bg-amber-400/10",
  },
};

export default function RunStatusBadge({
  status,
  size = "md",
  className,
}: RunStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-2.5 py-1.5 text-sm gap-1.5",
  };

  const iconSizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md border border-transparent",
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {status === "EXECUTING" ? (
        <Icon className={iconSizeClasses[size]} />
      ) : (
        <Icon className={iconSizeClasses[size]} />
      )}
      {config.label}
    </span>
  );
}