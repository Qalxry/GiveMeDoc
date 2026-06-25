---
name: preference-svg-fingerprint
description: 用 SVG path d 属性前缀作为按钮定位指纹，比 CSS 类名更抗 UI 重构
metadata:
  type: preference
  captured: 2026-06-26
  source: session 2026-06-25, DeepSeek UI v2 适配器重构
---

**SVG Fingerprint 策略** — 当需要从 DOM 中定位一个特定图标按钮时，不要依赖 CSS 类名（UI 重构时经常改名），而是用按钮内部 SVG `<path>` 的 `d` 属性前 ~20 个字符作指纹。

**为什么稳定**：同一功能图标的 SVG 路径在不同 UI 版本间几乎不变（换图标库才会变，产品极少这么做），而 CSS 类名是设计系统级的，一次重构全部改名。DeepSeek UI v1 → v2 的实践验证了这一点。

**最佳实践**：
- 取第一个 `<path>` 的 `d` 属性前 20 个字符
- 限定搜索范围（`scope: 'toolbar'`），避免全局误匹配
- 作为多策略中的第一优先级，CSS 选择器作为 fallback

**引擎实现**：`adapter-engine.ts` 中的 `bySvgFingerprint()`：
```
scope.querySelectorAll('button, [role="button"]')
  → 遍历 SVG path
  → d.startsWith(pathPrefix) 即返回按钮元素本身
```

与 [[pitfall-share-trigger-text-only]] 结合使用——SVG 指纹 + text 是两种最可靠的定位策略。
