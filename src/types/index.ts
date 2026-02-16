export type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type RunStatus = "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
}

// API Response types for routes
export interface ProjectListItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  memberCount: number;
  taskCount: number;
  recentRunCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RunListItem {
  id: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  createdAt: string;
  task: {
    id: string;
    name: string;
  };
}

export interface TaskWithRunCounts {
  id: string;
  name: string;
  description?: string | null;
  handler: string;
  config: Record<string, any>;
  timeout?: number | null;
  retryLimit: number;
  priority: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  runCounts: {
    total: number;
    completed: number;
    failed: number;
    executing: number;
    queued: number;
  };
  lastRun?: {
    id: string;
    status: RunStatus;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
}

export interface MemberWithUser {
  id: string;
  role: MemberRole;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface ScheduleWithTask {
  id: string;
  name: string;
  description?: string | null;
  cronExpr: string;
  timezone: string;
  input?: Record<string, any> | null;
  status: "ACTIVE" | "PAUSED" | "DISABLED";
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  task: {
    id: string;
    name: string;
  };
}

export interface DashboardStats {
  runsByStatus: Record<RunStatus, number>;
  runsByTask: Array<{
    taskName: string;
    taskDisplayName: string;
    count: number;
  }>;
  runsOverTime: Array<{
    date: string;
    count: number;
  }>;
  avgDuration: number | null;
  successRate: number;
  totalRuns: number;
  failedRuns: number;
}