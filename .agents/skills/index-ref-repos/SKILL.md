---
name: index-ref-repos
description: Index and maintain local reference repository collections such as ref_repos/, references/repos/, third_party_repos/, or similar directories. Use when Codex needs to create or update INDEX.md, INDEX.REPO.{repo-slug}.md, and INDEX.TOPIC.{topic-slug}.md files that explain what each reference repository contains, how its architecture works, what files/directories/commands/agents/skills are worth reading, which topics it informs, and how future agents should explore the collection. Supports initial indexing, incremental indexing of newly added local repos, manual refresh of explicitly named repo indexes, and topic aggregation without Git synchronization or automatic stale checks.
---

# Index Ref Repos

## Purpose

Build a durable Markdown index for a local collection of reference repositories. The index should help humans and future agents answer:

- Which reference repo should I inspect for this kind of task?
- What is the architecture and workflow of that repo?
- Which files, directories, commands, agents, skills, plugins, scripts, or docs are the best reading entry points?
- Which cross-repo topics already have useful references?
- Which repos were added but not yet indexed?

Do not turn this into a mirror-management or Git-sync workflow. Once a repo has a repo index, treat it as stable unless the user explicitly asks to refresh it.

## Required Reference

Read [index-format.md](index-format.md) before creating or refreshing index files. Use `scripts/create_index_template.py` to create empty index files from `templates/*.md` before filling them, unless the target project already has equivalent templates.

## Index Files

Use this file family in the reference repo directory:

- `INDEX.md`: root entry point with repo status and exploration strategy.
- `INDEX.REPO.{repo-slug}.md`: architecture-oriented index for one reference repo.
- `INDEX.TOPIC.{topic-slug}.md`: cross-repo topic directory and, when needed, comparison.

Use uppercase `INDEX`, `REPO`, and `TOPIC`; use lowercase slug names.

## Required Mode Selection

Before repository scanning, subagent delegation, template creation, or file edits, the main agent must confirm the execution ownership mode with the user unless the user's request explicitly names one of the modes below. If the environment provides a question tool, ask with that tool. If no question tool is available, ask in plain text using the host project's question format and wait for the answer.

Ask for both operation mode and execution ownership mode when either is unclear. After the user answers, state both selections before work begins:

```text
Operation mode: <scan|create-root|create-repo|refresh-repo|create-topic|refresh-topic>
Execution ownership mode: <master-only|explorer-notes|repo-index-workers|topic-synthesis>
Editable files: <explicit paths or file families>
```

Operation modes:

- `scan`: inspect repo/index coverage only.
- `create-root`: create or fill `INDEX.md`.
- `create-repo`: create missing `INDEX.REPO.*.md` files.
- `refresh-repo`: refresh explicitly named existing repo indexes.
- `create-topic`: create or fill `INDEX.TOPIC.*.md`.
- `refresh-topic`: deepen or compare an explicitly named topic index.

Execution ownership modes:

| Mode | Who researches | Who writes `INDEX.REPO.*.md` | Who writes `INDEX.md` | Who writes `INDEX.TOPIC.*.md` | Use when |
|---|---|---|---|---|---|
| `master-only` | Main agent | Main agent | Main agent | Main agent | Small or sensitive tasks where consistency matters more than parallelism. |
| `explorer-notes` | Read-only explorer subagents, one per repo when useful | Main agent | Main agent | Main agent | Broad research where subagents should gather evidence but final wording stays centralized. |
| `repo-index-workers` | Worker subagents, one per repo | Assigned worker, only for its own `INDEX.REPO.{repo}.md` | Main agent | Main agent | Multiple independent repo indexes where each repo file can be written in parallel. |
| `topic-synthesis` | Read-only explorer subagents, usually one per repo/topic slice | Main agent only if repo indexes are also requested | Main agent | Main agent | Cross-repo topic comparison where topic judgment must stay centralized. |

Recommended default when the user is unsure: `repo-index-workers` for creating or refreshing more than one repo index; `explorer-notes` for topic work; `master-only` for one repo or small updates.

## Workflow

1. **Confirm modes first** using Required Mode Selection.
2. **Locate the collection**: default to `ref_repos/` when present. Otherwise infer from the user request.
3. **Declare the selected modes before doing research or edits**. If the request includes multiple operation modes, state the sequence and which files may be edited.
4. **Scan locally** using shell commands such as `find`, `rg`, `ls`, and `sed`. Do not require Git remote synchronization.
5. **Compare repos to indexes**:
   - `missing`: local repo directory exists but `INDEX.REPO.{slug}.md` is missing.
   - `indexed`: local repo directory and matching repo index both exist.
   - `orphaned`: `INDEX.REPO.{slug}.md` exists but the repo directory is absent.
6. **Create templates first**: before writing a root, repo, or topic index, run `scripts/create_index_template.py` to create the Markdown skeleton, then fill it. In `repo-index-workers` mode, the main agent may create empty repo templates before delegating, or instruct each worker to create only its assigned repo template.
7. **Index new repos incrementally**: create `INDEX.REPO.*.md` only for missing repos unless the user asks for a broader pass.
8. **Refresh only on request**: if a repo index exists, do not reread or rewrite it unless the user explicitly asks to refresh that repo.
9. **Apply the selected execution ownership mode**. Keep subagent write scopes disjoint and explicit.
10. **Update `INDEX.md`** after adding repo indexes so the root status and exploration strategy stay useful.
11. **Update topics selectively**: create or update `INDEX.TOPIC.*.md` only for topics the user cares about or when a new repo clearly belongs to an existing topic.

## Repo Index Expectations

`INDEX.REPO.*.md` uses a multi-layer template designed for both quick scanning and deep understanding:

1. **Speed layer** (速查卡片): one-liner positioning, tech stack, size stats, license, dependencies, platform bindings, and directory tree. Lets an agent decide relevance in 30 seconds.
2. **Value and philosophy layer**: why the repo matters, its design philosophy, core principles, key architectural decisions (with evidence), and implicit conventions.
3. **Architecture layer**: module relationship diagram (Mermaid), per-layer responsibilities, and a capability inventory (skills/commands/agents/hooks/plugins as structured tables).
4. **Workflow and patterns layer**: core workflows with trigger conditions, gate/validation points, and output artifacts; design patterns with code evidence and portability assessment.
5. **Reading guide layer**: prioritized reading entries (🔴 must-read / 🟡 recommended / 🟢 optional).
6. **Project value layer**: directly reusable assets, adaptable ideas, parts to avoid, and concrete actionable suggestions for the current project.
7. **Frontier layer**: unexplored directions with investigation targets and expected outputs; low-confidence areas with re-investigation triggers.

Do not force a fixed number of entries in any section. If the useful material is concentrated in a directory, command set, agent group, plugin, or workflow, index that unit directly. Sections like the capability inventory should omit sub-sections that don't apply to the repo (e.g., skip Hooks if the repo has no hooks).

## Topic Index Expectations

`INDEX.TOPIC.*.md` uses a comparison-driven structure:

1. **Topic positioning**: definition, boundary, usage scenarios, and distinction from adjacent topics.
2. **Cross-repo comparison matrix**: structured table comparing implementations across repos on dimensions relevant to the topic (core abstractions, implementation approach, complexity, portability, documentation quality, test coverage, etc.).
3. **Per-repo deep analysis**: for each related repo, provide implementation overview, design tradeoffs, code evidence, and noteworthy details. Tag relevance as 🔴 core / 🟡 valuable / 🟢 peripheral.
4. **Recommended reading order**: sequenced from simple-to-complex or core-to-peripheral with explicit rationale.
5. **Synthesis and recommendations**: overall comparison conclusions, best-fit analysis for different scenarios, and concrete suggestions for the current project.
6. **Frontier and gaps**: comparison questions needing deeper investigation, and known gaps across all reference repos.

When a topic is actively used for decision-making, the comparison matrix and synthesis sections become the primary value. Do not leave them as lightweight aggregations.

## Subagents

Use subagents only after the user has selected an execution ownership mode that allows them. Do not spawn subagents during the required mode-selection question.

Use subagents when the work is broad enough to risk overloading the main context:

- comparing one topic across more than three repos,
- investigating more than one repo for repo indexes or a topic; default to at least one explorer subagent per repo,
- deeply understanding a large repo,
- extracting architecture from a repo with many agents, commands, plugins, or skills,
- refreshing multiple repo indexes in one task.

Subagent prompt requirements:

- State clearly: `You are a subagent. Finish with a plain text message only. Do not call question tools.`
- Provide the collection path, target repo/topic, and the required index format.
- Ask for architecture, workflows, reading entry points, reusable patterns, non-transferable parts, topic fit, and low-confidence areas.
- Require paths and evidence. Ask for concise but complete notes that the main agent can merge.

Explorer prompt requirements for `explorer-notes` and `topic-synthesis`:

- State clearly: `You are an explorer subagent. You are read-only. Do not edit files, create branches, fork work, or implement changes.`
- Do not ask explorers to write index files. The main agent performs all final index updates.

Worker prompt requirements for `repo-index-workers`:

- State clearly: `You are a repo-index worker subagent. You may edit only your assigned INDEX.REPO.{repo}.md file and no other files.`
- State clearly: `You are not alone in the codebase. Do not revert edits made by others; keep your write scope disjoint.`
- Assign exactly one repo and one editable output path to each worker.
- Ask the worker to create or refresh that repo index using the repo-index template and to return changed paths, topic leads, evidence paths, low-confidence areas, and any root-index note the main agent should merge.
- Do not let workers edit `INDEX.md`, `INDEX.TOPIC.*.md`, unrelated repo indexes, templates, scripts, or source repos.

Explorer example:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.
You are an explorer subagent. You are read-only. Do not edit files, create branches, fork work, or implement changes.

Investigate ref_repos/<repo> for an INDEX.REPO.<repo>.md entry.
Focus on architecture, core workflows, key abstractions, best reading entry points, reusable patterns, non-transferable parts, topic fit, and low-confidence areas.
Use shell discovery such as find, rg, ls, and sed. Do not modify files.
Return structured notes that fit the index-ref-repos repo-index template.
```

Worker example:

```text
You are a subagent. Finish with a plain text message only. Do not call question tools.
You are a repo-index worker subagent. You may edit only ref_repos/INDEX.REPO.<repo>.md and no other files.
You are not alone in the codebase. Do not revert edits made by others; keep your write scope disjoint.

Create or refresh ref_repos/INDEX.REPO.<repo>.md for ref_repos/<repo>.
Use the repo-index template and preserve the required headings.
Investigate architecture, core workflows, key abstractions, best reading entry points, reusable patterns, non-transferable parts, topic fit, and low-confidence areas.
Return changed paths, topic leads for the main agent, evidence paths, low-confidence areas, and any root-index note the main agent should merge.
```

For multi-repo topic research, spawn one explorer per repo unless the user explicitly asks to keep the work single-agent. Each explorer should investigate only its assigned repo; the main agent performs the topic comparison and writes the topic index.

## Useful Commands

List candidate repo directories:

```bash
find ref_repos -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort
```

List repo indexes:

```bash
find ref_repos -maxdepth 1 -type f -name 'INDEX.REPO.*.md' -printf '%f\n' | sort
```

Find skill files:

```bash
find ref_repos -path '*/.git' -prune -o -name 'SKILL.md' -type f -print
```

Create a repo index template:

```bash
python3 .agents/skills/index-ref-repos/scripts/create_index_template.py repo ref_repos superpowers
```

Create a topic index template:

```bash
python3 .agents/skills/index-ref-repos/scripts/create_index_template.py topic ref_repos skill-authoring
```

Create the root index template:

```bash
python3 .agents/skills/index-ref-repos/scripts/create_index_template.py root ref_repos
```

## Final Response

Report:

- indexes created or refreshed,
- missing/orphaned repos found,
- topics created or updated,
- subagents used, if any,
- important low-confidence areas,
- whether existing repo indexes were left untouched because refresh was not requested.
