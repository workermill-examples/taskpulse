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
  description: z.string().optional(),
  handler: z.string().min(1).max(255),
  retryLimit: z.number().int().min(0).max(10).default(0),
  timeout: z.number().int().min(1000).max(3600000).optional(),
  priority: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
  stepTemplates: z.array(z.object({
    name: z.string().min(1),
    avgDuration: z.number().int().min(100), // minimum 100ms
  })).min(1),
  // Frontend-specific fields that get stored in config JSON
  displayName: z.string().min(1).max(100).optional(),
  retryDelay: z.number().int().min(1000).max(300000).optional(),
  concurrency: z.number().int().min(1).max(100).optional(),
  inputSchema: z.record(z.any()).optional(),
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

// External trigger schema
export const externalTriggerSchema = z.object({
  task: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Task name must be lowercase with hyphens only"),
  input: z.record(z.any()).optional(),
});