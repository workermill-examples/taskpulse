import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { NextRequest } from "next/server";
import { parseExpression } from "cron-parser";
import { GET as SchedulesGET, POST as SchedulesPOST } from "@/app/api/projects/[slug]/schedules/route";
import { GET as ScheduleGET, PUT as SchedulePUT, DELETE as ScheduleDELETE } from "@/app/api/projects/[slug]/schedules/[id]/route";
import { requireProjectAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/middleware");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    schedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const mockRequireProjectAccess = requireProjectAccess as MockedFunction<typeof requireProjectAccess>;

describe("Schedules API Routes", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
  };

  const mockProject = {
    id: "project-1",
    name: "Test Project",
    slug: "test-project",
    description: "A test project",
  };

  const mockMembership = {
    id: "member-1",
    role: "MEMBER" as const,
    userId: "user-1",
    projectId: "project-1",
    user: mockUser,
    project: mockProject,
  };

  const mockAccessResult = {
    user: mockUser,
    membership: mockMembership,
    project: mockProject,
  };

  const mockTask = {
    id: "task-1",
    name: "Send Email", // This becomes displayName in API response
    handler: "send-email", // This becomes name in API response
    description: "Send notification email",
    isActive: true,
    projectId: "project-1",
  };

  const mockSchedule = {
    id: "schedule-1",
    name: "Daily Email Schedule",
    description: "Send daily emails",
    cronExpr: "0 9 * * *",
    timezone: "UTC",
    status: "ACTIVE" as const,
    nextRunAt: new Date("2024-01-02T09:00:00Z"),
    lastRunAt: new Date("2024-01-01T09:00:00Z"),
    projectId: "project-1",
    taskId: "task-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    task: mockTask,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/projects/[slug]/schedules", () => {
    it("should return schedules with task information", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockSchedulesData = [mockSchedule];
      (prisma.schedule.findMany as any).mockResolvedValue(mockSchedulesData);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules");
      const response = await SchedulesGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        id: "schedule-1",
        name: "Daily Email Schedule",
        description: "Send daily emails",
        cronExpression: "0 9 * * *",
        timezone: "UTC",
        enabled: true,
        nextRunAt: "2024-01-02T09:00:00.000Z",
        lastRunAt: "2024-01-01T09:00:00.000Z",
        task: {
          id: "task-1",
          name: "send-email",
          displayName: "Send Email",
          description: "Send notification email",
        },
      });
      expect(data.hasMore).toBe(false);

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "VIEWER"
      );
    });

    it("should handle pagination with cursor", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockSchedulesData = [
        { ...mockSchedule, id: "schedule-1" },
        { ...mockSchedule, id: "schedule-2" },
      ];
      (prisma.schedule.findMany as any).mockResolvedValue(mockSchedulesData);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules?cursor=schedule-3&limit=1");
      const response = await SchedulesGET(request, { params });

      expect(prisma.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: "project-1",
            id: { lt: "schedule-3" },
          }),
          take: 2, // limit + 1 to check for more
        })
      );
    });

    it("should handle middleware auth errors", async () => {
      const mockErrorResponse = Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules");
      const response = await SchedulesGET(request, { params });

      expect(response).toBe(mockErrorResponse);
    });

    it("should return hasMore=true when there are more schedules", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      // Mock 3 schedules when limit is 2
      const mockSchedulesData = [
        { ...mockSchedule, id: "schedule-1" },
        { ...mockSchedule, id: "schedule-2" },
        { ...mockSchedule, id: "schedule-3" },
      ];
      (prisma.schedule.findMany as any).mockResolvedValue(mockSchedulesData);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules?limit=2");
      const response = await SchedulesGET(request, { params });
      const data = await response.json();

      expect(data.hasMore).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.cursor).toBe("schedule-2");
    });
  });

  describe("POST /api/projects/[slug]/schedules", () => {
    it("should create schedule with valid data", async () => {
      mockRequireProjectAccess.mockResolvedValue({
        ...mockAccessResult,
        membership: { ...mockMembership, role: "MEMBER" as const },
      });

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.schedule.create as any).mockResolvedValue(mockSchedule);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules", {
        method: "POST",
        body: JSON.stringify({
          taskId: "task-1",
          cronExpression: "0 9 * * *",
          description: "Send daily emails",
          timezone: "UTC",
          enabled: true,
        }),
      });

      const response = await SchedulesPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: "schedule-1",
        name: "Daily Email Schedule",
        cronExpression: "0 9 * * *",
        enabled: true,
        task: {
          name: "send-email",
          displayName: "Send Email",
        },
      });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "MEMBER"
      );
    });

    it("should calculate nextRunAt when enabled", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);

      const mockCreatedSchedule = {
        ...mockSchedule,
        nextRunAt: new Date("2024-01-02T09:00:00Z"),
        status: "ACTIVE",
      };
      (prisma.schedule.create as any).mockResolvedValue(mockCreatedSchedule);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules", {
        method: "POST",
        body: JSON.stringify({
          taskId: "task-1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          enabled: true,
        }),
      });

      const response = await SchedulesPOST(request, { params });

      expect(prisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: expect.any(Date),
            status: "ACTIVE",
          }),
        })
      );
    });

    it("should set nextRunAt to null when disabled", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);

      const mockDisabledSchedule = {
        ...mockSchedule,
        nextRunAt: null,
        status: "DISABLED",
      };
      (prisma.schedule.create as any).mockResolvedValue(mockDisabledSchedule);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules", {
        method: "POST",
        body: JSON.stringify({
          taskId: "task-1",
          cronExpression: "0 9 * * *",
          timezone: "UTC",
          enabled: false,
        }),
      });

      await SchedulesPOST(request, { params });

      expect(prisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: null,
            status: "DISABLED",
          }),
        })
      );
    });

    it("should return 404 for non-existent task", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.task.findFirst as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules", {
        method: "POST",
        body: JSON.stringify({
          taskId: "nonexistent",
          cronExpression: "0 9 * * *",
        }),
      });

      const response = await SchedulesPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Task not found" });
    });

    it("should return 400 for invalid cron expression", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules", {
        method: "POST",
        body: JSON.stringify({
          taskId: "task-1",
          cronExpression: "invalid-cron",
        }),
      });

      const response = await SchedulesPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid cron expression");
    });

    it("should return 400 for invalid input data", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules", {
        method: "POST",
        body: JSON.stringify({
          taskId: "not-a-uuid",
          cronExpression: "0 9 * * *",
        }),
      });

      const response = await SchedulesPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid schedule data");
    });
  });

  describe("GET /api/projects/[slug]/schedules/[id]", () => {
    it("should return schedule details", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.schedule.findFirst as any).mockResolvedValue(mockSchedule);

      const params = Promise.resolve({ slug: "test-project", id: "schedule-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/schedule-1");
      const response = await ScheduleGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: "schedule-1",
        name: "Daily Email Schedule",
        cronExpression: "0 9 * * *",
        enabled: true,
        task: {
          name: "send-email",
          displayName: "Send Email",
        },
      });
    });

    it("should return 404 for non-existent schedule", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.schedule.findFirst as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project", id: "nonexistent" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/nonexistent");
      const response = await ScheduleGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Schedule not found" });
    });
  });

  describe("PUT /api/projects/[slug]/schedules/[id]", () => {
    it("should update schedule with valid data", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const existingSchedule = mockSchedule;
      const updatedSchedule = {
        ...mockSchedule,
        description: "Updated description",
        cronExpr: "0 10 * * *",
      };

      (prisma.schedule.findFirst as any).mockResolvedValue(existingSchedule);
      (prisma.schedule.update as any).mockResolvedValue(updatedSchedule);

      const params = Promise.resolve({ slug: "test-project", id: "schedule-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/schedule-1", {
        method: "PUT",
        body: JSON.stringify({
          description: "Updated description",
          cronExpression: "0 10 * * *",
        }),
      });

      const response = await SchedulePUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        description: "Updated description",
        cronExpression: "0 10 * * *",
      });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "MEMBER"
      );
    });

    it("should recalculate nextRunAt when cron expression changes", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.schedule.findFirst as any).mockResolvedValue(mockSchedule);
      (prisma.schedule.update as any).mockResolvedValue(mockSchedule);

      const params = Promise.resolve({ slug: "test-project", id: "schedule-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/schedule-1", {
        method: "PUT",
        body: JSON.stringify({
          cronExpression: "0 10 * * *",
        }),
      });

      await SchedulePUT(request, { params });

      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cronExpr: "0 10 * * *",
            nextRunAt: expect.any(Date),
          }),
        })
      );
    });

    it("should set nextRunAt to null when disabled", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.schedule.findFirst as any).mockResolvedValue(mockSchedule);
      (prisma.schedule.update as any).mockResolvedValue({
        ...mockSchedule,
        status: "DISABLED",
        nextRunAt: null,
      });

      const params = Promise.resolve({ slug: "test-project", id: "schedule-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/schedule-1", {
        method: "PUT",
        body: JSON.stringify({
          enabled: false,
        }),
      });

      await SchedulePUT(request, { params });

      expect(prisma.schedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DISABLED",
            nextRunAt: null,
          }),
        })
      );
    });

    it("should return 404 for non-existent schedule", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.schedule.findFirst as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project", id: "nonexistent" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/nonexistent", {
        method: "PUT",
        body: JSON.stringify({
          description: "Updated",
        }),
      });

      const response = await SchedulePUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Schedule not found" });
    });

    it("should return 400 for invalid cron expression", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.schedule.findFirst as any).mockResolvedValue(mockSchedule);

      const params = Promise.resolve({ slug: "test-project", id: "schedule-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/schedule-1", {
        method: "PUT",
        body: JSON.stringify({
          cronExpression: "invalid-cron",
        }),
      });

      const response = await SchedulePUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid cron expression");
    });
  });

  describe("DELETE /api/projects/[slug]/schedules/[id]", () => {
    it("should delete schedule with ADMIN role", async () => {
      mockRequireProjectAccess.mockResolvedValue({
        ...mockAccessResult,
        membership: { ...mockMembership, role: "ADMIN" as const },
      });

      (prisma.schedule.findFirst as any).mockResolvedValue(mockSchedule);
      (prisma.schedule.delete as any).mockResolvedValue(mockSchedule);

      const params = Promise.resolve({ slug: "test-project", id: "schedule-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/schedule-1", {
        method: "DELETE",
      });

      const response = await ScheduleDELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: "Schedule deleted successfully" });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );

      expect(prisma.schedule.delete).toHaveBeenCalledWith({
        where: { id: "schedule-1" },
      });
    });

    it("should return 404 for non-existent schedule", async () => {
      mockRequireProjectAccess.mockResolvedValue({
        ...mockAccessResult,
        membership: { ...mockMembership, role: "ADMIN" as const },
      });
      (prisma.schedule.findFirst as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project", id: "nonexistent" });
      const request = new NextRequest("http://localhost/api/projects/test-project/schedules/nonexistent", {
        method: "DELETE",
      });

      const response = await ScheduleDELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Schedule not found" });
    });
  });
});