# Electronics frontend plan

## Goal

Adapt the independent copy of [ecommerce-template-clothing](https://github.com/ShakerMasri/ecommerce-template-clothing) for motors, ICs, breadboards, ESP32 boards, sensors and university project kits.

Current scope: colors, fonts, layout, copy and imagery. New commerce features, variant redesign, SaaS and production release work are outside this frontend plan. Follow `AGENTS.md` for durable boundaries; see `agent-handoff.md` for current evidence and blockers.

## Checkpoints

1. **Initial read-only assessment — completed.** Use its existing findings; do not restart it.

2. **2A: Shared palette and typography — complete, 2026-09-24.** Approved palette and English/Arabic system typography implemented. Mobile/desktop, light/dark review passed across public, product, cart, authentication and admin screens, including selection, quantity changes and admin keyboard focus/hover. Existing screenshots reviewed; no scoped regressions found. Lint/typecheck and static contrast passed. Build/full E2E suite were not run; evidence and limits are in the handoff.

3. **2B: Shared layout and navigation - complete, 2026-09-25.** Refined the header, footer and short-page spacing using existing routes and controls. Single responsive navigation keeps all five links visible on mobile; improved touch targets and RTL contact formatting. Lint/typecheck passed. Twenty layout/control combinations across five widths, English/Arabic and light/dark passed; representative screenshots reviewed. Signed-out cart/empty catalog review limits and evidence are in the handoff.

4. **2C: Homepage and catalog presentation — proposed.** Adapt homepage sections, catalog/product layouts, copy and imagery to component shopping. Use verified product information; record asset sources and required notices. Identify functional clothing assumptions for separate decisions.

5. **2D: Visual consistency and regression review — proposed.** Polish remaining affected screens; review light/dark, English/Arabic, keyboard navigation and mobile usability. Run appropriate build and critical-flow checks against development data. Record outstanding issues and distinguish visual acceptance from release readiness.

## Sequence

2B is complete; stop before 2C. Approved local database initialization and review setup are complete. Later checkpoints remain proposals, not authorization to begin. Keep production readiness as separately scoped work.
