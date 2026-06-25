# Distill Experience Rules

## Core Policy

- The skill's value is **filtering**, not summarizing. Most of a conversation is not worth recording. Keep the few high-signal items; drop everything obvious, trivial, unverified, or derivable from the repo.
- Draft candidates in your response first. Do not write to disk until the user confirms.
- Every candidate must pass an adversarial self-audit before it can be presented, and only confirmed ones are written.
- One fact per file. Each memory file holds one experience, not a grab-bag.
- Never record what the repo already records (code structure, past fixes, git history, `CLAUDE.md`, `AGENTS.md`). Record only the non-obvious lesson *on top of* what the repo shows.
- Link related memories with `[[slug]]` in the body. A link to a slug that does not exist yet is fine — it marks something worth writing later.
- This skill **only writes** experience. Retrieving/applying it is governed by the project memory policy in `AGENTS.md`. Do not conflate the two.

## Experience Categories

Capture material in exactly these four types. Each memory file's frontmatter `metadata.type` must be one of them.

### `pitfall` — 易踩坑细节 / counterintuitive gotchas

Small, easily-missed, hard-to-fix details that cost real time when stumbled into blind. Includes:

- Counterintuitive code behavior (the API silently returns `[]` on this version; the flag must come *before* the subcommand; the mock only takes effect if the module is re-imported).
- Environment / tool quirks (the build only succeeds after installing this `lib*`; `xvfb-run` is required for any GUI; the test hangs without `--timeout`).
- Order/sequence traps, silent no-ops, things that look like they worked but didn't.

**Worth recording when:** it cost real exploration, and a future agent would plausibly hit the same wall. **Not worth it when:** it's documented in the README, or it's a one-off that won't recur.

### `trajectory` — 最优轨迹 (non-obvious)

The optimal step sequence for completing a task — *only* when that sequence was non-obvious and was found only after exploring worse paths. The whole point of this type: the agent spent tokens exploring, finally found the winning path; record the winning path so the next agent walks it directly.

**Worth recording when:** the optimal path was discovered through trial-and-error, and at least one plausible alternative looked like it should work but didn't (or was wasteful). **Not worth it when:** the steps are sparse, ordinary, or the first thing any agent would try. If the obvious approach is also the correct one, there is nothing to record — recording it adds noise.

A trajectory memory should name the **winning steps** and briefly note **which alternatives were tried and rejected** (so the next agent does not re-explore them).

### `dead-end` — 失败方法 / 死路

Approaches that were tried and do not work, with *why* they fail. Negative knowledge is often as valuable as the positive kind — knowing "this road is closed, and here is the reason" saves a future agent from walking it again.

**Worth recording when:** the approach was plausible enough that a future agent would likely try it too, and the failure reason is non-obvious (not just "I made a typo"). **Not worth it when:** the failure is trivially self-explanatory.

### `preference` — 浮现的偏好 / 标准

User-side conventions, standards, or feedback that emerged during the task (how the user wants things named, formatted, ordered, scoped; a working-style preference; a domain standard the user enforces). This type is project-level, not routed to the user-level Claude memory — it lives in `.agents/memory/` with everything else.

**Worth recording when:** it's a durable convention that will affect future tasks in this repo, and it is not already stated in `AGENTS.md` or `CLAUDE.md`. **Not worth it when:** it's a one-task whim, or it duplicates an existing `AGENTS.md` rule.

## The Worth-Recording Gate

Before drafting, run each candidate through this gate. A candidate must clear **all** bars to survive drafting. (The self-audit in the next section is a second, harsher pass.)

| Bar | Passes if… | Fails (drop) if… |
|---|---|---|
| **Non-obvious** | A competent agent would *not* trivially arrive here; it required exploration, a trap, or a real insight. | The first thing anyone would try; or it's in the README/CLAUDE.md/AGENTS.md. |
| **Correct** | You can stand behind it as true now, with evidence from this session. | It's a guess, a "probably", or you never actually verified it. |
| **Reusable** | A future agent in this repo would plausibly hit the same situation. | A one-off tied to this exact task that won't recur. |
| **Not derivable from repo** | The lesson is on top of what code/git/docs already show. | It restates code structure, a past fix, or git history. |
| **Won't mislead** | Following it will lead a future agent *right*, not into a stale/over-specific trap. | It's over-fitted to a transient state, version, or workaround that may not hold. |

If a candidate fails any bar, drop it and say so in your response (one line: "dropped: X — reason"). Transparency about what was filtered is part of the skill.

## Adversarial Self-Audit

After the gate, re-audit each survivor **adversarially** — try to *kill* it, defaulting to "drop" if uncertain. For each survivor, answer these aloud in your response with a one-line verdict:

1. **Is it truly non-obvious?** Could a fresh agent trivially rediscover it? If yes → drop.
2. **Is it correct *now*?** Did I actually verify it this session, or am I asserting it? If unverified → drop, or fix the claim to what is verified.
3. **Will it mislead a future agent?** Is it over-fitted to a version, a transient state, a workaround, or a context that may change? If it might point a future agent wrong → either scope it tightly (name the version/condition) or drop.
4. **Is it a duplicate of existing memory or repo docs?** If yes → merge/link, don't create a new file.

Survivors get a `KEEP` verdict with the reason. Killed ones get `DROP` with the reason. Only `KEEP` survivors reach the user-confirmation step.

## Deduplication

Before presenting survivors:

- Read `.agents/memory/MEMORY.md` (if it exists) and scan existing `*.md` files by slug, title, and keywords.
- If a near-duplicate exists → propose updating/extending that file instead of creating a new one. State the existing file path.
- If an existing entry is related but not identical → link to it with `[[slug]]` in the new memory's body and mention the relationship.
- If duplicate handling needs a judgment call → flag it to the user in the confirmation step.

## Memory File Format

Each memory is one file under `.agents/memory/<slug>.md`. Slug rules: lowercase, kebab-case, no slashes, short and descriptive (`apt-lib-for-electron-build`, `trajectory-run-electron-skill`, `dead-end-mock-without-reimport`). The slug must equal the frontmatter `name:`.

### Frontmatter schema

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary — used to decide relevance during recall; include the symptom or the winning move>
metadata:
  type: pitfall | trajectory | dead-end | preference
  captured: YYYY-MM-DD
  source: <where this came from — e.g. "session 2026-06-26", "task: <short task name>", or a transcript/PR reference>
---
```

- `description` is the recall key. Put the **symptom** (for pitfalls/dead-ends) or the **winning move** (for trajectories) in it, in the words a future agent would search.
- `captured` is the date the experience was distilled (use the session's current date).
- `source` gives traceability back to where it was learned.

### Body

The body is prose, not just a title. Structure depends on type but should always be actionable:

- **pitfall / dead-end**: the symptom → the cause → the fix/workaround (or, for dead-end, why it fails and what to do instead). Include the exact command/snippet that worked.
- **trajectory**: the winning step sequence → which alternatives were tried and rejected (one line each) → why the winner won. Be concrete (commands, file paths, order).
- **preference**: the convention → why it exists → how to apply it. Link to related memories with `[[slug]]`.

Keep each file focused and skimmable. Link liberally; a `[[slug]]` to a not-yet-written memory is fine.

### Template

```markdown
---
name: <slug>
description: <one-line summary with the symptom or winning move>
metadata:
  type: pitfall
  captured: 2026-06-26
  source: <session or task reference>
---

<Body: for a pitfall — symptom, cause, the exact fix that worked. For other types, see rules above. Link related memories with [[slug]].>
```

## Index Update

`.agents/memory/MEMORY.md` is the index — one line per memory, loaded into context when an agent reads it (per the `AGENTS.md` memory policy). After writing a confirmed memory file, append one line:

```
- [Title or one-line hook](<slug>.md) — <type> · <one-line symptom/winning move>
```

Keep index lines to one line each. Do not put memory content in the index. If the file did not exist, create it with a one-line header (e.g. `# Project Memory`) then the index entries.

## The Confirm-Then-Write Flow

You are the main agent interacting with the user. Per `AGENTS.md`, discuss before acting when the request is non-trivial. Distillation is non-trivial — follow this flow:

1. **Draft + self-audit + dedup** as above, all in your response (nothing on disk yet).
2. **Present** to the user: for each survivor, show the proposed `name`, `type`, `description`, one-line audit verdict (`KEEP: reason`), and proposed file path. Group killed candidates separately as "dropped: reason".
3. **Ask the user** to confirm which survivors to write (use the environment's question tool, or the `AGENTS.md` Markdown fallback question format if unavailable). Let the user edit, drop, or add.
4. **Write only the confirmed ones.** Create each memory file and append its index line to `.agents/memory/MEMORY.md`.
5. **Report**: what was written (file paths + index lines), what was dropped (gate-failures and self-audit kills, with reasons), and any items the user deferred.

If the user says "just write them all" after seeing the draft, that counts as confirmation — write the survivors.

## What Not to Record

- Anything you did not run / verify this session.
- Lessons fully derivable from code, git history, `CLAUDE.md`, `AGENTS.md`, or the README.
- Ordinary task steps that any agent would try first.
- Transient states, workarounds, or version-specific behavior presented as timeless fact — either scope them tightly (name the version/condition) or omit them.
- Anything only meaningful to this exact conversation and not reusable.

## Final Response

After writing, the final response should include:

- The list of written memories: file paths, slugs, types, one-line descriptions.
- The index lines appended to `.agents/memory/MEMORY.md`.
- What was filtered out and why (gate failures + self-audit kills).
- Any duplicates found and how they were handled (merged / linked / new).
- Any unresolved items deferred to a later distillation.
- A note that retrieval/application of these memories is governed by the `AGENTS.md` memory policy — this skill only writes.
