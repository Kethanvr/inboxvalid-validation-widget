# InboxValid Real-Time Validation Widget

A zero-runtime-dependency email-validation widget and demonstration website. It adds immediate syntax feedback to an existing email input, then checks disposable providers and real DNS mail-routing signals through a small API.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The development server exposes the demo and a local `/api/verify` route that performs real DNS lookups.

Useful checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The production build creates the demo site and the standalone widget:

```text
dist/
├── index.html
├── assets/...
└── inboxvalid.js
```

## Embed the widget

Add `data-inboxvalid` to an email input and load the IIFE bundle:

```html
<form>
  <label for="email">Work email</label>
  <input id="email" name="email" type="email" data-inboxvalid required>
  <button type="submit">Create account</button>
</form>

<script
  src="https://validate.kethanvr.tech/inboxvalid.js"
  defer>
</script>
```

The widget derives `https://validate.kethanvr.tech/api/verify` from its own script URL. An explicit endpoint can be supplied when the API is hosted elsewhere:

```html
<script
  src="https://validate.kethanvr.tech/inboxvalid.js"
  data-endpoint="https://api.example.com/email/verify"
  data-debounce="200"
  data-timeout="2500"
  defer>
</script>
```

The same values can be configured per input:

```html
<input
  type="email"
  data-inboxvalid
  data-endpoint="https://api.example.com/email/verify"
  data-debounce="200"
  data-timeout="2500"
  data-cache-ttl="300000">
```

Or through the public JavaScript API:

```js
window.InboxValid.init({
  endpoint: "https://api.example.com/email/verify",
  debounceMs: 200,
  timeoutMs: 2500,
  cacheTtlMs: 300000,
});

const instance = window.InboxValid.attach(document.querySelector("#email"));
```

Configuration precedence is JavaScript options, input data attributes, loader-script data attributes, the loader script's origin, and finally the current page origin.

## Browser behavior

- Syntax feedback is immediate and never calls the API for malformed input.
- Remote checks start after a 200 ms debounce by default.
- New input aborts the previous request and stale responses are ignored.
- Completed responses are cached in a bounded, five-minute in-memory cache.
- Known invalid and disposable results block native form submission.
- A submission made while checking waits for the active request. The widget safely resumes it with `requestSubmit()` when the outcome permits it.
- Client timeout, network failure, DNS failure, and plausible A/AAAA fallback resolve to `unknown`, clear native validity, and fail open.
- Status is announced through an ARIA live region and is not communicated by color alone.

### Options

| JavaScript | Data attribute | Default | Accepted range |
| --- | --- | ---: | ---: |
| `endpoint` | `data-endpoint` | Script-origin `/api/verify` | Absolute or relative URL |
| `debounceMs` | `data-debounce` | `200` | 0–5,000 ms |
| `timeoutMs` | `data-timeout` | `2,500` | 100–30,000 ms |
| `cacheTtlMs` | `data-cache-ttl` | `300,000` | 0–86,400,000 ms |

## Verification API

`POST /api/verify`

```json
{
  "email": "person@example.com"
}
```

Example response:

```json
{
  "email": "person@example.com",
  "domain": "example.com",
  "status": "valid",
  "sub_status": null,
  "domain_status": "exists",
  "mx_found": true,
  "mx_host": "mx.example.com",
  "fallback_address_found": null,
  "is_disposable": false,
  "verified_at": "2026-08-12T08:00:00.000Z"
}
```

Possible `status` values are `valid`, `invalid`, `disposable`, and `unknown`. Possible non-null `sub_status` values are:

`domain_status` is an independent DNS signal:

| Domain status | Meaning |
| --- | --- |
| `exists` | DNS confirmed the name, even if it has no mail-routing records |
| `not_found` | DNS returned NXDOMAIN / `ENOTFOUND` |
| `unknown` | A timeout or operational DNS failure prevented confirmation |

| Sub-status | Meaning | Form decision |
| --- | --- | --- |
| `invalid_syntax` | Address structure is malformed | Block |
| `disposable_domain` | Known throwaway provider | Block |
| `null_mx` | Domain explicitly declares that it accepts no email | Block |
| `no_mail_server` | No MX, A, or AAAA route exists | Block |
| `implicit_mx` | No MX, but an A/AAAA fallback exists | Allow |
| `dns_unavailable` | DNS timed out or failed operationally | Allow |

The endpoint supports credential-free CORS for third-party embedding. Validation outcomes use HTTP 200; malformed bodies use 400, and unsupported methods use 405.

The response intentionally follows InboxValid-style naming so a production endpoint can replace the prototype API with a small adapter rather than a widget rewrite.

## DNS decision model

```text
MX query succeeds / ENODATA  -> domain exists
NXDOMAIN / ENOTFOUND         -> domain not found
DNS timeout or SERVFAIL      -> domain unknown / fail open
MX records found             -> mail routing valid
MX 0 . (null MX)             -> mail routing invalid
No MX + A or AAAA found      -> mail routing plausible / fail open
No MX, A, or AAAA            -> no mail routing
```

Domain existence and mail capability are reported separately. An existing DNS name can intentionally have no mail service, and an address-record fallback only establishes routing plausibility. Neither signal proves that the individual mailbox exists.

## Technical limits

This prototype implements syntax checking, DNS domain-existence classification, a small auditable disposable-domain dataset, typo suggestions, MX lookup, null MX detection, and A/AAAA fallback. It deliberately does **not** perform WHOIS/RDAP registration checks, SMTP mailbox probing, catch-all detection, mailbox-level deliverability, production risk scoring, or private InboxValid API calls.

The disposable dataset is illustrative rather than exhaustive. A production version should use a maintained provider feed or the production InboxValid service. No signup data is stored, and the demo is marked `noindex,nofollow`.

## Project structure

```text
api/
  _lib/verify-email.ts  DNS and disposable verification
  verify.ts             Vercel HTTP function
src/
  shared/               Shared response types and email helpers
  widget/               Embeddable library, cache, UI, and API client
  main.ts               Demo interactions
  style.css             Demo website design
tests/                  Unit and DOM integration tests
```

## Deploy to Vercel

1. Import this private repository into Vercel.
2. Keep the detected Vite settings; `vercel.json` runs `npm run build` and publishes `dist`.
3. Confirm the demo, `/inboxvalid.js`, and `/api/verify` on the generated Vercel URL.
4. Add `validate.kethanvr.tech` in the project's Domains settings.
5. Add the DNS record Vercel supplies, then repeat the three route checks on the custom domain.

Deployment, DNS modification, GitHub pushing, and reviewer access are intentionally not automated here. A private repository URL alone does not grant access; invite the reviewer using the GitHub identity supplied by HR.
