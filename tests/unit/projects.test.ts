import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as ProjectsGET, POST as ProjectsPOST } from "@/app/api/projects/route";
import { GET as ProjectGET, PUT as ProjectPUT, DELETE as ProjectDELETE } from "@/app/api/projects/[slug]/route";
import { GET as MembersGET, POST as MembersPOST } from "@/app/api/projects/[slug]/members/route";
import { PUT as MemberPUT, DELETE as MemberDELETE } from "@/app/api/projects/[slug]/members/[id]/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, getUserProjectMembership, hasPermission } from "@/lib/middleware";
import type { ProjectListItem, MemberWithUser } from "@/types";

// Mock dependencies
vi.mock("@/lib/auth");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/middleware");

const mockAuth = auth as unknown as MockedFunction<() => Promise<any>>;
const mockRequireProjectAccess = requireProjectAccess as MockedFunction<typeof requireProjectAccess>;
const mockGetUserProjectMembership = getUserProjectMembership as MockedFunction<typeof getUserProjectMembership>;
const mockHasPermission = hasPermission as MockedFunction<typeof hasPermission>;

// Helper to create NextRequest with proper body handling for tests
function createTestRequest(url: string, options?: { method?: string; body?: any; headers?: Record<string, string> }) {
  if (options?.body) {
    return new NextRequest(
      new Request(url, {
        method: options.method || 'GET',
        headers: options.headers ? { 'Content-Type': 'application/json', ...options.headers } : { 'Content-Type': 'application/json' },
        body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
      })
    );
  } else {
    return new NextRequest(url, { method: options?.method || 'GET', headers: options?.headers });
  }
}

describe("Projects API Routes", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
  };

  const mockSession = {
    user: mockUser,
  };

  const mockProject = {
    id: "project-1",
    name: "Test Project",
    slug: "test-project",
    description: "A test project",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };

  const mockMembership = {
    id: "member-1",
    role: "OWNER" as const,
    userId: "user-1",
    projectId: "project-1",
    user: mockUser,
    project: mockProject,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/projects", () => {
    it("should return 401 if not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/projects");
      const response = await ProjectsGET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Authentication required" });
    });

    it("should return user's projects with counts", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const mockProjectsData = [
        {
          ...mockProject,
          _count: {
            members: 2,
            tasks: 5,
          },
          runs: [{ id: "run-1" }, { id: "run-2" }],
        },
      ];

      (prisma.project.findMany as any).mockResolvedValue(mockProjectsData);

      const request = new NextRequest("http://localhost/api/projects");
      const response = await ProjectsGET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: "project-1",
        name: "Test Project",
        slug: "test-project",
        memberCount: 2,
        taskCount: 5,
        recentRunCount: 2,
      });
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: "user-1",
            },
          },
        },
        include: expect.any(Object),
        orderBy: {
          updatedAt: "desc",
        },
      });
    });

    it("should handle database errors", async () => {
      mockAuth.mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockRejectedValue(new Error("DB error"));

      const request = new NextRequest("http://localhost/api/projects");
      const response = await ProjectsGET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Internal server error" });
    });
  });

  describe("POST /api/projects", () => {
    it("should return 401 if not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const request = createTestRequest("http://localhost/api/projects", {
        method: "POST",
        body: { name: "New Project" },
      });
      const response = await ProjectsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Authentication required" });
    });

    it("should create project with valid data", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const mockCreatedProject = {
        ...mockProject,
        _count: {
          members: 1,
          tasks: 0,
        },
      };

      (prisma.project.findUnique as any).mockResolvedValue(null); // No existing project
      (prisma.project.create as any).mockResolvedValue(mockCreatedProject);

      const request = createTestRequest("http://localhost/api/projects", {
        method: "POST",
        body: {
          name: "Test Project",
          description: "A test project",
        },
      });

      const response = await ProjectsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        name: "Test Project",
        slug: "test-project",
        description: "A test project",
        memberCount: 1,
        taskCount: 0,
        recentRunCount: 0,
      });

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          name: "Test Project",
          slug: "test-project",
          description: "A test project",
          members: {
            create: {
              userId: "user-1",
              role: "OWNER",
            },
          },
        },
        include: expect.any(Object),
      });
    });

    it("should generate unique slugs when name conflicts", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const mockCreatedProject = {
        ...mockProject,
        slug: "test-project-1",
        _count: {
          members: 1,
          tasks: 0,
        },
      };

      // First call finds existing project, second call returns null
      (prisma.project.findUnique as any)
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);
      (prisma.project.create as any).mockResolvedValue(mockCreatedProject);

      const request = createTestRequest("http://localhost/api/projects", {
        method: "POST",
        body: { name: "Test Project" },
      });

      const response = await ProjectsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.slug).toBe("test-project-1");
      expect(prisma.project.findUnique).toHaveBeenCalledTimes(2);
    });

    it("should return 400 for invalid input", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const request = createTestRequest("http://localhost/api/projects", {
        method: "POST",
        body: { name: "AB" }, // Too short
      });

      const response = await ProjectsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid input data" });
    });
  });

  describe("GET /api/projects/[slug]", () => {
    it("should return project details for authorized user", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: mockMembership,
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockProjectDetail = {
        ...mockProject,
        _count: {
          members: 2,
          tasks: 5,
        },
        runs: [{ id: "run-1" }],
      };

      (prisma.project.findUnique as any).mockResolvedValue(mockProjectDetail);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project");
      const response = await ProjectGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        id: "project-1",
        name: "Test Project",
        slug: "test-project",
        memberCount: 2,
        taskCount: 5,
        recentRunCount: 1,
      });
    });

    it("should return auth error response from middleware", async () => {
      const mockErrorResponse = NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "nonexistent" });
      const request = new NextRequest("http://localhost/api/projects/nonexistent");
      const response = await ProjectGET(request, { params });

      expect(response).toBe(mockErrorResponse);
    });
  });

  describe("PUT /api/projects/[slug]", () => {
    it("should update project with ADMIN role", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: { ...mockMembership, role: "ADMIN" as const },
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const updatedProject = {
        ...mockProject,
        name: "Updated Project",
        description: "Updated description",
      };

      (prisma.project.update as any).mockResolvedValue(updatedProject);

      const params = Promise.resolve({ slug: "test-project" });
      const request = createTestRequest("http://localhost/api/projects/test-project", {
        method: "PUT",
        body: {
          name: "Updated Project",
          description: "Updated description",
        },
      });

      const response = await ProjectPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        name: "Updated Project",
        description: "Updated description",
      });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );
    });

    it("should return 403 for insufficient permissions", async () => {
      const mockErrorResponse = NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "test-project" });
      const request = createTestRequest("http://localhost/api/projects/test-project", {
        method: "PUT",
        body: { name: "Updated Project" },
      });

      const response = await ProjectPUT(request, { params });

      expect(response).toBe(mockErrorResponse);
    });
  });

  describe("DELETE /api/projects/[slug]", () => {
    it("should delete project with OWNER role", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: mockMembership, // OWNER role
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.project.delete as any).mockResolvedValue(mockProject);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project", {
        method: "DELETE",
      });

      const response = await ProjectDELETE(request, { params });

      expect(response.status).toBe(204);
      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "OWNER"
      );
      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: "project-1" },
      });
    });
  });

  describe("GET /api/projects/[slug]/members", () => {
    it("should return project members", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: mockMembership,
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockMembers = [
        {
          id: "member-1",
          role: "OWNER",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          user: mockUser,
        },
      ];

      (prisma.projectMember.findMany as any).mockResolvedValue(mockMembers);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/members");
      const response = await MembersGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: "member-1",
        role: "OWNER",
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Test User",
        },
      });
    });
  });

  describe("POST /api/projects/[slug]/members", () => {
    it("should invite new member with ADMIN role", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: { ...mockMembership, role: "ADMIN" as const },
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockInvitedUser = {
        id: "user-2",
        email: "invited@example.com",
        name: "Invited User",
      };

      const mockNewMember = {
        id: "member-2",
        role: "MEMBER",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        user: mockInvitedUser,
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockInvitedUser);
      (prisma.projectMember.findFirst as any).mockResolvedValue(null); // Not already member
      (prisma.projectMember.create as any).mockResolvedValue(mockNewMember);

      const params = Promise.resolve({ slug: "test-project" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members", {
        method: "POST",
        body: {
          email: "invited@example.com",
          role: "MEMBER",
        },
      });

      const response = await MembersPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: "member-2",
        role: "MEMBER",
        user: {
          id: "user-2",
          email: "invited@example.com",
        },
      });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );
    });

    it("should return 404 for non-existent user", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: { ...mockMembership, role: "ADMIN" as const },
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members", {
        method: "POST",
        body: {
          email: "nonexistent@example.com",
          role: "MEMBER",
        },
      });

      const response = await MembersPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "User not found" });
    });

    it("should return 409 for already existing member", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: { ...mockMembership, role: "ADMIN" as const },
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockInvitedUser = {
        id: "user-2",
        email: "invited@example.com",
        name: "Invited User",
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockInvitedUser);
      (prisma.projectMember.findFirst as any).mockResolvedValue({ id: "existing-member" });

      const params = Promise.resolve({ slug: "test-project" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members", {
        method: "POST",
        body: {
          email: "invited@example.com",
          role: "MEMBER",
        },
      });

      const response = await MembersPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toEqual({ error: "User is already a project member" });
    });
  });

  describe("PUT /api/projects/[slug]/members/[id]", () => {
    it("should update member role with ADMIN permissions", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: { ...mockMembership, role: "ADMIN" as const },
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockTargetMember = {
        id: "member-2",
        role: "MEMBER",
        userId: "user-2",
        projectId: "project-1",
      };

      const mockUpdatedMember = {
        ...mockTargetMember,
        role: "ADMIN",
        user: {
          id: "user-2",
          email: "member@example.com",
          name: "Member User",
        },
      };

      (prisma.projectMember.findUnique as any).mockResolvedValue(mockTargetMember);
      (prisma.projectMember.update as any).mockResolvedValue(mockUpdatedMember);
      mockHasPermission.mockReturnValue(true);

      const params = Promise.resolve({ slug: "test-project", id: "member-2" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members/member-2", {
        method: "PUT",
        body: { role: "ADMIN" },
      });

      const response = await MemberPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role).toBe("ADMIN");
    });

    it("should prevent demoting last OWNER", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: mockMembership, // OWNER role
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockTargetMember = {
        id: "member-1",
        role: "OWNER",
        userId: "user-1",
        projectId: "project-1",
      };

      (prisma.projectMember.findUnique as any).mockResolvedValue(mockTargetMember);
      (prisma.projectMember.count as any).mockResolvedValue(1); // Only one OWNER
      mockHasPermission.mockReturnValue(true);

      const params = Promise.resolve({ slug: "test-project", id: "member-1" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members/member-1", {
        method: "PUT",
        body: { role: "ADMIN" },
      });

      const response = await MemberPUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: "Cannot demote the last owner" });
    });
  });

  describe("DELETE /api/projects/[slug]/members/[id]", () => {
    it("should allow member to remove themselves", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: mockMembership,
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockTargetMember = {
        id: "member-1",
        role: "OWNER",
        userId: "user-1", // Same as requesting user
        projectId: "project-1",
      };

      (prisma.projectMember.findUnique as any).mockResolvedValue(mockTargetMember);
      (prisma.projectMember.count as any).mockResolvedValue(2); // Multiple OWNERs
      (prisma.projectMember.delete as any).mockResolvedValue(mockTargetMember);

      const params = Promise.resolve({ slug: "test-project", id: "member-1" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members/member-1", {
        method: "DELETE",
      });

      const response = await MemberDELETE(request, { params });

      expect(response.status).toBe(204);
      expect(prisma.projectMember.delete).toHaveBeenCalledWith({
        where: { id: "member-1" },
      });
    });

    it("should prevent last OWNER from leaving", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: mockMembership, // OWNER role
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockTargetMember = {
        id: "member-1",
        role: "OWNER",
        userId: "user-1", // Same as requesting user
        projectId: "project-1",
      };

      (prisma.projectMember.findUnique as any).mockResolvedValue(mockTargetMember);
      (prisma.projectMember.count as any).mockResolvedValue(1); // Only one OWNER

      const params = Promise.resolve({ slug: "test-project", id: "member-1" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members/member-1", {
        method: "DELETE",
      });

      const response = await MemberDELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: "Cannot remove the last owner" });
    });

    it("should require ADMIN role to remove other members", async () => {
      const mockAccessResult = {
        user: mockUser,
        membership: { ...mockMembership, role: "MEMBER" as const }, // Not ADMIN
        project: mockProject,
      };

      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockTargetMember = {
        id: "member-2",
        role: "MEMBER",
        userId: "user-2", // Different user
        projectId: "project-1",
      };

      (prisma.projectMember.findUnique as any).mockResolvedValue(mockTargetMember);
      mockHasPermission.mockReturnValue(false); // MEMBER cannot remove others

      const params = Promise.resolve({ slug: "test-project", id: "member-2" });
      const request = createTestRequest("http://localhost/api/projects/test-project/members/member-2", {
        method: "DELETE",
      });

      const response = await MemberDELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: "Insufficient permissions" });
    });
  });
});