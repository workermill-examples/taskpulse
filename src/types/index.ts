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