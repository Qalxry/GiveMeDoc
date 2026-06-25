---
name: pitfall-mv3-war-match-pattern
description: Chrome MV3 web_accessible_resources.matches 不支持路径级 match pattern，只能用 https://domain/*
metadata:
  type: pitfall
  captured: 2026-06-26
  source: session 2026-06-25, 豆包扩展构建 BUG
---

**场景**：给扩展添加对豆包（`www.doubao.com`）的支持，在 `web_accessible_resources` 中添加匹配：

```json
{
  "resources": ["pandoc.wasm"],
  "matches": ["https://chat.deepseek.com/*", "https://www.doubao.com/chat/*"]
}
```

**结果**：Chrome 加载扩展时报 `Invalid value for 'web_accessible_resources[0]'. Invalid match pattern.`，扩展完全无法加载。

**根因**：Chrome MV3 的 `web_accessible_resources.matches` 使用的 match pattern **不支持路径级（`/chat/*`）模式**，只接受 `https://domain/*` 这种通配符。这与 `host_permissions` 和 `content_scripts.matches` 不同——后两者支持路径级匹配。

**修复**：将路径改为 `/*`：
```json
"matches": ["https://chat.deepseek.com/*", "https://www.doubao.com/*"]
```

**注意**：Firefox MV2 的 `web_accessible_resources` 是纯数组格式，不需要 `matches` 字段，默认对所有站点可用，没有此问题。

**排查建议**：如果扩展加载失败且 Chrome 提示无效 match pattern，优先检查 `web_accessible_resources` 中的域名后面是否跟了路径。
