import { cacheKey, parseEmail, suggestEmail } from "../shared/email";
import type { VerificationResponse, VerificationStatus } from "../shared/types";
import { requestVerification } from "./api-client";
import { ExpiringCache } from "./cache";
import { resolveOptions } from "./config";
import type { InboxValidOptions, ResolvedOptions } from "./config";

export type WidgetState = "idle" | "checking" | VerificationStatus;

const STATE_COPY: Record<WidgetState, { icon: string; message: string }> = {
  idle: { icon: "·", message: "Enter a work email to validate it." },
  checking: { icon: "", message: "Checking mail routing…" },
  valid: { icon: "✓", message: "Email domain can receive mail." },
  invalid: { icon: "!", message: "This email cannot receive mail." },
  disposable: { icon: "!", message: "Disposable email detected — use a permanent address." },
  unknown: { icon: "?", message: "Verification unavailable — safe to continue." },
};

let feedbackCounter = 0;

export class InboxValidWidget {
  readonly input: HTMLInputElement;
  private readonly options: ResolvedOptions;
  private readonly cache: ExpiringCache<VerificationResponse>;
  private readonly feedback: HTMLDivElement;
  private state: WidgetState = "idle";
  private suggestion?: string;
  private debounceId?: ReturnType<typeof setTimeout>;
  private timeoutId?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private activeRequest?: Promise<void>;
  private requestVersion = 0;
  private allowNextSubmit = false;
  private simulateOutage = false;
  private form?: HTMLFormElement;

  constructor(input: HTMLInputElement, options: InboxValidOptions = {}) {
    this.input = input;
    this.options = resolveOptions(input, options);
    this.cache = new ExpiringCache(this.options.cacheTtlMs, 100);
    this.feedback = this.createFeedback();
    this.input.addEventListener("input", this.handleInput);
    this.form = this.input.form ?? undefined;
    this.form?.addEventListener("submit", this.handleSubmit);
    this.handleInput();
  }

  get currentState(): WidgetState {
    return this.state;
  }

  get config(): Readonly<ResolvedOptions> {
    return this.options;
  }

  destroy(): void {
    this.cancelPending();
    this.input.removeEventListener("input", this.handleInput);
    this.form?.removeEventListener("submit", this.handleSubmit);
    this.feedback.remove();
  }

  setOutageSimulation(enabled: boolean): void {
    this.simulateOutage = enabled;
    this.handleInput();
  }

  async verifyNow(): Promise<void> {
    const value = this.input.value;
    const parsed = parseEmail(value);
    if (!parsed) {
      if (value.trim()) this.setState("invalid", "Enter a complete email address.");
      else this.setState("idle");
      return;
    }

    if (this.activeRequest) return this.activeRequest;
    if (this.debounceId) clearTimeout(this.debounceId);
    this.debounceId = undefined;

    const key = cacheKey(parsed.email);
    const cached = this.cache.get(key);
    if (cached) {
      this.applyResult(cached);
      return;
    }

    const version = ++this.requestVersion;
    const controller = new AbortController();
    this.controller?.abort("superseded");
    this.controller = controller;
    let timedOut = false;

    const execution = (async () => {
      this.timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort("timeout");
      }, this.options.timeoutMs);

      try {
        if (this.simulateOutage) {
          await new Promise<void>((_resolve, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new DOMException("Simulated outage", "AbortError")),
              { once: true },
            );
          });
        }
        const result = await requestVerification(this.options.endpoint, parsed.email, controller.signal);
        if (version !== this.requestVersion || parsed.email !== parseEmail(this.input.value)?.email) return;
        this.cache.set(key, result);
        this.applyResult(result);
      } catch {
        if (version !== this.requestVersion || (controller.signal.aborted && !timedOut)) return;
        this.setState(
          "unknown",
          timedOut
            ? "Verification timed out. You can continue."
            : "Verification is unavailable. You can continue.",
        );
      } finally {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        if (this.controller === controller) this.controller = undefined;
        if (this.controller === undefined) this.activeRequest = undefined;
      }
    })();

    this.activeRequest = execution;
    return execution;
  }

  private readonly handleInput = (): void => {
    this.cancelPending();
    const value = this.input.value;
    this.suggestion = suggestEmail(value);
    if (!value.trim()) {
      this.setState("idle");
      return;
    }
    if (!parseEmail(value)) {
      this.setState("invalid", "Enter a complete email address.");
      return;
    }

    this.setState("checking");
    this.debounceId = setTimeout(() => {
      this.debounceId = undefined;
      void this.verifyNow();
    }, this.options.debounceMs);
  };

  private readonly handleSubmit = (event: SubmitEvent): void => {
    if (this.allowNextSubmit) {
      this.allowNextSubmit = false;
      return;
    }

    if (this.state === "valid" || this.state === "unknown" || !this.input.value.trim()) return;
    event.preventDefault();

    if (this.state === "invalid" || this.state === "disposable") {
      this.input.focus();
      this.input.reportValidity();
      return;
    }

    const submittedValue = this.input.value;
    const submitter = event.submitter;
    void this.verifyNow().then(() => {
      if (this.input.value !== submittedValue) return;
      if (this.state !== "valid" && this.state !== "unknown") {
        this.input.focus();
        this.input.reportValidity();
        return;
      }
      this.allowNextSubmit = true;
      this.form?.requestSubmit(submitter);
    });
  };

  private cancelPending(): void {
    if (this.debounceId) clearTimeout(this.debounceId);
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.debounceId = undefined;
    this.timeoutId = undefined;
    this.requestVersion += 1;
    this.controller?.abort("superseded");
    this.controller = undefined;
    this.activeRequest = undefined;
  }

  private createFeedback(): HTMLDivElement {
    const feedback = document.createElement("div");
    feedback.className = "iv-feedback";
    feedback.id = `inboxvalid-feedback-${++feedbackCounter}`;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.setAttribute("aria-atomic", "true");
    const descriptions = new Set((this.input.getAttribute("aria-describedby") ?? "").split(/\s+/));
    descriptions.delete("");
    descriptions.add(feedback.id);
    this.input.setAttribute("aria-describedby", [...descriptions].join(" "));
    this.input.insertAdjacentElement("afterend", feedback);
    return feedback;
  }

  private applyResult(result: VerificationResponse): void {
    this.suggestion = result.suggestion ?? this.suggestion;
    const messages: Record<VerificationStatus, string> = {
      valid: result.mx_host
        ? `Mail server found: ${result.mx_host}`
        : STATE_COPY.valid.message,
      invalid:
        result.sub_status === "null_mx"
          ? "This domain explicitly does not accept email."
          : "No mail server was found for this domain.",
      disposable: STATE_COPY.disposable.message,
      unknown:
        result.sub_status === "implicit_mx"
          ? "No MX record, but the domain may accept mail. You can continue."
          : STATE_COPY.unknown.message,
    };
    this.setState(result.status, messages[result.status]);
  }

  private setState(state: WidgetState, message = STATE_COPY[state].message): void {
    this.state = state;
    this.feedback.dataset.state = state;
    this.input.dataset.inboxvalidState = state;
    const blocksSubmission = state === "invalid" || state === "disposable";
    this.input.setCustomValidity(blocksSubmission ? message : "");
    this.input.setAttribute("aria-invalid", String(blocksSubmission));

    const icon = document.createElement("span");
    icon.className = "iv-feedback__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = STATE_COPY[state].icon;
    const text = document.createElement("span");
    text.textContent = message;
    this.feedback.replaceChildren(icon, text);

    if (this.suggestion && state !== "valid") {
      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.className = "iv-feedback__suggestion";
      suggestion.textContent = this.suggestion;
      suggestion.addEventListener("click", () => {
        this.input.value = this.suggestion ?? this.input.value;
        this.input.dispatchEvent(new Event("input", { bubbles: true }));
        this.input.focus();
      });
      text.append(" Did you mean ", suggestion, "?");
    }
  }
}
