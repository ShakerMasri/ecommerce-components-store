# Agent instructions

## Start and scope

- Read `docs/agent-handoff.md`, then the relevant checkpoint in `docs/electronics-plan.md`. Do not reload legacy clothing prompts unless a specific unresolved requirement needs them.
- Confirm the working directory, branch and working-tree changes once before editing; preserve unrelated user edits.
- This is an independent electronics components store. Preserve Next.js App Router, strict TypeScript, React, Prisma/PostgreSQL, existing integrations and application behavior. Avoid major structural changes, speculative abstractions and unjustified `any`.
- Reuse existing components, design patterns and typed public configuration. Edit accessible files directly; request only missing inputs.

## Autonomy

- An authorized checkpoint includes routine local edits, related fixes, documentation updates and safe checks. Keep implementation, fixes and verification in the same session without per-file or small-change confirmations.
- Honor existing explicit approvals within their scope. Proposals are not approvals.
- Ask before unapproved destructive operations, production access, deployment, pushing/merging, schema changes (including applying migrations), business-logic changes, new services, significant dependencies or major scope expansion.
- Before asking, prepare a concrete proposal: exact action and target, reason, impact, validation and rollback where relevant. Do permitted preparation first.

## Security and product boundaries

- Preserve server-side authentication, authorization, customer ownership, input validation, CSRF protection, rate limiting, upload checks and safe caching. Hiding controls never replaces enforcement.
- Keep pricing, discounts, totals, stock and variant availability server-controlled. Preserve cart item identity, checkout idempotency and historical order snapshots, including delivery charges and variant details.
- Keep production secrets/data outside the agent-accessible development environment. `.gitignore` does not prevent agent access. Never print, commit or upload secrets; use sanitized diagnostics and nonproduction test data. Public configuration must contain no secrets.
- Preserve English/Arabic, RTL, accessibility and mobile usability.
- Use original code/assets or verified commercial-use permissions, retaining required notices. Check official documentation when version-specific details matter.
- Report functional clothing assumptions separately; never disguise them with misleading labels or fabricated data. Do not advertise unsupported features or equate visual completion with production readiness.

## Efficient execution

- Read relevant files and search narrowly with `rg`; avoid repeated repository audits, full scans and large log dumps. Reuse recorded findings unless stale, contradicted or insufficient for the current task.
- Use existing scripts and checks appropriate to the change. Repeat checks when a fix or remaining risk justifies it. Avoid unnecessary test scaffolding for minor styling; never reduce necessary security checks to save tokens.
- Distinguish reported results from checks actually run, and passed from skipped or blocked. Never invent results.
- Update the plan and handoff at meaningful checkpoint boundaries or handover: checkpoint status in the plan; evidence, blockers and next action in the handoff. Keep durable rules here.
- Keep responses brief: changes, verification, blockers and next action.
