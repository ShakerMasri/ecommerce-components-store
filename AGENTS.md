# Project instructions

Darakit is an independent electronics store using Next.js App Router, TypeScript, React, Prisma/PostgreSQL, Better Auth, Upstash, and Cloudinary. Preserve bilingual English/Arabic, RTL, accessibility, and existing storefront behavior.

## Context

- At a new task, check the actual repository, branch, and working tree. Preserve unrelated edits. Read `docs/agent-handoff.md` and only the requested section plus shared acceptance rules in `docs/release-plan.md`.
- The completed frontend plan and previous handoffs are historical references. Read them only to resolve a relevant uncertainty. Verify findings against current code; avoid repeating the whole audit.

## Scope and authority

- A requested release task authorizes its scoped edits, regression tests, and routine local checks. Finish those without asking for per-file approval.
- A plan entry alone is not authorization. Ask for a concrete decision before unapproved schema/data migrations, major dependency changes, new services, destructive actions, production access, or scope expansion.
- Keep production credentials/data outside this environment. Never print or commit secrets, auth state, or private test artifacts. Disposable test data may be changed only on an explicitly identified nonproduction target.
- Commit, push, merge, and deploy only when requested. No unrelated refactors or broad formatting changes.

## Invariants

- Preserve server-side authorization, customer ownership, CSRF checks, validation, and abuse protection.
- Prices, discounts, delivery charges, and stock remain server-controlled. Preserve checkout idempotency, transactional inventory, cart identity, and historical order snapshots.
- Keep private responses out of shared caches. Use existing patterns and typed configuration; verify version-sensitive changes with primary documentation.
- Do not invent catalog/business information or disguise clothing assumptions as electronics functionality.

## Completion

- Follow the task's acceptance tests. Use focused checks during iteration; run the required pre-merge checks once the change is ready. Never report skipped or mocked integration tests as live verification.
- Update task status/evidence in the release plan and replace the current handoff with a short summary. Keep history in Git. Report changes, checks, blockers, and the next action briefly.
