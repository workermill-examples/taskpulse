import { z } from "zod";

export const emailSchema = z.string().email().max(255);

export const passwordSchema = z.string().min(8);

export const slugSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});