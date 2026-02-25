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
} from './m3e/dom';
import { showToast } from './m3e/toast';
import {
  ICON_DOWNLOAD, ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT,
  ICON_USER, ICON_BOT, ICON_CHECK, ICON_LIST, ICON_REFRESH,
} from './m3e/icons';
import {
  getActiveChain, switchBranch, hasBranch, getChildIndex,
} from '../adapters/deepseek';

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let session: IChatSession | null = null;
let chain: IMessage[] = [];
let selectedIds = new Set<string>();
let templates: TemplateMeta[] = [];
let selectedTemplateId = '';

// DOM refs
let listEl: HTMLElement;
let selectAllCb: HTMLElement;
let templateSelect: HTMLSelectElement;
let exportBtn: HTMLButtonElement;
let countLabel: HTMLElement;
let root: HTMLElement;

// ═══════════════════════════════════════════════════════════════════════════
// Public render
// ═══════════════════════════════════════════════════════════════════════════

export function renderExportTab(cb: PanelCallbacks): HTMLElement {
  root = el('div', 'gmd-export');

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

  const refreshBtn = createIconButton({
    icon: ICON_REFRESH,
    title: '刷新会话',
    variant: 'standard',
    onClick: () => loadSession(cb),
  });

  append(toolbar, selectAllCb, countLabel, refreshBtn);
  root.appendChild(toolbar);

  // ── Message List ─────────────────────────────────────────────────────
  listEl = el('div', 'gmd-export__list');
  root.appendChild(listEl);

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

  // Branch switcher (only if parent has multiple children)
  if (session && msg.parentId && hasBranch(session, msg.parentId)) {
    const branchCtrl = createBranchSwitcher(msg);
    row.appendChild(branchCtrl);
  }

  return row;
}

function createBranchSwitcher(msg: IMessage): HTMLElement {
  if (!session || !msg.parentId) return el('span', '');

  const parent = session.messages.get(msg.parentId)!;
  const idx = getChildIndex(session, msg.parentId, msg.id);
  const total = parent.childrenIds.length;

  const ctrl = el('span', 'gmd-export__branch');

  const prevBtn = createIconButton({
    icon: ICON_CHEVRON_LEFT,
    title: '上一分支',
    variant: 'standard',
    onClick: () => navigateBranch(msg.parentId!, idx - 1),
  });
  if (idx <= 0) prevBtn.disabled = true;

  const label = el('span', 'gmd-export__branch-label');
  label.textContent = `${idx + 1}/${total}`;

  const nextBtn = createIconButton({
    icon: ICON_CHEVRON_RIGHT,
    title: '下一分支',
    variant: 'standard',
    onClick: () => navigateBranch(msg.parentId!, idx + 1),
  });
  if (idx >= total - 1) nextBtn.disabled = true;

  append(ctrl, prevBtn, label, nextBtn);
  return ctrl;
}

function navigateBranch(parentId: string, targetIdx: number): void {
  if (!session) return;
  const parent = session.messages.get(parentId);
  if (!parent || targetIdx < 0 || targetIdx >= parent.childrenIds.length) return;

  const targetChildId = parent.childrenIds[targetIdx];
  chain = switchBranch(session, parentId, targetChildId);

  // Preserve / reset selection
  selectedIds = new Set(chain.map((m) => m.id));
  renderList();
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

  exportBtn.disabled = selected === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

async function doExport(cb: PanelCallbacks): Promise<void> {
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
