import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import * as fs from 'fs';

const USERSCRIPT_META = `// ==UserScript==
// @name         Give Me Doc
// @name:zh-CN   Give Me Doc — AI 对话导出 Word
// @namespace    https://github.com/nichuanfang/GiveMeDoc
// @version      1.0.0
// @description  Convert AI chat to Word documents — powered by Pandoc WASM
// @description:zh-CN  将 AI 对话导出为 Word 文档 — 由 Pandoc WASM 驱动
// @author       GiveMeDoc Contributors
// @homepageURL  https://github.com/nichuanfang/GiveMeDoc
// @supportURL   https://github.com/nichuanfang/GiveMeDoc/issues
// @icon         https://raw.githubusercontent.com/nichuanfang/GiveMeDoc/main/icons/icon-128.png
// @match        https://chat.deepseek.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      pandoc.org
// @connect      cdn.jsdelivr.net
// @noframes
// @run-at       document-idle
// @license      AGPL-3.0
// ==/UserScript==
`;

/**
 * Vite plugin: inject userscript metadata block at the very top of the output.
 * Using a generateBundle hook is more reliable than rollup's `banner` option
 * which can be overridden by Vite's internal license annotation processing.
 */
function userscriptBannerPlugin(): Plugin {
  return {
    name: 'userscript-banner',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = USERSCRIPT_META + '\n' + chunk.code;
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  if (mode === 'userscript') {
    return {
      plugins: [userscriptBannerPlugin()],
      build: {
        target: 'ES2022',
        outDir: 'dist/userscript',
        lib: {
          entry: resolve(__dirname, 'src/userscript.ts'),
          formats: ['iife'],
          name: 'GiveMeDoc',
          fileName: () => 'give-me-doc.user.js',
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
        minify: false,
        cssCodeSplit: false,
      },
      define: {
        __PLATFORM__: JSON.stringify('userscript'),
      },
    };
  }

  // mode === 'extension' (default)
  function copyWasmPlugin(): Plugin {
    return {
      name: 'copy-pandoc-wasm',
      closeBundle() {
        const src = resolve(__dirname, 'bin/pandoc.wasm');
        const dest = resolve(__dirname, 'dist/extension/pandoc.wasm');
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log('[copy-pandoc-wasm] bin/pandoc.wasm → dist/extension/pandoc.wasm');
        } else {
          console.warn('[copy-pandoc-wasm] bin/pandoc.wasm not found, skipping.');
        }
      },
    };
  }

  // Extension build: content script must be self-contained (no ES imports)
  // because Chrome content_scripts don't support ES modules.
  // We use two sequential builds:
  //   1. Content script + worker → IIFE (self-contained, no chunk splitting)
  //   2. Popup + background → ESM (can use chunks, loaded as module)
  //
  // The `mode` value selects which sub-build to run:
  //   - extension-content  → content.js + pandoc.worker.js (IIFE)
  //   - extension          → popup + background (ESM)

  if (mode === 'extension-content') {
    // Build 1: content script (IIFE, self-contained)
    return {
      plugins: [copyWasmPlugin()],
      build: {
        target: 'ES2022',
        outDir: 'dist/extension',
        rollupOptions: {
          input: resolve(__dirname, 'src/extension-content.ts'),
          output: {
            entryFileNames: 'content.js',
            assetFileNames: 'assets/[name][extname]',
            format: 'iife',
            inlineDynamicImports: true,
          },
        },
        minify: false,
        cssCodeSplit: false,
      },
      define: {
        __PLATFORM__: JSON.stringify('extension'),
      },
    };
  }

  if (mode === 'extension-worker') {
    // Build 2: pandoc worker (IIFE, self-contained)
    return {
      build: {
        target: 'ES2022',
        outDir: 'dist/extension',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, 'src/core/pandoc.worker.ts'),
          output: {
            entryFileNames: 'pandoc.worker.js',
            format: 'iife',
            inlineDynamicImports: true,
          },
        },
        minify: false,
        cssCodeSplit: false,
      },
      define: {
        __PLATFORM__: JSON.stringify('extension'),
      },
    };
  }

  // mode === 'extension' — Build 3: popup + background (ESM, can use chunks)
  return {
    build: {
      target: 'ES2022',
      outDir: 'dist/extension',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          'background': resolve(__dirname, 'src/extension-background.ts'),
          'popup': resolve(__dirname, 'src/extension-popup.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
      minify: false,
      cssCodeSplit: false,
    },
    define: {
      __PLATFORM__: JSON.stringify('extension'),
    },
  };
});
