import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { GET as TasksGET, POST as TasksPOST } from "@/app/api/projects/[slug]/tasks/route";
import { GET as TaskGET, PUT as TaskPUT, DELETE as TaskDELETE } from "@/app/api/projects/[slug]/tasks/[id]/route";
import { GET as RunsGET, POST as RunsPOST } from "@/app/api/projects/[slug]/runs/route";
import { GET as RunGET } from "@/app/api/projects/[slug]/runs/[id]/route";
import { POST as CancelRun } from "@/app/api/projects/[slug]/runs/[id]/cancel/route";
import { POST as RetryRun } from "@/app/api/projects/[slug]/runs/[id]/retry/route";
import { GET as StreamRun } from "@/app/api/projects/[slug]/runs/[id]/stream/route";
import { GET as StatsGET } from "@/app/api/projects/[slug]/stats/route";
import { POST as ExternalTrigger } from "@/app/api/trigger/route";
import { requireProjectAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { simulateRun } from "@/lib/run-simulator";
import { RunStatus, LogLevel } from "@/generated/prisma/client";
import type { RunListItem, TaskWithRunCounts, DashboardStats } from "@/types";

// Mock dependencies
vi.mock("@/lib/middleware");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    run: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/run-simulator");
vi.mock("bcrypt");

const mockRequireProjectAccess = requireProjectAccess as MockedFunction<typeof requireProjectAccess>;
const mockSimulateRun = simulateRun as MockedFunction<typeof simulateRun>;
const mockBcryptCompare = vi.fn().mockResolvedValue(true);

describe("Tasks & Runs API Routes", () => {
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
    description: "Send notification email",
    handler: "send-email", // This becomes name in API response
    config: JSON.stringify({
      stepTemplates: [
        { name: "Prepare email", avgDuration: 500 },
        { name: "Send email", avgDuration: 1000 },
      ],
    }),
    timeout: 300000,
    retryLimit: 3,
    priority: 0,
    tags: [],
    isActive: true,
    projectId: "project-1",
    createdBy: "user-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };

  const mockRun = {
    id: "run-1",
    status: RunStatus.COMPLETED,
    startedAt: new Date("2024-01-01T10:00:00Z"),
    completedAt: new Date("2024-01-01T10:01:00Z"),
    duration: 60000,
    error: null,
    input: {},
    output: { success: true },
    taskId: "task-1",
    projectId: "project-1",
    createdBy: "user-1",
    createdAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    task: {
      id: "task-1",
      name: "send-email",
      displayName: "Send Email",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (bcrypt.compare as any) = mockBcryptCompare;
  });

  describe("GET /api/projects/[slug]/tasks", () => {
    it("should return tasks with run counts", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockTasksData = [
        {
          ...mockTask,
          _count: {
            runs: 10,
          },
          runs: [
            {
              id: "run-1",
              status: RunStatus.COMPLETED,
              startedAt: new Date("2024-01-01T10:00:00Z"),
              completedAt: new Date("2024-01-01T10:01:00Z"),
            },
          ],
        },
      ];

      // Mock the run counts query
      const mockRunCounts = [
        { taskId: "task-1", status: RunStatus.COMPLETED, _count: { id: 8 } },
        { taskId: "task-1", status: RunStatus.FAILED, _count: { id: 1 } },
        { taskId: "task-1", status: RunStatus.EXECUTING, _count: { id: 1 } },
      ];

      (prisma.task.findMany as any).mockResolvedValue(mockTasksData);
      (prisma.run.groupBy as any).mockResolvedValue(mockRunCounts);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks");
      const response = await TasksGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.hasMore).toBe(false);
      expect(data.data[0]).toMatchObject({
        id: "task-1",
        name: "send-email",
        displayName: "Send Email",
        runCounts: {
          total: 10,
          completed: 8,
          failed: 1,
          executing: 1,
          queued: 0,
        },
      });
    });

    it("should handle middleware auth errors", async () => {
      const mockErrorResponse = NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks");
      const response = await TasksGET(request, { params });

      expect(response).toBe(mockErrorResponse);
    });
  });

  describe("POST /api/projects/[slug]/tasks", () => {
    it("should create task with valid data", async () => {
      mockRequireProjectAccess.mockResolvedValue({
        ...mockAccessResult,
        membership: { ...mockMembership, role: "MEMBER" as const },
      });

      (prisma.task.findFirst as any).mockResolvedValue(null); // No existing task
      (prisma.task.create as any).mockResolvedValue(mockTask);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: "send-email",
          displayName: "Send Email",
          description: "Send notification email",
          stepTemplates: [
            { name: "Prepare email", avgDuration: 500 },
            { name: "Send email", avgDuration: 1000 },
          ],
          timeout: 300000,
          retryLimit: 3,
        }),
      });

      const response = await TasksPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: "task-1",
        name: "send-email",
        displayName: "Send Email",
        description: "Send notification email",
      });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "MEMBER"
      );
    });

    it("should return 409 for duplicate task name", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.task.findFirst as any).mockResolvedValue({ id: "existing-task" });

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: "send-email",
          displayName: "Send Email",
          stepTemplates: [{ name: "Step 1", avgDuration: 1000 }],
        }),
      });

      const response = await TasksPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({ error: "Task name already exists" });
    });

    it("should return 400 for invalid input", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: "INVALID-NAME", // Should be lowercase
          displayName: "Test Task",
        }),
      });

      const response = await TasksPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid input data" });
    });
  });

  describe("GET /api/projects/[slug]/tasks/[id]", () => {
    it("should return task details", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const taskWithStats = {
        ...mockTask,
        _count: { runs: 15 },
        runs: [mockRun],
        runCounts: {
          completed: 12,
          failed: 2,
          executing: 1,
          queued: 0,
        },
      };

      (prisma.task.findUnique as any).mockResolvedValue(taskWithStats);

      const params = Promise.resolve({ slug: "test-project", id: "task-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks/task-1");
      const response = await TaskGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: "task-1",
        name: "send-email",
        displayName: "Send Email",
        runCounts: {
          total: 15,
          completed: 12,
          failed: 2,
        },
      });
    });

    it("should return 404 for non-existent task", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.task.findUnique as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project", id: "nonexistent" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks/nonexistent");
      const response = await TaskGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Task not found" });
    });
  });

  describe("PUT /api/projects/[slug]/tasks/[id]", () => {
    it("should update task with valid data", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const existingTask = { ...mockTask };
      const updatedTask = {
        ...mockTask,
        displayName: "Updated Email Task",
        description: "Updated description",
      };

      (prisma.task.findUnique as any).mockResolvedValue(existingTask);
      (prisma.task.findFirst as any).mockResolvedValue(null); // No name conflict
      (prisma.task.update as any).mockResolvedValue(updatedTask);

      const params = Promise.resolve({ slug: "test-project", id: "task-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks/task-1", {
        method: "PUT",
        body: JSON.stringify({
          displayName: "Updated Email Task",
          description: "Updated description",
        }),
      });

      const response = await TaskPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        displayName: "Updated Email Task",
        description: "Updated description",
      });
    });
  });

  describe("DELETE /api/projects/[slug]/tasks/[id]", () => {
    it("should delete task with ADMIN role", async () => {
      mockRequireProjectAccess.mockResolvedValue({
        ...mockAccessResult,
        membership: { ...mockMembership, role: "ADMIN" as const },
      });

      (prisma.task.findUnique as any).mockResolvedValue(mockTask);
      (prisma.task.delete as any).mockResolvedValue(mockTask);

      const params = Promise.resolve({ slug: "test-project", id: "task-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/tasks/task-1", {
        method: "DELETE",
      });

      const response = await TaskDELETE(request, { params });

      expect(response.status).toBe(204);
      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );
    });
  });

  describe("GET /api/projects/[slug]/runs", () => {
    it("should return paginated runs with task info", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockRunsData = [
        {
          ...mockRun,
          task: {
            id: "task-1",
            name: "Send Email", // This becomes displayName in API response
            handler: "send-email", // This becomes name in API response
          },
        },
      ];

      (prisma.run.findMany as any).mockResolvedValue(mockRunsData);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs?limit=20");
      const response = await RunsGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("data");
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        id: "run-1",
        status: "COMPLETED",
        task: {
          displayName: "Send Email",
        },
      });
      expect(data).toHaveProperty("hasMore");
    });

    it("should filter runs by status", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.run.findMany as any).mockResolvedValue([]);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs?status=FAILED");
      const response = await RunsGET(request, { params });

      expect(prisma.run.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "FAILED",
          }),
        })
      );
    });

    it("should filter runs by date range", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.run.findMany as any).mockResolvedValue([]);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest(
        "http://localhost/api/projects/test-project/runs?from=2024-01-01T00:00:00Z&to=2024-01-02T00:00:00Z"
      );
      const response = await RunsGET(request, { params });

      expect(prisma.run.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date("2024-01-01T00:00:00Z"),
              lte: new Date("2024-01-02T00:00:00Z"),
            },
          }),
        })
      );
    });
  });

  describe("POST /api/projects/[slug]/runs", () => {
    it("should trigger run and return completed result", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockSimulatedRun = {
        run: {
          status: RunStatus.COMPLETED,
          startedAt: new Date("2024-01-01T10:00:00Z"),
          completedAt: new Date("2024-01-01T10:01:00Z"),
          duration: 60000,
          error: null,
          input: { email: "test@example.com" },
          output: { success: true },
          taskId: "task-1",
          projectId: "project-1",
          createdBy: "user-1",
        },
        steps: [
          {
            name: "Prepare email",
            type: "step",
            status: "success",
            startTime: new Date("2024-01-01T10:00:00Z"),
            endTime: new Date("2024-01-01T10:00:30Z"),
            duration: 30000,
            metadata: { stepIndex: 0 },
            runId: "run-1",
            parentId: null,
          },
        ],
        logs: [
          {
            level: LogLevel.INFO,
            message: "Starting email preparation",
            timestamp: new Date("2024-01-01T10:00:00Z"),
            metadata: { stepIndex: 0 },
            runId: "run-1",
          },
        ],
      };

      const mockCreatedRun = {
        id: "run-1",
        ...mockSimulatedRun.run,
        steps: mockSimulatedRun.steps,
        logs: mockSimulatedRun.logs,
      };

      (prisma.task.findUnique as any).mockResolvedValue(mockTask);
      mockSimulateRun.mockReturnValue(mockSimulatedRun);
      (prisma.run.create as any).mockResolvedValue(mockCreatedRun);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs", {
        method: "POST",
        body: JSON.stringify({
          taskId: "task-1",
          input: { email: "test@example.com" },
        }),
      });

      const response = await RunsPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: "run-1",
        status: "COMPLETED",
        input: { email: "test@example.com" },
      });

      expect(mockSimulateRun).toHaveBeenCalledWith(
        "project-1",
        mockTask,
        { email: "test@example.com" },
        "manual"
      );
    });

    it("should return 404 for non-existent task", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.task.findUnique as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs", {
        method: "POST",
        body: JSON.stringify({
          taskId: "nonexistent",
        }),
      });

      const response = await RunsPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Task not found" });
    });
  });

  describe("GET /api/projects/[slug]/runs/[id]", () => {
    it("should return run details with steps and logs", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockRunDetail = {
        ...mockRun,
        task: {
          id: "task-1",
          name: "send-email",
          displayName: "Send Email",
          timeout: 300000,
          retryLimit: 3,
        },
        steps: [
          {
            id: "step-1",
            name: "Prepare email",
            status: "COMPLETED",
            startTime: new Date("2024-01-01T10:00:00Z"),
            endTime: new Date("2024-01-01T10:00:30Z"),
            duration: 30000,
            position: 0,
          },
        ],
        logs: [
          {
            id: "log-1",
            level: "INFO",
            message: "Starting email preparation",
            timestamp: new Date("2024-01-01T10:00:00Z"),
          },
        ],
      };

      (prisma.run.findUnique as any).mockResolvedValue(mockRunDetail);

      const params = Promise.resolve({ slug: "test-project", id: "run-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs/run-1");
      const response = await RunGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: "run-1",
        status: "COMPLETED",
        steps: expect.arrayContaining([
          expect.objectContaining({
            name: "Prepare email",
            status: "COMPLETED",
          }),
        ]),
        logs: expect.arrayContaining([
          expect.objectContaining({
            level: "INFO",
            message: "Starting email preparation",
          }),
        ]),
      });
    });
  });

  describe("POST /api/projects/[slug]/runs/[id]/cancel", () => {
    it("should cancel queued or executing run", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockExecutingRun = {
        ...mockRun,
        status: "EXECUTING",
        completedAt: null,
      };

      const mockCancelledRun = {
        ...mockExecutingRun,
        status: "CANCELLED",
        completedAt: new Date("2024-01-01T10:00:30Z"),
      };

      (prisma.run.findUnique as any).mockResolvedValue(mockExecutingRun);
      (prisma.run.update as any).mockResolvedValue(mockCancelledRun);

      const params = Promise.resolve({ slug: "test-project", id: "run-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs/run-1/cancel", {
        method: "POST",
      });

      const response = await CancelRun(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("CANCELLED");

      expect(prisma.run.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CANCELLED",
          }),
        })
      );
    });

    it("should return 400 for already completed run", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockCompletedRun = {
        ...mockRun,
        status: "COMPLETED",
      };

      (prisma.run.findUnique as any).mockResolvedValue(mockCompletedRun);

      const params = Promise.resolve({ slug: "test-project", id: "run-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs/run-1/cancel", {
        method: "POST",
      });

      const response = await CancelRun(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Cannot cancel completed run" });
    });
  });

  describe("POST /api/projects/[slug]/runs/[id]/retry", () => {
    it("should create retry run for failed run", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockFailedRun = {
        ...mockRun,
        status: "FAILED",
        input: { email: "test@example.com" },
        task: mockTask,
      };

      const mockRetryRun = {
        ...mockRun,
        id: "run-2",
        status: "COMPLETED",
        task: mockTask,
        traces: [],
        logs: [],
      };

      (prisma.run.findUnique as any).mockResolvedValue(mockFailedRun);
      mockSimulateRun.mockReturnValue({
        run: {
          status: RunStatus.COMPLETED,
          projectId: "project-1",
          taskId: "task-1",
          createdBy: "user-1",
          input: { email: "test@example.com" },
          output: { success: true },
          error: null,
          duration: 30000,
          startedAt: new Date("2024-01-01T10:00:00Z"),
          completedAt: new Date("2024-01-01T10:00:30Z"),
        },
        steps: [],
        logs: [],
      });
      (prisma.run.create as any).mockResolvedValue(mockRetryRun);

      const params = Promise.resolve({ slug: "test-project", id: "run-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs/run-1/retry", {
        method: "POST",
      });

      const response = await RetryRun(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.originalRunId).toBe("run-1");
      expect(data.status).toBe("COMPLETED");
      expect(mockSimulateRun).toHaveBeenCalledWith(
        "project-1",
        mockTask,
        { email: "test@example.com" },
        "retry"
      );
    });

    it("should return 400 for successful run", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockSuccessfulRun = {
        ...mockRun,
        status: "COMPLETED",
      };

      (prisma.run.findUnique as any).mockResolvedValue(mockSuccessfulRun);

      const params = Promise.resolve({ slug: "test-project", id: "run-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/runs/run-1/retry", {
        method: "POST",
      });

      const response = await RetryRun(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Cannot retry successful run" });
    });
  });

  describe("GET /api/projects/[slug]/stats", () => {
    it("should return dashboard statistics", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockStatsData = {
        runsByStatus: { COMPLETED: 20, FAILED: 5, EXECUTING: 2, QUEUED: 1 },
        runsByTask: [
          { taskName: "send-email", taskDisplayName: "Send Email", count: 15 },
          { taskName: "process-data", taskDisplayName: "Process Data", count: 13 },
        ],
        runsOverTime: [
          { date: "2024-01-01", count: 10 },
          { date: "2024-01-02", count: 18 },
        ],
        avgDuration: 45000,
        successRate: 80.0,
        totalRuns: 28,
        failedRuns: 3,
      };

      // Mock the complex aggregation queries
      (prisma.run.findMany as any).mockImplementation(({ select, where }: any) => {
        if (select && select.status) {
          return [
            { status: "COMPLETED" },
            { status: "COMPLETED" },
            { status: "FAILED" },
          ];
        }
        return mockStatsData.runsOverTime;
      });

      (prisma.run.count as any).mockResolvedValue(28);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/stats");
      const response = await StatsGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        totalRuns: expect.any(Number),
        successRate: expect.any(Number),
        avgDuration: expect.any(Number),
        failedRuns: expect.any(Number),
      });
      expect(data).toHaveProperty("runsByStatus");
      expect(data).toHaveProperty("runsByTask");
      expect(data).toHaveProperty("runsOverTime");
    });
  });

  describe("POST /api/trigger (External API)", () => {
    const mockApiKey = {
      id: "key-1",
      keyPrefix: "sk-test-12345678",
      keyHash: "$2b$10$hashedkey",
      projectId: "project-1",
      createdBy: "user-1",
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      lastUsedAt: null,
      project: mockProject,
    };

    it("should authenticate and trigger run with valid API key", async () => {
      const bearerToken = "sk-test-1234567890123456-full-key";

      (prisma.apiKey.findUnique as any).mockResolvedValue(mockApiKey);
      mockBcryptCompare.mockResolvedValue(true);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      mockSimulateRun.mockReturnValue({
        run: {
          status: RunStatus.COMPLETED,
          projectId: "project-1",
          taskId: "task-1",
          createdBy: "user-1",
          input: { task: "send-email" },
          output: { success: true },
          error: null,
          duration: 30000,
          startedAt: new Date("2024-01-01T10:00:00Z"),
          completedAt: new Date("2024-01-01T10:00:30Z"),
        },
        steps: [],
        logs: [],
      });

      const mockCreatedRun = {
        ...mockRun,
        id: "run-2",
        task: {
          name: "send-email",
          description: "Send notification email",
        },
        traces: [],
        logs: [],
      };

      (prisma.run.create as any).mockResolvedValue(mockCreatedRun);
      (prisma.apiKey.update as any).mockResolvedValue(mockApiKey);

      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({
          task: "send-email",
          input: { email: "test@example.com" },
        }),
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: "run-2",
        status: "COMPLETED",
        task: {
          name: "send-email",
        },
      });

      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyPrefix: "sk-test-12345678" },
        include: { project: true },
      });

      expect(mockBcryptCompare).toHaveBeenCalledWith(bearerToken, mockApiKey.keyHash);

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-1" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it("should return 401 for missing Authorization header", async () => {
      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        body: JSON.stringify({ task: "send-email" }),
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Authentication required" });
    });

    it("should return 401 for invalid API key prefix", async () => {
      (prisma.apiKey.findUnique as any).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-key-1234567890123456",
        },
        body: JSON.stringify({ task: "send-email" }),
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("should return 401 for invalid API key hash", async () => {
      (prisma.apiKey.findUnique as any).mockResolvedValue(mockApiKey);
      mockBcryptCompare.mockResolvedValue(false); // Wrong password

      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk-test-1234567890123456-wrong-key",
        },
        body: JSON.stringify({ task: "send-email" }),
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("should return 401 for expired API key", async () => {
      const expiredApiKey = {
        ...mockApiKey,
        expiresAt: new Date(Date.now() - 86400000), // 24 hours ago
      };

      (prisma.apiKey.findUnique as any).mockResolvedValue(expiredApiKey);
      mockBcryptCompare.mockResolvedValue(true);

      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk-test-1234567890123456-expired-key",
        },
        body: JSON.stringify({ task: "send-email" }),
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "API key expired" });
    });

    it("should return 404 for non-existent task", async () => {
      (prisma.apiKey.findUnique as any).mockResolvedValue(mockApiKey);
      mockBcryptCompare.mockResolvedValue(true);
      (prisma.task.findFirst as any).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk-test-1234567890123456-valid-key",
        },
        body: JSON.stringify({ task: "nonexistent-task" }),
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Task not found" });
    });

    it("should return 400 for invalid request body", async () => {
      const request = new NextRequest("http://localhost/api/trigger", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk-test-1234567890123456-valid-key",
        },
        body: JSON.stringify({ task: "INVALID-TASK-NAME" }), // Should be lowercase
      });

      const response = await ExternalTrigger(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Task name must be lowercase");
    });
  });
});