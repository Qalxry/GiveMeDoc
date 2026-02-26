/**
 * Give Me Doc — Export Tab
 *
 * Renders the message list with checkboxes, content summaries,
 * branch switcher controls, and the bottom action bar (template select + export).
 *
 * BEM: .gmd-export, .gmd-export__*
 */
import type { PanelCallbacks, IMessage, IChatSession, TemplateMeta } from '../core/types';
import {
  el, append, html,
  createButton, createCheckbox, createIconButton,
  createSelect, setCheckboxState, getCheckboxState,
  createSegmentedControl, createInput, createTextarea,
} from './m3e/dom';
import { showToast } from './m3e/toast';
import {
  ICON_DOWNLOAD, ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT,
  ICON_USER, ICON_BOT, ICON_MESSAGES_SQUARE, ICON_REFRESH,
  ICON_TEXT_CURSOR_INPUT,
} from './m3e/icons';
import {
  getActiveChain, switchBranch, hasBranch, getChildIndex, getRootIds, getCurrentSessionId,
} from '../adapters/deepseek';

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let session: IChatSession | null = null;
let chain: IMessage[] = [];
let selectedIds = new Set<string>();
let templates: TemplateMeta[] = [];
let selectedTemplateId = '';

let spinStartTime = 0;
const MIN_SPIN_MS = 600; // match animation duration — at least half a rotation for better feedback

// Mode: 'session' = DeepSeek conversation export, 'freetext' = paste-your-own Markdown
let mode: 'session' | 'freetext' = 'session';
let freetextMd = '';
let freetextFilename = 'export';

// DOM refs
let listEl: HTMLElement;
let selectAllCb: HTMLElement;
let templateSelect: HTMLSelectElement;
let exportBtn: HTMLButtonElement;
let countLabel: HTMLElement;
let refreshBtn: HTMLButtonElement;
let root: HTMLElement;

// DOM refs — session mode container (toolbar + list)
let sessionContainer!: HTMLElement;
// DOM refs — freetext mode container
let freetextContainer!: HTMLElement;

// ═══════════════════════════════════════════════════════════════════════════
// Public render
// ═══════════════════════════════════════════════════════════════════════════

export function renderExportTab(cb: PanelCallbacks): HTMLElement {
  root = el('div', 'gmd-export');

  // ── Mode Switch (Segmented Control) ───────────────────────────────
  const modeSwitch = el('div', 'gmd-export__mode-switch');
  const segmented = createSegmentedControl({
    segments: [
      { id: 'session', label: '当前会话', icon: ICON_MESSAGES_SQUARE },
      { id: 'freetext', label: '自由输入', icon: ICON_TEXT_CURSOR_INPUT },
    ],
    activeId: mode,
    onChange: (id) => {
      mode = id as 'session' | 'freetext';
      applyModeSwitch();
    },
  });
  modeSwitch.appendChild(segmented);
  root.appendChild(modeSwitch);

  // ── Session mode container ──────────────────────────────────────────
  sessionContainer = el('div', 'gmd-export__session');

  // ── Toolbar ──────────────────────────────────────────────────────────
  const toolbar = el('div', 'gmd-export__toolbar');

  selectAllCb = createCheckbox({
    label: '全选',
    onChange: (checked) => {
      for (const msg of chain) {
        if (checked) selectedIds.add(msg.id);
        else selectedIds.delete(msg.id);
      }
      syncList();
    },
  });

  countLabel = el('span', 'gmd-export__count');
  countLabel.textContent = '0 条消息';

  refreshBtn = createIconButton({
    icon: ICON_REFRESH,
    title: '刷新会话',
    variant: 'standard',
    onClick: () => {
      refreshBtn.classList.add('gmd-icon-btn--spinning');
      spinStartTime = Date.now();
      loadSession(cb);
    },
  });

  append(toolbar, selectAllCb, countLabel, refreshBtn);
  sessionContainer.appendChild(toolbar);

  // ── Message List ─────────────────────────────────────────────────────
  listEl = el('div', 'gmd-export__list');
  sessionContainer.appendChild(listEl);

  root.appendChild(sessionContainer);

  // ── Freetext mode container ─────────────────────────────────────────
  freetextContainer = el('div', 'gmd-export__freetext');
  freetextContainer.style.display = 'none';

  const filenameInput = createInput({
    label: '导出文件名',
    value: freetextFilename,
    placeholder: 'export',
    onChange: (v) => {
      freetextFilename = v;
      syncExportBtnState();
    },
  });
  freetextContainer.appendChild(filenameInput);

  const mdTextarea = createTextarea({
    label: 'Markdown 内容',
    value: freetextMd,
    placeholder: '在此粘贴或输入 Markdown 文本…',
    rows: 12,
    onChange: (v) => {
      freetextMd = v;
      syncExportBtnState();
    },
  });
  mdTextarea.classList.add('gmd-export__freetext-editor');
  freetextContainer.appendChild(mdTextarea);

  root.appendChild(freetextContainer);

  // ── Bottom Bar ───────────────────────────────────────────────────────
  const bottomBar = el('div', 'gmd-export__bottom');

  templateSelect = createSelect({
    options: [],
    placeholder: '选择模板…',
    onChange: (v) => { selectedTemplateId = v; },
  });

  exportBtn = createButton({
    label: '导出',
    icon: ICON_DOWNLOAD,
    variant: 'filled',
    onClick: () => doExport(cb),
  });

  append(bottomBar, templateSelect, exportBtn);
  root.appendChild(bottomBar);

  // ── Initial load ─────────────────────────────────────────────────────
  loadSession(cb);
  loadTemplates(cb);

  return root;
}

// ═══════════════════════════════════════════════════════════════════════════
// Data loading
// ═══════════════════════════════════════════════════════════════════════════

async function loadSession(cb: PanelCallbacks): Promise<void> {
  try {
    session = await cb.getSession();
    if (!session) {
      listEl.textContent = '未检测到当前会话，请打开一个对话。';
      return;
    }
    chain = getActiveChain(session);
    selectedIds = new Set(chain.map((m) => m.id));
    renderList();
  } catch (err) {
    showToast({ message: `加载会话失败: ${(err as Error).message}`, level: 'error' });
  } finally {
    // Ensure at least one full rotation before stopping
    const elapsed = Date.now() - spinStartTime;
    const remaining = Math.max(0, MIN_SPIN_MS - elapsed);
    setTimeout(() => refreshBtn?.classList.remove('gmd-icon-btn--spinning'), remaining);
  }
}

async function loadTemplates(cb: PanelCallbacks): Promise<void> {
  try {
    templates = await cb.getTemplateList();
    const config = await cb.getConfig();
    selectedTemplateId = config.selectedTemplateId;
    rebuildTemplateSelect();
  } catch (err) {
    showToast({ message: `加载模板失败: ${(err as Error).message}`, level: 'error' });
  }
}

function rebuildTemplateSelect(): void {
  templateSelect.innerHTML = '';
  for (const t of templates) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name + (t.isBuiltin ? '' : ' (自定义)');
    if (t.id === selectedTemplateId) opt.selected = true;
    templateSelect.appendChild(opt);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Message list rendering
// ═══════════════════════════════════════════════════════════════════════════

function renderList(): void {
  listEl.innerHTML = '';
  for (const msg of chain) {
    listEl.appendChild(createMessageRow(msg));
  }
  syncCount();
}

function createMessageRow(msg: IMessage): HTMLElement {
  const row = el('div', `gmd-export__row gmd-export__row--${msg.role}`);

  // Checkbox
  const cb = createCheckbox({
    checked: selectedIds.has(msg.id),
    onChange: (checked) => {
      if (checked) selectedIds.add(msg.id);
      else selectedIds.delete(msg.id);
      syncCount();
    },
  });
  row.appendChild(cb);

  // Role icon
  const icon = html('span', 'gmd-export__role-icon', msg.role === 'user' ? ICON_USER : ICON_BOT);
  row.appendChild(icon);

  // Content summary
  const summary = el('span', 'gmd-export__summary');
  const plain = msg.content.replace(/[#*`>\-\[\]()]/g, '').trim();
  summary.textContent = plain.length > 80 ? plain.slice(0, 80) + '…' : plain;
  summary.title = plain.slice(0, 300);
  row.appendChild(summary);

  // Branch switcher (if parent has multiple children, or multiple roots)
  if (session && hasBranch(session, msg.parentId)) {
    const branchCtrl = createBranchSwitcher(msg);
    row.appendChild(branchCtrl);
  }

  return row;
}

function createBranchSwitcher(msg: IMessage): HTMLElement {
  if (!session) return el('span', '');

  const parentId = msg.parentId;
  const childrenIds = parentId === null
    ? getRootIds(session)
    : session.messages.get(parentId)!.childrenIds;
  const idx = getChildIndex(session, parentId, msg.id);
  const total = childrenIds.length;

  const ctrl = el('span', 'gmd-export__branch');

  const prevBtn = createIconButton({
    icon: ICON_CHEVRON_LEFT,
    title: '上一分支',
    variant: 'standard',
    onClick: () => navigateBranch(parentId, idx - 1),
  });
  if (idx <= 0) prevBtn.disabled = true;

  const label = el('span', 'gmd-export__branch-label');
  label.textContent = `${idx + 1}/${total}`;

  const nextBtn = createIconButton({
    icon: ICON_CHEVRON_RIGHT,
    title: '下一分支',
    variant: 'standard',
    onClick: () => navigateBranch(parentId, idx + 1),
  });
  if (idx >= total - 1) nextBtn.disabled = true;

  append(ctrl, prevBtn, label, nextBtn);
  return ctrl;
}

function navigateBranch(parentId: string | null, targetIdx: number): void {
  if (!session) return;

  const childrenIds = parentId === null
    ? getRootIds(session)
    : session.messages.get(parentId)?.childrenIds;
  if (!childrenIds || targetIdx < 0 || targetIdx >= childrenIds.length) return;

  const targetChildId = childrenIds[targetIdx];
  const prevSelectedIds = new Set(selectedIds);
  const prevChainIds = new Set(chain.map((m) => m.id));
  chain = switchBranch(session, parentId, targetChildId);

  // Preserve selection for messages that existed in the old chain;
  // default-select only newly introduced messages on the new branch.
  selectedIds = new Set(
    chain
      .filter((m) => prevChainIds.has(m.id) ? prevSelectedIds.has(m.id) : true)
      .map((m) => m.id),
  );
  renderList();
}

// ═══════════════════════════════════════════════════════════════════════════
// Mode switching
// ═══════════════════════════════════════════════════════════════════════════

function applyModeSwitch(): void {
  if (mode === 'session') {
    sessionContainer.style.display = '';
    freetextContainer.style.display = 'none';
  } else {
    sessionContainer.style.display = 'none';
    freetextContainer.style.display = '';
  }
  syncExportBtnState();
}

/** Update export button disabled state based on current mode's content. */
function syncExportBtnState(): void {
  if (mode === 'freetext') {
    exportBtn.disabled = !freetextMd.trim();
  } else {
    exportBtn.disabled = selectedIds.size === 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sync helpers
// ═══════════════════════════════════════════════════════════════════════════

function syncList(): void {
  const rows = listEl.querySelectorAll('.gmd-export__row');
  rows.forEach((row, i) => {
    const cb = row.querySelector('.gmd-checkbox') as HTMLElement | null;
    if (cb && chain[i]) {
      setCheckboxState(cb, selectedIds.has(chain[i].id));
    }
  });
  syncCount();
}

function syncCount(): void {
  const total = chain.length;
  const selected = selectedIds.size;
  countLabel.textContent = `${selected}/${total} 条消息`;

  // Sync select-all state
  const allChecked = total > 0 && selected === total;
  setCheckboxState(selectAllCb, allChecked);

  syncExportBtnState();
}

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

async function doExport(cb: PanelCallbacks): Promise<void> {
  if (mode === 'freetext') {
    if (!freetextMd.trim()) {
      showToast({ message: '请输入 Markdown 文本', level: 'warning' });
      return;
    }

    exportBtn.disabled = true;
    const origLabel = exportBtn.querySelector('.gmd-btn__label')!;
    const prevText = origLabel.textContent;
    origLabel.textContent = '导出中…';

    try {
      await cb.onExportRaw(freetextMd, selectedTemplateId, freetextFilename || 'export');
      showToast({ message: '导出成功', level: 'success' });
    } catch (err) {
      showToast({ message: `导出失败: ${(err as Error).message}`, level: 'error' });
    } finally {
      origLabel.textContent = prevText;
      exportBtn.disabled = false;
    }
    return;
  }

  // Session mode
  if (selectedIds.size === 0) {
    showToast({ message: '请至少选择一条消息', level: 'warning' });
    return;
  }

  exportBtn.disabled = true;
  const origLabel = exportBtn.querySelector('.gmd-btn__label')!;
  const prevText = origLabel.textContent;
  origLabel.textContent = '导出中…';

  try {
    await cb.onExport(Array.from(selectedIds), selectedTemplateId);
    showToast({ message: '导出成功', level: 'success' });
  } catch (err) {
    showToast({ message: `导出失败: ${(err as Error).message}`, level: 'error' });
  } finally {
    origLabel.textContent = prevText;
    exportBtn.disabled = false;
  }
}

/** Allow external refresh (e.g. after branch switch from other context). */
export function refreshExportTab(cb: PanelCallbacks): void {
  loadSession(cb);
}

/** Reload template dropdown (e.g. after uploading a custom template in settings). */
export function refreshExportTemplates(cb: PanelCallbacks): void {
  if (!root) return; // tab not yet rendered
  loadTemplates(cb);
}

/**
 * Intercept SPA navigation (history.pushState / replaceState + popstate)
 * and auto-refresh the export tab when the DeepSeek session ID changes.
 * Call once during script initialisation.
 */
export function setupUrlWatcher(cb: PanelCallbacks): void {
  let lastSessionId = getCurrentSessionId();

  function checkUrlChange(): void {
    const newId = getCurrentSessionId();
    if (newId !== lastSessionId) {
      lastSessionId = newId;
      refreshExportTab(cb);
    }
  }

  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPushState(...args);
    checkUrlChange();
  };
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplaceState(...args);
    checkUrlChange();
  };
  window.addEventListener('popstate', checkUrlChange);
}
