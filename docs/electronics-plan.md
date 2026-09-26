# Electronics frontend plan

## Goal

Adapt the independent copy of [ecommerce-template-clothing](https://github.com/ShakerMasri/ecommerce-template-clothing) for motors, ICs, breadboards, ESP32 boards, sensors and university project kits.

Current scope: colors, fonts, layout, copy and imagery. New commerce features, variant redesign, SaaS and production release work are outside this frontend plan. Follow `AGENTS.md` for durable boundaries; see `agent-handoff.md` for current evidence and blockers.

## Checkpoints

1. **Initial read-only assessment — completed.** Use its existing findings; do not restart it.

2. **2A: Shared palette and typography — complete, 2026-09-24.** Approved palette and English/Arabic system typography implemented. Mobile/desktop, light/dark review passed across public, product, cart, authentication and admin screens, including selection, quantity changes and admin keyboard focus/hover. Existing screenshots reviewed; no scoped regressions found. Lint/typecheck and static contrast passed. Build/full E2E suite were not run; evidence and limits are in the handoff.

3. **2B: Shared layout and navigation - complete, 2026-09-25.** Refined the header, footer and short-page spacing using existing routes and controls. Single responsive navigation keeps all five links visible on mobile; improved touch targets and RTL contact formatting. Lint/typecheck passed. Twenty layout/control combinations across five widths, English/Arabic and light/dark passed; representative screenshots reviewed. Signed-out cart/empty catalog review limits and evidence are in the handoff.

4. **2C: Homepage and catalog presentation — complete, 2026-09-26.** Adapted bilingual homepage/catalog copy and public store configuration; added original component artwork, uncropped square product imagery, readable model names and multiline descriptions. Existing product data and variant behavior preserved. General content sources, asset notices, missing real-SKU inputs and functional clothing assumptions are recorded in `electronics-content-sources.md`. ESLint/TypeScript, five ProductCard tests and 36 scoped browser screen combinations passed; populated review used browser-only synthetic fixtures.

5. **2D: Visual consistency and regression review — complete, 2026-09-26.** Polished cart/order/admin images, wrapping, RTL alignment and cart touch targets; fixed checkout modal keyboard containment, Escape and focus return. Reviewed 320/390/1440px, English/Arabic and light/dark: 156 authenticated screen combinations, 72 public combinations, 12 synthetic order layouts, plus final modal regression in all 12 combinations. Lint/typecheck, 188 existing unit/API tests, 21 selected E2E checks and final compile-only build passed. Normal build remains blocked by missing production Redis configuration; full order submission/external integrations were not exercised. Fixture cart is empty, stock unchanged and zero orders created. Evidence, minor outstanding presentation issues and release blockers are in `agent-handoff.md`. Scoped visual acceptance does not establish release readiness.

## Sequence

2A–2D are complete; stop here. Review/commit the 2C and 2D changes when desired. Approved local database initialization and review setup remain unchanged. Real catalog population, functional variant redesign and production readiness remain separately scoped work requiring authorization.
