import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it, vi } from "vitest";
import handler from "../api/verify";

function mockResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    status: vi.fn(function (this: { statusCode: number }, statusCode: number) {
      this.statusCode = statusCode;
      return this;
    }),
    json: vi.fn(function (this: { body: unknown }, body: unknown) {
      this.body = body;
      return this;
    }),
    end: vi.fn(function (this: object) {
      return this;
    }),
  };
  return { response, headers };
}

describe("verification API handler", () => {
  it("answers CORS preflight without a body", async () => {
    const { response, headers } = mockResponse();
    await handler({ method: "OPTIONS" } as VercelRequest, response as unknown as VercelResponse);
    expect(response.statusCode).toBe(204);
    expect(response.end).toHaveBeenCalled();
    expect(headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects unsupported methods", async () => {
    const { response, headers } = mockResponse();
    await handler({ method: "GET" } as VercelRequest, response as unknown as VercelResponse);
    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method not allowed" });
    expect(headers.get("Allow")).toBe("POST, OPTIONS");
  });

  it.each([undefined, {}, { email: "" }, { email: 42 }])(
    "rejects malformed body %j",
    async (body) => {
      const { response } = mockResponse();
      await handler(
        { method: "POST", body } as VercelRequest,
        response as unknown as VercelResponse,
      );
      expect(response.statusCode).toBe(400);
    },
  );

  it("rejects invalid JSON strings", async () => {
    const { response } = mockResponse();
    await handler(
      { method: "POST", body: "{" } as VercelRequest,
      response as unknown as VercelResponse,
    );
    expect(response.statusCode).toBe(400);
  });
});
