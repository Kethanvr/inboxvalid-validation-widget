import type { MxRecord } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import { verifyEmail } from "../api/_lib/verify-email";
import type { DnsResolver } from "../api/_lib/verify-email";

function dnsError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function resolver(overrides: Partial<DnsResolver> = {}): DnsResolver {
  return {
    resolveMx: vi.fn<(_: string) => Promise<MxRecord[]>>().mockResolvedValue([
      { exchange: "mx.example.com", priority: 10 },
    ]),
    resolve4: vi.fn<(_: string) => Promise<string[]>>().mockResolvedValue([]),
    resolve6: vi.fn<(_: string) => Promise<string[]>>().mockResolvedValue([]),
    ...overrides,
  };
}

describe("verifyEmail", () => {
  it("returns invalid syntax without querying DNS", async () => {
    const dns = resolver();
    const result = await verifyEmail("not-an-email", dns);
    expect(result.status).toBe("invalid");
    expect(result.sub_status).toBe("invalid_syntax");
    expect(result.domain_status).toBe("unknown");
    expect(dns.resolveMx).not.toHaveBeenCalled();
  });

  it("reports domain existence for disposable providers", async () => {
    const dns = resolver();
    const result = await verifyEmail("person@mailinator.com", dns);
    expect(result).toMatchObject({
      status: "disposable",
      domain_status: "exists",
      is_disposable: true,
    });
    expect(dns.resolveMx).toHaveBeenCalledOnce();
  });

  it("selects the lowest-priority usable MX record", async () => {
    const dns = resolver({
      resolveMx: vi.fn().mockResolvedValue([
        { exchange: "secondary.example.com", priority: 20 },
        { exchange: "primary.example.com", priority: 5 },
      ]),
    });
    const result = await verifyEmail("person@example.com", dns);
    expect(result).toMatchObject({
      status: "valid",
      domain_status: "exists",
      mx_found: true,
      mx_host: "primary.example.com",
      is_disposable: false,
    });
  });

  it("recognizes a null MX declaration", async () => {
    const dns = resolver({
      resolveMx: vi.fn().mockResolvedValue([{ exchange: ".", priority: 0 }]),
    });
    const result = await verifyEmail("person@example.com", dns);
    expect(result).toMatchObject({
      status: "invalid",
      sub_status: "null_mx",
      domain_status: "exists",
    });
  });

  it("returns unknown when an A record supplies an implicit MX fallback", async () => {
    const dns = resolver({
      resolveMx: vi.fn().mockRejectedValue(dnsError("ENODATA")),
      resolve4: vi.fn().mockResolvedValue(["192.0.2.1"]),
    });
    const result = await verifyEmail("person@example.com", dns);
    expect(result).toMatchObject({
      status: "unknown",
      sub_status: "implicit_mx",
      domain_status: "exists",
      fallback_address_found: true,
    });
  });

  it("accepts an AAAA-only implicit MX fallback", async () => {
    const dns = resolver({
      resolveMx: vi.fn().mockResolvedValue([]),
      resolve6: vi.fn().mockResolvedValue(["2001:db8::1"]),
    });
    const result = await verifyEmail("person@example.com", dns);
    expect(result.sub_status).toBe("implicit_mx");
  });

  it("rejects a domain with no MX, A, or AAAA records", async () => {
    const absent = () => vi.fn().mockRejectedValue(dnsError("ENOTFOUND"));
    const dns = resolver({ resolveMx: absent(), resolve4: absent(), resolve6: absent() });
    const result = await verifyEmail("person@example.com", dns);
    expect(result).toMatchObject({
      status: "invalid",
      sub_status: "no_mail_server",
      domain_status: "not_found",
    });
  });

  it("treats ENODATA as an existing domain without the requested record type", async () => {
    const noData = () => vi.fn().mockRejectedValue(dnsError("ENODATA"));
    const dns = resolver({ resolveMx: noData(), resolve4: noData(), resolve6: noData() });
    const result = await verifyEmail("person@example.com", dns);
    expect(result).toMatchObject({
      status: "invalid",
      sub_status: "no_mail_server",
      domain_status: "exists",
      mx_found: false,
    });
  });

  it("fails open on a DNS service error", async () => {
    const dns = resolver({ resolveMx: vi.fn().mockRejectedValue(dnsError("SERVFAIL")) });
    const result = await verifyEmail("person@example.com", dns);
    expect(result).toMatchObject({
      status: "unknown",
      sub_status: "dns_unavailable",
      domain_status: "unknown",
    });
  });

  it("fails open when DNS does not settle before the server timeout", async () => {
    vi.useFakeTimers();
    const dns = resolver({
      resolveMx: vi.fn(() => new Promise<MxRecord[]>(() => undefined)),
    });
    const resultPromise = verifyEmail("person@example.com", dns);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(resultPromise).resolves.toMatchObject({
      status: "unknown",
      sub_status: "dns_unavailable",
      domain_status: "unknown",
    });
    vi.useRealTimers();
  });
});
