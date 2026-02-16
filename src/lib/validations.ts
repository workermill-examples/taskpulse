import { z } from "zod";

export const emailSchema = z.string().email().max(255);

export const passwordSchema = z.string().min(8);

export const slugSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().optional(),
});

// Member schemas
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(["VIEWER", "MEMBER", "ADMIN", "OWNER"]),
});

// Task schemas
export const registerTaskSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Task name must be lowercase with hyphens only"),
  displayName: z.string().min(1).max(100),
  description: z.string().optional(),
  retryLimit: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(1000).max(300000).default(5000), // 1s to 5min in ms
  timeout: z.number().int().min(1000).max(3600000).default(300000), // 1s to 1hr in ms
  concurrency: z.number().int().min(1).max(100).default(1),
  inputSchema: z.record(z.any()).optional(),
  stepTemplates: z.array(z.object({
    name: z.string().min(1),
    avgDuration: z.number().int().min(100), // minimum 100ms
  })).min(1),
});

// Run schemas
export const triggerRunSchema = z.object({
  taskId: z.string().uuid(),
  input: z.record(z.any()).optional(),
});

export const runFilterSchema = z.object({
  status: z.enum(["QUEUED", "EXECUTING", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]).optional(),
  taskId: z.string().uuid().optional(),
  triggeredBy: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});