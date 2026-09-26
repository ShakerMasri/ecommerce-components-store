# Checkpoint 2C: content, imagery and deferred decisions

Completed: 2026-09-26. Scope: homepage and catalog/product presentation only.

## Content sources

The homepage gives general component-shopping guidance, not specifications for stocked products. Sources checked on 2026-09-25:

| Source | Use and limits |
| --- | --- |
| [Adafruit: Breadboards for Beginners](https://learn.adafruit.com/breadboards-for-beginners/breadboards) | Supports the description of solderless breadboards for temporary circuit assembly. Original paraphrase; no copied photographs or instructions. |
| [Espressif: ESP32](https://www.espressif.com/en/products/socs/esp32) | Supports the board-family context. Copy asks customers to check the exact model; it does not apply one chip's interfaces, radio features or electrical ratings to every ESP32 board. |
| [Texas Instruments: Motor drivers](https://www.ti.com/product-category/motor-drivers/overview.html) | Supports distinguishing motors from their drivers. No driver compatibility, voltage or current specification is asserted for store inventory. |

Project-list, pinout, rating and kit-content reminders are original shopping guidance. They do not promise kit availability, engineering support, documentation downloads or compatibility checking by the store.

Product names, descriptions, categories, prices, stock, options and image URLs continue to come from the existing API. No catalog data was created, relabeled or independently certified in 2C. Verified supplier SKU/model records, exact kit contents, specifications and commercially usable product photos were not supplied. Obtain those before populating a real electronics catalog; never substitute generic family specifications or the review fixtures for product facts.

## Asset register and notices

| Asset | Source / rights / use |
| --- | --- |
| `src/components/products/ComponentsIllustration.tsx` | Original SVG code authored in this checkpoint. Decorative generic board, breadboard, IC and LED illustration; not a photograph, exact product depiction, pinout or wiring diagram. No third-party artwork, logo, font or tracing used; no additional third-party attribution notice required. Uses the existing theme tokens and is hidden from assistive technology as decoration. |
| Existing API product images | Existing URLs retained. Cards and gallery now contain the full image within square frames. No new third-party product images imported. Rights/provenance of existing inventory images were not audited; each future product image needs its own source/license record. |
| `test-results/2c-review/` fixture image | Original inline SVG explicitly labeled `SYNTHETIC LAYOUT FIXTURE`; ignored browser-review evidence only. Never written to catalog data or shipped as a product asset. |

Existing repository notices remain unchanged. Source links above support facts, not permission to reuse those sites' images. “Components Store” / “متجر المكوّنات” is descriptive public configuration, not an assertion of a registered business name. Existing contact placeholders remain unverified.

## Functional clothing assumptions: separate decisions required

- `prisma/schema.prisma` still models variants as `sizeLabel` / `colorLabel`, with normalized size/color keys and uniqueness per product. Admin variant validation/editor and API errors use the same model. Do not silently rename these to voltage, resistance, package or board revision. A different option model needs separately approved schema/business-logic work.
- Product-detail selection and cart variant identity still use the existing variants. Size/color selection help remains truthful to that implementation. Preserve stock checks, variant identity and historical order snapshots in any later redesign.
- Existing admin clothing examples/placeholders remain outside this presentation checkpoint. Editing them does not resolve the underlying variant model.
- Product details remain free text and images; there are no structured electrical specifications, datasheet attachments, compatibility filters or kit bill-of-materials features. The new presentation does not advertise them.
- University kits are shopping guidance only; no bundle inventory, kit configurator or university endorsement is implied or implemented.

## Verification scope

- `npm.cmd run check`: ESLint and TypeScript passed after application edits.
- Existing `ProductCard.test.tsx`: 5/5 passed. Initial sandbox child-process failure was resolved by running the same test with approved escalation.
- Saved Playwright review: 36 screen combinations across homepage, catalog and product detail; widths 320/390/1440, English/Arabic, light/dark. No document overflow or page runtime errors. Search/empty-results/clear-filters and gallery selection passed. Representative screenshots visually inspected, including RTL dark and narrow English views.
- Evidence: ignored `test-results/2c-review/review.mjs`, `results.json` and 36 PNGs. Homepage used the local application; populated catalog/detail responses were browser-intercepted synthetic fixtures. Missing image and sold-out card states were included. This does not verify real inventory, authenticated cart mutations, checkout or server variant enforcement.
- No database writes, migrations, orders, external integration actions, production access, build/full E2E, commit, push or deployment in 2C. Broader regression and release work remain outside this checkpoint.
