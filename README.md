<div align='center'>
  <img src="./public/icons/logo.svg" alt="GiveMeDoc Logo" width="64"/>
  <h1>GiveMeDoc</h1>
  <a href="README.en.md">English</a>
</div>
<br/>
<div align='center'>基于 <b><em>⚡️Pandoc WASM⚡️</em></b> 的 AI 对话导出 Word 工具</div>
<div align='center'><b>🚫 别再为导出对话为 Word 付费了</b></div>
<br/>

| ![导出页 - 会话模式](./assets/tab1-1.png) | ![导出页 - 自由输入](./assets/tab1-2.png) | ![设置页](./assets/tab2.png) |
| ----- | ---- | ---- |

## 🤔 为什么选择 GiveMeDoc？

受够了那些把 Pandoc 套层壳就收订阅费的垃圾插件。GiveMeDoc 旨在打破这种模式，提供一个真正免费、开源的 AI 对话导出方案，没有任何隐性收费。

- **永久免费**：没有付费墙，没有订阅，没有隐性消费。
- **无需后端**：纯客户端 Pandoc WASM 转换。所有处理均在浏览器本地完成，数据绝不上传至任何服务器，隐私完全可控。
- **完全开源**：AGPL-3.0 许可证。

## ⚡️ 功能特性

- **Pandoc WASM**：Pandoc 通过 WebAssembly 完整运行在浏览器中。无服务器、无网络依赖，真正的离线能力。
- **原生 OMML 公式**：告别截图公式。AI 回复中的 LaTeX 数学公式将导出为 Word 原生 OMML 公式——可编辑、可搜索、任意缩放都清晰锐利。
- **多款内置模板**：提供学术、现代、简约、手册等多种排版模板，也可上传自定义 `.docx` 参考模板实现完全自定义。
- **分支感知导出**：浏览并导出对话的特定分支。可逐条勾选消息，也可一键导出完整对话。
- **自由输入模式**：你使用的平台还没有适配？没关系，直接将任意 Markdown 内容复制粘贴到自由输入框，即可转换为精美的 `.docx` 文件。
- **思考过程开关**：自由选择是否在导出中包含模型的思维链 / 思考过程。
- **Material 3 风格 UI**：简洁现代的浮动面板，不打扰你的正常使用。

## 🌐 平台支持

| 平台 | 状态 | 方式 |
|------|------|------|
| **DeepSeek** | ✅ 原生适配 | 通过 API / IndexedDB 自动获取会话数据 |
| **ChatGPT、Claude、Gemini 等** | ✅ 自由输入 | 复制 Markdown 粘贴到自由输入模式即可转换 |
| *更多平台适配即将推出* | 🚧 | 欢迎提交 PR！ |

## 🚀 快速开始

GiveMeDoc 同时提供**浏览器扩展**（Chrome / Edge / Firefox）和**Tampermonkey 油猴脚本**两种使用方式。目前尚未上架任何扩展商店，请手动安装。

### 方式一：浏览器扩展（Chrome / Edge / Firefox）（推荐）

- **Chrome / Edge**：
  1. 下载最新版本的扩展压缩包：[点击此处下载](https://github.com/Qalxry/GiveMeDoc/releases/latest/download/give-me-doc_chrome.zip)
  2. 解压下载得到的 `give-me-doc_chrome.zip` 文件为 `give-me-doc_chrome` 文件夹。
  3. 在浏览器地址栏输入 `chrome://extensions` 并回车，进入扩展管理页面。（Edge 用户输入 `edge://extensions`）
  4. 启用右上角的 `开发者模式` ，点击 `加载已解压的扩展程序` ，选择解压得到的 `give-me-doc_chrome` 文件夹。
  5. 点击浏览器工具栏中的 GiveMeDoc 图标，或在支持的网站上使用页面内的浮动按钮，即可打开面板。

- **Firefox**：
  1. 下载最新版本的扩展压缩包：[点击此处下载](https://github.com/Qalxry/GiveMeDoc/releases/latest/download/give-me-doc_firefox.zip)
  2. 在浏览器地址栏输入 `about:debugging#/runtime/this-firefox` 并回车，进入调试页面。
  3. 点击 `临时加载附加组件` ，选择下载的 `give-me-doc_firefox.zip` 文件。
  4. 点击浏览器工具栏中的 GiveMeDoc 图标，或在支持的网站上使用页面内的浮动按钮，即可打开面板。


### 方式二：Tampermonkey 油猴脚本

1. 在浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/)。
2. [点击这里安装](https://github.com/Qalxry/GiveMeDoc/releases/latest/download/give-me-doc.user.js) 最新版本的油猴脚本。
3. 访问 [chat.deepseek.com](https://chat.deepseek.com)，页面上将出现一个浮动操作按钮。


## 🔨 从源码构建

```bash
# 克隆仓库
git clone https://github.com/Qalxry/GiveMeDoc.git
cd GiveMeDoc

# 安装依赖
pnpm install

# 一键构建（图标、模板、油猴脚本、扩展）
pnpm build

# 或者单独构建：
pnpm build:chrome      # Chrome/Edge 扩展
pnpm build:firefox     # Firefox 扩展
pnpm build:userscript  # Tampermonkey 油猴脚本
```

## 📖 使用方法

1. **会话模式**：在支持的网站（如 DeepSeek）上打开 GiveMeDoc 面板，当前对话将自动加载。勾选/取消勾选消息、切换分支、选择模板，点击 **导出** 即可。
2. **自由输入模式**：在面板中切换到"自由输入"标签页，粘贴任意 Markdown 内容，设置文件名，导出为 `.docx`。

## 🛠 技术栈

- **Pandoc WASM**：在 Web Worker 中通过 [browser_wasi_shim](https://github.com/aspect-build/aspect-build-rules-js/tree/main/packages/browser_wasi_shim) 运行的文档转换引擎
- **Comlink**：Web Worker 通信
- **Vite**：面向油猴脚本和浏览器扩展的多目标构建系统
- **TypeScript**：端到端类型安全
- **python-docx**（构建时）：根据 YAML 配置生成 `.docx` 参考模板

## 📄 许可证

GiveMeDoc 基于 **AGPL-3.0** 许可证开源，详见 [LICENSE](LICENSE) 文件。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！
