# Asset License Notes

This file records asset and media license-review notes for this clothing ecommerce template.

This is an engineering audit aid, not legal advice.

## Current Asset Audit Summary

Temporary audit files can be regenerated with:

```bash
find public src -type f | sort > asset-files.txt
grep -RInE "next/font|fonts\.googleapis|@font-face|url\(|<img|OptimizedImage|cloudinary|res\.cloudinary|lucide-react|react-icons|/[^\"' )]+\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|otf)" src public > asset-refs.txt || true
```

These generated files are local-only and should not be committed:

```txt
asset-files.txt
asset-refs.txt
```

## Findings

### Repository Static Assets

Status: resolved

Finding:

- The asset scan found `public/favicon.ico`.
- The app references this file as `/favicon.ico`.
- The original source of this favicon is currently unknown.

Decision:

- Replaced the unknown `public/favicon.ico` with a simple original `public/favicon.svg`.
- The SVG uses basic shapes and text only.
- No copied logo, icon pack, external image, or embedded font is used.

### Fonts

Status: accepted

Finding:

- The app imports `Geist` through `next/font/google`.
- No separate committed font files were found in the repository scan.

Decision:

- Geist is licensed under SIL Open Font License 1.1.
- The app uses it through `next/font/google`.
- No local modified font files are committed.
- No replacement needed.

### Product Images and Cloudinary Media

Status: accepted only after production image review

Finding:

- Product images are uploaded through Cloudinary.
- Product images are rendered through the app using `OptimizedImage`.
- Product image URLs are expected to come from Cloudinary.

Decision:

- Staging/test images are disposable and not production assets.
- Before production, every real Cloudinary product image must be client-owned, supplier-approved, original, or properly licensed.
- Unknown-source images must be removed or replaced.

2026-10-15 SEO fixture note: the owner reports that the existing two proposed staging product images came from the internet and are already on Cloudinary. The approved temporary staging fixture reuses their exact existing URLs; no new image is ingested or published by this preparation. Their source/permission evidence remains undocumented for production review; Cloudinary storage does not resolve that evidence gap. Separately prepared optional original geometric SVG/PNG test illustrations are local ignored artifacts under `node_modules/.cache/seo-hosted-20261015/fixture-prep-20261015-71a4fc7/original-images-20261015`, with source hashes and inspected PNGs. They contain no third-party photos/logos/embedded images/font files and have not been uploaded or incorporated into the application.

### Icons, SVGs, and UI Asset Packs

Status: accepted with trademark caution

Finding:

- The scan did not show committed SVG packs, illustration packs, or downloaded UI kits in `public`.
- The footer uses a small dependency-free inline SVG map for optional public social profile links.
- The optional floating WhatsApp support shortcut reuses the same dependency-free WhatsApp inline SVG approach.
- Current supported brand icons are Instagram, WhatsApp, and Facebook.
- The location/map-pin icon is an original simple geometric inline SVG created for this template, not a copied brand or icon-pack asset.

Decision:

- Do not add `react-icons`, paid icon kits, copied Google/Image-search SVGs, or unknown-source assets for social links.
- Footer social brand icon path data is based on Simple Icons, a CC0 project: `https://simpleicons.org/` and `https://github.com/simple-icons/simple-icons`.
- Simple Icons' own disclaimer asks users to review icon license information because licenses and brand usage can change.
- CC0 reduces copyright risk for the icon path data, but it does not remove trademark, brand-guideline, endorsement, or unfair-competition concerns.
- Use brand icons only as neutral links to the store's real public profiles. Do not use them in a way that suggests Meta, Instagram, WhatsApp, Facebook, or any other platform sponsors, endorses, or partners with the store.
- Keep the footer social/location icons grouped inside the contact summary so they read as navigation/contact links, not as a separate brand partnership section.
- Use the floating WhatsApp support shortcut only as a neutral customer-support/contact entry point. Do not present it as an official WhatsApp/Meta partnership or as a replacement for server-validated website checkout.
- Replace placeholder social/location URLs in `src/config/contact.ts` before launch. Remove any social platform the client does not actually use.
- Keep icons monochrome with `currentColor` in this footer so they match the theme and are presented as navigation icons, not modified brand lockups.
- Before commercial launch, review the current official brand-resource pages for each enabled platform and keep this file updated.

Reviewed links for this checkpoint:

- Simple Icons: `https://simpleicons.org/`
- Simple Icons legal disclaimer: `https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md`
- Instagram brand resources: `https://www.meta.com/brand/resources/instagram/instagram-brand/`
- WhatsApp brand resources: `https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/`
- Facebook brand resources: `https://www.meta.com/brand/resources/facebook/logo/`

## Required Production Actions

Before handing the project to a real client or launching production:

- Verify the original `public/favicon.svg` still matches the client brand or replace it with a client-owned asset.
- Verify the font license and keep proof.
- Verify every real product image uploaded to Cloudinary.
- Remove temporary, test, or demo product images.
- Do not use copyrighted fashion photos, model photos, product photos, brand logos, posters, supplier catalog images, or influencer/customer photos without permission.
- Keep source/license notes for all commercial assets.
