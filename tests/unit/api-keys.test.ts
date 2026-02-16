import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { GET as ApiKeysGET, POST as ApiKeysPOST } from "@/app/api/projects/[slug]/api-keys/route";
import { DELETE as ApiKeyDELETE } from "@/app/api/projects/[slug]/api-keys/[id]/route";
import { requireProjectAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/middleware");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("bcrypt");
vi.mock("crypto");

const mockRequireProjectAccess = requireProjectAccess as MockedFunction<typeof requireProjectAccess>;
const mockBcryptHash = vi.fn();
const mockCryptoRandomBytes = vi.fn();

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

describe("API Keys Routes", () => {
  const mockUser = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "admin@example.com",
    name: "Admin User",
  };

  const mockProject = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "Test Project",
    slug: "test-project",
    description: "A test project",
  };

  const mockMembership = {
    id: "550e8400-e29b-41d4-a716-446655440002",
    role: "ADMIN" as const,
    userId: "550e8400-e29b-41d4-a716-446655440000",
    projectId: "550e8400-e29b-41d4-a716-446655440001",
    user: mockUser,
    project: mockProject,
  };

  const mockAccessResult = {
    user: mockUser,
    membership: mockMembership,
    project: mockProject,
  };

  const mockApiKey = {
    id: "api-key-1",
    name: "Production API Key",
    keyPrefix: "tp_live_abcd1234",
    keyPreview: "5678",
    lastUsedAt: new Date("2024-01-01T12:00:00Z"),
    expiresAt: new Date("2024-12-31T23:59:59Z"),
    createdAt: new Date("2024-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (bcrypt.hash as any) = mockBcryptHash;
    (crypto.randomBytes as any) = mockCryptoRandomBytes;
  });

  describe("GET /api/projects/[slug]/api-keys", () => {
    it("should return API keys with prefix only for ADMIN user", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockApiKeysData = [mockApiKey];
      (prisma.apiKey.findMany as any).mockResolvedValue(mockApiKeysData);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys");
      const response = await ApiKeysGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0]).toMatchObject({
        id: "api-key-1",
        name: "Production API Key",
        keyPrefix: "tp_live_abcd1234",
        keyPreview: "5678",
        lastUsedAt: "2024-01-01T12:00:00.000Z",
        expiresAt: "2024-12-31T23:59:59.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      });

      // Verify full key is not included in response
      expect(data.data[0]).not.toHaveProperty("keyHash");
      expect(data.data[0]).not.toHaveProperty("key");

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );

      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { projectId: "550e8400-e29b-41d4-a716-446655440001" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          keyPreview: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
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
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys");
      const response = await ApiKeysGET(request, { params });

      expect(response).toBe(mockErrorResponse);
    });

    it("should require ADMIN role to view API keys", async () => {
      const mockNonAdminAccess = {
        ...mockAccessResult,
        membership: { ...mockMembership, role: "MEMBER" as const },
      };

      const mockErrorResponse = NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys");
      const response = await ApiKeysGET(request, { params });

      expect(response).toBe(mockErrorResponse);
    });

    it("should return empty array when no API keys exist", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.apiKey.findMany as any).mockResolvedValue([]);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys");
      const response = await ApiKeysGET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(0);
    });
  });

  describe("POST /api/projects/[slug]/api-keys", () => {
    it("should create API key with valid data and return full key once", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const fullApiKey = "tp_live_abcd1234567890abcdef1234567890ab";
      mockCryptoRandomBytes.mockReturnValue(Buffer.from("abcd1234567890abcdef1234567890ab", "hex"));
      mockBcryptHash.mockResolvedValue("$2b$12$hashedkey");

      const mockCreatedApiKey = {
        ...mockApiKey,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      };
      (prisma.apiKey.create as any).mockResolvedValue(mockCreatedApiKey);

      const params = Promise.resolve({ slug: "test-project" });
      const request = createTestRequest("http://localhost/api/projects/test-project/api-keys", {
        method: "POST",
        body: {
          name: "Production API Key",
          expiresAt: "2024-12-31T23:59:59Z",
        },
      });

      const response = await ApiKeysPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: "api-key-1",
        name: "Production API Key",
        keyPrefix: "tp_live_abcd1234",
        keyPreview: "5678",
        key: fullApiKey, // Full key returned only once
      });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );

      expect(mockBcryptHash).toHaveBeenCalledWith(fullApiKey, 12);

      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          name: "Production API Key",
          keyHash: "$2b$12$hashedkey",
          keyPrefix: "tp_live_abcd1234",
          keyPreview: expect.any(String),
          permissions: {},
          expiresAt: new Date("2024-12-31T23:59:59Z"),
          projectId: "550e8400-e29b-41d4-a716-446655440001",
          createdBy: "550e8400-e29b-41d4-a716-446655440000",
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          keyPreview: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    });

    it("should create API key without expiration date", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const fullApiKey = "tp_live_abcd1234567890abcdef1234567890ab";
      mockCryptoRandomBytes.mockReturnValue(Buffer.from("abcd1234567890abcdef1234567890ab", "hex"));
      mockBcryptHash.mockResolvedValue("$2b$12$hashedkey");

      const mockCreatedApiKey = {
        ...mockApiKey,
        expiresAt: null,
      };
      (prisma.apiKey.create as any).mockResolvedValue(mockCreatedApiKey);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: "Permanent API Key",
        }),
      });

      const response = await ApiKeysPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.key).toBe(fullApiKey);

      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: null,
        }),
        select: expect.any(Object),
      });
    });

    it("should generate tp_live_ prefix with 32 random hex chars", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockRandomBytes = Buffer.from("1234567890abcdef1234567890abcdef", "hex");
      mockCryptoRandomBytes.mockReturnValue(mockRandomBytes);
      mockBcryptHash.mockResolvedValue("$2b$12$hashedkey");

      (prisma.apiKey.create as any).mockResolvedValue(mockApiKey);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Key",
        }),
      });

      await ApiKeysPOST(request, { params });

      expect(mockCryptoRandomBytes).toHaveBeenCalledWith(16); // 16 bytes = 32 hex chars

      const expectedKey = "tp_live_" + "1234567890abcdef1234567890abcdef";
      expect(mockBcryptHash).toHaveBeenCalledWith(expectedKey, 12);
    });

    it("should store correct keyPrefix for lookup", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const mockRandomBytes = Buffer.from("1234567890abcdef1234567890abcdef", "hex");
      mockCryptoRandomBytes.mockReturnValue(mockRandomBytes);
      mockBcryptHash.mockResolvedValue("$2b$12$hashedkey");

      (prisma.apiKey.create as any).mockResolvedValue(mockApiKey);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Key",
        }),
      });

      await ApiKeysPOST(request, { params });

      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          keyPrefix: "tp_live_12345678", // First 16 chars
          keyPreview: expect.any(String), // Last 4 chars
        }),
        select: expect.any(Object),
      });
    });

    it("should return 400 for invalid input data", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: "", // Empty name should be invalid
        }),
      });

      const response = await ApiKeysPOST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid API key data");
    });

    it("should require ADMIN role to create API keys", async () => {
      const mockErrorResponse = NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "test-project" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Key",
        }),
      });

      const response = await ApiKeysPOST(request, { params });

      expect(response).toBe(mockErrorResponse);
    });
  });

  describe("DELETE /api/projects/[slug]/api-keys/[id]", () => {
    it("should revoke API key with ADMIN role", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);

      (prisma.apiKey.findFirst as any).mockResolvedValue(mockApiKey);
      (prisma.apiKey.delete as any).mockResolvedValue(mockApiKey);

      const params = Promise.resolve({ slug: "test-project", id: "api-key-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys/api-key-1", {
        method: "DELETE",
      });

      const response = await ApiKeyDELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ message: "API key revoked successfully" });

      expect(mockRequireProjectAccess).toHaveBeenCalledWith(
        request,
        "test-project",
        "ADMIN"
      );

      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          id: "api-key-1",
          projectId: "550e8400-e29b-41d4-a716-446655440001",
        },
      });

      expect(prisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: "api-key-1" },
      });
    });

    it("should return 404 for non-existent API key", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.apiKey.findFirst as any).mockResolvedValue(null);

      const params = Promise.resolve({ slug: "test-project", id: "nonexistent" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys/nonexistent", {
        method: "DELETE",
      });

      const response = await ApiKeyDELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "API key not found" });
    });

    it("should perform hard delete (revoke)", async () => {
      mockRequireProjectAccess.mockResolvedValue(mockAccessResult);
      (prisma.apiKey.findFirst as any).mockResolvedValue(mockApiKey);
      (prisma.apiKey.delete as any).mockResolvedValue(mockApiKey);

      const params = Promise.resolve({ slug: "test-project", id: "api-key-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys/api-key-1", {
        method: "DELETE",
      });

      await ApiKeyDELETE(request, { params });

      // Verify it's a hard delete, not a soft delete
      expect(prisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: "api-key-1" },
      });

      // Should not call update to set a deletedAt field
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it("should require ADMIN role to delete API keys", async () => {
      const mockErrorResponse = NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );

      mockRequireProjectAccess.mockResolvedValue(mockErrorResponse as any);

      const params = Promise.resolve({ slug: "test-project", id: "api-key-1" });
      const request = new NextRequest("http://localhost/api/projects/test-project/api-keys/api-key-1", {
        method: "DELETE",
      });

      const response = await ApiKeyDELETE(request, { params });

      expect(response).toBe(mockErrorResponse);
    });
  });
});