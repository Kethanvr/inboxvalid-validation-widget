import { describe, expect, it } from "vitest";
import { ExpiringCache } from "../src/widget/cache";

describe("ExpiringCache", () => {
  it("expires entries at the configured TTL", () => {
    let now = 1_000;
    const cache = new ExpiringCache<string>(500, 10, () => now);
    cache.set("email", "valid");
    expect(cache.get("email")).toBe("valid");
    now = 1_500;
    expect(cache.get("email")).toBeUndefined();
  });

  it("evicts the least recently used entry when bounded", () => {
    const cache = new ExpiringCache<number>(1_000, 2, () => 0);
    cache.set("first", 1);
    cache.set("second", 2);
    expect(cache.get("first")).toBe(1);
    cache.set("third", 3);
    expect(cache.get("second")).toBeUndefined();
    expect(cache.get("first")).toBe(1);
    expect(cache.get("third")).toBe(3);
  });
});
