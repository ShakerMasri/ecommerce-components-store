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

## Production engineering standard

This is a real ecommerce application intended for production. A change is complete only when it addresses the actual requirement, preserves relevant protections, and has appropriate verification. Making an error disappear or passing mocked tests is not sufficient.

- **Fix root causes.** Trace the affected data flow before changing behavior. Do not hide failures, weaken validation, disable protections, or substitute diagnostic scaffolding for a correction. Clearly identify any mitigation, temporary workaround, or unresolved dependency.
- **Keep behavior consistent.** Related consumers must follow the same intended rules. Reuse a focused shared implementation when appropriate; avoid duplicated security or business logic that can drift.
- **Preserve security and data integrity.** Evaluate risks relevant to the changed path, including authorization, ownership, untrusted input, secrets, abuse protection, transactions, concurrency, and historical data. Do not turn every task into an unrelated full-system audit.
- **Match the real deployment.** Verify assumptions about installed libraries, proxies, providers, and environments. Use supported APIs and primary documentation. Explicitly distinguish local tests from database, provider, and hosted verification.
- **Choose the smallest complete solution.** Prefer clear, maintainable code and existing patterns. New files are justified when they create a useful responsibility boundary or meaningful tests. Avoid speculative abstractions, unnecessary configuration, diagnostic frameworks, and documentation churn. Do not sacrifice correctness merely to reduce file count.
- **Test meaningful behavior.** Cover the affected success, rejection, failure, and boundary cases. Test the actual integration between changed components where feasible. Reuse applicable passing evidence and rerun only affected checks or required gates.
- **Own completion.** Resolve routine implementation and testing issues autonomously within the authorized scope. Escalate genuine business decisions, missing external facts, and actions requiring authorization.
- **Report precisely.** Explain what was fixed, why the design is appropriate, what was verified, and what remains uncertain. Never equate a green build, passing tests, or an independent review with proof that the whole application is secure or production-ready.

## Completion

- Follow the task's acceptance tests. Use focused checks during iteration; run the required pre-merge checks once the change is ready. Never report skipped or mocked integration tests as live verification.
- Update task status/evidence in the release plan and replace the current handoff with a short summary. Keep history in Git. Report changes, checks, blockers, and the next action briefly.
