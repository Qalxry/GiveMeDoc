/**
 * Give Me Doc — Tampermonkey Userscript Entry Point
 *
 * Runs in the page context on chat.deepseek.com.
 * Responsibilities:
 *   1. GM_* storage adapter
 *   2. Download & init Pandoc WASM (from CDN)
 *   3. Inject panel CSS via GM_addStyle
 *   4. Wire PanelCallbacks → storage + converter
 *   5. Inject single-export buttons + share-panel button + menu command
 */
import type { IStorage } from './core/types';
import { initPandoc, isPandocReady, getPandocVersion, exportToDocx, downloadBlob } from './core/converter';
import {
  getCurrentSessionId, getSession, getActiveChain,
  injectSingleExportButtons, injectSharePanelButton,
} from './adapters/deepseek';
import { togglePanel } from './ui/panel';
import { showToast } from './ui/m3e/toast';
import {
  loadConfig, getTemplateBlob, createCallbacks,
} from './core/storage-helpers';
import PandocWorker from './core/pandoc.worker.ts?worker&inline';

// CSS will be inlined by Vite and injected via GM_addStyle
import css from './ui/index.css?inline';

declare const __PLATFORM__: 'userscript' | 'extension';
declare function GM_getValue<T>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_deleteValue(key: string): void;
declare function GM_addStyle(css: string): void;
declare function GM_registerMenuCommand(caption: string, onClick: () => void): void;
declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  responseType: string;
  onload: (resp: { response: ArrayBuffer; status: number }) => void;
  onerror: (err: unknown) => void;
}): void;

// ═══════════════════════════════════════════════════════════════════════════
// GM Storage Adapter
// ═══════════════════════════════════════════════════════════════════════════

const gmStorage: IStorage = {
  async get<T>(key: string): Promise<T | null> {
    const v = GM_getValue<T | null>(key, null);
    return v;
  },
  async set<T>(key: string, value: T): Promise<void> {
    GM_setValue(key, value);
  },
  async remove(key: string): Promise<void> {
    GM_deleteValue(key);
  },
  async getBlob(key: string): Promise<ArrayBuffer | null> {
    const b64 = GM_getValue<string | null>(key, null);
    if (!b64) return null;
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  },
  async setBlob(key: string, value: ArrayBuffer): Promise<void> {
    const bytes = new Uint8Array(value);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    GM_setValue(key, btoa(s));
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc WASM loading
// ═══════════════════════════════════════════════════════════════════════════

async function loadPandocWasm(): Promise<void> {
  const config = await loadConfig(gmStorage);
  const urls = config.cdnUrls;

  for (const url of urls) {
    try {
      showToast({ message: '正在下载 Pandoc WASM…', level: 'info', duration: 2000 });
      const wasmBytes = await fetchWasm(url);
      await initPandoc(wasmBytes, new PandocWorker());
      showToast({ message: `Pandoc 就绪 (${await getPandocVersion()})`, level: 'success' });
      return;
    } catch (err) {
      console.warn(`[GiveMeDoc] Failed to load from ${url}:`, err);
    }
  }
  showToast({ message: 'Pandoc WASM 加载失败，请检查 CDN 配置', level: 'error', duration: 0 });
}

function fetchWasm(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      onload: (resp) => {
        if (resp.status >= 200 && resp.status < 300) {
          resolve(resp.response);
        } else {
          reject(new Error(`HTTP ${resp.status}`));
        }
      },
      onerror: (err) => reject(err),
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════════════

(function main() {
  // 1. Inject styles
  GM_addStyle(css);

  const callbacks = createCallbacks(gmStorage);

  // 2. Register GM menu command to toggle panel
  GM_registerMenuCommand('📄 Give Me Doc 面板', () => togglePanel(callbacks));

  // 3. Inject per-message export buttons
  injectSingleExportButtons(async (md) => {
    if (!isPandocReady()) {
      showToast({ message: 'Pandoc 尚未就绪，请稍候…', level: 'warning' });
      return;
    }
    try {
      const config = await loadConfig(gmStorage);
      const refDocx = await getTemplateBlob(gmStorage, config.selectedTemplateId);
      // Single message export: wrap in a minimal session
      const { blob, filename } = await exportToDocx(
        [{ id: '0', parentId: null, role: 'assistant', content: md, thinkingContent: '', timestamp: Date.now(), status: 'finished', childrenIds: [] }],
        config,
        `单条消息导出`,
        refDocx,
      );
      downloadBlob(blob, filename);
      showToast({ message: '导出成功', level: 'success' });
    } catch (err) {
      showToast({ message: `导出失败: ${(err as Error).message}`, level: 'error' });
    }
  });

  // 4. Inject share-panel export button
  injectSharePanelButton(async (selectedIndices) => {
    if (!isPandocReady()) {
      showToast({ message: 'Pandoc 尚未就绪，请稍候…', level: 'warning' });
      return;
    }
    try {
      const sessionId = getCurrentSessionId();
      if (!sessionId) throw new Error('未检测到会话 ID');
      const session = await getSession(sessionId);
      const chain = getActiveChain(session);
      const messages = selectedIndices.map((i) => chain[i]).filter(Boolean);
      if (messages.length === 0) throw new Error('没有选中任何消息');

      const config = await loadConfig(gmStorage);
      const refDocx = await getTemplateBlob(gmStorage, config.selectedTemplateId);
      const { blob, filename } = await exportToDocx(messages, config, session.title, refDocx);
      downloadBlob(blob, filename);
      showToast({ message: '导出成功', level: 'success' });
    } catch (err) {
      showToast({ message: `导出失败: ${(err as Error).message}`, level: 'error' });
    }
  });

  // 5. Start loading Pandoc WASM in background
  loadPandocWasm().catch((err) => {
    console.error('[GiveMeDoc] Pandoc init failed:', err);
  });

  console.log('[GiveMeDoc] Userscript loaded ✓');
})();
