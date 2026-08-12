export type VerificationStatus = "valid" | "invalid" | "disposable" | "unknown";
export type DomainStatus = "exists" | "not_found" | "unknown";

export type VerificationSubStatus =
  | "invalid_syntax"
  | "disposable_domain"
  | "null_mx"
  | "no_mail_server"
  | "implicit_mx"
  | "dns_unavailable"
  | null;

export interface VerificationResponse {
  email: string;
  domain: string;
  status: VerificationStatus;
  sub_status: VerificationSubStatus;
  domain_status: DomainStatus;
  mx_found: boolean | null;
  mx_host: string | null;
  fallback_address_found: boolean | null;
  is_disposable: boolean | null;
  suggestion?: string;
  verified_at: string;
}
