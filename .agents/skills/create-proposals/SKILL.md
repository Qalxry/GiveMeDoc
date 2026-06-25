---
name: create-proposals
description: Create tracked proposal entries for software repositories. Use when the user asks Codex to turn ideas, bugs, review notes, TODOs, errors, feature requests, implementation/documentation drift, or product discussions into proposals.p0.md, proposals.p1.md, proposals.p2.md, proposals.feat.md, docs.updates.md, or similar local proposal files; investigate when needed, deduplicate existing entries, classify severity or recommendation, assign the next id, and write the proposal without starting implementation.
---

# Create Proposals

## Required Reference

Read `rules.md` in this skill directory before creating or updating proposal entries. Also read the repository's own proposal and documentation-update conventions, especially `AGENTS.md` when present.

This skill creates and updates proposal records only. Do not start implementation after creating a proposal; report what was created and stop.

## Purpose

Turn user ideas, bug reports, review observations, code/documentation drift, TODOs, errors, and product discussions into durable, well-classified proposal entries.

This skill should write to the appropriate repository proposal file rather than only drafting text in chat. It should classify the entry itself, investigate when useful, deduplicate before writing, and maintain stable numbering.

## Proposal Targets

Use local conventions when available. Common targets are:

- `proposals.p0.md` for critical defects.
- `proposals.p1.md` for important defects or implementation gaps.
- `proposals.p2.md` for lower-risk defects, maintainability issues, or minor improvements.
- `proposals.feat.md` for feature proposals and product/engineering capability ideas.
- `docs.updates.md` for documentation synchronization, implementation/documentation drift, or docs clarification items.

## Workflow

1. Read repository instructions and this skill's `rules.md`.
2. Understand the user request and preserve the user's original wording when relevant.
3. Classify the entry: P0, P1, P2, feature proposal, docs update, or a combination that needs separate entries.
4. Investigate according to proposal type:
   - For defects and docs updates, prefer deeper investigation and use subagents when helpful.
   - For feature proposals, run the feature-proposal prewriting flow below before writing, unless the request is already a small, concrete, implementation-ready proposal.
5. Deduplicate against existing proposal files and `docs.updates.md`. If a near-duplicate exists, update or extend the existing entry instead of creating a duplicate, unless the user explicitly wants a separate proposal.
6. Determine the next id from `最后编号` or existing entry ids.
7. Write the entry to the correct file using the repository's format.
8. Update file metadata such as last audit date and last id when the local file convention uses them.
9. Report what was created or updated, where it was written, and any unresolved questions. Do not offer to implement unless the user asks.

## Feature Proposal Prewriting Flow

Feature proposals need an explicit thinking and alignment step. When the user asks an open-ended feature question, asks for architectural judgment, or proposes several possible directions, do not collapse that discussion straight into a file edit.

Before writing a non-trivial feature proposal:

1. Restate the product intent and any assumptions.
2. Brainstorm at least two viable approaches, including tradeoffs.
3. Recommend one direction with a clear rationale.
4. State what would be written: target file, tentative title, scope, and any important unresolved decision.
5. Ask for confirmation when the chosen product direction, scope, or workflow policy is still genuinely ambiguous. If the user already gave a clear direction or explicitly asked to create the proposal now, proceed after briefly showing the recommendation.

The final proposal entry should preserve this reasoning: include the user's original wording and either a dedicated comparison section or a clear comparison inside the recommended implementation section.

## Subagents

Use subagents for investigation when classification or evidence requires more than a small local check.

Subagent prompt requirements:

- State clearly: `You are a subagent. Finish with a plain text message only. Do not call question tools.`
- Provide the skill path, for example `.agents/skills/create-proposals`, and require the subagent to read `.agents/skills/create-proposals/rules.md`.
- Give the specific investigation scope.
- Ask for evidence, likely classification, duplicate candidates, affected files, and proposal-writing inputs.
- Do not ask subagents to write proposal files unless the main agent explicitly delegates that edit.

Example investigation prompt:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.

Use the create-proposals skill at .agents/skills/create-proposals.
Before investigating, read .agents/skills/create-proposals/rules.md.

Investigate whether <issue/request> should become a proposal. Check relevant code/docs and existing proposals for duplicates.
Return classification, evidence, affected files, duplicate candidates, recommended target file, severity/recommendation, and key text that should appear in the proposal. For feature proposals, also return product intent, candidate approaches, tradeoffs, recommended direction, and unresolved decisions.
Do not edit files.
```

## Final Response

Report created or updated entries, target files, assigned ids, duplicate handling, investigation performed, and any unresolved ambiguity. Stop after proposal creation; implementation belongs to a separate skill or request.
