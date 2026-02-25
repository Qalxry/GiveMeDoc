/**
 * Give Me Doc — Extension Popup Script
 *
 * Mounts the full panel UI (Export, Settings, About) inside the browser popup
 * by reusing panel.ts in "embedded" mode — no fixed positioning, dragging or
 * click-outside-to-close, but identical header / tabs / scrolling behaviour.
 *
 * Settings/About tabs work directly via browser.storage.
 * Export tab communicates with the content script via messaging to access
 * the DeepSeek session data and Pandoc WASM engine.
 */
import type { IMessage, PanelCallbacks } from './core/types';
import browser from 'webextension-polyfill';
import { createCallbacks } from './core/storage-helpers';
import { extStorage } from './core/storage/webext';
import { createPanel } from './ui/panel';

// Import CSS — Vite will bundle it as an asset for the popup HTML
import './ui/index.css';

declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Messaging helpers — communicate with content script
// ═══════════════════════════════════════════════════════════════════════════

async function sendToContentScript<T>(msg: Record<string, unknown>): Promise<T> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('未找到活跃标签页');
  return browser.tabs.sendMessage(tab.id, msg) as Promise<T>;
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
    try {
      const resp = await sendToContentScript<{ version: string }>({ type: 'GET_PANDOC_STATUS' });
      return resp?.version ?? '';
    } catch { return ''; }
  },

  isPandocReady() { return true; },

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
