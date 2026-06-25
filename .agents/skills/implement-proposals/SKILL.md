---
name: implement-proposals
description: Plan and implement tracked proposal items in software repositories. Use when the user asks Codex to fix or implement items from proposals.p0.md, proposals.p1.md, proposals.p2.md, proposals.feat.md, docs.updates.md, or similar proposal and documentation-update documents; decide implementation scope, clarify ambiguous requirements, coordinate subagents when useful, modify code, validate changes, and mark proposals as fixed or completed.
---

# Implement Proposals

## Required Reference

Read `rules.md` in this skill directory before selecting, planning, implementing, or updating any proposal. Treat it as the authoritative execution guide for:

- Choosing which proposal items to implement.
- Deciding when to ask the user before implementation.
- Grouping related proposal items.
- Using subagents safely.
- Validating changes.
- Updating proposal files after implementation.

When launching subagents, do not paste the full rules into their prompts. Give them the path to this skill and explicitly require them to read `rules.md` themselves before analyzing or implementing their slice.

## Purpose

Implement accepted defect fixes and feature proposals from proposal files while preserving user control over scope. The skill should prevent mechanical execution of stale, conflicting, or poorly scoped proposals, but it should also move decisively once the user has specified what to implement or confirmed the plan.

This skill is repository-agnostic. Prefer local proposal conventions when present; otherwise use common proposal files such as `proposals.p0.md`, `proposals.p1.md`, `proposals.p2.md`, `proposals.feat.md`, and `docs.updates.md`.

## Operating Modes

- **Specified proposal mode**: If the user names exact proposal ids, titles, files, or a clearly bounded subset, implement those items directly after a brief sanity check. Ask only if requirements are ambiguous, stale, risky, contradictory, or impossible to verify.
- **Unspecified proposal mode**: If the user says to fix proposals generally, review proposal files, group candidates, recommend an implementation batch, and ask the user to confirm which items to implement before editing code.
- **Discussion mode**: If the user asks to discuss, plan, evaluate, or decide first, do not edit code until the discussion has converged and the user authorizes implementation.

During implementation, do not repeatedly ask for confirmation. Continue through coding, validation, and proposal-status updates unless a genuine blocker or material scope change appears.

## Workflow

1. Read repository instructions such as `AGENTS.md`, contribution docs, and proposal conventions.
2. Read this skill's `rules.md`.
3. Locate relevant proposal files. Use `rg --files` and inspect existing numbering/status conventions before editing.
4. Build a proposal inventory: id/title, source file, status, severity/recommendation, affected area, dependencies, overlap, risk, and likely verification method.
5. Decide mode:
   - If the user specified exact items, proceed with those items after sanity checks.
   - If not specified, prepare a recommended batch and ask for confirmation before code edits.
   - If the user requested discussion, discuss until scope is clear.
6. Group related proposals. Put overlapping, dependent, or coordinated changes in the same group.
7. Decide subagent strategy:
   - If the task is simple, the main agent implements directly.
   - If there are 3 or fewer meaningful groups, subagents may investigate or design, while the main agent implements.
   - If there are more than 3 meaningful groups, propose or use subagents to own separate groups when safe; keep overlapping groups together.
8. Implement using the repository's existing architecture and conventions. Avoid compatibility layers unless necessary.
9. Validate with the strongest practical checks: targeted tests, type checks, lint, build, migrations, smoke tests, or manual verification.
10. Update proposal documents: mark completed items with strikethrough and `✅ 已修复` or `✅ 已完成`, then fill `最终修复情况`.
11. If the implementation changes or clarifies documented behavior, update `docs.updates.md` or the relevant docs according to repository convention.
12. Report files changed, proposals completed, validation results, unresolved risks, and any follow-up proposals created.

## Subagents

Use subagents for parallel analysis or implementation only when the task naturally splits into independent groups.

Subagent prompt requirements:

- State clearly: `You are a subagent. Finish with a plain text message only. Do not call question tools.`
- Provide the skill path, for example `.agents/skills/implement-proposals`, and require the subagent to read `.agents/skills/implement-proposals/rules.md`.
- Give the exact proposal group, files, and affected source areas.
- State whether the subagent is allowed to edit code or only investigate/design.
- Require final output with implemented changes, validation performed, proposal updates needed, risks, and blockers.

Default policy:

- For 3 or fewer groups, subagents should usually investigate and design only; the main agent applies changes.
- For more than 3 groups, subagents may implement separate independent groups if that improves throughput and the user has not restricted edits.
- Never split overlapping proposals across different implementing subagents.
- The main agent remains responsible for final integration, validation, proposal status updates, and user-facing reporting.

Example investigation prompt:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.

Use the implement-proposals skill at .agents/skills/implement-proposals.
Before working, read .agents/skills/implement-proposals/rules.md.

Investigate proposal group <group>. Do not edit code.
Return the implementation plan, affected files, dependencies, risks, validation strategy, and whether any user clarification is needed.
```

Example implementation prompt:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.

Use the implement-proposals skill at .agents/skills/implement-proposals.
Before working, read .agents/skills/implement-proposals/rules.md.

Implement proposal group <group>. Edit only the relevant files. Keep overlapping or uncertain work out of scope.
Return changed files, validation performed, proposal status text to write, risks, and any unresolved blockers.
```

## Final Response

Report the implemented proposal ids, files changed, validation commands and outcomes, proposal files updated, remaining risks, and any items that were skipped or need clarification. If work was completed, ask for user direction before beginning a separate implementation batch.
