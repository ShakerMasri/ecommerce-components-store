# Electronics frontend plan

## Goal

Adapt the independent copy of [ecommerce-template-clothing](https://github.com/ShakerMasri/ecommerce-template-clothing) for motors, ICs, breadboards, ESP32 boards, sensors and university project kits.

Current scope: colors, fonts, layout, copy and imagery. New commerce features, variant redesign, SaaS and production release work are outside this frontend plan. Follow `AGENTS.md` for durable boundaries; see `agent-handoff.md` for current evidence and blockers.

**Status: current frontend visual scope complete and committed, verified 2026-09-26.** On `electronics/setup`, 2A is committed as `8dbb31e`, 2B as `3b867ce`, and 2C/2D together as `6ef023c`. The working tree was clean before this documentation closeout. No remaining blocker prevents closing 2A–2D; this does not establish production readiness.

## Checkpoints

1. **Initial read-only assessment — completed.** Use its existing findings; do not restart it.

2. **2A: Shared palette and typography — complete, 2026-09-24.** Approved palette and English/Arabic system typography implemented. Mobile/desktop, light/dark review passed across public, product, cart, authentication and admin screens, including selection, quantity changes and admin keyboard focus/hover. Existing screenshots reviewed; no scoped regressions found. Lint/typecheck and static contrast passed. Build/full E2E suite were not run; evidence and limits are in the handoff.

3. **2B: Shared layout and navigation - complete, 2026-09-25.** Refined the header, footer and short-page spacing using existing routes and controls. Single responsive navigation keeps all five links visible on mobile; improved touch targets and RTL contact formatting. Lint/typecheck passed. Twenty layout/control combinations across five widths, English/Arabic and light/dark passed; representative screenshots reviewed. Signed-out cart/empty catalog review limits and evidence are in the handoff.

4. **2C: Homepage and catalog presentation — complete, 2026-09-26.** Adapted bilingual homepage/catalog copy and public store configuration; added original component artwork, uncropped square product imagery, readable model names and multiline descriptions. Existing product data and variant behavior preserved. General content sources, asset notices, missing real-SKU inputs and functional clothing assumptions are recorded in `electronics-content-sources.md`. ESLint/TypeScript, five ProductCard tests and 36 scoped browser screen combinations passed; populated review used browser-only synthetic fixtures.

5. **2D: Visual consistency and regression review — complete, 2026-09-26.** Polished cart/order/admin images, wrapping, RTL alignment and cart touch targets; fixed checkout modal keyboard containment, Escape and focus return. Reviewed 320/390/1440px, English/Arabic and light/dark: 156 authenticated screen combinations, 72 public combinations, 12 synthetic order layouts, plus final modal regression in all 12 combinations. Lint/typecheck, 188 existing unit/API tests, 21 selected E2E checks and final compile-only build passed. Normal build remains blocked by missing production Redis configuration; full order submission/external integrations were not exercised. Fixture cart is empty, stock unchanged and zero orders created. Evidence, minor outstanding presentation issues and release blockers are in `agent-handoff.md`. Scoped visual acceptance does not establish release readiness.

## Sequence

Separately authorized follow-up: **Checkout email verification feedback complete, 2026-09-28.** Unverified-email failures show bilingual inline guidance and an account resend link; server enforcement and phone behavior are unchanged. Lint/TypeScript and 20 focused order API tests passed; see handoff for verification limits.

Separately authorized follow-up: **Darakit SVG logo replacement complete, 2026-09-28.** Header/footer use the supplied outlined logo with homepage links and accessible labels. Lint/TypeScript passed; evidence and scope are in the handoff.

Header sizing follow-up complete: larger wordmark from `sm` upward, existing favicon icon on mobile. Lint/TypeScript passed.

Light-mode header logo follow-up complete: outline-free variants with navy wordmark letters; existing dark-mode appearance preserved. Lint/TypeScript and SVG geometry/color checks passed.

Separately authorized follow-up: **Darakit rebrand complete, 2026-09-27.** Shared brand, bilingual hero copy, metadata for darakit.com and favicon label updated without design or commerce changes. ESLint/TypeScript passed; see handoff for evidence. Stop after this rebrand.

2A–2D are complete and committed; stop at this boundary. Approved local database initialization and review setup remain unchanged. The priorities below are recommendations for separately authorized work, not an extension of the completed visual scope.

## Remaining work outside the completed scope

1. **Decide the electronics variant model.** Existing size/color schema, admin examples, validation and selection remain functional clothing assumptions. Prepare a separate option-model proposal before any schema or business-logic changes; preserve server-controlled prices/stock, cart identity and historical order snapshots. Structured electrical specifications, datasheets, compatibility filters and kit/bundle inventory are not implemented or promised.
2. **Obtain and populate verified real catalog content.** Owner input is needed for exact SKU/model specifications, kit contents, categories, prices/stock and commercially usable photos with provenance. Review fixtures are not real inventory. Coordinate catalog population with the variant decision; see `electronics-content-sources.md`.
3. **Complete business and production configuration.** Verify public contacts, business identity, legal/policy and delivery information. The last normal build was blocked by missing `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; compile-only success with process-local `SKIP_ENV_VALIDATION=1` does not close that blocker. Configure and validate required deployment/integration settings separately, keeping production secrets/data outside the agent-accessible development environment.
4. **Run separately scoped release validation.** Full packaged E2E, actual order submission/idempotency/inventory effects, admin saves/uploads, registration/reset email delivery and SMTP/Redis/Cloudinary/Google integrations remain unverified. Use suitable verified nonproduction accounts and explicitly scoped writes. The completed keyboard/mobile review is not a full assistive-technology audit; production access and deployment remain separately authorized.
5. **Optional follow-up copy/RTL polish.** Registration help still mentions server hashing; checkout phone punctuation needs LTR isolation review. These recorded nonblocking issues do not reopen the accepted visual scope.
