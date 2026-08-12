// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("widget configuration", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("derives the API endpoint from the widget script origin", async () => {
    const script = document.createElement("script");
    script.src = "https://validate.kethanvr.tech/inboxvalid.js";
    document.head.append(script);
    const { resolveOptions } = await import("../src/widget/config");
    const input = document.createElement("input");
    expect(resolveOptions(input).endpoint).toBe("https://validate.kethanvr.tech/api/verify");
  });

  it("applies JavaScript options over input and script attributes", async () => {
    const script = document.createElement("script");
    script.src = "https://widget.example/inboxvalid.js";
    script.dataset.endpoint = "https://script.example/verify";
    script.dataset.debounce = "400";
    document.head.append(script);
    const { resolveOptions } = await import("../src/widget/config");
    const input = document.createElement("input");
    input.dataset.endpoint = "https://input.example/verify";
    input.dataset.debounce = "300";
    const options = resolveOptions(input, {
      endpoint: "https://options.example/verify",
      debounceMs: 200,
    });
    expect(options.endpoint).toBe("https://options.example/verify");
    expect(options.debounceMs).toBe(200);
  });
});
