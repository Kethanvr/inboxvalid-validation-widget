import type { InboxValidOptions } from "./config";
import { injectStyles } from "./styles";
import { InboxValidWidget } from "./widget";

const instances = new WeakMap<HTMLInputElement, InboxValidWidget>();

export interface InboxValidApi {
  init(options?: InboxValidOptions): InboxValidWidget[];
  attach(input: HTMLInputElement, options?: InboxValidOptions): InboxValidWidget;
}

export function attach(
  input: HTMLInputElement,
  options: InboxValidOptions = {},
): InboxValidWidget {
  injectStyles();
  const existing = instances.get(input);
  if (existing) return existing;
  const instance = new InboxValidWidget(input, options);
  instances.set(input, instance);
  return instance;
}

export function init(options: InboxValidOptions = {}): InboxValidWidget[] {
  injectStyles();
  return Array.from(document.querySelectorAll<HTMLInputElement>("input[data-inboxvalid]")).map(
    (input) => attach(input, options),
  );
}

export const InboxValid: InboxValidApi = { init, attach };

declare global {
  interface Window {
    InboxValid: InboxValidApi;
  }
}

if (typeof window !== "undefined") {
  window.InboxValid = InboxValid;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }
}

export type { InboxValidOptions } from "./config";
export { InboxValidWidget } from "./widget";
