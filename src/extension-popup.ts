/**
 * Give Me Doc — Extension Popup Script
 *
 * Mounts the full panel UI (Export, Settings, About) inside the browser popup
 * by reusing panel.ts in "embedded" mode — no fixed positioning, dragging or
 * click-outside-to-close, but identical header / tabs / scrolling behaviour.
 *
 * Settings/About tabs work directly via browser.storage.
 * Export tab: session export delegates to the content script (DeepSeek pages only);
 * free-text export loads Pandoc WASM locally in the popup so it works on any page.
 */
import type { IMessage, PanelCallbacks } from './core/types';
import browser from 'webextension-polyfill';
import { initPandoc, isPandocReady, getPandocVersion, exportRawToDocx, downloadBlob } from './core/converter';
import { createCallbacks, loadConfig, getTemplateBlob } from './core/storage-helpers';
import { extStorage } from './core/storage/webext';
import { createPanel } from './ui/panel';

// Import CSS — Vite will bundle it as an asset for the popup HTML
import './ui/index.css';

declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc WASM — loaded directly in the popup for self-sufficient export
// ═══════════════════════════════════════════════════════════════════════════

let pandocLoading: Promise<void> | null = null;

async function ensurePandoc(): Promise<void> {
  if (isPandocReady()) return;
  if (!pandocLoading) pandocLoading = loadPandocInPopup();
  return pandocLoading;
}

async function loadPandocInPopup(): Promise<void> {
  // Popup runs in the extension origin → can fetch extension resources directly
  const wasmUrl = browser.runtime.getURL('pandoc.wasm');
  const wasmResp = await fetch(wasmUrl);
  if (!wasmResp.ok) throw new Error(`WASM fetch failed: ${wasmResp.status}`);
  const wasmBytes = await wasmResp.arrayBuffer();

  const workerScriptUrl = browser.runtime.getURL('pandoc.worker.js');
  const workerResp = await fetch(workerScriptUrl);
  const workerText = await workerResp.text();
  const blob = new Blob([workerText], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const pandocWorker = new Worker(blobUrl);
  await initPandoc(wasmBytes, pandocWorker);
}

// ═══════════════════════════════════════════════════════════════════════════
// Messaging helpers — communicate with content script
// ═══════════════════════════════════════════════════════════════════════════

async function sendToContentScript<T>(msg: Record<string, unknown>): Promise<T> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('未找到活跃标签页');
  try {
    return await (browser.tabs.sendMessage(tab.id, msg) as Promise<T>);
  } catch {
    throw new Error('请先打开 DeepSeek 页面（Pandoc 引擎仅在该页面加载）');
  }
}

/** Deserialize IChatSession from messaging (Map sent as array of entries). */
function deserializeSession(raw: {
  id: string; title: string; updatedAt: number;
  messages: [string, IMessage][]; currentMessageId: string;
}) {
  return { ...raw, messages: new Map(raw.messages) };
}

// ═══════════════════════════════════════════════════════════════════════════
// Build callbacks — reuse createCallbacks with popup-specific overrides
// ═══════════════════════════════════════════════════════════════════════════

const popupOverrides: Partial<PanelCallbacks> = {
  async onExport(selectedIds, templateId) {
    const resp = await sendToContentScript<{ ok?: boolean; error?: string }>({
      type: 'EXPORT', selectedIds, templateId,
    });
    if (resp?.error) throw new Error(resp.error);
  },

  async onExportRaw(markdown, templateId, filename) {
    // Free-text export runs entirely in the popup — no content script needed
    await ensurePandoc();
    const config = await loadConfig(extStorage);
    const refDocx = await getTemplateBlob(extStorage, templateId);
    const { blob, filename: outName } = await exportRawToDocx(markdown, filename, refDocx, config.lineBreaks);
    downloadBlob(blob, outName);
  },

  async getSession() {
    try {
      const resp = await sendToContentScript<{
        session: { id: string; title: string; updatedAt: number;
                   messages: [string, IMessage][]; currentMessageId: string } | null;
        error?: string;
      }>({ type: 'GET_SESSION' });
      if (resp?.error) throw new Error(resp.error);
      if (!resp?.session) return null;
      return deserializeSession(resp.session);
    } catch {
      return null;
    }
  },

  async getPandocVersion() {
    // Eagerly load local Pandoc so we can report the real version
    try {
      await ensurePandoc();
      return getPandocVersion();
    } catch { /* local load failed, fall back */ }
    // Fall back to content script
    try {
      const resp = await sendToContentScript<{ version: string }>({ type: 'GET_PANDOC_STATUS' });
      return resp?.version ?? '';
    } catch { return ''; }
  },

  isPandocReady() {
    // Popup has its own Pandoc — always report ready (will lazy-load on first export)
    return true;
  },

  // FAB is not applicable in the popup context
  onFabToggle: undefined,
};

const callbacks = createCallbacks(extStorage, undefined, undefined, popupOverrides);

// ═══════════════════════════════════════════════════════════════════════════
// Mount — reuse panel.ts in embedded mode
// ═══════════════════════════════════════════════════════════════════════════

createPanel(callbacks, {
  container: document.getElementById('gmd-popup-root')!,
  embedded: true,
});
