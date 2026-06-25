/**
 * Give Me Doc — DeepSeek platform adapter (all-in-one)
 *
 * Contains everything DeepSeek-specific in a single file:
 * - Auth token extraction
 * - API client (fetch session by id)
 * - IndexedDB reader (deepseek-chat / history-message)
 * - Combined session getter (IDB first → API fallback)
 * - Message tree builder (raw API → IMessage Map)
 * - Active chain & branch switching
 *
 * Icon imports are from the centralized m3e/icons module.
 * - DOM injection (single-export button, share-panel export button)
 *
 * DOM selectors & structures are driven by AdapterConfig (deepseek-config.ts)
 * which is upgradeable via CDN at runtime.
 *
 * References: docs/deepseek.md
 */
import type {
  IMessage,
  IChatSession,
  DSRawMessage,
  DSRawSession,
  DSHistoryResponse,
  DSIDBRecord,
  DSFragment,
} from '../core/types';
import { ICON_FILE_TYPE, iconSize } from '../ui/m3e/icons';
import { loadAdapterConfig } from './deepseek-config';
import { AdapterEngine } from './adapter-engine';

// ═══════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════

/** Extract JWT from DeepSeek's localStorage. */
export function getToken(): string | null {
  try {
    const raw = localStorage.getItem('userToken');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchSessionFromAPI(sessionId: string, token: string): Promise<IChatSession> {
  const engine = await getEngine();
  const api = engine.getApiConfig();
  const url = engine.buildApiUrl('historyMessages', { sessionId });
  const res = await fetch(url, {
    headers: { ...api.headers, authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status} ${res.statusText}`);
  const json: DSHistoryResponse = await res.json();
  if (json.code !== 0) throw new Error(`DeepSeek biz error: code=${json.code}`);

  const { chat_session, chat_messages } = json.data.biz_data;
  return buildSession(chat_session, chat_messages);
}

// ═══════════════════════════════════════════════════════════════════════════
// IndexedDB
// ═══════════════════════════════════════════════════════════════════════════

function openDeepSeekDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('deepseek-chat');
    req.onerror = () => reject(new Error('Cannot open deepseek-chat IndexedDB'));
    req.onsuccess = () => resolve(req.result);
  });
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T | undefined);
  });
}

export async function fetchSessionFromIDB(sessionId: string): Promise<IChatSession | null> {
  try {
    const db = await openDeepSeekDB();
    const record = await idbGet<DSIDBRecord>(db, 'history-message', sessionId);
    db.close();
    if (!record?.data?.chat_session || !record.data.chat_messages?.length) return null;

    return buildSession(record.data.chat_session, record.data.chat_messages);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Combined getter: IDB first → API fallback
// ═══════════════════════════════════════════════════════════════════════════

export async function getSession(sessionId: string): Promise<IChatSession> {
  // Try IDB first
  const idbSession = await fetchSessionFromIDB(sessionId);
  if (idbSession && idbSession.messages.size > 0) {
    return idbSession;
  }

  // Fallback to API
  const token = getToken();
  if (!token) throw new Error('No DeepSeek auth token found');
  return fetchSessionFromAPI(sessionId, token);
}

// ═══════════════════════════════════════════════════════════════════════════
// Message tree builder
// ═══════════════════════════════════════════════════════════════════════════

function buildSession(rawSession: DSRawSession, rawMessages: DSRawMessage[]): IChatSession {
  const messages = new Map<string, IMessage>();

  // First pass: create all IMessage objects
  for (const rm of rawMessages) {
    const id = String(rm.message_id);
    const parentId = rm.parent_id != null ? String(rm.parent_id) : null;

    let content = '';
    let thinkingContent = '';
    for (const frag of rm.fragments) {
      if (frag.type === 'REQUEST' || frag.type === 'RESPONSE') {
        content += frag.content;
      } else if (frag.type === 'THINK') {
        thinkingContent += frag.content;
      }
    }

    messages.set(id, {
      id,
      parentId,
      role: rm.role === 'USER' ? 'user' : 'assistant',
      content,
      thinkingContent,
      timestamp: rm.inserted_at,
      status: rm.status === 'FINISHED' ? 'finished' : rm.status === 'INCOMPLETE' ? 'incomplete' : 'error',
      childrenIds: [],
    });
  }

  // Second pass: wire up children
  for (const msg of messages.values()) {
    if (msg.parentId && messages.has(msg.parentId)) {
      const parent = messages.get(msg.parentId)!;
      if (!parent.childrenIds.includes(msg.id)) {
        parent.childrenIds.push(msg.id);
      }
    }
  }

  return {
    id: rawSession.id,
    title: rawSession.title,
    updatedAt: rawSession.updated_at,
    messages,
    currentMessageId: String(rawSession.current_message_id),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Active chain & Branch switching
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trace from currentMessageId back to root → returns ordered array [root, ..., leaf].
 */
export function getActiveChain(session: IChatSession): IMessage[] {
  const chain: IMessage[] = [];
  let id: string | null = session.currentMessageId;
  while (id) {
    const msg = session.messages.get(id);
    if (!msg) break;
    chain.unshift(msg);
    id = msg.parentId;
  }
  return chain;
}

/**
 * Build a chain from root to a specific leaf, following a chosen branch at `nodeId`.
 *
 * 1. Trace from nodeId back to root (prefix)
 * 2. From targetChildId, follow the first child repeatedly until leaf (suffix)
 * 3. Return prefix + suffix
 */
export function switchBranch(
  session: IChatSession,
  nodeId: string | null,
  targetChildId: string,
): IMessage[] {
  const messages = session.messages;

  // Build prefix: root → nodeId (empty if nodeId is null = virtual root)
  const prefix: IMessage[] = [];
  if (nodeId !== null) {
    let id: string | null = nodeId;
    while (id) {
      const msg = messages.get(id);
      if (!msg) break;
      prefix.unshift(msg);
      id = msg.parentId;
    }
  }

  // Build suffix: targetChildId → leaf (always follow first child)
  const suffix: IMessage[] = [];
  let current: string | null = targetChildId;
  while (current) {
    const msg = messages.get(current);
    if (!msg) break;
    suffix.push(msg);
    current = msg.childrenIds.length > 0 ? msg.childrenIds[0] : null;
  }

  return [...prefix, ...suffix];
}

/** Check if a node has multiple children (i.e. a branch point). Pass null for virtual root. */
export function hasBranch(session: IChatSession, nodeId: string | null): boolean {
  if (nodeId === null) return getRootIds(session).length > 1;
  const msg = session.messages.get(nodeId);
  return !!msg && msg.childrenIds.length > 1;
}

/** Get the index of a child within its parent's childrenIds. Pass null parentId for root. */
export function getChildIndex(session: IChatSession, parentId: string | null, childId: string): number {
  if (parentId === null) return getRootIds(session).indexOf(childId);
  const parent = session.messages.get(parentId);
  if (!parent) return 0;
  return parent.childrenIds.indexOf(childId);
}

/** Get all root message IDs (parentId === null) in insertion order. */
export function getRootIds(session: IChatSession): string[] {
  const ids: string[] = [];
  for (const msg of session.messages.values()) {
    if (msg.parentId === null) ids.push(msg.id);
  }
  return ids;
}

// ═══════════════════════════════════════════════════════════════════════════
// Current page session ID
// ═══════════════════════════════════════════════════════════════════════════

/** Extract session id from DeepSeek URL: /a/chat/s/{uuid} */
export function getCurrentSessionId(): string | null {
  const m = window.location.pathname.match(/\/a\/chat\/s\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOM Injection — Single message export button
// ═══════════════════════════════════════════════════════════════════════════

const FILE_TYPE_SVG = iconSize(ICON_FILE_TYPE, 16);

/** Module-level engine singleton, lazily initialized. */
let _engine: AdapterEngine | null = null;
let _engineInit: Promise<void> | null = null;

async function getEngine(): Promise<AdapterEngine> {
  if (_engine) return _engine;
  if (!_engineInit) {
    _engineInit = (async () => {
      const config = await loadAdapterConfig();
      _engine = new AdapterEngine(config);
    })();
  }
  await _engineInit;
  return _engine!;
}

/**
 * Inject a "export to docx" icon button into the message toolbar.
 * Uses MutationObserver to handle dynamically added / hover-shown messages.
 *
 * DOM selectors and button markup come from AdapterConfig (CDN-upgradeable).
 *
 * Calling code does NOT need to await — errors are silently caught.
 */
export async function injectSingleExportButtons(onClick: (md: string, title: string) => void): Promise<void> {
  const MARKER_ATTR = 'data-gmd-injected';
  const engine = await getEngine();

  function processToolbar(toolbar: Element): void {
    if (toolbar.hasAttribute(MARKER_ATTR)) return;
    toolbar.setAttribute(MARKER_ATTR, '1');

    // Multi-strategy: try SVG fingerprint → first-child → selector+index
    const copyBtn = engine.findCopyButton(toolbar);
    if (!copyBtn) return;

    const exportBtn = engine.createToolbarExportButton(FILE_TYPE_SVG);
    exportBtn.setAttribute('aria-disabled', 'false');
    exportBtn.title = '导出为 Word';

    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // 1. Simulate click on the copy button
      (copyBtn as HTMLElement).click();

      // 2. Brief delay — clipboard write is async
      await new Promise((r) => setTimeout(r, 300));

      // 3. Read clipboard
      try {
        const md = await navigator.clipboard.readText();
        if (md) {
          const title = document.title.replace(/ - DeepSeek$/, '').trim() || '单条消息导出';
          onClick(md, title);
        }
      } catch (err) {
        console.error('[GiveMeDoc] Clipboard read failed:', err);
      }
    });

    // Append after the last toolbar button
    toolbar.appendChild(exportBtn);
  }

  function scanAll(): void {
    const toolbars = engine.findToolbars();
    toolbars.forEach(processToolbar);
  }

  // Initial scan
  scanAll();

  // Watch for new messages
  const observer = new MutationObserver(() => scanAll());
  observer.observe(document.body, { childList: true, subtree: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// DOM Injection — Share panel export button
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inject an "导出为 Word" button in DeepSeek's share dialog bottom bar.
 * Watches for the dialog to appear (detected by the "创建分享链接" button).
 *
 * DOM selectors / button markup come from AdapterConfig (CDN-upgradeable).
 * Multi-strategy lookup: text → selector → svg fingerprint.
 */
export async function injectSharePanelButton(onClick: (selectedIndices: number[]) => void): Promise<void> {
  const MARKER_ATTR = 'data-gmd-share-injected';
  const engine = await getEngine();

  function tryInject(): void {
    const shareBtn = engine.findShareTrigger();
    if (!shareBtn) return;

    const bottomBar = shareBtn.parentElement;
    if (!bottomBar || bottomBar.hasAttribute(MARKER_ATTR)) return;
    bottomBar.setAttribute(MARKER_ATTR, '1');

    const exportBtn = engine.createShareExportButton(FILE_TYPE_SVG);

    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Read selected checkboxes — skip "全选" (inside ds-checkbox-wrapper)
      const checkboxes = engine.getMessageCheckboxes();
      const indices: number[] = [];

      for (let i = 0; i < checkboxes.length; i++) {
        if (engine.isCheckboxActive(checkboxes[i])) {
          indices.push(i);
        }
      }
      onClick(indices);
    });

    bottomBar.insertBefore(exportBtn, shareBtn);
  }

  // Watch for dialog appearance
  const observer = new MutationObserver(() => tryInject());
  observer.observe(document.body, { childList: true, subtree: true });
  tryInject();
}
