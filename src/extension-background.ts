/**
 * Give Me Doc — Extension Background Service Worker
 *
 * Minimal responsibilities:
 *   1. Fetch Pandoc WASM on behalf of content script (bypass CORS)
 *   2. Handle toolbar icon click → send TOGGLE_PANEL to active tab
 *   3. Cache WASM bytes in memory to avoid re-download
 */
import browser from 'webextension-polyfill';

// ═══════════════════════════════════════════════════════════════════════════
// WASM cache & fetch
// ═══════════════════════════════════════════════════════════════════════════

const PANDOC_WASM_URL =
  'https://pandoc.org/app/pandoc.wasm?sha1=2ab8055eb0803168da93d4b784fe40aa06551dfa';

let wasmCache: ArrayBuffer | null = null;

async function fetchPandocWasm(): Promise<ArrayBuffer> {
  if (wasmCache) return wasmCache;

  const response = await fetch(PANDOC_WASM_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Pandoc WASM: ${response.status} ${response.statusText}`);
  }
  wasmCache = await response.arrayBuffer();
  return wasmCache;
}

// ═══════════════════════════════════════════════════════════════════════════
// Message handling
// ═══════════════════════════════════════════════════════════════════════════

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FETCH_PANDOC_WASM') {
    fetchPandocWasm()
      .then((wasm) => sendResponse({ wasm }))
      .catch((err) => sendResponse({ error: (err as Error).message }));
    // Return true to indicate async sendResponse
    return true;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Toolbar icon click → toggle panel in content script
// ═══════════════════════════════════════════════════════════════════════════

browser.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  try {
    await browser.tabs.sendMessage(tab.id!, { type: 'TOGGLE_PANEL' });
  } catch {
    // Content script not loaded on this page — ignore
  }
});

console.log('[GiveMeDoc] Background service worker loaded ✓');
