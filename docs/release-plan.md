# Darakit release plan

## Shared acceptance rules

Work on one requested task at a time. Findings below came from the 2026-09-28 review of `b21f625`; confirm only the relevant code before fixing. Task status is not authorization.

Use focused regression tests while editing. Before merging a code task: `npm.cmd run check`, `npm.cmd run test:run`, and `git diff --check`. Build for dependency/configuration changes and at final release validation. Run affected browser/integration checks when behavior requires them. Do not rerun unrelated visual matrices. Documentation-only changes need a diff/content review, not application tests.

Label every check PASS, FAIL, or BLOCKED with the command/target and evidence. A production build with placeholder variables checks compilation only. Keep environment validation enabled; do not weaken it to get a green build. Missing services remain explicit integration blockers.

Status values: TODO, IN PROGRESS, CODE VERIFIED / INTEGRATION PENDING, BLOCKED, DONE. A row is DONE only when its acceptance criteria have evidence. Keep completed rows concise. Production deployment is a separate action.

| Task | Scope | Status | Evidence / remaining blocker |
|---|---|---|---|
| R1 | Vulnerable dependencies and image optimizer | CODE VERIFIED / INTEGRATION PENDING | Nodemailer 10.0.12 approved and verified; 209 tests pass. Prisma advisory deferral recommended; actual catalog/services unverified. |
| R2 | Rate-limit failures and trusted client IP | CODE VERIFIED / INTEGRATION PENDING | Failures reject sensitive requests; hosting/IP trust and staging checks pending |
| R3 | Production email safety | TODO | Log delivery allowed in production |
| R4 | Phone normalization and validation | TODO | Punctuation-only input accepted |
| R5 | Admin inventory filtering/sorting | TODO | Uses legacy Product.stock |
| R6 | Electronics/default product options | TODO | Design decision required |
| R7 | Real store configuration/content | TODO | Owner input required |
| R8 | Full staging release validation | TODO | Real commerce/integrations unverified |

## R1 — Dependencies and image optimization

Start: `package.json`, lockfile, `next.config.js`, `OptimizedImage.tsx`, CI.

Verify current official advisories and installed versions. The prior review identified GHSA-2xp9-vwfh-vxw4 affecting Next 15.5.19; 15.5.24 fixed that advisory, not necessarily every future issue. Prefer a current patched compatible 15.x release and aligned tooling. Update existing dependencies as needed; propose major upgrades separately. Triage remaining advisories by actual exposure; do not present disabled Better Auth plugins as enabled vulnerabilities.

Inspect whether Next image optimization is needed: the component-level `unoptimized` flag did not disable the endpoint. Disable the optimizer globally if unused, or restrict allowed remote paths to the store's verified Cloudinary namespace. Preserve Cloudinary delivery and image appearance.

Accept: clean lockfile install, dependency audit with residual findings explained, full checks/build, product images on mobile/desktop, and a safe test that arbitrary tenant image URLs cannot reach an active unrestricted optimizer. No exploit payloads or production probing.

### R1 evidence — 2026-09-29

Branch `fix/r1-dependencies-images`, base/HEAD `be5e12b0e83820570f1ca89c3fef7ea115211939`. Original R1 changes preserved; approved Nodemailer follow-up added. All changes remain uncommitted. No Prisma major/override, schema/data changes, external emails, commit, push, merge, deployment, R2, or R3 implementation.

Next/tooling **15.5.26**, Better Auth 1.6.33, Vitest/coverage 4.1.11, Vite 8.3.1, Sharp 0.35.5, and compatible transitive security fixes remain in place. Next includes the [AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) and [Windows server](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) fixes. The scoped PostCSS override retains 8.5.28 instead of Next's pinned 8.4.31; reassess when upstream patches its dependency.

The unused optimizer remains disabled globally: Cloudinary transformations and component-level bypass already handle product images; other Next Image callers use SVG logos. Delivery components are unchanged. CI build explicitly uses production mode with placeholder variables and validation enabled.

**Approved Nodemailer upgrade:** pinned **10.0.12**, removed redundant `@types/nodemailer` because v10 bundles declarations. Reviewed official [v9 breaking changes](https://github.com/nodemailer/nodemailer/releases/tag/v9.0.0), [v10 breaking changes](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0), and [10.0.12 release](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.12). V9 validates TLS certificates for remote content/OAuth/proxy fetches; these paths are unused here and no TLS bypass was added. V10 requires Node ≥20 and supports ESM/CommonJS; repository minimum 20.17, CI 20.19.0, and local 24.13.0 satisfy it. Existing imports, SMTP configuration, templates, and production log-mode behavior needed no code changes. Production log safety remains R3.

### Verification

| Check | Result / evidence |
|---|---|
| `npm.cmd ci --offline=false` | PASS after Nodemailer update; clean install and Prisma Client generation, no migrations. |
| Online `npm.cmd audit --json --offline=false`, also `--omit=dev` | Both completed with exit 1: **3 high package findings**, all the single Prisma/config/deepmerge-ts chain below; zero Nodemailer, critical, moderate, or low findings. Initial R1 audit had 18 package findings. |
| `npm.cmd run check` | PASS, lint and TypeScript, including Nodemailer's bundled declarations. |
| `npm.cmd run test:run` | PASS, **34 files / 209 tests** after final test edits. |
| New `src/server/email.test.ts` | PASS, **11 tests**. Calls actual verification/reset callbacks and order notification function with mocked auth/DB setup; Nodemailer constructs real multipart MIME in memory. Checks recipients/sender, links, subjects, verification expiry, order details/HTML escaping/phone masking, skipped unconfigured notifications, port 465 TLS, and explicit development logging. Each message also exercises a mocked transport-adapter failure through the real mailer promise. No external SMTP or test-account service. |
| `npm.cmd run build` | PASS, production mode, 32 static pages, explicit dummy service values, environment validation enabled. Compilation only; no real service validation. |
| Prisma reachability checks | PASS, installed-source trace, config load with dummy database URLs (4 objects, zero cycles), PrismaClient constructor without queries (no config modules loaded), and 49 fresh Next build traces with no config/deepmerge/C12 dependencies. |
| Previous R1 image evidence, retained rather than rerun | PASS, optimizer returned 404 for unrelated tenant/public sample/local SVG. Eight catalog/detail views at 390/1440px × English/Arabic passed using browser API fixtures and public Cloudinary sample. Thumbnails, logos, gallery/local fallback, contain fit, no overflow/runtime errors or optimizer requests. Image code/config unchanged by this follow-up. Ignored evidence: `test-results/r1/`. |
| Diff / formatting | PASS, scoped diff review, `git diff --check`, and Prettier on changed email tests/manifest. |
| Previous license inventory | Command passed; 41 notice/review flags recorded before this follow-up, not a license-clearance claim. Nodemailer 10 declares MIT-0. |
| Real integrations | BLOCKED: store catalog/tenant image delivery, real verification/reset/order email delivery, and database-backed auth/commerce flows remain unverified. No external email was sent. |

### Remaining advisory: Prisma/config/deepmerge-ts

**Finding:** [GHSA-ggr8-5vv4-36mx](https://github.com/RebeccaStevens/deepmerge-ts/security/advisories/GHSA-ggr8-5vv4-36mx), patched in deepmerge-ts 8, concerns stack exhaustion from recursive object graphs. `npm explain deepmerge-ts` confirms `prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5`. Prisma/config pin these versions. Prisma is a direct dev dependency but also an optional peer of installed runtime packages, explaining why npm still reports all three with `--omit=dev`.

**Actual build/config path:** `prisma/config.js` re-exports `@prisma/config`. Its `dist/index.js:892` config loader imports C12 and deepmerge, supplying deepmerge as C12's merger. It disables dotenv loading by C12, RC files, remote extensions, config extension, and package.json config. The project's checked-in `prisma.config.ts` independently loads dotenv and constructs fixed schema/migration paths plus database URL strings; strings cannot supply cyclic object references. C12 merges the main configuration and optional local configuration layers; no external JSON/request data feeds those objects. Loading the current config with dummy URLs completed with zero cycles. `npm ci` postinstall runs `prisma generate`, so the merge library is reachable during installation/CLI operations, but attacker-controlled object graphs are not an input under the current trusted repository/config model.

**Runtime path:** application code imports `@prisma/client` through `src/lib/prisma.ts`, not the CLI config loader. Generated client uses `@prisma/client/runtime/library.js`; neither the app nor Better Auth's Prisma adapter imports the config merger. Constructing PrismaClient without issuing queries loaded no config/C12/deepmerge modules. None of 49 production build `.nft.json` traces referenced them. These observations support no identified remote request path to the vulnerable merge; they are not proof about arbitrary future deployments.

**Recommendation: justified deferral**, retaining this advisory in release evidence until a compatible maintained Prisma 6/config fix is available. Do not force deepmerge-ts 8 or upgrade Prisma major solely to clear the audit. Reassess if config loaders receive user objects, config extensions/plugins change, or build inputs become untrusted. Someone able to edit executable Prisma config could introduce cycles during a build, but already has code execution in that build context; do not expose production credentials to untrusted builds. This recommendation does not claim the installed library is patched or risk-free.

Better Auth's [device authorization advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-q84f-53jg-9ppm) includes 1.6.33 but its opt-in plugin is disabled; not an active exposure here. The previously reported magic-link/email-OTP issue is patched, and those plugins also remain disabled.

Next: review the deferral recommendation and complete actual nonproduction catalog/email/service acceptance under separate authorization. R1 is **CODE VERIFIED / INTEGRATION PENDING**, not DONE. No R2 work is authorized.

## R2 — Rate limiting

Start: `src/lib/rate-limit.ts`, auth wrapper, existing rate-limit tests and installed limiter implementation.

For configured production mutation/auth limiters, Redis errors and timeout results must return a controlled temporary failure, not success. Handle the library's `success: true` timeout result explicitly. Preserve valid 429 responses and Retry-After. Public-read outage behavior may remain permissive if deliberate and documented; local development without Redis may remain supported.

Use a client-IP trust policy appropriate to the actual hosting proxy. Do not assume arbitrary forwarding headers are authentic. Ask which host/proxy will be used if unknown; complete independent failure-handling work meanwhile. No invented universal proxy rule or new service.

Accept: mocked success/429/error/timeout/missing-config cases; user-key isolation; proxy spoofing checks against the selected host's documented behavior; staging quota/outage smoke checks. Auth/checkout must not silently lose their configured protection. Mark host/integration work pending if unavailable.

### R2 evidence — 2026-09-29

Branch `fix/r2-rate-limiting`, starting HEAD `e926cb11c9279cc5c3d1cf371eb8a17058c2ef70`; working tree was clean. Only R2 helper, regression tests, and handoff/plan changed; no commit or deployment.

- Sensitive buckets now return a controlled **503** (`RATE_LIMIT_UNAVAILABLE`, `Cache-Control: no-store`) on Redis exceptions or `reason: "timeout"`, before checking `success`. Missing production Redis configuration also rejects sensitive requests; existing environment validation remains intact. Allowed requests and actual **429** quota headers/Retry-After are preserved. Public catalog reads deliberately remain permissive during outages; development/test without Redis remains supported. No fallback system added. Logs contain only failure category and bucket, not raw Redis errors.
- Inspected installed `@upstash/ratelimit` 2.0.8 (`dist/index.js`, constructor/applyTimeout) and [official timeout documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/features#timeout): default timeout is five seconds and returns `success: true`, `reason: "timeout"`. The existing library deadline remains in use.
- Reviewed auth POST wrapper, login/signup/reset/verification email callbacks, checkout order/email path, and mutation callers. Existing `!limited.ok` early returns already stop protected handlers; no caller refactor needed. Tests combine the actual helper with mocked Redis and route dependencies: failure at auth or either verification-email gate never reaches Better Auth; checkout failures never reach the transaction, order/profile/stock/cart writes, or notification email. Existing allowed/429 tests remain, with added all-sensitive-bucket error/timeout, production missing/partial config, public-read outage, and user-key isolation cases.
- **PASS** focused: `npm.cmd run test:run -- src/lib/rate-limit.test.ts 'src/app/api/auth/[...all]/route.test.ts' src/app/api/orders/route.test.ts` — **3 files / 53 tests**.
- **PASS** shared regression gate: `npm.cmd run test:run` — **34 files / 230 tests**. All integrations here are mocked; no external Redis, database, or email verification is claimed.
- **PASS** `npm.cmd run check` (lint/types), scoped Prettier formatting, and `git diff --check`. Initial sandbox-only formatting/test attempts failed with EPERM; approved execution outside the sandbox succeeded. R1 audit/install/build/browser evidence reused without reruns; no dependency changes.
- **BLOCKED / deployment requirement:** user confirmed production hosting/reverse proxy is not finalized. Current IP parser still selects the first `x-forwarded-for` entry, then `x-real-ip`, then `cf-connecting-ip`, then `local`; this is **not verified trustworthy** and can be spoofed on an ingress that forwards arbitrary client headers. No provider-specific policy was invented. Before release, select the host/proxy, verify its documented canonical client-IP source and header overwrite/chain rules, restrict direct origin access, implement extraction for that exact trust boundary, and test forged headers, multi-hop chains, missing headers, and origin bypass. Auth's anonymous IP keys remain subject to this unresolved requirement; authenticated checkout/mutation keys use server session user IDs and tests show forwarding headers cannot change those keys. Better Auth's own IP behavior must also be checked against the chosen ingress; it is not a substitute for this gate.
- **BLOCKED / integration:** staging quota/Retry-After and Redis outage/timeout smoke checks await an explicitly identified nonproduction target. Verify no login/email/order side effects and successful recovery there. No production credentials/data accessed.

Next: finalize deployment trust policy and authorize nonproduction staging smoke checks. R2 is **CODE VERIFIED / INTEGRATION PENDING**, not DONE. R3 was not started.

## R3 — Production email

Start: `src/env.js`, `src/server/email.ts`, auth configuration, `.env.example`, CI.

Reject log-only email delivery in production and prevent password-reset/verification tokens from appearing in production logs. Keep local development logging explicit. Update examples and CI placeholder settings without sending real mail during builds or requiring production secrets. Preserve verification and reset behavior.

Accept: production + log fails safely; development logging still works; production SMTP path does not log tokens; SMTP failure is handled safely. A production-mode build with validation enabled passes. On staging, actual verification and reset emails arrive, links use the staging origin, and verified users can checkout. Code may be merged before this last check only with the integration blocker retained.

## R4 — Checkout phone

Start: shared `phoneSchema`, order validation/API/tests, profile and checkout UI consumers.

Validate permitted characters, normalize formatting, then validate the resulting number. Proposed format policy: 10–15 ASCII digits with one optional leading `+`; allow spaces, hyphens, and parentheses as input formatting. This checks format, not phone ownership. Preserve shared validation and useful English/Arabic errors.

Accept: reject `----------`, `1---------`, `+---------`, letters, misplaced/repeated plus signs, and too few/many digits; accept ordinary local/international examples and normalize consistently. Verify invalid order requests perform no order/stock/cart/profile writes. Valid checkout snapshots the number and updates the profile transactionally; failures do not update it. Check phone display/entry in RTL and LTR.

## R5 — Inventory filters and sorting

Start: admin product API/filter queries and UI; public availability and variant stock logic.

Use the same sum of active variant stock for admin in-stock/out-of-stock/low-stock filtering and stock ordering that the storefront uses. Preserve current low-stock threshold unless a change is requested. Filter and sort globally before pagination; aggregating only the displayed page is incorrect. Avoid loading the entire catalog. Do not introduce a stale duplicated stock total to hide the mismatch.

Accept: positive, zero, inactive-only, and mixed variants; deliberately conflicting legacy Product.stock; low-stock boundaries; ascending/descending ordering and stable multi-page results. Include a database-backed query test using a confirmed disposable target. No migration unless separately proposed and approved.

## R6 — Electronics options: design first

Start: variant schema/validation/admin UI, add-to-cart, checkout, historical snapshots.

Explain the smallest practical support for ordinary components and real selectable options. Recommend between one explicit default sellable option per simple product and a neutral option model. Clarify which attributes buyers actually choose. Do not build specifications, kits/bundles, or compatibility filters without a request; do not relabel clothing fields deceptively.

First deliver one concrete proposal: behavior, affected files, schema/data impact, existing-order compatibility, tests, migration/rollback if needed. Record the decision here. Implementation begins only after the user accepts that proposal; continue in the same session if context is still useful.

Accept after implementation: a simple component can be created, stocked, purchased, and cancelled; actual options retain unique cart identity and stock; inactive options cannot be bought; old orders retain names/prices/option labels. Preserve R5 query behavior. Any approved migrations are tested only on a disposable database before a separate deployment decision.

## R7 — Public configuration and catalog

Start: contact/store/delivery/policy/legal config, metadata, catalog setup workflow.

Request one concise batch of missing public owner inputs: contact channels, domain, delivery fees/areas, policy decisions, verified business details, exact product/model/options/prices/stock, and image rights. Populate supplied values; remove unused links. Never fabricate information or treat test fixtures as real inventory. Surface conflicting domain guards/metadata for resolution without asserting legal requirements from template code.

Accept: no placeholder support destinations, working phone/WhatsApp/email/social links, agreed delivery charges matching server checkout, bilingual/RTL pages and real product descriptions/photos checked. Complete available public configuration first; private credentials are entered by the owner through the appropriate environment, not committed.

## R8 — Staging release gate

Use a fresh session after R1–R7 code has merged. Audit current task evidence and release diff, then exercise the existing stack on a specifically identified disposable local/staging target. Inventory required accounts, products, services and cleanup before writes. Add only missing high-value tests; reuse existing suites.

Accept: full check/tests/build and Playwright; two customers' data isolation; guest/customer admin denial; price/delivery tampering rejection; verify/reset/login; phone flow; add/edit/archive products and upload images. Against real PostgreSQL, test duplicate same-key checkout, competing purchases of the last unit, same-cart concurrency with different keys, cancellation retries and exactly-once restocking. Same-key retries must yield one order and one deduction; stock must stay nonnegative. Assess different-key/cart-edit races against the intended single-cart semantics.

Verify SMTP, Redis, Cloudinary and optional OAuth with real staging services. Rehearse committed migrations and backup restore using disposable data; document deployment variables, target commit and rollback. Fix small in-scope defects with regression tests; propose substantial schema/redesign changes separately. Produce GO/NO-GO evidence. Unrun gates remain blockers; passing unit mocks or a build alone cannot establish readiness. Do not deploy.
