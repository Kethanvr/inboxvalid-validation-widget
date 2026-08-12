import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import type { MxRecord } from "node:dns";
import { isDisposableDomain } from "../../src/shared/disposable-domains.js";
import { parseEmail, suggestEmail } from "../../src/shared/email.js";
import type { VerificationResponse } from "../../src/shared/types.js";

const DNS_TIMEOUT_MS = 2_000;
const NO_DATA_CODE = "ENODATA";
const NOT_FOUND_CODE = "ENOTFOUND";

export interface DnsResolver {
  resolveMx(domain: string): Promise<MxRecord[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

const nodeDnsResolver: DnsResolver = { resolveMx, resolve4, resolve6 };

interface DnsError extends Error {
  code?: string;
}

function responseBase(email: string, domain: string) {
  return {
    email,
    domain,
    verified_at: new Date().toISOString(),
  };
}

function dnsErrorCode(error: unknown): string {
  return (error as DnsError | undefined)?.code ?? "";
}

function isAbsentRecordError(error: unknown): boolean {
  return [NO_DATA_CODE, NOT_FOUND_CODE].includes(dnsErrorCode(error));
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error("DNS lookup timed out") as DnsError;
      error.code = "ETIMEOUT";
      reject(error);
    }, DNS_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

type AddressLookup = "found" | "absent" | "error";

async function resolveAddress(promise: Promise<string[]>): Promise<AddressLookup> {
  try {
    const addresses = await withTimeout(promise);
    return addresses.length > 0 ? "found" : "absent";
  } catch (error) {
    return isAbsentRecordError(error) ? "absent" : "error";
  }
}

async function verifyAddressFallback(
  domain: string,
  resolver: DnsResolver,
): Promise<"found" | "absent" | "error"> {
  const [ipv4, ipv6] = await Promise.all([
    resolveAddress(resolver.resolve4(domain)),
    resolveAddress(resolver.resolve6(domain)),
  ]);

  if (ipv4 === "found" || ipv6 === "found") return "found";
  if (ipv4 === "absent" && ipv6 === "absent") return "absent";
  return "error";
}

export async function verifyEmail(
  rawEmail: string,
  resolver: DnsResolver = nodeDnsResolver,
): Promise<VerificationResponse> {
  const parsed = parseEmail(rawEmail);
  if (!parsed) {
    return {
      ...responseBase(rawEmail.trim(), ""),
      status: "invalid",
      sub_status: "invalid_syntax",
      domain_status: "unknown",
      mx_found: null,
      mx_host: null,
      fallback_address_found: null,
      is_disposable: null,
    };
  }

  const suggestion = suggestEmail(parsed.email);
  const disposable = isDisposableDomain(parsed.domain);

  let records: MxRecord[];
  let domainStatus: "exists" | "not_found" | "unknown" = "exists";
  try {
    records = await withTimeout(resolver.resolveMx(parsed.domain));
  } catch (error) {
    const code = dnsErrorCode(error);
    if (code === NOT_FOUND_CODE) {
      domainStatus = "not_found";
      return {
        ...responseBase(parsed.email, parsed.domain),
        status: "invalid",
        sub_status: "no_mail_server",
        domain_status: domainStatus,
        mx_found: false,
        mx_host: null,
        fallback_address_found: false,
        is_disposable: disposable,
        ...(suggestion ? { suggestion } : {}),
      };
    }
    if (code !== NO_DATA_CODE) {
      domainStatus = "unknown";
      if (disposable) {
        return {
          ...responseBase(parsed.email, parsed.domain),
          status: "disposable",
          sub_status: "disposable_domain",
          domain_status: domainStatus,
          mx_found: null,
          mx_host: null,
          fallback_address_found: null,
          is_disposable: true,
          ...(suggestion ? { suggestion } : {}),
        };
      }
      return {
        ...responseBase(parsed.email, parsed.domain),
        status: "unknown",
        sub_status: "dns_unavailable",
        domain_status: domainStatus,
        mx_found: null,
        mx_host: null,
        fallback_address_found: null,
        is_disposable: false,
        ...(suggestion ? { suggestion } : {}),
      };
    }
    records = [];
  }

  if (disposable) {
    const preferredMx = records
      .filter(({ exchange }) => exchange.trim() && exchange.trim() !== ".")
      .sort((first, second) => first.priority - second.priority)[0];
    return {
      ...responseBase(parsed.email, parsed.domain),
      status: "disposable",
      sub_status: "disposable_domain",
      domain_status: domainStatus,
      mx_found: preferredMx ? true : records.length > 0 ? false : null,
      mx_host: preferredMx?.exchange ?? null,
      fallback_address_found: null,
      is_disposable: true,
      ...(suggestion ? { suggestion } : {}),
    };
  }

  const nullMx = records.some(
    ({ exchange, priority }) => priority === 0 && ["", "."].includes(exchange.trim()),
  );
  if (nullMx) {
    return {
      ...responseBase(parsed.email, parsed.domain),
      status: "invalid",
      sub_status: "null_mx",
      domain_status: domainStatus,
      mx_found: false,
      mx_host: null,
      fallback_address_found: false,
      is_disposable: false,
      ...(suggestion ? { suggestion } : {}),
    };
  }

  const usableMxRecords = records
    .filter(({ exchange }) => exchange.trim() && exchange.trim() !== ".")
    .sort((first, second) => first.priority - second.priority);
  const preferredMx = usableMxRecords[0];
  if (preferredMx) {
    return {
      ...responseBase(parsed.email, parsed.domain),
      status: "valid",
      sub_status: null,
      domain_status: domainStatus,
      mx_found: true,
      mx_host: preferredMx.exchange,
      fallback_address_found: null,
      is_disposable: false,
      ...(suggestion ? { suggestion } : {}),
    };
  }

  const fallback = await verifyAddressFallback(parsed.domain, resolver);
  if (fallback === "found") {
    return {
      ...responseBase(parsed.email, parsed.domain),
      status: "unknown",
      sub_status: "implicit_mx",
      domain_status: domainStatus,
      mx_found: false,
      mx_host: null,
      fallback_address_found: true,
      is_disposable: false,
      ...(suggestion ? { suggestion } : {}),
    };
  }

  if (fallback === "error") {
    return {
      ...responseBase(parsed.email, parsed.domain),
      status: "unknown",
      sub_status: "dns_unavailable",
      domain_status: domainStatus,
      mx_found: false,
      mx_host: null,
      fallback_address_found: null,
      is_disposable: false,
      ...(suggestion ? { suggestion } : {}),
    };
  }

  return {
    ...responseBase(parsed.email, parsed.domain),
    status: "invalid",
    sub_status: "no_mail_server",
    domain_status: domainStatus,
    mx_found: false,
    mx_host: null,
    fallback_address_found: false,
    is_disposable: false,
    ...(suggestion ? { suggestion } : {}),
  };
}
