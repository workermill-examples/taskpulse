import { describe, it, expect } from "vitest";

describe("/api/health", () => {
  it("should return health status", async () => {
    const response = await fetch("http://localhost:3000/api/health");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("timestamp");
    expect(typeof data.timestamp).toBe("string");
    expect(new Date(data.timestamp)).toBeInstanceOf(Date);
  });
});