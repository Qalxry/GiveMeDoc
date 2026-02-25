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
import type {
  IStorage, UserConfig, TemplateMeta, PanelCallbacks, IChatSession,
} from './core/types';
import { DEFAULT_CONFIG } from './core/types';
import { initPandoc, isPandocReady, getPandocVersion, exportToDocx, downloadBlob } from './core/converter';
import {
  getCurrentSessionId, getSession, getActiveChain,
  injectSingleExportButtons, injectSharePanelButton,
} from './adapters/deepseek';
import { togglePanel } from './ui/panel';
import { showToast } from './ui/m3e/toast';

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
// Config helpers
// ═══════════════════════════════════════════════════════════════════════════

async function loadConfig(): Promise<UserConfig> {
  const saved = await gmStorage.get<Partial<UserConfig>>('config');
  return { ...DEFAULT_CONFIG, ...saved };
}

async function saveConfigPartial(partial: Partial<UserConfig>): Promise<void> {
  const current = await loadConfig();
  await gmStorage.set('config', { ...current, ...partial });
}

// ═══════════════════════════════════════════════════════════════════════════
// Template management
// ═══════════════════════════════════════════════════════════════════════════

/** Built-in templates loaded from generated file (if available). */
let builtinTemplates: TemplateMeta[] = [
  { id: 'builtin-gb', name: 'GB/T 标准格式', isBuiltin: true, description: '符合国标的 Word 格式' },
];

async function getTemplateList(): Promise<TemplateMeta[]> {
  const custom = await gmStorage.get<TemplateMeta[]>('custom-templates') ?? [];
  return [...builtinTemplates, ...custom];
}

async function uploadTemplate(name: string, data: ArrayBuffer): Promise<void> {
  const id = `custom-${Date.now()}`;
  const meta: TemplateMeta = { id, name, isBuiltin: false };
  const list = await gmStorage.get<TemplateMeta[]>('custom-templates') ?? [];
  list.push(meta);
  await gmStorage.set('custom-templates', list);
  await gmStorage.setBlob(`tpl-blob-${id}`, data);
}

async function deleteTemplate(id: string): Promise<void> {
  const list = await gmStorage.get<TemplateMeta[]>('custom-templates') ?? [];
  await gmStorage.set('custom-templates', list.filter((t) => t.id !== id));
  await gmStorage.remove(`tpl-blob-${id}`);
}

async function getTemplateBlob(id: string): Promise<ArrayBuffer | undefined> {
  if (id.startsWith('builtin-')) {
    // TODO: load from builtin-templates.generated.ts
    return undefined;
  }
  return (await gmStorage.getBlob(`tpl-blob-${id}`)) ?? undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc WASM loading
// ═══════════════════════════════════════════════════════════════════════════

async function loadPandocWasm(): Promise<void> {
  const config = await loadConfig();
  const urls = config.cdnUrls;

  for (const url of urls) {
    try {
      showToast({ message: '正在下载 Pandoc WASM…', level: 'info', duration: 2000 });
      const wasmBytes = await fetchWasm(url);
      const workerBlob = new Blob(
        [`import './core/pandoc.worker.ts';`],
        { type: 'application/javascript' },
      );
      // In userscript IIFE mode, the worker code is inlined.
      // We create a blob URL pointing to the bundled worker.
      const workerUrl = new URL('./core/pandoc.worker.ts', import.meta.url);
      await initPandoc(wasmBytes, workerUrl);
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
// Panel Callbacks
// ═══════════════════════════════════════════════════════════════════════════

function createCallbacks(): PanelCallbacks {
  return {
    async onExport(selectedIds, templateId) {
      const sessionId = getCurrentSessionId();
      if (!sessionId) throw new Error('未检测到会话 ID');

      const session = await getSession(sessionId);
      const chain = getActiveChain(session);
      const selectedSet = new Set(selectedIds);
      const messages = chain.filter((m) => selectedSet.has(m.id));
      if (messages.length === 0) throw new Error('没有选中任何消息');

      const config = await loadConfig();
      const refDocx = await getTemplateBlob(templateId);
      const { blob, filename } = await exportToDocx(messages, config, session.title, refDocx);
      downloadBlob(blob, filename);
    },

    async onTemplateUpload(name, data) {
      await uploadTemplate(name, data);
    },

    async onTemplateDelete(id) {
      await deleteTemplate(id);
    },

    async onConfigChange(partial) {
      await saveConfigPartial(partial);
    },

    async getConfig() {
      return loadConfig();
    },

    async getTemplateList() {
      return getTemplateList();
    },

    async getSession() {
      const id = getCurrentSessionId();
      if (!id) return null;
      return getSession(id);
    },

    async getPandocVersion() {
      return getPandocVersion();
    },

    isPandocReady() {
      return isPandocReady();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════════════

(function main() {
  // 1. Inject styles
  GM_addStyle(css);

  const callbacks = createCallbacks();

  // 2. Register GM menu command to toggle panel
  GM_registerMenuCommand('📄 Give Me Doc 面板', () => togglePanel(callbacks));

  // 3. Inject per-message export buttons
  injectSingleExportButtons(async (md) => {
    if (!isPandocReady()) {
      showToast({ message: 'Pandoc 尚未就绪，请稍候…', level: 'warning' });
      return;
    }
    try {
      const config = await loadConfig();
      const refDocx = await getTemplateBlob(config.selectedTemplateId);
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

      const config = await loadConfig();
      const refDocx = await getTemplateBlob(config.selectedTemplateId);
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
