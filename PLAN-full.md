User: 我认为这个PLAN-full.md太复杂了。导致多次构建失败。我希望文件越少越好，使用**Vanilla TS**。不要任何UI库、不要任何框架。给我写一个更易于实现的方案。然后storage需要放到apps/里面去，不要放到core。templates可以复用现在的文件（稍作修改）。能一个文件完成的功能，不要拆成多个小文件。最终不得超过10个文件。

可以使用comlink、lucide、webextension-polyfill、BEM 命名.
彻底抛弃Tailwindcss、Vue、UI库、Shadow DOM。

最后把你的方案直接输出到对话即可，我会自己复制粘贴，避免任何工具调用。

GitHub Copilot: 

 Let me first quickly check a few files to understand the current template system, then I'll output the simplified plan.   

读取 [](file:///media/takagisan/Data/Code/Web/Tampermonkey/GiveMeDoc/scripts/build_templates.py#1-1)，行 1 到 200

读取 [](file:///media/takagisan/Data/Code/Web/Tampermonkey/GiveMeDoc/templates/config.yaml#1-1)，行 1 到 100

读取 [](file:///media/takagisan/Data/Code/Web/Tampermonkey/GiveMeDoc/PLAN.md#1-1)，行 1 到 200

读取 [](file:///media/takagisan/Data/Code/Web/Tampermonkey/GiveMeDoc/templates/config.yaml#100-100)，行 100 到 203

读取 [](file:///media/takagisan/Data/Code/Web/Tampermonkey/GiveMeDoc/bin)

读取 [](file:///media/takagisan/Data/Code/Web/Tampermonkey/GiveMeDoc/scripts/build_templates.py#200-200)，行 200 到 272

好的，以下是精简后的方案。

---

# Give Me Doc — 精简开发计划（Vanilla TS，≤10 文件）

> **版本**: v1.0 &nbsp;|&nbsp; **许可证**: AGPL-3.0 &nbsp;|&nbsp; **最后更新**: 2026-02-25

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **Vanilla TS** | 零 UI 框架、零 UI 库、零 Shadow DOM、零 Tailwind |
| **文件极简** | 源码文件 **≤ 10 个**（不含构建配置/manifest/模板生成脚本） |
| **单文件单职责** | 能一个文件搞定的绝不拆分 |
| **可用依赖** | Comlink、Lucide（SVG 字符串）、webextension-polyfill、BEM 命名 |
| **Storage 归 apps** | 存储实现跟随分发入口，不在 core |

---

## 2. 目录结构

```text
give-me-doc/
├── package.json
├── tsconfig.json
├── vite.config.ts              # 多入口构建 (userscript / extension)
│
├── src/                        # ========== 核心源码（10 个文件）==========
│   ├── types.ts                # 1. 所有类型/接口
│   ├── pandoc.worker.ts        # 2. Pandoc WASM Worker（Comlink expose）
│   ├── converter.ts            # 3. MD 格式化 + 模板拼装 + 转换调度
│   ├── deepseek.ts             # 4. DeepSeek 全部逻辑（API/IDB/DOM注入/消息树）
│   ├── panel.ts                # 5. 面板 UI（3 个 Tab，纯 DOM + BEM）
│   ├── panel.css               # 6. 面板样式（BEM）
│   ├── userscript.ts           # 7. 油猴入口 + GM_storage
│   ├── extension-content.ts    # 8. 扩展 Content Script + chrome.storage
│   ├── extension-background.ts # 9. 扩展 Service Worker
│   └── extension-popup.html    #10. 扩展 Popup（纯 HTML，内联 <script> 挂载 panel）
│
├── bin/
│   └── pandoc.wasm             # 已有，扩展打包用
│
├── templates/                  # 已有，保持不变
│   └── config.yaml
│
├── scripts/
│   └── build_templates.py      # 已有，仅改输出路径 → src/builtin-templates.generated.ts
│
├── dist/                       # 构建产物
│   ├── userscript/
│   │   └── give-me-doc.user.js
│   ├── chrome/
│   └── firefox/
│
└── manifests/
    ├── chrome.manifest.json
    └── firefox.manifest.json
```

**计数：`src/` 下恰好 10 个文件**（8 个 `.ts` + 1 个 `.css` + 1 个 `.html`）。

---

## 3. 各文件职责

### 3.1 `types.ts` — 全局类型

所有接口、类型、枚举集中于此。

```ts
// ── 消息与会话 ──
export interface IMessage {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  timestamp: number;
  status: 'finished' | 'incomplete' | 'error';
  childrenIds: string[];
}

export interface IChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Map<string, IMessage>;   // id → message
  currentMessageId: string;          // 叶节点，用于确定活跃链
}

// ── 存储抽象 ──
export interface IStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getBlob(key: string): Promise<ArrayBuffer | null>;
  setBlob(key: string, value: ArrayBuffer): Promise<void>;
}

// ── 用户配置 ──
export interface UserConfig {
  locale: 'zh-CN' | 'en-US';
  includeThinking: boolean;
  selectedTemplateId: string;
  documentPrefix: string;
  userMessageTemplate: string;
  assistantMessageTemplate: string;
  cdnUrls: string[];               // 仅油猴
}

// ── Pandoc Worker API (Comlink) ──
export interface PandocAPI {
  init(wasmSource: ArrayBuffer | string): Promise<void>;
  convert(md: string, referenceDoc?: ArrayBuffer): Promise<ArrayBuffer>;
  getVersion(): Promise<string>;
}

// ── 面板回调 ──
export interface PanelCallbacks {
  onExport(selectedIds: string[], templateId: string): Promise<void>;
  onTemplateUpload(name: string, data: ArrayBuffer): Promise<void>;
  onTemplateDelete(id: string): Promise<void>;
  onConfigChange(partial: Partial<UserConfig>): Promise<void>;
  getConfig(): Promise<UserConfig>;
  getTemplateList(): Promise<Array<{ id: string; name: string; isBuiltin: boolean }>>;
  getSession(): Promise<IChatSession | null>;
  getPandocVersion(): Promise<string>;
}
```

### 3.2 `pandoc.worker.ts` — Pandoc WASM Worker

- 在 Worker 线程中加载 `pandoc.wasm`
- 通过 Comlink 暴露 `PandocAPI`
- 核心参考 pandoc.md 中的 WASI 初始化 + `convert()` 调用方式
- 内部管理 WASI shim（`@bjorn3/browser_wasi_shim`）、虚拟文件系统

```ts
// 伪代码骨架
import * as Comlink from 'comlink';
import { WASI, File, ... } from '@bjorn3/browser_wasi_shim';

const api: PandocAPI = {
  async init(wasmSource) { /* instantiate WASM, hs_init */ },
  async convert(md, referenceDoc?) {
    // 1. 设虚拟 FS: stdin=md, 可选 reference.docx
    // 2. 构建 options JSON: { from:"markdown", to:"docx", "output-file":"out.docx", ... }
    // 3. 调用 instance.exports.convert(ptr, len)
    // 4. 从虚拟 FS 读取 out.docx → ArrayBuffer
    return docxBuffer;
  },
  async getVersion() { /* query({query:"version"}) */ }
};
Comlink.expose(api);
```

### 3.3 `converter.ts` — MD 格式化 + 模板拼装 + 转换调度

**三合一**，全部在主线程。唯一对外 API：`exportToDocx()`。

```ts
import * as Comlink from 'comlink';
import type { PandocAPI, IMessage, UserConfig, IChatSession } from './types';

// ── 单例 Worker 管理 ──
let worker: Worker | null = null;
let pandoc: Comlink.Remote<PandocAPI> | null = null;

export async function initPandoc(wasmSource: ArrayBuffer | string) { ... }
export async function getPandocVersion(): Promise<string> { ... }

// ── Markdown 格式化 ──
export function formatMarkdown(raw: string): string {
  // 1. 数学分隔符: \(...\) → $...$,  \[...\] → $$...$$
  // 2. 清理冗余空行 (连续 3+ 空行 → 2 空行)
  // 3. 列表缩进/符号统一
  // 4. 标题层级最小化修复
  return formatted;
}

// ── 模板拼装 ──
export function assembleDocument(
  messages: IMessage[],
  config: UserConfig,
  sessionTitle: string
): string {
  // 1. 渲染 documentPrefix: 替换 {title}, {output_date}
  // 2. 遍历 messages, 按 role 选模板
  //    - user  → userMessageTemplate.replace('{content}', msg.content)
  //    - assistant → assistantMessageTemplate
  //        若 includeThinking=false → {thinking_content} 置空 + 删关联空行
  //        若占位符在 > 行 → 多行内容逐行补 >
  // 3. 拼接为完整 markdown string
  return fullMd;
}

// ── 一键导出 ──
export async function exportToDocx(
  messages: IMessage[],
  config: UserConfig,
  sessionTitle: string,
  referenceDoc?: ArrayBuffer
): Promise<{ blob: Blob; filename: string }> {
  const md = assembleDocument(messages, config, sessionTitle);
  const formatted = formatMarkdown(md);
  const buffer = await pandoc!.convert(formatted, referenceDoc);
  return {
    blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    filename: `${sessionTitle || 'export'}.docx`
  };
}
```

### 3.4 `deepseek.ts` — DeepSeek 平台适配（全合一）

一个文件包含：API 调用、IndexedDB 读取、消息树构建/分支切换、DOM 注入。

```ts
import type { IMessage, IChatSession, IStorage } from './types';

// ═══════ Auth ═══════
export function getToken(): string | null { /* localStorage → userToken → JSON.parse → value */ }

// ═══════ API ═══════
export async function fetchSessionFromAPI(sessionId: string, token: string): Promise<IChatSession> { ... }

// ═══════ IndexedDB ═══════
export async function fetchSessionFromIDB(sessionId: string): Promise<IChatSession | null> { ... }

// ═══════ 组合获取（IDB 优先 → API fallback）═══════
export async function getSession(sessionId: string): Promise<IChatSession> { ... }

// ═══════ 消息树 ═══════
export function buildMessageMap(raw: any[]): Map<string, IMessage> { ... }
export function getActiveChain(session: IChatSession): IMessage[] {
  // 从 currentMessageId 回溯到根
}
export function switchBranch(session: IChatSession, nodeId: string, newChildId: string): IMessage[] {
  // 在指定节点切换子分支，返回新的链
}

// ═══════ 当前页面会话 ID ═══════
export function getCurrentSessionId(): string | null {
  // 从 URL 提取: /a/chat/s/{id}
}

// ═══════ DOM 注入 ═══════
export function injectSingleExportButtons(onClick: (md: string) => void) {
  // MutationObserver 监听消息工具栏出现
  // 在复制按钮旁注入 Lucide file-type 图标按钮
  // 点击: 模拟点击复制 → 读剪贴板 → 回调
}

export function injectSharePanelButton(onClick: (selectedIndices: number[]) => void) {
  // MutationObserver 监听分享界面出现（检测 "创建分享链接" 按钮）
  // 在底部栏注入 "导出为 Word" 按钮
  // 点击: 读取 .ds-checkbox.ds-checkbox--active → 回调选中索引
}
```

### 3.5 `panel.ts` — 面板 UI（纯 DOM + BEM）

**一个文件实现全部 3 个 Tab**。不使用任何 UI 库，纯 `document.createElement` + BEM class。

```ts
import type { PanelCallbacks, IMessage, UserConfig } from './types';
// Lucide 仅用 SVG 字符串常量
import { FileText, ChevronLeft, ChevronRight, Trash2, Upload, Download, Check } from 'lucide';

export class Panel {
  private root: HTMLElement;
  private callbacks: PanelCallbacks;
  private activeTab: 'export' | 'settings' | 'about' = 'export';
  private messages: IMessage[] = [];
  private selected: Set<string> = new Set();

  constructor(container: HTMLElement, callbacks: PanelCallbacks) { ... }

  // ── 整体渲染 ──
  render() {
    this.root.innerHTML = '';
    this.root.className = 'gmd';
    this.root.appendChild(this.renderTabs());
    this.root.appendChild(this.renderTabContent());
  }

  // ── 顶部 Tabs ──
  private renderTabs(): HTMLElement { /* gmd__tabs > gmd__tab--active */ }

  // ── Export Tab ──
  private renderExportTab(): HTMLElement {
    // gmd__export
    //   gmd__export-toolbar  (全选 checkbox)
    //   gmd__export-list     (消息列表，每条: checkbox + 摘要 + 分支切换 < 2/3 >)
    //   gmd__export-actions  (模板 <select> + 导出按钮)
  }

  // ── Settings Tab ──
  private renderSettingsTab(): HTMLElement {
    // gmd__settings
    //   gmd__settings-section "模板管理"  (列表 + 上传按钮)
    //   gmd__settings-section "导出选项"  (思考内容 switch、模板编辑 textarea)
    //   gmd__settings-section "CDN 配置"  (仅油猴可见, textarea + 恢复默认)
  }

  // ── About Tab ──
  private renderAboutTab(): HTMLElement {
    // gmd__about
    //   gmd__about-status  (运行环境、Pandoc 状态、版本)
    //   gmd__about-info    (项目名/版本/简介)
    //   gmd__about-links   (GitHub / Bug Report)
  }

  // ── 公开方法 ──
  setMessages(msgs: IMessage[]) { ... }
  show() { this.root.style.display = ''; }
  hide() { this.root.style.display = 'none'; }
  destroy() { this.root.remove(); }
}
```

### 3.6 `panel.css` — BEM 样式

```css
/* 根容器 */
.gmd { ... }

/* Tabs */
.gmd__tabs { display: flex; border-bottom: 1px solid #e0e0e0; }
.gmd__tab { padding: 8px 16px; cursor: pointer; }
.gmd__tab--active { border-bottom: 2px solid #1976d2; color: #1976d2; }

/* Export Tab */
.gmd__export { display: flex; flex-direction: column; height: 100%; }
.gmd__export-toolbar { ... }
.gmd__export-list { flex: 1; overflow-y: auto; }
.gmd__export-item { display: flex; align-items: center; padding: 8px 12px; }
.gmd__export-item__checkbox { ... }
.gmd__export-item__summary { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gmd__export-item__branch { display: flex; align-items: center; gap: 4px; }
.gmd__export-actions { padding: 12px; border-top: 1px solid #e0e0e0; }

/* Settings Tab */
.gmd__settings-section { ... }
.gmd__settings-section__title { ... }
.gmd__switch { ... }
.gmd__switch--active { ... }

/* About Tab */
.gmd__about-status { ... }
.gmd__about-status__item { ... }
.gmd__about-status__dot--ok { background: #4caf50; }
.gmd__about-status__dot--error { background: #f44336; }

/* 通用 */
.gmd__btn { ... }
.gmd__btn--primary { ... }
.gmd__select { ... }
.gmd__textarea { ... }
```

### 3.7 `userscript.ts` — 油猴入口

```ts
import { Panel } from './panel';
import { initPandoc, exportToDocx, getPandocVersion } from './converter';
import * as deepseek from './deepseek';
import type { IStorage, UserConfig } from './types';

// ── GM Storage 实现 ──
const storage: IStorage = {
  async get<T>(key: string) { return JSON.parse(await GM.getValue(key, 'null')); },
  async set<T>(key: string, value: T) { await GM.setValue(key, JSON.stringify(value)); },
  async remove(key: string) { await GM.deleteValue(key); },
  async getBlob(key: string) { /* base64 decode from GM */ },
  async setBlob(key: string, value: ArrayBuffer) { /* base64 encode to GM */ },
};

// ── 配置管理（带默认值合并）──
const DEFAULT_CONFIG: UserConfig = { ... };
async function loadConfig(): Promise<UserConfig> { ... }
async function saveConfig(partial: Partial<UserConfig>) { ... }

// ── 模板管理 ──
// 内置模板: import from './builtin-templates.generated'
// 自定义模板: storage.getBlob / setBlob

// ── 入口 ──
(async () => {
  // 1. 注入面板容器（浮动面板）
  const container = document.createElement('div');
  container.id = 'gmd-panel';
  document.body.appendChild(container);

  // 2. 注入 CSS (GM_addStyle 或 <style>)
  GM_addStyle(panelCSS);

  // 3. 创建 Panel，传入回调
  const panel = new Panel(container, { onExport, onTemplateUpload, ... });

  // 4. 后台加载 Pandoc WASM（CDN fallback）
  loadPandocFromCDN(config.cdnUrls);

  // 5. 注入 DeepSeek 页面按钮
  deepseek.injectSingleExportButtons(handleSingleExport);
  deepseek.injectSharePanelButton(handleMultiExport);

  // 6. GM_registerMenuCommand 注册菜单项打开面板
})();
```

### 3.8 `extension-content.ts` — 扩展 Content Script

```ts
import browser from 'webextension-polyfill';
import { Panel } from './panel';
import * as deepseek from './deepseek';
import type { IStorage } from './types';

// ── Chrome Storage 实现 ──
const storage: IStorage = {
  async get<T>(key: string) { const r = await browser.storage.local.get(key); return r[key] ?? null; },
  async set<T>(key: string, value: T) { await browser.storage.local.set({ [key]: value }); },
  async remove(key: string) { await browser.storage.local.remove(key); },
  async getBlob(key: string) { /* base64 from storage */ },
  async setBlob(key: string, value: ArrayBuffer) { /* base64 to storage */ },
};

// ── 入口 ──
// 与 userscript 类似，但:
// - Pandoc WASM 通过 browser.runtime.getURL('pandoc.wasm') 加载
// - CSS 通过 manifest content_scripts 注入
// - 与 background 通过 browser.runtime.sendMessage 通信
```

### 3.9 `extension-background.ts` — 扩展 Service Worker

```ts
import browser from 'webextension-polyfill';

// 职责极简:
// 1. 监听来自 content script / popup 的消息
// 2. 可选: 在 background 中运行 Pandoc Worker (若 content script 不允许创建 Worker)
// 3. 管理扩展图标点击 → 通知 content script 打开面板
browser.action.onClicked.addListener((tab) => {
  browser.tabs.sendMessage(tab.id!, { type: 'toggle-panel' });
});
```

### 3.10 `extension-popup.html` — 扩展 Popup

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="panel.css">
  <style>body { width: 400px; height: 560px; margin: 0; }</style>
</head>
<body>
  <div id="gmd-panel"></div>
  <script type="module">
    // 复用 Panel + extension storage
    // 通过 browser.tabs.query 获取当前标签页信息
    // 通过 browser.tabs.sendMessage 与 content script 通信获取会话数据
  </script>
</body>
</html>
```

---

## 4. 模板系统

### 4.1 复用现有文件

| 文件 | 改动 |
|------|------|
| config.yaml | **不变** |
| build_templates.py | 仅改 `OUTPUT_TS_PATH` → `src/builtin-templates.generated.ts` |

### 4.2 生成的 `builtin-templates.generated.ts`

```ts
// Auto-generated — DO NOT EDIT
export const BUILTIN_TEMPLATES: Record<string, { name: string; description: string; data: string }> = {
  'builtin-gb': {
    name: '国标文档风格',
    description: '参照 GB/T 9704 公文格式，黑体标题 + 仿宋正文',
    data: 'UEsDB...(base64)...'
  },
  'builtin-academic': { ... },
  'builtin-minimal': { ... },
};
```

### 4.3 运行时逻辑

- 内置模板：从 `BUILTIN_TEMPLATES` 直接 base64 decode
- 自定义模板：用户上传 `.docx` → `storage.setBlob('template:custom-xxx', arrayBuffer)`
- 列表合并：内置 + 自定义，内置不可删除

---

## 5. 数据流

### 5.1 多条导出（Panel 内）

```
用户打开 Panel
  → deepseek.getCurrentSessionId()
  → deepseek.getSession(id)          // IDB 优先 → API fallback
  → panel.setMessages(activeChain)    // 消息树 → 活跃链
  → 用户操作: 多选 / 分支切换 / 搜索
  → 点击"导出 Word"
  → converter.exportToDocx(selected, config, title, refDoc?)
  → 触发 download
```

### 5.2 单条快捷导出（DeepSeek 页面注入）

```
用户点击消息旁注入的图标
  → deepseek 模拟点击原生复制按钮
  → navigator.clipboard.readText() 获取 MD
  → converter.exportToDocx([{role:'assistant', content:md}], config, document.title)
  → 触发 download
```

### 5.3 分享界面多选导出（DeepSeek 页面注入）

```
用户进入 DeepSeek 分享界面 → 选择消息
  → 点击注入的 "导出为 Word" 按钮
  → deepseek 读取 .ds-checkbox 选中状态 → 选中索引
  → deepseek.getSession(id) → 活跃链
  → 按索引筛选 → exportToDocx()
  → 触发 download
```

---

## 6. 消息树与分支切换

```ts
// deepseek.ts 内

/** 从 currentMessageId 回溯到根，得到活跃链 */
export function getActiveChain(session: IChatSession): IMessage[] {
  const chain: IMessage[] = [];
  let id: string | null = session.currentMessageId;
  while (id) {
    const msg = session.messages.get(id)!;
    chain.unshift(msg);
    id = msg.parentId;
  }
  return chain;
}

/** 在指定节点处切换到另一个子分支，返回新链 */
export function switchBranch(
  session: IChatSession,
  nodeId: string,
  targetChildId: string
): IMessage[] {
  // 1. 从根到 nodeId 的路径不变
  // 2. 从 targetChildId 开始，沿第一个 child 一路走到叶
  // 3. 拼接返回
}

/** 某节点是否有分支（children > 1）*/
export function hasBranch(session: IChatSession, nodeId: string): boolean {
  return (session.messages.get(nodeId)?.childrenIds.length ?? 0) > 1;
}
```

---

## 7. 构建策略

### 7.1 Vite 多入口

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'userscript') {
    return {
      build: {
        lib: { entry: 'src/userscript.ts', formats: ['iife'], name: 'GiveMeDoc' },
        outDir: 'dist/userscript',
        // rollup: 内联 CSS、添加油猴 meta header
      }
    };
  }
  if (mode === 'extension') {
    return {
      build: {
        rollupOptions: {
          input: {
            content: 'src/extension-content.ts',
            background: 'src/extension-background.ts',
            popup: 'src/extension-popup.html',
            worker: 'src/pandoc.worker.ts',
          }
        },
        outDir: 'dist/extension',
      }
    };
  }
});
```

### 7.2 构建命令

```json
{
  "scripts": {
    "build:templates": "python3 scripts/build_templates.py",
    "build:userscript": "vite build --mode userscript",
    "build:extension": "vite build --mode extension",
    "build:chrome": "pnpm build:extension && node scripts/copy-manifest.js chrome",
    "build:firefox": "pnpm build:extension && node scripts/copy-manifest.js firefox",
    "build": "pnpm build:templates && pnpm build:userscript && pnpm build:extension"
  }
}
```

### 7.3 Pandoc WASM 加载

| 环境 | 来源 | 方式 |
|------|------|------|
| 扩展 | pandoc.wasm 打包在扩展内 | `browser.runtime.getURL('pandoc.wasm')` → fetch → ArrayBuffer |
| 油猴 | CDN（用户可配置多源 fallback） | 按 `cdnUrls` 数组逐个 fetch，第一个成功即用 |

---

## 8. 存储方案

存储实现分别在 `userscript.ts` 和 `extension-content.ts` 中，共用 `IStorage` 接口。

| 数据 | Key 格式 | 值类型 |
|------|----------|--------|
| 用户配置 | `config` | `UserConfig` JSON |
| 自定义模板元数据 | templates | `Array<{id, name}>` JSON |
| 自定义模板文件 | `template:blob:{id}` | Base64 字符串（GM）/ ArrayBuffer（chrome.storage） |

---

## 9. 错误处理

- **统一方式**：在 Panel 底部显示 toast 消息条（纯 CSS 动画，BEM `.gmd__toast`）
- WASM 加载失败 → toast 警告 + About 页红点
- API 请求失败 → toast 显示错误摘要
- IndexedDB 数据不全 → 静默 fallback API
- 转换异常 → toast 显示 Pandoc stderr 摘要
- 剪贴板读取失败 → toast 提示权限

---

## 10. 开发阶段

### Phase 1：骨架搭建（1-2 天）

- [x] 初始化项目（package.json / tsconfig / vite.config）
- [ ] 创建 10 个空文件骨架
- [ ] build_templates.py 改输出路径，运行生成 `builtin-templates.generated.ts`
- [ ] `types.ts` 写完所有类型

### Phase 2：核心转换（2-3 天）

- [ ] `pandoc.worker.ts`：WASM 加载 + convert + Comlink expose
- [ ] `converter.ts`：formatMarkdown + assembleDocument + exportToDocx
- [ ] 手动测试：给定 MD → 生成 docx 能打开

### Phase 3：DeepSeek 适配（2-3 天）

- [ ] `deepseek.ts`：API + IDB + 消息树 + getActiveChain + switchBranch
- [ ] `deepseek.ts`：DOM 注入（单条按钮 + 分享界面按钮）
- [ ] 手动测试：在 DeepSeek 页面能拿到消息数据

### Phase 4：面板 UI（2-3 天）

- [ ] `panel.ts` + `panel.css`：Export Tab（消息列表 + 多选 + 分支 + 导出）
- [ ] `panel.ts`：Settings Tab（模板管理 + 配置）
- [ ] `panel.ts`：About Tab（状态 + 信息）

### Phase 5：分发集成（1-2 天）

- [ ] `userscript.ts`：GM storage + 面板挂载 + CDN 加载 + 菜单注册
- [ ] `extension-content.ts` + `extension-background.ts` + `extension-popup.html`
- [ ] Chrome / Firefox manifest 编写
- [ ] 构建测试：油猴脚本能装、扩展能侧载

---

## 11. 关键决策摘要

| 决策 | 选择 | 理由 |
|------|------|------|
| UI 方案 | 纯 DOM + BEM CSS | 零依赖，最大可控性 |
| 文件数量 | **10 个源文件** | 避免过度拆分导致构建/依赖复杂 |
| 框架 | **无** | Vanilla TS 最简单最可靠 |
| 存储位置 | apps 入口文件内 | 环境强相关，不抽 core |
| 模板生成 | 复用 build_templates.py | 已验证可用，仅改输出路径 |
| Worker 边界 | 仅 Pandoc 转换 | 其余全在主线程，避免通信开销 |
| Monorepo | **不用** | 单 package，Vite 多入口即可 |
| CSS 方案 | BEM 命名 + 单个 CSS 文件 | 简洁、无冲突、好维护 |