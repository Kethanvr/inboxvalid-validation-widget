export interface InboxValidOptions {
  endpoint?: string;
  debounceMs?: number;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export interface ResolvedOptions {
  endpoint: string;
  debounceMs: number;
  timeoutMs: number;
  cacheTtlMs: number;
}

const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_TIMEOUT_MS = 2_500;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000;

interface LoaderConfig {
  endpoint?: string;
  debounceMs?: number;
  timeoutMs?: number;
  scriptSource?: string;
}

function readPositiveNumber(value: string | undefined, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function findLoaderScript(): HTMLScriptElement | null {
  if (typeof document === "undefined") return null;
  if (document.currentScript instanceof HTMLScriptElement) return document.currentScript;

  const scripts = Array.from(document.scripts);
  return (
    scripts.find((script) => {
      try {
        return new URL(script.src, document.baseURI).pathname.endsWith("/inboxvalid.js");
      } catch {
        return false;
      }
    }) ?? null
  );
}

function readLoaderConfig(): LoaderConfig {
  const script = findLoaderScript();
  if (!script) return {};
  return {
    ...(script.dataset.endpoint ? { endpoint: script.dataset.endpoint } : {}),
    ...(readPositiveNumber(script.dataset.debounce, 0, 5_000) !== undefined
      ? { debounceMs: readPositiveNumber(script.dataset.debounce, 0, 5_000) }
      : {}),
    ...(readPositiveNumber(script.dataset.timeout, 100, 30_000) !== undefined
      ? { timeoutMs: readPositiveNumber(script.dataset.timeout, 100, 30_000) }
      : {}),
    ...(script.src ? { scriptSource: script.src } : {}),
  };
}

const loaderConfig = readLoaderConfig();

function defaultEndpoint(): string {
  if (loaderConfig.scriptSource) {
    return new URL("/api/verify", loaderConfig.scriptSource).toString();
  }
  if (typeof window !== "undefined") {
    return new URL("/api/verify", window.location.href).toString();
  }
  return "/api/verify";
}

function inputConfig(input: HTMLInputElement): InboxValidOptions {
  const debounceMs = readPositiveNumber(input.dataset.debounce, 0, 5_000);
  const timeoutMs = readPositiveNumber(input.dataset.timeout, 100, 30_000);
  const cacheTtlMs = readPositiveNumber(input.dataset.cacheTtl, 0, 86_400_000);
  return {
    ...(input.dataset.endpoint ? { endpoint: input.dataset.endpoint } : {}),
    ...(debounceMs !== undefined ? { debounceMs } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(cacheTtlMs !== undefined ? { cacheTtlMs } : {}),
  };
}

export function resolveOptions(
  input: HTMLInputElement,
  options: InboxValidOptions = {},
): ResolvedOptions {
  const merged: InboxValidOptions = {
    endpoint: loaderConfig.endpoint ?? defaultEndpoint(),
    debounceMs: loaderConfig.debounceMs ?? DEFAULT_DEBOUNCE_MS,
    timeoutMs: loaderConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    cacheTtlMs: DEFAULT_CACHE_TTL_MS,
    ...inputConfig(input),
    ...options,
  };

  return {
    endpoint: new URL(merged.endpoint ?? defaultEndpoint(), window.location.href).toString(),
    debounceMs: readPositiveNumber(String(merged.debounceMs), 0, 5_000) ?? DEFAULT_DEBOUNCE_MS,
    timeoutMs: readPositiveNumber(String(merged.timeoutMs), 100, 30_000) ?? DEFAULT_TIMEOUT_MS,
    cacheTtlMs:
      readPositiveNumber(String(merged.cacheTtlMs), 0, 86_400_000) ?? DEFAULT_CACHE_TTL_MS,
  };
}
