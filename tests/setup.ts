import { vi } from "vitest";

// Mock Next.js server components to avoid module resolution issues
vi.mock("next/server", () => ({
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    headers: Map<string, string>;
    body?: ReadableStream;

    constructor(input: string | Request, options?: any) {
      // Handle both string URL and Request object
      if (typeof input === 'string') {
        this.url = input;
        this.method = options?.method || "GET";
        this.headers = new Map();

        if (options?.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            this.headers.set(key, value as string);
          });
        }

        if (options?.body) {
          this.body = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(options.body));
              controller.close();
            },
          });
        }
      } else {
        // input is a Request object
        this.url = input.url;
        this.method = input.method;
        this.headers = new Map();

        // Copy headers from Request
        input.headers.forEach((value, key) => {
          this.headers.set(key, value);
        });

        // Copy body from Request
        if (input.body) {
          this.body = input.body;
        }
      }
    }

    async json() {
      if (!this.body) return {};
      const reader = this.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(combined);
      return JSON.parse(text);
    }
  },
  NextResponse: class MockNextResponse extends Response {
    static json(data: any, init?: ResponseInit) {
      const status = init?.status || 200;
      const body = status === 204 ? null : JSON.stringify(data);

      return new MockNextResponse(body as BodyInit, {
        status: status,
        headers: status === 204 ? {} : {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    }

    constructor(body?: BodyInit, init?: ResponseInit) {
      super(body, init);
    }
  },
}));

// Mock NextAuth
vi.mock("next-auth", () => {
  const mockNextAuth = vi.fn(() => ({
    handlers: {
      GET: vi.fn(),
      POST: vi.fn(),
    },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }));

  return {
    default: mockNextAuth,
  };
});

// Mock bcrypt
vi.mock("bcrypt", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Mock Zod to handle Error instanceof checks
vi.mock("zod", async () => {
  const actual = await vi.importActual("zod") as any;
  return {
    ...actual,
    ZodError: class MockZodError extends Error {
      issues: any[];

      constructor(issues: any[]) {
        super("Validation error");
        this.name = "ZodError";
        this.issues = issues;
      }
    },
  };
});