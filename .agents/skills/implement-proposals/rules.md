# Implement Proposals Rules

## Scope Selection

Use these rules before editing code:

- If the user specifies proposal ids, titles, files, or a clearly bounded subset, implement that scope directly after checking that the proposal still applies.
- If the user does not specify which proposals to implement, inventory the proposal files, recommend a batch, and ask the user to confirm the scope before editing code.
- If the user asks to discuss, compare, evaluate, or plan, do not edit code until the user confirms implementation.
- If any proposal is ambiguous, stale, contradictory, risky, or requires a product decision, ask the user before implementing that proposal.
- Once implementation begins, do not ask for routine confirmations. Continue through coding, validation, and proposal updates unless there is a genuine blocker or material scope change.

## Proposal Inventory

When reading proposals, capture:

- Proposal id or inferred number.
- Source file: `proposals.p0.md`, `proposals.p1.md`, `proposals.p2.md`, `proposals.feat.md`, `docs.updates.md`, or another local proposal/update document.
- Title and status.
- Severity or recommendation level.
- Affected modules and likely files.
- Dependencies and overlaps with other proposals.
- Whether the proposal is still valid.
- Whether the recommended fix is still reasonable.
- Validation strategy.

Prefer fixing already accepted proposal items over inventing new work. If implementation reveals a new defect or feature idea, add a new proposal instead of silently expanding scope.

## Grouping Rules

Group proposals before implementation:

- Put overlapping proposals in the same group.
- Put dependency chains in the same group unless a dependency can be finished and validated independently.
- Put proposals touching the same state machine, schema, authorization boundary, migration, or public API in the same group.
- Split unrelated proposals by module or workflow.
- Keep very risky or unclear proposals separate so they can be discussed or deferred.

Subagent strategy:

- If the work is simple, the main agent implements directly.
- If the grouped work has 3 or fewer groups, subagents should usually investigate/design only, and the main agent implements.
- If the grouped work has more than 3 groups, subagents may each own one independent implementation group when this improves throughput.
- Do not let different implementing subagents modify overlapping files or tightly coupled behavior without a clear coordinator plan.

## Reasonableness Check

Before implementing a proposal, verify:

- The issue or feature still exists in the current code.
- The proposal is not already completed.
- The proposed solution matches the current architecture.
- There is no cleaner fix that better matches repository conventions.
- The change does not require hidden product decisions.
- The change does not add unnecessary compatibility complexity.
- The validation path is realistic.

For early-stage projects, prefer clean direct fixes over compatibility-preserving patches unless the repository clearly requires backward compatibility.

## User Questions

Ask before implementation when scope is not specified, when discussion is requested, or when a material decision is required.

If the environment provides `vscode_askQuestions`, `request_user_input`, or an equivalent structured question tool, use it when available and appropriate. If no such tool is available, use this Markdown fallback:

```markdown
> **Q{No}. {问题短标题}**
> {详细的问题内容，包含必要的背景信息、分析等，以便用户理解并做出准确回答。}
> **A1. {选项标题}**: {详细回答内容}（{陈述利弊和推荐等级1-5颗⭐}）
> **A2. {选项标题}**: {详细回答内容}（{陈述利弊和推荐等级1-5颗⭐}）
> **A{No}**: 请输入
>
> {补充说明和建议。}
```

For unspecified proposal batches, ask for a concrete implementation scope. Include:

- Recommended batch.
- Items intentionally deferred.
- Grouping rationale.
- Main risks.
- Validation plan.

## Implementation Rules

- Respect existing repository instructions and coding style.
- Keep edits scoped to the selected proposals.
- Do not revert unrelated user changes.
- Prefer repository-local helpers and patterns over new abstractions.
- Add or update tests in proportion to risk.
- Update docs or specs when behavior changes, and record deferred documentation work in `docs.updates.md`.
- Avoid fake, stub, no-op, or partial implementations that merely satisfy surface tests.
- If a proposal's recommended fix is worse than an alternative, implement the better solution and explain the divergence in `最终修复情况`.

## Validation

Run the strongest practical checks for the changed area:

- Unit tests for changed modules.
- Integration or end-to-end tests for workflow changes.
- Type checking and linting for typed projects.
- Build commands for frontend or packaged artifacts.
- Migration/schema validation for storage changes.
- Manual smoke tests when automated coverage is missing.

If validation cannot be run, state why and describe residual risk.

## Proposal Status Updates

After successful implementation:

- In `proposals.p0.md`, `proposals.p1.md`, or `proposals.p2.md`, mark completed review findings with strikethrough and `✅ 已修复`.
- In `proposals.feat.md`, mark completed feature proposals with strikethrough and `✅ 已完成`.
- Fill `### 最终修复情况` with what actually changed, including deviations from the original recommendation.
- Preserve existing numbering and headings.
- Update last audit date and last id fields only when the local file convention uses them.
- If only part of a proposal is implemented, do not mark it complete. Write a partial implementation note and list remaining work.

## `docs.updates.md` Updates

Use `docs.updates.md` for documentation synchronization work that is discovered or created while implementing proposals. This file is broader than a spec-only update log: it can cover PRD, specs, README, API docs, config docs, architecture docs, operational docs, and user-facing docs.

Add or update an entry when:

- Implementation intentionally differs from current docs and the code behavior is acceptable.
- A proposal implementation changes public behavior, configuration, schema, API, workflow, or architecture.
- Existing docs are incomplete, stale, misleading, or too narrow for the implemented behavior.
- The docs should record a richer implementation rather than treating it as a defect.

Do not use `docs.updates.md` to hide incomplete implementation. If code is weaker than the documented requirement, keep or create a P0/P1/P2 proposal.

Each entry should include:

- Stable id such as `DU-01`.
- Audit date.
- Related source docs and sections.
- Related code/proposal locations.
- Current documented behavior.
- Actual implementation or desired documentation change.
- Recommended target docs to update.
- Status: `待同步`, `已同步`, `无需同步`, or `需要决策`.

Example completed review proposal title:

```markdown
## ~~🔴 1. 修复权限检查绕过问题~~ ✅ 已修复
```

Example completed feature proposal title:

```markdown
## ~~🟡 3. 增加任务执行历史筛选能力~~ ✅ 已完成
```

## Final Report

Include:

- Proposal ids completed.
- Proposal files updated.
- `docs.updates.md` entries updated, if any.
- Important code files changed.
- Validation commands and outcomes.
- Behavior or spec changes.
- Proposals skipped or deferred.
- Remaining risks or follow-up proposals.
