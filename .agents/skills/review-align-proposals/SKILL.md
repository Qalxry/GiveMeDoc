---
name: review-align-proposals
description: Facilitate a patient conversation to review, clarify, and align AI-generated proposal files with the user's real intent before editing them. Use when the user wants to review or revise proposals.p0.md, proposals.p1.md, proposals.p2.md, proposals.feat.md, docs.updates.md, or similar tracked proposal documents; when they say proposals feel wrong, too severe, too vague, not aligned, duplicated, missing context, or need discussion; or when proposal changes should be driven by explanation, questioning, user answers, and iterative alignment rather than direct implementation.
---

# Review & Align Proposals

## Purpose

Use this skill to align proposal documents with the user's judgment, priorities, and product intent. The main output is usually revised proposal text, but the primary work is the conversation: explain, ask, listen, analyze, explain again, and only edit once the user's intent is clear enough.

This skill is for proposal curation, not implementation. Do not start fixing code unless the user separately asks for implementation.

## Core Posture

Treat AI-generated proposals as drafts, not truth. Many are technically plausible but may miss the user's taste, architecture direction, risk tolerance, or product priorities.

Your job is to help the user think. Be patient and specific. When the user gives a vague feeling such as "these feel off", do not force an immediate classification. Explain what might be off, ask one or two targeted questions, reflect the answer back, and gradually converge.

Prefer collaborative language:

- "I think this proposal may be mixing two concerns..."
- "Your discomfort might be about severity, framing, or whether this is actually a product decision."
- "Let me separate what is factual, what is interpretation, and what is a recommendation."

Avoid turning the process into a one-shot audit unless the user explicitly asks for direct normalization.

## Conversation Loop

Drive the work through repeated cycles:

1. Explain the current proposal or proposal cluster in plain terms.
2. Ask a small number of focused questions.
3. Let the user answer with feelings, examples, priorities, or concrete edits.
4. Analyze the answer and infer the underlying intent.
5. Explain the proposed alignment decision.
6. Ask for confirmation or the next refinement.
7. Edit only after enough alignment exists.

Keep each user-facing question narrow. If tool-based question UI is unavailable, ask plain-text questions directly. Do not present a large survey unless the user asks for a batch review.

## First Step

First establish the review scope. Ask the user which proposals or files to align unless they already provided enough scope.

Useful scope prompts:

- Which file or proposal IDs should we align first?
- Are you mainly worried about severity, wording, whether it is a real issue, or whether it matches your product direction?
- Should we preserve the current proposal structure and only adjust content, or are moves/deletions/new proposals allowed?

If the user already names a scope, read only that scope first. Avoid loading all proposal files unless the scope requires it.

## Reading Strategy

Use light local reading before deep research:

- Read repository instructions such as `AGENTS.md` when proposal formatting matters.
- Read the selected proposal entries and nearby entries for context.
- Read the proposal rules or existing file conventions if edits will be made.
- Use `rg` and targeted snippets instead of full-file deep dives when possible.

Do not personally perform broad codebase investigation by default. This skill is designed to preserve context for discussion. Use subagents for deeper fact-finding when a claim needs verification, when several entries need independent evidence, or when the user asks for stronger grounding.

## Subagents

Use subagents as lightweight researchers, not as conversation owners. The main agent keeps the alignment conversation with the user.

Subagent prompt requirements:

- State clearly: `You are a subagent. Finish with a plain text message only. Do not call question tools.`
- Provide the repository path and the specific proposal IDs or files to inspect.
- Ask for factual evidence, duplicate candidates, severity signals, and possible rewrite options.
- Tell the subagent not to edit files unless explicitly delegated.
- Ask the subagent to distinguish facts, interpretation, and recommendations.

Example prompt:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.

Repository: <path>
Investigate proposal <ID/title> only. Check the cited code/docs and nearby related proposals.
Return:
- Which claims are directly supported, with file/line evidence.
- Which claims are interpretation or product judgment.
- Whether this should remain, be rewritten, moved, merged, split, or deleted.
- Suggested rewrite options.
Do not edit files.
```

After receiving subagent output, summarize it for the user. Do not blindly apply it; use it as evidence in the alignment discussion.

## Alignment Decisions

For each proposal, converge on one of these outcomes:

- **Keep with wording changes**: the issue is real, but framing, evidence, severity, or fix plan needs adjustment.
- **Move**: the proposal belongs in a different severity file, `proposals.feat.md`, or `docs.updates.md`.
- **Merge or split**: the proposal duplicates another entry or combines separate concerns.
- **Delete**: the discussion shows it is not a real issue, not worth tracking, or already covered elsewhere.
- **Create new proposal**: the conversation reveals a separate issue or feature idea.
- **Defer**: the user has not decided yet, or more evidence is needed.

When recommending an outcome, state why in terms of the user's intent and the evidence, not only in terms of technical correctness.

## Editing Rules

Before editing, restate the intended change and wait for user confirmation unless the user already gave explicit permission to edit.

When editing proposal files:

- Preserve local proposal format, numbering, metadata, and status conventions.
- Do not silently delete user-authored content; summarize deletions or moves.
- Keep the user's original wording when it is important to preserve reasoning history.
- Update `最后编号` only when adding new entries.
- If moving an entry, remove it from the old file and add it to the new target with a stable new number unless the local convention supports cross-file IDs.
- If deleting an entry because it is not a real issue, consider whether a short note in the final response is enough; do not create a tombstone unless the repository convention requires it.

Never use `docs.updates.md` to hide weaker-than-spec implementation. If the implementation is weaker, use a defect proposal. Use `docs.updates.md` only for richer implementation, acceptable divergence, documentation gaps, or decisions to sync into docs.

## Question Patterns

Use questions that help uncover the user's judgment:

- "When you say this feels wrong, is the problem the claim itself, the severity, or the proposed fix?"
- "Do you want this project to optimize for strict spec compliance here, or for a simpler early-stage implementation?"
- "Is this behavior unacceptable, or should the docs be updated to bless it?"
- "Would you rather track this as a defect, a feature idea, or a product decision?"
- "What outcome would feel right after someone implements this proposal?"

Ask at most one to three questions at a time.

## Final Response

Report:

- Which proposal files were changed.
- Which entries were kept, moved, merged, deleted, or created.
- What decisions remain unresolved.
- What evidence was checked, including any subagent research.

End by asking for direction before starting a separate implementation phase.
