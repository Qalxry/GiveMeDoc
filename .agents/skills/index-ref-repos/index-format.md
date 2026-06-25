# Index Format

Use these templates for reference repository collections.

## Naming

- Root index: `INDEX.md`
- Repo index: `INDEX.REPO.{repo-slug}.md`
- Topic index: `INDEX.TOPIC.{topic-slug}.md`

Use uppercase `INDEX`, `REPO`, and `TOPIC`. Use lowercase slugs.

## Design Principles

索引文件的设计原则：

1. **分层可读**：每个索引都有"速查"和"深度"两个层次。速查部分让 agent 在 30 秒内判断相关性，深度部分提供架构级理解。
2. **证据驱动**：不写空洞的 pattern 名称，所有抽象和模式都要附带具体的代码路径、片段或配置示例作为证据。
3. **决策导向**：解释"为什么这么做"比描述"做了什么"更有价值。设计哲学和关键决策是仓库索引的核心章节。
4. **结构化对比**：跨仓库分析使用对比矩阵而非散文，让差异一目了然。
5. **诚实标注**：低置信区域和未覆盖范围必须显式标注，避免索引使用者产生虚假的完整感。

## Root Index — `templates/root-index.md`

模板文件: [`templates/root-index.md`](templates/root-index.md)

核心章节：

| 章节 | 要点 |
|---|---|
| 全景分析 | 覆盖范围总结、缺失和空白、仓库间关系（可选 Mermaid 图）、成熟度对比表 |
| 仓库索引状态 | 全量状态表，每行含一句话定位 |
| 探索策略 | 按任务类型推荐阅读路径，附阅读顺序和理由 |
| 主题索引 / 仓库索引 | 带一句话说明的链接列表 |
| 待补索引 | 缺失 repo、orphaned repo、建议创建的 topic |

## Repo Index — `templates/repo-index.md`

模板文件: [`templates/repo-index.md`](templates/repo-index.md)

核心章节：

| 章节 | 要点 |
|---|---|
| 速查卡片 | 一句话定位、推荐阅读场景、技术栈/规模/License/依赖/平台绑定表、目录结构树 |
| 仓库价值概述 | 回答三个问题：解决什么、独到之处、最值得借鉴什么 |
| 设计哲学与核心决策 | 核心理念（附证据）、3-5 个关键设计决策（选择/放弃/理由/证据）、隐含约定 |
| 架构地图 | Mermaid 模块关系图 + 各层职责描述 |
| 能力清单 | Skills / Commands / Agents / Hooks / Plugins 结构化表格，按实际内容增删 |
| 核心工作流 | 触发条件、流程步骤（建议 Mermaid）、门禁节点、产出物 |
| 关键抽象与设计模式 | 每个模式：名称、问题、做法、代码证据、可移植性 |
| 重点阅读入口 | 🔴必读 / 🟡推荐 / 🟢可选 分级表 |
| 对当前项目的价值评估 | 可直接复用资产、可借鉴思路、不适合照搬、具体建议 |
| 待深入探索的方向 | 方向 + 调研目标 + 预期产出 |
| 未覆盖或低置信区域 | 盲区标注 + 重新调研触发条件 |

## Topic Index — `templates/topic-index.md`

模板文件: [`templates/topic-index.md`](templates/topic-index.md)

核心章节：

| 章节 | 要点 |
|---|---|
| 主题定位 | 定义、边界、使用场景、与相邻主题区分 |
| 跨仓库对比矩阵 | 按维度（核心抽象、实现方式、复杂度、可移植性等）结构化对比 |
| 各仓库详细分析 | 每个仓库：相关度标签（🔴🟡🟢）、实现概述、设计取舍、代码证据、深层细节 |
| 推荐阅读顺序 | 从简到繁或从核心到边缘，附理由 |
| 综合分析与建议 | 方案优劣总结 + 对当前项目的具体建议 |
| 待深挖问题 / 已知空白 | 涉及哪些仓库、为什么需要深挖、预期产出 |

## Incremental Rules

- If `{collection}/{repo}` exists and `INDEX.REPO.{repo}.md` is missing, create the repo index.
- If `INDEX.REPO.{repo}.md` exists and `{collection}/{repo}` is missing, report it as orphaned; do not delete automatically.
- Existing repo indexes are stable by default. Refresh only when explicitly requested.
- Topic indexes do not need to cover every repo. They should cover active or strategically useful themes.
- Keep low-confidence areas explicit.

## Execution Rules

- The main agent must confirm the execution ownership mode with the user before repository scanning, subagent delegation, template creation, or file edits, unless the user's request explicitly selected a mode.
- The main agent must state both selections before work begins:
  - Operation mode: `scan`, `create-root`, `create-repo`, `refresh-repo`, `create-topic`, or `refresh-topic`.
  - Execution ownership mode: `master-only`, `explorer-notes`, `repo-index-workers`, or `topic-synthesis`.
- `master-only`: the main agent researches and writes all index files.
- `explorer-notes`: read-only explorer subagents may gather evidence; the main agent writes `INDEX.md`, `INDEX.REPO.*.md`, and `INDEX.TOPIC.*.md`.
- `repo-index-workers`: each worker subagent may edit only its assigned `INDEX.REPO.{repo}.md`; the main agent owns `INDEX.md`, `INDEX.TOPIC.*.md`, conflict resolution, and final synthesis.
- `topic-synthesis`: read-only explorer subagents gather cross-repo evidence; the main agent writes topic indexes and root-index updates.
- Keep subagent write scopes disjoint and explicit. No subagent may edit source repositories, scripts, templates, `INDEX.md`, or `INDEX.TOPIC.*.md` unless this reference is intentionally revised later.
