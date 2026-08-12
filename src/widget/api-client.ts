import type { VerificationResponse } from "../shared/types";

export class VerificationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationRequestError";
  }
}

function isVerificationResponse(value: unknown): value is VerificationResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<VerificationResponse>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.domain === "string" &&
    ["valid", "invalid", "disposable", "unknown"].includes(candidate.status ?? "") &&
    typeof candidate.verified_at === "string"
  );
}

export async function requestVerification(
  endpoint: string,
  email: string,
  signal: AbortSignal,
): Promise<VerificationResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    signal,
  });

  if (!response.ok) {
    throw new VerificationRequestError(`Verification request failed with ${response.status}`);
  }

  const result = (await response.json()) as unknown;
  if (!isVerificationResponse(result)) {
    throw new VerificationRequestError("Verification API returned an unexpected response");
  }
  return result;
}
