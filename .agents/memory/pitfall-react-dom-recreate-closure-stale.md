---
name: pitfall-react-dom-recreate-closure-stale
description: React 平台 hover 时重建 DOM，闭包捕获的 DOM 引用过期导致 .click() 无声失效
metadata:
  type: pitfall
  captured: 2026-06-26
  source: session 2026-06-25, 豆包适配器导出按钮 BUG
---

**场景**：在豆包（React 渲染）的消息工具栏中注入"导出为 Word"按钮，点击后调用之前闭包中捕获的复制按钮 `copyBtn.click()`。

**现象**：`processToolbar` 时通过 SVG 指纹找到了 `copyBtn`，闭包捕获了引用。但点击导出按钮时 `copyBtn.click()` 无效果，而控制台手动 `copyBtn.click()` 有效。

**根因**：豆包用 React 渲染，鼠标 hover 进出消息时工具栏 DOM 会被重建（包括内部按钮）。闭包中捕获的 `copyBtn` 指向的是已脱离 DOM 的老元素，`.click()` 调用无任何效果也不报错。

**修复**：不要在 `processToolbar` 时捕获 `copyBtn`，改为在**导出按钮的 click 事件处理器中实时从 toolbar 查找**复制按钮：

```typescript
exportBtn.addEventListener('click', async (e) => {
  // 每次点击时实时查找，不依赖闭包缓存
  const copyBtn = toolbar.querySelector('button[data-dbx-name="button"]');
  // 或通过 SVG fingerprint
  const copyBtn = findCopyButton(toolbar, SVG_PREFIX);
  if (!copyBtn) return;
  (copyBtn as HTMLElement).click();
});
```

**要点**：
- 此问题不限于豆包——任何使用 React/Vue 等框架且 hover 触发 DOM 重建的场景都会遇到
- DeepSeek 没有此问题，因为它的工具栏 DOM 不会在 hover 时重建
- 注入的"导出"按钮本身不会消失，因为它是 appendChild 到实时 DOM 上，React 重建会替换父元素但子元素与之一起被替换
