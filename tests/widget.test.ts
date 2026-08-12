// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VerificationResponse } from "../src/shared/types";
import { InboxValidWidget } from "../src/widget/widget";

function response(overrides: Partial<VerificationResponse> = {}): VerificationResponse {
  return {
    email: "person@example.com",
    domain: "example.com",
    status: "valid",
    sub_status: null,
    mx_found: true,
    mx_host: "mx.example.com",
    fallback_address_found: null,
    is_disposable: false,
    verified_at: new Date().toISOString(),
    ...overrides,
  };
}

function fetchResponse(body: VerificationResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(options: { debounceMs?: number; timeoutMs?: number } = {}) {
  document.body.innerHTML = `
    <form><input name="email" type="email" data-inboxvalid><button type="submit">Go</button></form>
  `;
  const input = document.querySelector("input") as HTMLInputElement;
  const form = document.querySelector("form") as HTMLFormElement;
  const widget = new InboxValidWidget(input, {
    endpoint: "https://api.example/verify",
    debounceMs: options.debounceMs ?? 200,
    timeoutMs: options.timeoutMs ?? 2_500,
  });
  return { input, form, widget };
}

describe("InboxValidWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("reports invalid syntax immediately without a request", () => {
    const { input, widget } = setup();
    input.value = "person@";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(widget.currentState).toBe("invalid");
    expect(input.validationMessage).toContain("complete email");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts the remote request after the 200ms debounce", async () => {
    vi.mocked(fetch).mockResolvedValue(fetchResponse(response()));
    const { input, widget } = setup();
    input.value = "person@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(199);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTicks();
    expect(fetch).toHaveBeenCalledOnce();
    expect(widget.currentState).toBe("valid");
  });

  it("uses a cached result for repeated input", async () => {
    vi.mocked(fetch).mockResolvedValue(fetchResponse(response()));
    const { input } = setup();
    input.value = "person@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(200);
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "person@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("fails open after the strict client timeout", async () => {
    vi.mocked(fetch).mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    const { input, widget } = setup({ debounceMs: 0, timeoutMs: 2_500 });
    input.value = "person@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(2_500);
    expect(widget.currentState).toBe("unknown");
    expect(input.validationMessage).toBe("");
  });

  it("prevents stale responses from replacing the latest state", async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    const { input, widget } = setup({ debounceMs: 0 });

    input.value = "first@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
    input.value = "second@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);

    resolveSecond(fetchResponse(response({ email: "second@example.com", status: "valid" })));
    await vi.advanceTimersByTimeAsync(0);
    resolveFirst(
      fetchResponse(
        response({
          email: "first@example.com",
          status: "invalid",
          sub_status: "no_mail_server",
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(widget.currentState).toBe("valid");
  });

  it("holds a checking submission and resumes it after a valid response", async () => {
    let resolveRequest!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => (resolveRequest = resolve)));
    const { input, form } = setup();
    input.value = "person@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const requestSubmit = vi.spyOn(form, "requestSubmit").mockImplementation(() => undefined);
    const submitEvent = new SubmitEvent("submit", { cancelable: true });
    form.dispatchEvent(submitEvent);
    expect(submitEvent.defaultPrevented).toBe(true);
    resolveRequest(fetchResponse(response()));
    await vi.advanceTimersByTimeAsync(0);
    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it("renders an accessible live status region", () => {
    setup();
    const feedback = document.querySelector(".iv-feedback");
    expect(feedback?.getAttribute("role")).toBe("status");
    expect(feedback?.getAttribute("aria-live")).toBe("polite");
  });
});
