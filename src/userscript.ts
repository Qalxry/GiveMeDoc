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
import { initPandoc, isPandocReady, getPandocVersion } from './core/converter';
import {
  injectSingleExportButtons, injectSharePanelButton,
} from './adapters/deepseek';
import { injectSingleExportButtons as injectDoubaoSingleExportButtons } from './adapters/doubao';
import { togglePanel } from './ui/panel';
import { createFab, destroyFab, isFabMounted } from './ui/fab';
import { setupUrlWatcher } from './ui/panel-export';
import { showToast } from './ui/m3e/toast';
import {
  loadConfig, createCallbacks,
  createSingleExportHandler, createShareExportHandler,
} from './core/storage-helpers';
import { gmStorage } from './core/storage/gm';
import PandocWorker from './core/pandoc.worker.ts?worker&inline';

// CSS will be inlined by Vite and injected via GM_addStyle
import css from './ui/index.css?inline';

declare const __PLATFORM__: 'userscript' | 'extension';
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
// IndexedDB WASM Cache
// ═══════════════════════════════════════════════════════════════════════════

const WASM_DB_NAME = 'gmd-wasm-cache';
const WASM_DB_VERSION = 1;
const WASM_STORE = 'wasm';

function openWasmDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(WASM_DB_NAME, WASM_DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(WASM_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedWasm(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openWasmDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WASM_STORE, 'readonly');
      const req = tx.objectStore(WASM_STORE).get(url);
      req.onsuccess = () => { db.close(); resolve((req.result as ArrayBuffer) ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
}

async function setCachedWasm(url: string, bytes: ArrayBuffer): Promise<void> {
  try {
    const db = await openWasmDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WASM_STORE, 'readwrite');
      const req = tx.objectStore(WASM_STORE).put(bytes, url);
      req.onsuccess = () => { db.close(); resolve(); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch (err) {
    console.warn('[GiveMeDoc] Failed to cache WASM:', err);
  }
}

async function clearWasmCache(): Promise<void> {
  const db = await openWasmDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WASM_STORE, 'readwrite');
    const req = tx.objectStore(WASM_STORE).clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc WASM loading
// ═══════════════════════════════════════════════════════════════════════════

async function loadPandocWasm(): Promise<void> {
  const config = await loadConfig(gmStorage);
  const urls = config.cdnUrls;

  for (const url of urls) {
    try {
      // 优先从 IndexedDB 缓存加载，避免重复下载 58 MB 的 WASM 文件
      const cached = await getCachedWasm(url);
      if (cached) {
        // showToast({ message: '从缓存加载 Pandoc WASM…', level: 'info', duration: 2000 });
        await initPandoc(cached, new PandocWorker());
        // showToast({ message: `Pandoc 就绪 (${await getPandocVersion()})`, level: 'success' });
        return;
      }
      // 缓存未命中：下载并存入 IndexedDB（以 URL 为缓存键，URL 变更时自动失效）
      showToast({ message: '正在下载 Pandoc WASM…', level: 'info', duration: 2000 });
      const wasmBytes = await fetchWasm(url);
      await setCachedWasm(url, wasmBytes);
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

  const callbacks = createCallbacks(gmStorage, clearWasmCache, (show) => {
    if (show) { if (!isFabMounted()) createFab(callbacks); }
    else { destroyFab(); }
  });

  // 2. Register GM menu commands
  GM_registerMenuCommand('📄 Give Me Doc 面板', () => togglePanel(callbacks));

  // 3. Mount FAB if enabled
  loadConfig(gmStorage).then((cfg) => {
    if (cfg.showFab) createFab(callbacks);
  });

  // 4. Inject per-message export buttons (platform-specific)
  const hostname = window.location.hostname;
  if (hostname.includes('doubao.com')) {
    injectDoubaoSingleExportButtons(createSingleExportHandler(gmStorage));
  } else {
    // DeepSeek (default)
    injectSingleExportButtons(createSingleExportHandler(gmStorage));

    // 5. Inject share-panel export button (DeepSeek only)
    injectSharePanelButton(createShareExportHandler(gmStorage));
  }

  // 5. Watch for SPA URL changes and auto-refresh export tab
  setupUrlWatcher(callbacks);

  // 6. Start loading Pandoc WASM in background
  loadPandocWasm().catch((err) => {
    console.error('[GiveMeDoc] Pandoc init failed:', err);
  });

  console.log('[GiveMeDoc] Userscript loaded ✓');
})();
