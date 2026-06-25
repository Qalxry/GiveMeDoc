# Reference Repositories Index

> 索引目录: {{collection_path}}
> 索引日期: {{date}}
> 索引规范: INDEX.md + INDEX.REPO.{repo}.md + INDEX.TOPIC.{topic}.md

## 使用方式

先通过本文件的「全景分析」和「探索策略」判断应该阅读哪个主题索引或仓库索引；
当需要横向比较同一主题时，进入 `INDEX.TOPIC.*.md`；
需要深入了解具体仓库时，进入 `INDEX.REPO.*.md` 查看架构、能力清单、设计哲学和可复用模式。

---

## 全景分析

### 这批参考仓库覆盖了什么

TODO — 从整体角度总结这些参考仓库作为一个集合覆盖了哪些领域、能力和设计理念。
不要逐个复述仓库描述，而是提炼共性和差异。例如：
- 覆盖的能力域（skill 编写、工作流编排、代码审查、浏览器自动化……）
- 覆盖的平台/生态（Claude Code、Codex、Cursor……）
- 共同的设计取向（Markdown-first、skill-as-workflow、progressive disclosure……）

### 明显的缺失和空白

TODO — 这批仓库作为整体有什么明显没有覆盖到的领域或视角？
这对理解参考库的局限性很重要。

### 仓库间关系

TODO — 这些仓库之间有没有继承、fork、互相引用、共享上游等关系？
有没有功能重叠或互补关系？

```mermaid
TODO — 如果仓库间存在有意义的关系，用 Mermaid 图展示。例如：
graph LR
    A[repo-a] -->|fork| B[repo-b]
    A -.->|影响| C[repo-c]
    B --- C
```

### 仓库成熟度对比

| 仓库 | 规模 | 活跃度 | 文档完整度 | 测试覆盖 | 综合成熟度 |
|---|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO | TODO |

> 注：成熟度判断是粗略估计，基于目录结构和文档质量推断，不代表精确度量。

---

## 仓库索引状态

| 仓库 | 索引文件 | 状态 | 一句话定位 | 适用主题 |
|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO |

---

## 探索策略

TODO — 按常见任务类型给出推荐阅读路径。每条策略说明为什么推荐这组仓库，以及阅读顺序。

| 任务类型 | 优先阅读 | 阅读顺序和理由 |
|---|---|---|
| TODO | TODO | TODO |

---

## 主题索引

TODO — 列出已有的主题索引，每个主题附一句话说明。

- [INDEX.TOPIC.{topic}.md](INDEX.TOPIC.{topic}.md): {一句话说明这个主题覆盖什么}

---

## 仓库索引

TODO — 列出所有仓库索引，每个仓库附一句话说明它的核心价值。

- [INDEX.REPO.{repo}.md](INDEX.REPO.{repo}.md): {一句话核心价值}

---

## 待补索引

TODO — 列出缺失的仓库索引、orphaned 索引和建议创建的主题索引。

- 缺失 repo 索引: TODO
- orphaned repo 索引: TODO
- 建议创建的 topic 索引: TODO（说明为什么建议创建这些主题）
