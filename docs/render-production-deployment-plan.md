# Render Starter production deployment plan

Updated: 2026-10-08. **PLAN PREPARED / DEPLOYMENT NOT CONFIRMED / RELEASE NO-GO.** Owner chose Render Starter ($7/month) and `https://darakit.com`; the upgrade/deployment has not been reported complete. This document authorizes no provider change, database operation or hosted request.

## Evidence and source base

- **PASS — local Git:** clean `main` at `4c57030`, equal to local `origin/main`, selected as this documentation base. Cache commit `35d35f5` is an ancestor; its configuration is unchanged. No fetch; live remote/deployed state unverified. Stash/private environment untouched; full identifiers in the handoff.
- **OWNER-REPORTED COMPLETE — hosted cache checks:** completed after committing the fix; individual responses/deployed SHA unspecified. Reuse completion and prior local cache evidence without an automatic rerun.
- **OWNER-REPORTED — IP symptom:** original hosted warning is no longer observed and normal sign-in/out work. Coordinated two-client IP acceptance remains **PAUSED**, not passed.

## Recommended separation and decisions

Recommend a separate Starter production service; retain staging at `https://darakit-staging.onrender.com`. Use independent PostgreSQL database/role (prefer separate Neon project), Upstash database, auth secret and environment group. Separate Cloudinary credentials/account where practical, at least folders; separate SMTP credentials/restrict staging recipients and OAuth clients if enabled. Folders alone do not isolate credentials; staging must not access production data.

**Owner decisions unconfirmed:** upgrade/promote existing versus create separate service; retain existing data versus empty production database. Retention is independent of service creation. Any data move must freeze all source writers through final transfer/cutover, preserve the source, and prevent staging from writing production afterward. Development catalog is not launch-approved.

Starter is the legacy name for `0.5c-512mb` (0.5 CPU / 512 MB); the $7 is web-service compute, not a total database/email/storage budget. Confirm the selected plan ID in the eventual change record. [Render compute plans](https://render.com/docs/compute-plans), [pricing](https://render.com/pricing).

## Commands and environment

Native Node web service, repository root. These commands derive from `package.json`, the committed lockfile and Prisma config; **not executed here**:

| Render field / operator check | Exact command | Purpose |
| --- | --- | --- |
| Build | `npm install --global npm@11.12.1 && npm ci --include=dev && npm run build` | Pin packageManager toolchain; locked install runs postinstall `prisma generate`; build runs `next build`. Include TypeScript/Prisma tooling. |
| Paid pre-deploy | `npm run db:migrate:deploy` | Runs `prisma migrate deploy` once per deployment, after build and before activation. |
| Start | `npm run start -- --hostname 0.0.0.0 --port "$PORT"` | Runs `next start` on Render's assigned port. |
| Migration history, before and after | `node node_modules/prisma/build/index.js migrate status` | Uses repository config; inspect expected pending migrations before execution, require up-to-date afterward. |

Install/generate/build/start do **not** migrate. Do not use `db:push:dev`, `db:migrate:dev`, reset or seed against production. Paid [pre-deploy commands](https://render.com/docs/deploys#pre-deploy-command) run on a separate instance while the existing service can still run; filesystem changes there do not reach the new app. [Render port binding](https://render.com/docs/web-services#port-binding) and [Next 15 CLI arguments](https://nextjs.org/docs/15/app/api-reference/cli/next) support the start command.

Pin `NODE_VERSION`: recommend Node 24 LTS (`24.21.0` in current provider documentation) with repository `npm@11.12.1`. Engines permit it; exact candidate install/build remains unverified. CI uses 20.19.0, now EOL. No runtime/dependency/settings changes here. [Render Node selection](https://render.com/docs/node-version), [Node release status](https://nodejs.org/en/about/previous-releases).

Set names/values through the owner's private provider configuration, never in Git:

| Names | Production / staging rule |
| --- | --- |
| `NODE_ENV`, `NODE_VERSION`, `PORT` | `production` for both hosted services; explicit supported runtime; Render supplies `PORT` (normally 10000). |
| `APP_URL`, `BETTER_AUTH_URL` | Both `https://darakit.com` in production; both `https://darakit-staging.onrender.com` on the separately isolated staging service. No trailing slash. |
| `BETTER_AUTH_SECRET` | Independent production secret, at least 32 characters; retain the established production secret during routine rollback. |
| `DATABASE_URL`, `DIRECT_URL` | Set both to the same environment's database: pooled runtime URL and direct migration URL respectively. `prisma.config.ts` prefers `DIRECT_URL`; verify actual destination/history privately, not merely URL syntax. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Dedicated production database; prefixes are fixed in code, so sharing staging Redis would share counters. |
| `EMAIL_DELIVERY_MODE` | `smtp`; production validation rejects `log`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Actual authorized sender/provider settings; preserve verified receipt behavior and eight-second budget. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_PRODUCT_FOLDER` | Environment-specific access and explicit folder; avoid accidental use of the historical default folder. |
| Optional `ORDER_RECEIPT_FROM_EMAIL`, `ORDER_NOTIFICATION_EMAIL` | Receipt override only with an authorized sender; unset notification address disables optional owner notices. |
| Optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Both only if Google sign-in is approved; production callback `https://darakit.com/api/auth/callback/google`, staging callback on its own origin. |

Names match `src/env.js`; no public client variables required. Leave `SKIP_ENV_VALIDATION` unset. APP_URL controls CSRF/trusted origin and links; BETTER_AUTH_URL controls auth base URL. After approval, verify domain/TLS/DNS and `www` redirect; no current configuration inspected. Record enabled/disabled production onrender hostname: it is public ingress, not an extra allowed browser mutation origin. [Render custom domains](https://render.com/docs/custom-domains).

## Paid Render client-IP boundary

Keep strict single `CF-Connecting-IP`, mapped-IPv4 normalization, IPv6 `/64` and bounded missing-IP fallback. Render documents public-ingress header overwrite; custom/onrender domains use that ingress, including DNS-only custom records. No XFF/Host fallback or fresh DaraKit observation. [Render proxy guidance](https://render.com/articles/host-pocketbase-on-render).

Unlike Free, Starter receives private-network calls from same-workspace/same-region peers, workers and cron jobs without public Cloudflare. Port 10000 reaches the primary HTTP server even if it binds elsewhere. A caller-chosen valid CF header passes syntax validation; missing headers share the fallback. Confirm peers/private/loopback HTTP callers before upgrade. Recommend public customer ingress and no untrusted private callers; environment network blocking requires Pro workspace. Any private caller needs a scoped trust decision; no evidenced redesign here. [Render private network](https://render.com/docs/private-network).

Recommend one serving instance/Next process, no cluster. Application limits use Upstash; Better Auth 1.6.33 defaults to **process-local memory**, with no shared storage configured. Counters reset on restart and differ during deploy overlap/scale-out. Record actual process/instance count and overlap; future scaling needs review. [Better Auth storage](https://better-auth.com/docs/1.6/concepts/rate-limit#storage). Reuse local IP tests; [coordinated hosted acceptance](render-client-ip-acceptance.md) stays paused.

## Migration, backup and recovery order

1. **Before execution authorization:** identify service, candidate SHA, exact production database/history, retained-data decision, all writers and maintenance method. Preserve an identifiable reviewed R6-compatible build **plus generated client**, migration checksums, runtime and private configuration references. Current main is a candidate, not a validated R6-C artifact. Automatic deploys must not bypass this first rollout's approved sequencing.
2. **Recovery rehearsal:** reuse the completed PostgreSQL 15.17 clone backup/restore, 15-migration history, 13 reviewed nonproduction mappings/idempotence, R5/R6 15 database cases and R8 10 lock cases. Remaining evidence is target-specific backup/restore capability and a preserved R6-C artifact exercised on an explicitly approved disposable target with both historical and newly created default/named orders. Rehearse returning from a later candidate to R6-C while retaining the expanded database: labels/prices/references remain historical; cancellation restores the recorded inventory once, including inactive options and legacy variantless orders. No existing fixture approval extends to production mappings.
3. **Approved window:** enforce server-side write freeze for checkout/cart/catalog/admin and other retained-data writers, drain old writers/instances, then capture a fresh consistent backup with private history/order/inventory baselines. A frontend banner is insufficient; an enforceable maintenance/drain method is not yet verified. Store a custom-format dump outside Git/provider ephemeral app storage, check its digest and `pg_restore --list`, and restore into a separate approved recovery target to verify records/references, not only counts. Confirm provider PITR/retention if available; none is assumed for the chosen database plan.
4. **Migrate once:** pre-deploy runs the command above only against the approved target. Empty database: all 15 committed migrations. Existing database: only verified pending migrations; stop on failed history/drift. If R6 is already applied, do not replay it. The R6 migration is transactional schema expansion and removes the old clothing uniqueness index; it does **not** map existing options. Keep pre-R6 catalog writers stopped even if Render retains the old deploy after a failure.
5. **Activate compatibility app:** start the R6-compatible candidate before reopening writes; verify history/schema/generated client and preservation. Retained legacy inventory requires owner-reviewed reconciliation and an approved production execution procedure using the shared mapping logic. Existing backfill runner/config require a disposable target: never mark production disposable or bypass the guard. This procedure remains unprepared if the target needs backfill; keep unmapped inventory unavailable, preserve IDs/stock/carts, never copy legacy Product.stock automatically. Empty target needs no legacy backfill; approve real catalog separately.
6. **Recover without losing later orders:** failed rollout stays frozen and fixes forward. After new orders exist, application rollback requires validated R6-C **with cart coordination/current security/cache protections**, retaining schema, snapshots, variant IDs and stock. Never restore a stale backup over the working database or return to pre-R6 code. Database recovery requires frozen writes, preservation of the current database and reconciliation of every later order/cancellation/stock change on a separate target before switching. That reconciliation is unprepared/unauthorized; fix forward meanwhile.

See [R6 recovery contract](r6-options-rollout.md#rollback) and [executed release evidence](release-plan.md#r6-existing-data-backuprestore-and-schema-rehearsal--2026-10-02). Local backup evidence proves that rehearsal only; owner-reported Neon setup does not prove production recovery.

## Final hosted acceptance after separate authorization

- [ ] Record actual service/Starter plan, deployed SHA, runtime, origins/TLS/aliases, process/private-caller inventory and private config validation. Confirm staging is isolated and migration/backup/R6-C evidence is complete.
- [ ] Focused EN/AR/RTL purchase on approved test accounts/catalog: default/named selection, server totals/delivery, same-key replay, stock/cart behavior, order history, cancellation/restock once, customer/admin ownership. Use the actual pooled database; reuse local race/browser coverage instead of repeating the whole matrix.
- [ ] Verification/reset links use the production origin and reset revokes sessions; Cloudinary upload/display; Google and owner notices only if enabled. Reuse local mail evidence and owner-reported hosted receipt success; do not reopen Brevo setup/receipt layout. Check ordinary provider health; deliberate Redis failure checks belong on a separately approved nonproduction target.
- [x] **Hosted cache checks completed per owner**, with individual results/deployed SHA unspecified; no automatic rerun or fabricated status/header results. Separately, IP warning disappearance is symptoms only; coordinated acceptance remains **PAUSED** and R2 integration unresolved.
- [ ] Record remaining R4/R7 business/catalog/legal prerequisites and explicit release decision. Public contact is now locally corrected to +972599355107, Jerusalem fees to 35/50 ILS with other fees/free collection preserved; scoped tests pass, hosted acceptance pending. No final GO until remaining gates are satisfied or explicitly decided by the owner.

**Next action:** owner confirms service promotion/separation, data retention and private-caller/process topology; then authorize only the chosen target's configuration and recovery preparation. No deployment is performed by this planning task.
