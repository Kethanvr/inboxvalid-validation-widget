const LOCAL_PART_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const DOMAIN_LABEL_PATTERN = /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/i;

const DOMAIN_CORRECTIONS: Readonly<Record<string, string>> = {
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
};

export interface ParsedEmail {
  email: string;
  localPart: string;
  domain: string;
}

export function parseEmail(value: string): ParsedEmail | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return null;

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== trimmed.indexOf("@")) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1).toLowerCase();
  if (localPart.length > 64 || !domain || domain.length > 253) return null;
  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !LOCAL_PART_PATTERN.test(localPart)
  ) {
    return null;
  }

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))) {
    return null;
  }

  return {
    email: `${localPart}@${domain}`,
    localPart,
    domain,
  };
}

export function suggestEmail(value: string): string | undefined {
  const parsed = parseEmail(value);
  if (!parsed) return undefined;
  const correctedDomain = DOMAIN_CORRECTIONS[parsed.domain];
  return correctedDomain ? `${parsed.localPart}@${correctedDomain}` : undefined;
}

export function cacheKey(value: string): string {
  return value.trim().toLowerCase();
}
