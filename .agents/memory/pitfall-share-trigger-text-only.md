---
name: pitfall-share-trigger-text-only
description: 分享面板触发按钮只能用 text 策略，selector/svg fallback 会误匹配
metadata:
  type: pitfall
  captured: 2026-06-26
  source: session 2026-06-25, DeepSeek 适配器回归 BUG
---

**场景**：在 AdapterConfig 中为 DeepSeek 分享面板的"创建分享链接"按钮定义多策略查找。

**问题**：除了 text 策略外，添加了 selector（`.ds-button--primary.ds-button--filled`）和 svg-fingerprint fallback。结果导出按钮被错误注入到输入框区域。

**根因**：`findShareTrigger()` 在分享面板**未打开时也会被调用**（`tryInject` 在页面加载时立即执行，且在 MutationObserver 中持续运行）。此时：
- text `"创建分享链接"` → 分享面板未打开，DOM 中没有 → 不匹配 ✅
- selector `.ds-button--primary.ds-button--filled` → **输入框的发送按钮**匹配！❌
- svg-fingerprint `M7.95889...` → **工具栏的分享按钮**匹配！❌

**修复**：`sharePanel.triggerButton` 只保留 text 策略，去掉 selector 和 svg-fingerprint fallback。因为 `"创建分享链接"` 这个文本只在分享面板打开时才存在于 DOM，不可能误匹配。

```json
"triggerButton": [
  { "method": "text", "text": "创建分享链接" }
]
```

**推广**：对于**只在特定 UI 状态（弹窗/面板/菜单）出现**的元素，text 策略是天生安全的——因为文本内容也只在那个状态时才出现于 DOM。而对于**始终存在于 DOM**的元素（如工具栏按钮），SVG 指纹 + scope 限制是首选。

与 [[preference-svg-fingerprint]] 形成互补。
