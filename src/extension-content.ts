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
import browser from 'webextension-polyfill';
import { initPandoc, isPandocReady, getPandocVersion } from './core/converter';
import {
  getCurrentSessionId, getSession,
  injectSingleExportButtons, injectSharePanelButton,
} from './adapters/deepseek';
import { togglePanel } from './ui/panel';
import { createFab, destroyFab, isFabMounted } from './ui/fab';
import { setupUrlWatcher } from './ui/panel-export';
import { showToast } from './ui/m3e/toast';
import {
  loadConfig, createCallbacks,
  createSingleExportHandler, createShareExportHandler,
} from './core/storage-helpers';
import { extStorage } from './core/storage/webext';

// Vite will extract CSS as an asset — import for side-effect bundling
import './ui/index.css';

declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc WASM loading
// ═══════════════════════════════════════════════════════════════════════════

async function loadPandocWasm(): Promise<void> {
  try {
    showToast({ message: '正在加载 Pandoc WASM…', level: 'info', duration: 2000 });

    // Fetch WASM directly from the extension's web-accessible resources.
    // This avoids passing a 58 MB ArrayBuffer through runtime.sendMessage
    // (which would lose the ArrayBuffer type via structured cloning).
    const wasmUrl = browser.runtime.getURL('pandoc.wasm');
    const wasmResp = await fetch(wasmUrl);
    if (!wasmResp.ok) throw new Error(`WASM fetch failed: ${wasmResp.status}`);
    const wasmBytes = await wasmResp.arrayBuffer();

    // Content scripts run in the page's origin, so we cannot directly
    // `new Worker('chrome-extension://…')`.  Fetch the script text and
    // create a blob URL that the page origin can load.
    const workerScriptUrl = browser.runtime.getURL('pandoc.worker.js');
    const workerResp = await fetch(workerScriptUrl);
    const workerText = await workerResp.text();
    const blob = new Blob([workerText], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    // Worker script is IIFE (not module), so don't pass { type: 'module' }
    const pandocWorker = new Worker(blobUrl);
    await initPandoc(wasmBytes, pandocWorker);
    showToast({ message: `Pandoc 就绪 (${await getPandocVersion()})`, level: 'success' });
  } catch (err) {
    console.error('[GiveMeDoc] Pandoc WASM load failed:', err);
    showToast({ message: `Pandoc 加载失败: ${(err as Error).message}`, level: 'error', duration: 0 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════════════

const callbacks = createCallbacks(extStorage, undefined, (show) => {
  if (show) { if (!isFabMounted()) createFab(callbacks); }
  else { destroyFab(); }
});

// Listen for messages from popup / background
browser.runtime.onMessage.addListener(((msg: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
  const m = msg as { type?: string; [key: string]: unknown };
  switch (m?.type) {
    case 'TOGGLE_PANEL':
      togglePanel(callbacks);
      break;

    case 'GET_SESSION': {
      (async () => {
        try {
          const id = getCurrentSessionId();
          if (!id) return sendResponse({ session: null });
          const session = await getSession(id);
          // Serialize Map to array of entries for messaging
          sendResponse({
            session: {
              ...session,
              messages: Array.from(session.messages.entries()),
            },
          });
        } catch (err) {
          sendResponse({ error: (err as Error).message });
        }
      })();
      return true; // async response
    }

    case 'EXPORT': {
      const { selectedIds: ids, templateId } = m as { selectedIds: string[]; templateId: string; type: string };
      (async () => {
        try {
          await callbacks.onExport(ids, templateId);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ error: (err as Error).message });
        }
      })();
      return true;
    }

    case 'GET_PANDOC_STATUS': {
      (async () => {
        try {
          const version = await getPandocVersion();
          sendResponse({ ready: isPandocReady(), version });
        } catch {
          sendResponse({ ready: false, version: '' });
        }
      })();
      return true;
    }
  }
}) as Parameters<typeof browser.runtime.onMessage.addListener>[0]);

// Mount FAB if enabled
loadConfig(extStorage).then((cfg) => {
  if (cfg.showFab) createFab(callbacks);
});

// Inject per-message export buttons
injectSingleExportButtons(createSingleExportHandler(extStorage));

// Inject share-panel export button
injectSharePanelButton(createShareExportHandler(extStorage));

// Watch for SPA URL changes and auto-refresh export tab
setupUrlWatcher(callbacks);

// Load Pandoc WASM
loadPandocWasm().catch((err) => console.error('[GiveMeDoc] Init error:', err));

console.log('[GiveMeDoc] Extension content script loaded ✓');
