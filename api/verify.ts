import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyEmail } from "./_lib/verify-email";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function applyCors(response: VercelResponse): void {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(name, value);
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  applyCors(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    return response.status(405).json({ error: "Method not allowed" });
  }

  let body: unknown = request.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return response.status(400).json({ error: "Request body must be valid JSON" });
    }
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email?: unknown }).email
      : undefined;
  if (typeof email !== "string" || !email.trim() || email.length > 320) {
    return response.status(400).json({ error: "A valid email string is required" });
  }

  const result = await verifyEmail(email);
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json(result);
}
