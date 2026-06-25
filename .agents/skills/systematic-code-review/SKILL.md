---
name: systematic-code-review
description: Systematic review and proposal workflow for software repositories. Use when the user asks Codex to review code against PRD/spec/docs, audit a newly written codebase, find logic errors, implementation drift, security or reliability risks, fake/simple/lazy implementations, coordinate parallel subagents, write findings to proposals.p0.md/proposals.p1.md/proposals.p2.md, write feature ideas to proposals.feat.md, and record richer implementation or documentation differences in docs.updates.md.
---

# Systematic Code Review

## Required Reference

Read `rules.md` in this skill directory before writing or requesting any proposal output. Treat it as the authoritative format and style guide for:

- `proposals.p0.md`
- `proposals.p1.md`
- `proposals.p2.md`
- `proposals.feat.md`

When launching subagents, do not paste the full rules into their prompts. Give them the path to this skill and explicitly require them to read `rules.md` themselves before producing findings.

## Purpose

Perform a rigorous, repository-agnostic review of a codebase against its PRD, specs, architecture docs, tests, and professional engineering expectations. This skill is especially suited to projects that have just been implemented from 0 to 1 and need a broad correctness, completeness, and quality audit.

Accept implementation choices that are genuinely richer or equivalent to the spec. Reject fake, placeholder, oversimplified, or lazy implementations that avoid the required behavior. Produce durable proposal documents that the user can track and fix later.

## Core Review Standard

Classify every discrepancy carefully:

- **Richer implementation**: equivalent or stronger behavior than the PRD/spec requires, such as extra protocol support, additional fields, stronger validation, better persistence, more complete state handling, stricter authorization, or a cleaner equivalent design. Do not treat this as a defect unless it creates risk. Record meaningful richer deviations in `docs.updates.md`.
- **Lazy implementation**: code that appears complete but skips required complexity, such as stubs, no-op methods, fake adapters, hard-coded success, TODO/FIXME placeholders, in-memory substitutes for required persistence, disabled authorization, incomplete state machines, ignored edge cases, swallowed errors, weak validation, or simplified routing/security/patch/memory behavior. Treat this as a defect.
- **Spec drift**: code that differs from the spec without being clearly richer or equivalent. File it as a defect unless the implementation is demonstrably preferable; if preferable, record it in `docs.updates.md`.
- **Improvement opportunity**: design, UX, architecture, observability, testing, or product capability that is not strictly required by the current spec but would materially improve the project. Record as `proposals.feat.md` when it is feature-oriented, or as P2 when it is a maintainability/reliability review item.

## Workflow

1. Read repository instructions first: `AGENTS.md`, contribution guides, existing proposal files, and project-specific output rules.
2. Read this skill's `rules.md` and follow it for all proposal files.
3. Inventory the repository with fast tools such as `rg --files`, package/config files, source roots, tests, migrations, docs, and CI/build scripts.
4. Identify the authoritative requirements. Prefer PRD/spec/docs when present; otherwise infer expectations from README, tests, API contracts, schemas, issue text, and user instructions.
5. Avoid over-exploring alone. For large repositories, launch parallel subagents early, up to 6, and divide work by independent slices.
6. Ask subagents to read `rules.md` and produce proposal-ready findings in that format, plus `docs.updates.md` and feature-proposal candidates when relevant.
7. Perform a coordinator pass over cross-cutting concerns: architecture boundaries, state transitions, persistence, migrations, auth/permissions, validation, concurrency, failure handling, data loss, API compatibility, security, observability, and test coverage.
8. Merge subagent output. Deduplicate, verify severe claims directly, normalize severity, and discard unsupported findings.
9. Write review findings into `proposals.p0.md`, `proposals.p1.md`, and `proposals.p2.md` by severity.
10. Write feature ideas or product enhancements into `proposals.feat.md`.
11. Write richer or intentionally different implementation or documentation behavior into `docs.updates.md`. Never use `docs.updates.md` to excuse behavior weaker than the docs/spec.
12. If you fix a proposal in the same task, mark it complete with strikethrough and `✅ 已修复` or `✅ 已完成`, then fill the final implementation section.

## Parallel Subagents

Use multiple subagents when the repository is large, cross-domain, or impossible to audit thoroughly in one pass. Use up to 6 subagents when there are enough independent areas.

Common slices:

- Requirements/spec coverage and implementation mapping.
- Core domain types, schemas, storage, migrations, and persistence.
- API, routing, auth, permissions, validation, and error handling.
- Background jobs, execution engines, state machines, adapters, integrations, and external tools.
- Frontend, UX flows, client state, accessibility, and API integration.
- Tests, build, CI, security, observability, and operational risks.

Subagent prompt requirements:

- State clearly: `You are a subagent. Finish with a plain text message only. Do not call question tools.`
- Provide the skill path, for example `.agents/skills/systematic-code-review`, and require the subagent to read `.agents/skills/systematic-code-review/rules.md`.
- Give the specific slice and relevant docs/files to inspect.
- Require the same review standard: richer implementation is acceptable and should be recorded; lazy implementation is unacceptable.
- Require proposal-ready Markdown using `rules.md`, not loose notes.
- Require feature ideas for `proposals.feat.md` when the subagent sees valuable product or engineering opportunities.
- Require `docs.updates.md` candidates for richer or intentionally divergent implementations or documentation gaps.

Example subagent prompt:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.

Use the systematic-code-review skill at .agents/skills/systematic-code-review.
Before reviewing, read .agents/skills/systematic-code-review/rules.md and follow its proposal format exactly.

Review <slice> against the available PRD/spec/docs and the implementation. Accept richer equivalent implementations, but flag fake/simple/placeholder/lazy behavior as defects.

Return:
- P0/P1/P2 proposal-ready findings using the format in rules.md.
- Feature proposal candidates for proposals.feat.md using the format in rules.md.
- docs.updates.md candidates for richer or intentionally different implementation choices or documentation updates.
- Test gaps and any areas you could not inspect.
```

## Severity And Recommendation Guide

- **P0**: correctness, data loss, security, authorization, persistence, state-machine, execution, or migration failures that can break core product behavior or violate explicit critical requirements.
- **P1**: important implementation drift, incomplete required behavior, reliability/concurrency failures, missing validation, broken integration paths, or missing tests around core flows.
- **P2**: lower-risk maintainability issues, unclear behavior, weak diagnostics, edge-case gaps, non-critical spec inconsistencies, or engineering improvements.
- **Feature proposal**: new user-facing capability, major internal platform capability, workflow improvement, automation, observability productization, or an enhancement that is better tracked as planned work than as a defect.

When uncertain, choose the lower defect severity unless the failure can corrupt data, bypass permissions, execute unintended work, expose secrets, or make a core workflow unusable.

## `docs.updates.md`

Record implementation choices, documentation gaps, or intentional behavior differences that should be synchronized into PRD, specs, README, API docs, configuration docs, architecture docs, or user guides. Include:

- Audit date.
- Sequential update id.
- Related source document and section, if any.
- Code locations.
- Description of the richer, different, or undocumented behavior.
- Reason it is acceptable, preferable, or needs documentation.
- Recommended target document update.
- Whether the formal docs should be updated, clarified, or left as implementation detail.

Do not record lazy or weaker behavior here. If implementation falls short of the spec, create a P0/P1/P2 proposal.

## Final Response

Report updated files, count of P0/P1/P2 findings, count of feature proposals, count of `docs.updates.md` entries, validation performed, and any areas not fully reviewed. Keep the final response concise and ask for direction before beginning a separate implementation phase.
