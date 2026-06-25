---
name: distill-experience
description: Distill reusable experience (pitfalls, optimal task trajectories, dead-ends, emergent preferences) from the current conversation into the project memory store at `.agents/memory/`. Use when the user asks to 总结经验 / 记下这次的经验 / distill / capture lessons learned / 把刚才的踩坑或方法记下来 / 提炼经验沉淀; after finishing a task that involved real trial-and-error or non-obvious gotchas; or when the user wants to persist what was learned so a future agent does not pay the same exploration cost. Drafts candidates, adversarially self-audits each (truly non-obvious? correct? will it mislead a future agent?), drops the unqualified ones, presents survivors for user confirmation, and writes only the confirmed ones.
---

# Distill Experience

## Required Reference

Read `rules.md` in this skill directory before distilling anything. It is the authoritative execution guide for:

- Which experience categories to capture and what each one means.
- The worth-recording gate that filters out obvious/trivial knowledge.
- The adversarial self-audit every candidate must pass before it can be written.
- The file format, frontmatter schema, slug rules, and `.agents/memory/MEMORY.md` index update rules.
- The dedup-against-existing-memory check.
- The confirm-then-write flow with the user.

Do not write any memory file until you have read `rules.md`.

## Purpose

Turn the non-obvious parts of the current conversation into durable, reusable project knowledge so a future agent (or human) does not pay the same exploration cost again. The skill's value is **filtering**, not summarizing: most of a conversation is not worth recording. The point is to keep the few high-signal items — the gotcha that cost an hour, the method that only became obvious after several wrong attempts, the approach that silently failed — and to drop everything obvious, trivial, or speculative.

This skill **only writes** experience. Reading and applying existing experience is governed by the project memory policy declared in `AGENTS.md` (read `.agents/memory/MEMORY.md` at the start of a task and pull relevant entries). Do not use this skill to retrieve or apply experience.

## When to Use

- A task is done (or a hard sub-problem is solved) and the conversation contains real lessons worth keeping.
- The user explicitly asks to summarize/dry-distill/capture the experience of this session.
- You (the agent) notice mid-task that something non-obvious just happened and want to flag it for distillation at the end.

## When Not to Use

- The conversation is routine: no surprising failure, no explored-then-found path, no emergent preference. Recording the ordinary creates noise.
- You are only being asked to *retrieve or apply* existing experience (use the `AGENTS.md` memory policy instead).
- The lesson is fully derivable from the code, git history, or existing docs — memory should not duplicate what the repo already records.

## Procedure (summary — see `rules.md` for the full flow)

1. **Review** the current conversation context for distillable material across the four categories.
2. **Draft** candidate experiences, one idea per candidate, in your response (not yet written to disk).
3. **Self-audit** each candidate adversarially: drop ones that are obvious, unverified, derivable from the repo, or likely to mislead. Keep the survivors with a one-line audit verdict each.
4. **Dedup** survivors against existing `.agents/memory/` entries; merge or link instead of duplicating.
5. **Present** survivors to the user for confirmation, with the audit verdict and proposed file path for each.
6. **Write** only the confirmed ones: create the memory file, append the index line to `.agents/memory/MEMORY.md`.
7. **Report** what was written, what was dropped and why, and any unresolved items.

See `rules.md` for the exact memory-file template, frontmatter schema, slug conventions, and the full self-audit checklist.
