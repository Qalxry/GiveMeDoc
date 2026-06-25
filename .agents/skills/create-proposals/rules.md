# Create Proposals Rules

## Core Policy

- Always write the proposal or update entry when the user asks to create one. Do not only draft in chat.
- Classify the target file yourself based on evidence and repository conventions.
- Do not start implementation after creating a proposal.
- Preserve user-provided wording in `### 原始表述` when the user gives concrete requirement, issue, or idea text.
- Prefer fewer, better proposals over many shallow entries. Split only when items differ in severity, target file, ownership, or implementation path.

## Classification

Use the repository's local rules first. If no local rules exist:

- Use `proposals.p0.md` for defects that can cause data loss, security bypass, authorization failure, corruption, broken core workflows, severe execution failure, or critical documented requirement violations.
- Use `proposals.p1.md` for important implementation gaps, reliability failures, missing validation, integration breaks, significant spec drift, or core-flow test gaps.
- Use `proposals.p2.md` for lower-risk bugs, maintainability issues, diagnostics gaps, minor edge cases, or non-critical engineering improvements.
- Use `proposals.feat.md` for new product capabilities, workflow improvements, automation, user-facing enhancements, or major engineering platform capabilities that are better tracked as planned work than defects.
- Use `docs.updates.md` for documentation synchronization only: richer implementation, acceptable documentation drift, stale docs, missing docs, or documentation clarification. Do not use it to hide incomplete code.

When one user request contains multiple categories, create separate entries.

## Investigation Depth

Choose investigation depth by proposal type:

- **Defect proposals**: investigate deeply enough to confirm the issue, identify affected code, assign severity, and avoid duplicates. Use subagents when the affected area is broad or uncertain.
- **Docs updates**: investigate the relevant docs and code behavior deeply enough to distinguish acceptable drift from implementation failure. Use subagents when multiple docs or modules are involved.
- **Feature proposals**: clarify user intent, brainstorm multiple implementation options, compare tradeoffs, and recommend one direction before writing the proposal. Investigate code when feasibility, affected area, or integration points matter.
- **Small obvious proposals**: do a focused local check and write directly.

Do not turn this skill into a full systematic review. If the user asks for broad code review, use a review skill instead.

## Feature Proposal Prewriting

Feature proposals are not just filing tasks. They often define product direction, workflow policy, architecture, or future implementation shape, so the agent must make the reasoning visible before it becomes a durable tracked item.

Use this prewriting flow when the request is open-ended, strategic, architectural, asks "whether/how should we", contains several possible directions, or would create a new workflow/tooling policy:

1. **Restate intent**: summarize what the user appears to want, including the problem being solved and the expected outcome.
2. **Surface assumptions**: name assumptions that materially affect the proposal. Do not invent facts silently.
3. **Brainstorm options**: provide at least two viable approaches. For broad workflow or architecture proposals, prefer three options when useful.
4. **Compare tradeoffs**: discuss implementation cost, reliability, migration burden, human readability, tool dependency, future extensibility, and operational risk when relevant.
5. **Recommend a direction**: choose one path and explain why it is better for this repository now.
6. **Confirm when needed**: ask the user before writing if the preferred direction, scope, target users, or policy strictness is still genuinely ambiguous.
7. **Write after alignment**: once direction is clear, write or update the proposal file and preserve the decision context in the entry.

Direct writing is allowed only when the feature request is already concrete and low-ambiguity, for example "add a dry-run flag to the proposal archive script" or "record archived proposal counts in stats output". Even then, include a concise rationale and any alternatives that were considered if they matter later.

The proposal entry for a non-trivial feature should contain enough of the prewriting result to be useful months later:

- `### 原始表述` with the user's concrete wording or a faithful summary of the conversation path.
- A problem/context paragraph that explains why the feature matters.
- A comparison of considered approaches, either in `### 方案比较` or inside `### 推荐实现方案`.
- A clear recommended direction and the reason it was chosen.
- Unresolved decisions, if any, instead of hiding them as if already decided.

## Deduplication

Before writing:

- Search existing `proposals.p0.md`, `proposals.p1.md`, `proposals.p2.md`, `proposals.feat.md`, `docs.updates.md`, and local archive/index files if present.
- Search by likely title keywords, module names, proposal ids, API names, file paths, and domain terms.
- If a near-duplicate exists, update or extend the existing entry instead of creating a new one.
- If the existing entry is related but not identical, link to it or mention the relationship in the new entry.
- If duplicate handling requires a product decision, ask the user before writing.

## Numbering

Use existing file conventions. By default:

- `P0-XX` for `proposals.p0.md`.
- `P1-XX` for `proposals.p1.md`.
- `P2-XX` for `proposals.p2.md`.
- `FP-XX` for `proposals.feat.md`.
- `DU-XX` for `docs.updates.md`.

Determine the next id from `最后编号` first. If missing or stale, scan headings for existing ids and use the next highest number.

Update `最后审计日期` and `最后编号` when the file has those fields. Preserve existing heading style and ordering.

## User Questions

Ask questions only when the proposal cannot be responsibly written without clarification, such as:

- The user only gives a vague feature idea and the product intent is unclear.
- The user is asking for a product, architecture, or workflow recommendation and several plausible directions would produce materially different proposals.
- The recommended feature direction would impose a policy on future agent behavior, data format, workflow strictness, or tooling requirements that the user has not clearly accepted.
- The severity requested by the user conflicts with evidence.
- A near-duplicate exists and it is unclear whether to update or create a separate entry.
- The request mixes defect, feature, and docs-update concerns in a way that needs user prioritization.
- Writing the proposal would assert facts that investigation cannot verify.

If a structured question tool is unavailable, use the repository's Markdown fallback question format.

## Writing And Finalization

- Write entries in Markdown using the local file's existing style and the full templates below.
- Keep descriptions substantial enough to be actionable and understandable later.
- Maintain stable ids and do not reuse ids.
- Do not mark new entries as completed.
- If updating an existing entry, state what was added or changed in the final response.
- After writing, re-read the changed section to check formatting, numbering, and target file correctness.

Final response should include:

- Created or updated ids.
- Target files.
- Classification rationale.
- Investigation performed, including subagents if used.
- Duplicate handling.
- Any unresolved ambiguity.
- A clear note that implementation was not started.

## 提案 `proposals.{p0|p1|p2|feat}.md` 规范

- 当用户需要您审查代码时，请写入审查提案内容到 `proposals.{p0|p1|p2}.md` 文件中。
- 当您/用户提出新的功能需求时，请写入功能提案内容到 `proposals.feat.md` 文件中。
- **必须在提案标题前添加序号**，以便后续跟踪和管理。
- 当您完成了一项提案后，请标记它为已完成（✅ 已修复），并编写最终实现情况。
- **文件位置必须包含行号范围**，以便快速定位相关代码段。

审查提示：
- 现在处于项目初期，可以进行更果断干净的修复和实现，不必过于担心兼容性问题，但仍需注意潜在风险和注意事项。
- 尽量避免兼容性修复和实现，因为这会增加代码复杂度和维护成本，除非确实有必要保留旧行为，否则可以直接删改和实现到位。
- 若用户有具体的描述文本，则需要加一项{### 原始表述}，并把用户的最终原话放进去，以便后续对比和回顾。

功能需求创意提示：
- 您可以先进行头脑风暴，列出多个可能的实现方案，并分析它们的优缺点，然后再选择一个最合适的方案进行详细描述和实现。
- 用户的需求可能不够清晰或具体，您需要通过提问和沟通来澄清和细化需求，以确保您理解正确并能够提供有针对性的解决方案。
- 宁愿用更大段落的文字来清晰完整地表达您的意思，也不要用一些自以为凝练但实际上怪异难懂的短句或标题来表达复杂的想法。
- 突出重点，层次分明，逻辑清晰，避免在一个段落里堆砌过多的信息或观点，让读者难以抓住重点。
- 若用户有具体的描述文本，则需要加一项{### 原始表述}，并整理用户的心路旅程和最终原话，以便后续对比和回顾。
- 您需要表现出您的专业能力和创造力，提出一些可能用户没有想到的创新功能需求，并详细描述它们的实现细节和潜在价值。
- 需要展示出您的主见、决断力、独立思考能力，能够为用户提供明确的建议和指导，而不是模棱两可或过于顺着用户的意见。
- 确保您的叙述风格更理性化，避免过于口语化或情绪化的表达，避免不恰当的比喻或夸张的说法，保持专业和客观的语气。

审查提案示例：

```markdown
# P0 — 关键缺陷：影响正确性的实现问题

> 最后审计日期: YYYY-MM-DD
> 最后编号：P0-XX

---

## ~~{🔴|🟡|🟢} P0-01. 提案标题内容~~ ✅ 已修复

> 严重程度: {🔴 关键|🟡 中高|🟢 低}
> 影响范围: {架构|模块|函数|...}
> 评级理由: {简述评级理由}

### 问题描述
{以markdown格式详细描述问题内容，包含必要的背景信息、复现步骤、相关代码片段等。}

### 位置
- [文件相对路径](文件相对路径#L{start}-L{end})：{函数/类/模块名称}（{简述该位置与提案的关系}）
- [文件夹相对路径](文件夹相对路径)：{简述该位置与提案的关系}
- [./path/to/file](./path/to/file#L100-L150)：FileReader.readFile（该函数在提案中被错误使用，导致了问题的发生）

### 影响
{简述该问题可能导致的后果，例如数据丢失、性能下降、安全漏洞等}

### 推荐修复方案
{以markdown格式详细描述建议的修复方案，包含必要的技术细节、实现步骤、潜在风险、注意事项、验收结果等，如果有多个方案可以选择，可以分修复方案A、B、C列出。}

### 最终修复情况
{在修复完成后，更新该部分内容以反映最终的代码实现细节，包括任何与原提案不完全一致的修改。}

---
```

功能提案示例：

```markdown
# Feature Proposal: 功能提案

> 最后审计日期: YYYY-MM-DD
> 最后编号：FP-XX

---

## ~~{🔴|🟡|🟢} FP-01. 功能提案标题内容~~ ✅ 已完成

> 推荐程度**: {🔴 强烈推荐|🟡 推荐|🟢 可选}
> 影响范围: {全局|模块|函数|...}
> 评级理由: {简述评级理由}

### 功能描述
{以markdown格式详细描述功能需求内容，包含必要的背景信息、使用场景、用户需求、相关代码片段等。}

### 位置
- [文件相对路径](文件相对路径#L{start}-L{end})：{函数/类/模块名称}（{简述该位置与功能的关系}）

### 推荐实现方案
{以markdown格式详细描述建议的实现方案，包含必要的技术细节、实现步骤、潜在风险、注意事项、验收结果等，如果有多个方案可以选择，可以分实现方案A、B、C列出。}

### 最终实现情况
{在实现完成后，更新该部分内容以反映最终的代码实现细节，包括任何与原提案不完全一致的修改。}

---
```

---

## 文档更新 `docs.updates.md` 规范

`docs.updates.md` 用于记录需要同步进项目文档的实现差异、文档缺口、规格澄清和决策项，适用范围包括但不限于 PRD、SPEC、README、API 文档、配置文档、架构文档、运维文档、用户文档和外部集成说明。

当实现比文档更丰富、代码行为与文档存在可接受差异、文档遗漏了已经实现的能力、或者修复/功能实现导致文档需要同步时，应写入 `docs.updates.md`。如果代码弱于文档要求，则应写入 `proposals.{p0|p1|p2}.md` 作为待修复缺陷。

### 写入原则

- **只记录需要文档同步的事实和决策**：例如实现新增字段、API 行为变化、配置项变化、状态机扩展、架构取舍、外部协议支持、文档描述过窄或过时。
- **区分“实现更丰富”和“实现偷懒”**：更丰富实现可以记录到 `docs.updates.md`；偷懒实现必须进入缺陷提案。
- **必须给出目标文档**：说明建议同步到哪个 PRD/SPEC/README/API/配置/架构文档，避免只写“需要更新文档”。
- **必须给出代码位置或证据**：没有代码位置、行为证据或决策来源的条目不应写入。
- **保持可追踪编号**：使用 `DU-XX` 或当前文件已有编号规则，便于后续逐项处理。
- **完成同步后更新状态**：文档已更新时标记为 `✅ 已同步`，并写明同步到哪些文件。
- **只用于对齐代码实现与文档**：不记录功能提案、缺陷提案、设计决策等内容，这些应进入相应的 `proposals` 文件。

### 推荐格式

```markdown
# Docs Updates - 需要同步进项目文档的实现差异

> 最后审计日期: YYYY-MM-DD
> 最后编号：DU-XX

---

## ~~{🔴|🟡|🟢} DU-01. 文档更新标题~~ ✅ 已同步

> 状态: {待同步|需要决策|无需同步|✅ 已同步}
> 影响文档: {PRD|SPEC|README|API 文档|配置文档|架构文档|...}
> 影响范围: {模块|接口|配置|状态机|存储|运行时|...}

### 背景
{说明为什么需要记录该文档更新，例如实现比文档更丰富、文档过时、文档遗漏、实现与文档存在可接受差异等。}

### 相关位置
- [文件相对路径](文件相对路径#L{start}-L{end})：{代码/文档位置与该更新的关系}

### 当前文档描述
{概括当前文档中已有描述；如果文档缺失，则说明缺失。}

### 实际实现或建议描述
{说明当前代码的真实行为、已做出的设计决策，或建议写入文档的内容。}

### 推荐同步方案
{说明应更新哪些文档、如何更新、是否需要先做产品/架构决策。}

### 最终同步情况
{完成文档同步后，写明实际更新了哪些文档，与原建议是否一致。}

---
```
