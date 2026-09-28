# Darakit release plan

## Shared acceptance rules

Work on one requested task at a time. Findings below came from the 2026-09-28 review of `b21f625`; confirm only the relevant code before fixing. Task status is not authorization.

Use focused regression tests while editing. Before merging a code task: `npm.cmd run check`, `npm.cmd run test:run`, and `git diff --check`. Build for dependency/configuration changes and at final release validation. Run affected browser/integration checks when behavior requires them. Do not rerun unrelated visual matrices. Documentation-only changes need a diff/content review, not application tests.

Label every check PASS, FAIL, or BLOCKED with the command/target and evidence. A production build with placeholder variables checks compilation only. Keep environment validation enabled; do not weaken it to get a green build. Missing services remain explicit integration blockers.

Status values: TODO, IN PROGRESS, CODE VERIFIED / INTEGRATION PENDING, BLOCKED, DONE. A row is DONE only when its acceptance criteria have evidence. Keep completed rows concise. Production deployment is a separate action.

| Task | Scope | Status | Evidence / remaining blocker |
|---|---|---|---|
| R1 | Vulnerable dependencies and image optimizer | TODO | Prior lockfile: Next 15.5.19 |
| R2 | Rate-limit failures and trusted client IP | TODO | Redis errors/timeouts allow requests |
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

## R2 — Rate limiting

Start: `src/lib/rate-limit.ts`, auth wrapper, existing rate-limit tests and installed limiter implementation.

For configured production mutation/auth limiters, Redis errors and timeout results must return a controlled temporary failure, not success. Handle the library's `success: true` timeout result explicitly. Preserve valid 429 responses and Retry-After. Public-read outage behavior may remain permissive if deliberate and documented; local development without Redis may remain supported.

Use a client-IP trust policy appropriate to the actual hosting proxy. Do not assume arbitrary forwarding headers are authentic. Ask which host/proxy will be used if unknown; complete independent failure-handling work meanwhile. No invented universal proxy rule or new service.

Accept: mocked success/429/error/timeout/missing-config cases; user-key isolation; proxy spoofing checks against the selected host's documented behavior; staging quota/outage smoke checks. Auth/checkout must not silently lose their configured protection. Mark host/integration work pending if unavailable.

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
