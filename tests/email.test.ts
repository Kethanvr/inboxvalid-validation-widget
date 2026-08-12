import { describe, expect, it } from "vitest";
import { cacheKey, parseEmail, suggestEmail } from "../src/shared/email";

describe("email helpers", () => {
  it("normalizes the domain while preserving the local part", () => {
    expect(parseEmail("  Alex.Smith@Example.COM ")).toEqual({
      email: "Alex.Smith@example.com",
      localPart: "Alex.Smith",
      domain: "example.com",
    });
  });

  it.each(["", "alex", "@example.com", "alex@", "a..b@example.com", "a@example..com"])(
    "rejects malformed address %j",
    (value) => expect(parseEmail(value)).toBeNull(),
  );

  it("suggests a corrected common provider without changing the local part", () => {
    expect(suggestEmail("Alex@gmal.com")).toBe("Alex@gmail.com");
  });

  it("creates a normalized cache key", () => {
    expect(cacheKey(" Alex@Example.COM ")).toBe("alex@example.com");
  });
});
