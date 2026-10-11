# DaraKit

DaraKit is an independent electronics storefront for components, IoT supplies, and student project kits. This repository contains the customer website, admin dashboard, and backend.

The storefront supports English and Arabic, including right-to-left layouts. Customers can browse products, choose available options, manage a cart, and place cash-on-delivery orders. Admins manage the catalog, inventory, and orders.

**Release status:** local implementation and verification are recorded in the [release plan](docs/release-plan.md). Production configuration, recovery preparation, and hosted acceptance still have open gates. This README is a guide to the project, not launch approval.

## What the app does

**For customers**

- Browse products with search, category filters, and paginated results.
- View discounts, availability, and exact stock when the store enables it.
- Buy a simple product or select a named electronics option.
- Register, sign in, reset a password, and manage a profile. Google sign-in is optional.
- Review delivery or collection details and the final total before checkout.
- View order history and receive an order receipt by email when delivery succeeds.
- Read shipping, returns, privacy, and terms pages, or contact the store through WhatsApp.

**For admins**

- Create, edit, archive, and restore products; upload images through Cloudinary.
- Manage product options, stock, discounts, and customer stock visibility.
- Filter, sort, and paginate inventory and categories.
- Delete categories only when they have no related products.
- Review orders, update order and payment statuses, and add internal notes.
- Receive optional email notifications for new orders.

Online card payments, coupons, POS, accounting, and delivery-company integrations are not implemented. Delivery pricing is managed in code.

## Technology

| Area           | Tools                                                       |
| -------------- | ----------------------------------------------------------- |
| Application    | Next.js 15 App Router, React 19, TypeScript                 |
| Styling        | Tailwind CSS 4 and project CSS                              |
| Database       | PostgreSQL, Prisma 6                                        |
| Authentication | Better Auth                                                 |
| Validation     | Zod and typed environment configuration                     |
| Services       | Upstash Redis, Cloudinary, Nodemailer/SMTP                  |
| Checks         | ESLint, Prettier, Vitest, React Testing Library, Playwright |

[package.json](package.json) defines the scripts and supported runtime; [package-lock.json](package-lock.json) pins the dependency tree. Some package and environment defaults retain the old clothing-template name. The current app is DaraKit.

## Run locally

You need Node.js **20.17 or newer**, npm, and PostgreSQL. CI uses Node.js 20.19.0; the declared package manager is npm 11.12.1. Docker is optional if you already have a local database.

The examples below use PowerShell from the repository root. Use a local development database, separate from staging and production.

### 1. Create your environment file

```powershell
Copy-Item .env.example .env
```

Edit `.env` before installing dependencies. For the included Docker database, use:

```dotenv
DATABASE_URL="postgresql://components:components_dev_password@localhost:5437/components"
DIRECT_URL="postgresql://components:components_dev_password@localhost:5437/components"
BETTER_AUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
EMAIL_DELIVERY_MODE="log"
SMTP_FROM_NAME="DaraKit"
ORDER_NOTIFICATION_EMAIL=""
```

Generate a development session secret, then put the result in `BETTER_AUTH_SECRET` in your private `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The environment schema also requires nonempty SMTP and Cloudinary settings, even for local log mode. For development without those services, the following **dummy values** satisfy validation; they do not enable SMTP or image uploads:

```dotenv
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER="local-only"
SMTP_PASSWORD="local-only"
SMTP_FROM_EMAIL="noreply@example.com"
CLOUDINARY_CLOUD_NAME="local-placeholder"
CLOUDINARY_API_KEY="local-placeholder"
CLOUDINARY_API_SECRET="local-placeholder"
```

Use a separate Cloudinary development account to test uploads. Leave Google OAuth and Upstash credentials empty unless you are testing those integrations. Without Upstash configuration, the application limiter is bypassed outside production; that does not verify production rate limiting.

Log mode sends no emails but prints email content and sensitive verification/reset links. Keep those logs private. It is allowed only outside `NODE_ENV=production`.

### 2. Start the database and install dependencies

```powershell
docker compose up -d db
npm ci
```

The Docker database listens on `localhost:5437` and stores data in a persistent volume. Its bundled credentials are for local development only. `npm ci` generates the Prisma client through the postinstall script.

### 3. Apply migrations and start the app

After confirming both database URLs point to your local development database:

```powershell
npm run db:migrate:deploy
npm run dev
```

Open [localhost:3000](http://localhost:3000). A fresh database has no catalog or admin account.

Register a local account through the app. To use the admin dashboard in development, open `npm run db:studio` and change only that local user's `role` to `ADMIN`. Registration creates customer accounts; Google sign-in does not grant admin access. Add categories and products through `/admin`.

To stop the Docker database while retaining its data:

```powershell
docker compose stop db
```

## Environment settings

[.env.example](.env.example) lists the variables; [src/env.js](src/env.js) defines validation. Keep secrets in private environment files or hosting settings.

| Settings                                             | Purpose                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | Application database connection; may use a pooled connection                       |
| `DIRECT_URL`                                         | Direct migration connection; Prisma config falls back to `DATABASE_URL` when unset |
| `BETTER_AUTH_SECRET`                                 | Session secret, at least 32 characters                                             |
| `BETTER_AUTH_URL`, `APP_URL`                         | Authentication origin and email-link base URL; public URLs require HTTPS           |
| `SMTP_*`, `EMAIL_DELIVERY_MODE`                      | Authentication emails, customer receipts, and owner notifications                  |
| `ORDER_RECEIPT_FROM_EMAIL`                           | Optional receipt sender; defaults to `SMTP_FROM_EMAIL`                             |
| `ORDER_NOTIFICATION_EMAIL`                           | Optional owner notification recipient; empty disables it                           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`           | Optional Google sign-in; both are needed                                           |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared application rate limiting; required in production                           |
| `CLOUDINARY_*`                                       | Product image uploads and upload folder                                            |

For Google OAuth, register the exact callback URL for each environment: `<app-origin>/api/auth/callback/google`.

Production mode, including staging production builds, requires SMTP mode and production environment validation. A build using dummy service values proves compilation only. Actual email delivery requires a provider-approved sender; creating a mailbox alone is not sufficient.

## Everyday commands

| Command                     | Use                                                |
| --------------------------- | -------------------------------------------------- |
| `npm run dev`               | Start the development server                       |
| `npm run check`             | Run ESLint and TypeScript checks                   |
| `npm run test:run`          | Run Vitest once                                    |
| `npm test`                  | Run Vitest in watch mode                           |
| `npm run test:coverage`     | Generate coverage reports                          |
| `npm run build`             | Build the production app                           |
| `npm start`                 | Serve an existing production build                 |
| `npm run db:generate`       | Regenerate the Prisma client                       |
| `npm run db:migrate:dev`    | Create/apply migrations on a development database  |
| `npm run db:migrate:deploy` | Apply existing migrations to the configured target |
| `npm run db:studio`         | Inspect/edit the configured database               |
| `npm run audit:licenses`    | Generate a dependency license inventory            |

Use migrations for schema changes. `db:push:dev` is available for disposable development work; it is not the deployment workflow. Check the database target before any migration or data-editing command. Existing inventory upgrades also need the [options rollout procedure](docs/r6-options-rollout.md); applying the schema does not reconcile legacy inventory.

### Verification

For code changes, the shared pre-merge checks are:

```powershell
npm run check
npm run test:run
git diff --check
```

Build for dependency/configuration changes and final release validation. Documentation-only changes need content and diff review rather than application tests.

Database integration suites require explicit disposable-target opt-ins and otherwise skip. Passing unit/component tests or skipped integration tests do not establish database or hosted service acceptance. See the [shared acceptance rules](docs/release-plan.md#shared-acceptance-rules) for evidence requirements.

Playwright needs a running app, disposable test accounts/products, and a private `.env.e2e.local` using the `E2E_*` settings shown in `.env.example`:

```powershell
npx playwright install chromium
npm run test:e2e
```

The current Playwright config accepts only an `http://localhost:` target. It does not start the app automatically or allow a remote staging URL. Some tests create orders and change stock. Keep auth state, screenshots, traces, and reports out of Git.

## Inventory and checkout rules

- A simple product has a default option. A selectable product has named options. Sellable stock belongs to those options, using the existing `ProductVariant` model.
- Legacy size/color columns remain for compatibility and historical orders. Unresolved legacy options are unavailable for purchase until reconciled.
- Adding to the cart does not reserve stock. Checkout validates availability and reserves stock inside the order transaction.
- Prices, discounts, delivery fees, and totals are calculated on the server.
- Repeating checkout with the same customer/idempotency key reuses the order. Admin confirmation does not deduct stock again; cancellation restores reserved stock once.
- Orders preserve purchase-time product, option, price, and delivery snapshots. Catalog edits must not rewrite order history.
- Receipt and owner emails are best-effort after the order commits. An email failure does not undo a successful order.

Server-side authorization, customer ownership checks, input validation, CSRF/same-origin checks, and abuse protection remain required. Private API groups have `Cache-Control: private, no-store`; no shared application catalog cache has been added.

## Where to find things

| Path              | Contents                                                                   |
| ----------------- | -------------------------------------------------------------------------- |
| `src/app/`        | Storefront, account/admin pages, and API routes                            |
| `src/components/` | UI components                                                              |
| `src/config/`     | Public store, contact, delivery, policy, and business disclosure settings  |
| `src/lib/`        | Authentication, validation, translations, and request protections          |
| `src/server/`     | Server-only inventory, checkout coordination, pricing, and email code      |
| `src/env.js`      | Environment validation                                                     |
| `prisma/`         | Database schema and migrations                                             |
| `tests/e2e/`      | Playwright browser tests                                                   |
| `scripts/`        | Maintenance, acceptance, and asset tools; inspect target guards before use |
| `docs/`           | Current release evidence, deployment procedures, and historical plans      |

Keep English/Arabic content, RTL behavior, and accessibility aligned when changing the UI. Public configuration must contain no secrets. Catalog descriptions, photos, delivery promises, and policy details need store-owner approval.

## Release and project documentation

- [Current handoff](docs/agent-handoff.md): latest task, evidence, and next action.
- [Release plan](docs/release-plan.md): active gates and recorded verification.
- [Render production deployment plan](docs/render-production-deployment-plan.md): configuration, database/recovery preparation, and release sequence.
- [Production backup guide](docs/production-backup-guide.md#8-run-the-windows-backup-script): one-command Windows setup for backups every 24 hours, private storage and restore verification.
- [Electronics options rollout](docs/r6-options-rollout.md): compatibility, reconciliation, and rollback rules.
- [Render client-IP acceptance](docs/render-client-ip-acceptance.md): hosted rate-limit procedure; coordinated acceptance remains paused.
- [Asset license notes](docs/asset-license-notes.md) and [license review notes](docs/license-review-notes.md): asset provenance and licensing review.

Older clothing-template plans are historical references. Follow current code, release evidence, and [AGENTS.md](AGENTS.md) for repository work. Do not commit secrets, private environment files, database dumps, or test authentication state. Commit, push, merge, and deployment are separate actions and require an explicit request.
