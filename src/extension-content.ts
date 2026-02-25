/**
 * Give Me Doc — Browser Extension Content Script
 *
 * Injected into chat.deepseek.com by the extension manifest.
 * Responsibilities:
 *   1. browser.storage adapter (via webextension-polyfill)
 *   2. Message the background script to fetch Pandoc WASM
 *   3. Inject CSS into page
 *   4. Wire PanelCallbacks → storage + converter
 *   5. Inject single-export buttons + share-panel button
 *   6. Listen for popup toggle messages
 */
import type { IStorage } from './core/types';
import browser from 'webextension-polyfill';
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

// Vite will extract CSS as an asset — import for side-effect bundling
import './ui/index.css';

declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Chrome Storage Adapter
// ═══════════════════════════════════════════════════════════════════════════

const extStorage: IStorage = {
  async get<T>(key: string): Promise<T | null> {
    const result = await browser.storage.local.get(key);
    return (result[key] as T) ?? null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },
  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },
  async getBlob(key: string): Promise<ArrayBuffer | null> {
    const result = await browser.storage.local.get(key);
    const b64 = result[key] as string | undefined;
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
    await browser.storage.local.set({ [key]: btoa(s) });
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc WASM loading
// ═══════════════════════════════════════════════════════════════════════════

async function loadPandocWasm(): Promise<void> {
  try {
    showToast({ message: '正在加载 Pandoc WASM…', level: 'info', duration: 2000 });

    // Request WASM bytes from background service worker
    const response: { wasm?: ArrayBuffer; error?: string } = await browser.runtime.sendMessage({
      type: 'FETCH_PANDOC_WASM',
    }) as { wasm?: ArrayBuffer; error?: string };

    if (response.error || !response.wasm) {
      throw new Error(response.error || '未收到 WASM 数据');
    }

    const workerUrl = browser.runtime.getURL('pandoc.worker.js');
    await initPandoc(response.wasm, workerUrl);
    showToast({ message: `Pandoc 就绪 (${await getPandocVersion()})`, level: 'success' });
  } catch (err) {
    console.error('[GiveMeDoc] Pandoc WASM load failed:', err);
    showToast({ message: `Pandoc 加载失败: ${(err as Error).message}`, level: 'error', duration: 0 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════════════

const callbacks = createCallbacks(extStorage);

// Listen for toggle from popup / background
browser.runtime.onMessage.addListener((msg: unknown) => {
  if ((msg as { type?: string })?.type === 'TOGGLE_PANEL') {
    togglePanel(callbacks);
  }
});

// Inject per-message export buttons
injectSingleExportButtons(async (md) => {
  if (!isPandocReady()) {
    showToast({ message: 'Pandoc 尚未就绪，请稍候…', level: 'warning' });
    return;
  }
  try {
    const config = await loadConfig(extStorage);
    const refDocx = await getTemplateBlob(extStorage, config.selectedTemplateId);
    const { blob, filename } = await exportToDocx(
      [{ id: '0', parentId: null, role: 'assistant', content: md, thinkingContent: '', timestamp: Date.now(), status: 'finished', childrenIds: [] }],
      config,
      '单条消息导出',
      refDocx,
    );
    downloadBlob(blob, filename);
    showToast({ message: '导出成功', level: 'success' });
  } catch (err) {
    showToast({ message: `导出失败: ${(err as Error).message}`, level: 'error' });
  }
});

// Inject share-panel export button
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

    const config = await loadConfig(extStorage);
    const refDocx = await getTemplateBlob(extStorage, config.selectedTemplateId);
    const { blob, filename } = await exportToDocx(messages, config, session.title, refDocx);
    downloadBlob(blob, filename);
    showToast({ message: '导出成功', level: 'success' });
  } catch (err) {
    showToast({ message: `导出失败: ${(err as Error).message}`, level: 'error' });
  }
});

// Load Pandoc WASM
loadPandocWasm().catch((err) => console.error('[GiveMeDoc] Init error:', err));

console.log('[GiveMeDoc] Extension content script loaded ✓');
