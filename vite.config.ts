import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { verifyEmail } from "./api/_lib/verify-email.js";

const MAX_DEV_BODY_BYTES = 4_096;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk.toString();
    if (raw.length > MAX_DEV_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  }
  return JSON.parse(raw) as unknown;
}

export default defineConfig({
  plugins: [
    {
      name: "local-widget-bundle",
      configureServer(server) {
        server.middlewares.use("/inboxvalid.js", async (_request, response) => {
          try {
            const bundle = await readFile(resolve(import.meta.dirname, "dist/inboxvalid.js"));
            response.statusCode = 200;
            response.setHeader("Content-Type", "text/javascript; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(bundle);
          } catch {
            sendJson(response, 404, { error: "Run npm run build:widget first" });
          }
        });
      },
    },
    {
      name: "local-verification-api",
      configureServer(server) {
        server.middlewares.use("/api/verify", async (request, response) => {
          response.setHeader("Access-Control-Allow-Origin", "*");
          response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          response.setHeader("Access-Control-Allow-Headers", "Content-Type");
          if (request.method === "OPTIONS") {
            response.statusCode = 204;
            response.end();
            return;
          }
          if (request.method !== "POST") {
            response.setHeader("Allow", "POST, OPTIONS");
            sendJson(response, 405, { error: "Method not allowed" });
            return;
          }

          try {
            const body = await readBody(request);
            const email =
              typeof body === "object" && body !== null && "email" in body
                ? (body as { email?: unknown }).email
                : undefined;
            if (typeof email !== "string" || !email.trim() || email.length > 320) {
              sendJson(response, 400, { error: "A valid email string is required" });
              return;
            }
            sendJson(response, 200, await verifyEmail(email));
          } catch {
            sendJson(response, 400, { error: "Request body must be valid JSON" });
          }
        });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
