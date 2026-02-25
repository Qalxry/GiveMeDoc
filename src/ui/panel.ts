/**
 * Give Me Doc — Panel Shell
 *
 * The main floating panel that hosts three tabs: Export, Settings, About.
 * Manages the panel lifecycle (create, show, hide, destroy) and
 * delegates each tab's content to its respective module.
 *
 * BEM: .gmd-panel, .gmd-panel__*
 */
import type { PanelCallbacks } from '../core/types';
import { el, append, createIconButton, html } from './m3e/dom';
import { createTabs, type Tab } from './m3e/tabs';
import {
  ICON_LIST, ICON_SETTINGS, ICON_INFO, ICON_FILE_TEXT, ICON_X,
} from './m3e/icons';
import { renderExportTab, refreshExportTab, refreshExportTemplates } from './panel-export';
import { renderSettingsTab } from './panel-settings';
import { renderAboutTab } from './panel-about';
import { showFab, isFabMounted } from './fab';

// ═══════════════════════════════════════════════════════════════════════════
// Panel state
// ═══════════════════════════════════════════════════════════════════════════

let panelEl: HTMLElement | null = null;
let isVisible = false;
let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// Create
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create and mount the Give Me Doc side panel.
 * Call this once — subsequent calls are no-ops.
 */
export function createPanel(cb: PanelCallbacks): void {
  if (panelEl) return;

  panelEl = el('div', 'gmd-panel');
  panelEl.setAttribute('data-gmd-panel', '');

  // ── Header ───────────────────────────────────────────────────────────
  const header = el('div', 'gmd-panel__header');

  const titleWrap = el('div', 'gmd-panel__title-wrap');
  const logoIcon = html('span', 'gmd-panel__logo', ICON_FILE_TEXT);
  const titleText = el('span', 'gmd-panel__title');
  titleText.textContent = 'Give Me Doc';
  append(titleWrap, logoIcon, titleText);

  const closeBtn = createIconButton({
    icon: ICON_X,
    title: '关闭面板',
    variant: 'standard',
    onClick: () => hidePanel(),
  });

  append(header, titleWrap, closeBtn);
  panelEl.appendChild(header);

  // ── Tabs ─────────────────────────────────────────────────────────────
  const tabs: Tab[] = [
    {
      id: 'export',
      label: '导出',
      icon: ICON_LIST,
      render: () => renderExportTab(cb),
    },
    {
      id: 'settings',
      label: '设置',
      icon: ICON_SETTINGS,
      render: () => renderSettingsTab(cb),
    },
    {
      id: 'about',
      label: '关于',
      icon: ICON_INFO,
      render: () => renderAboutTab(cb),
    },
  ];

  const { root: tabsRoot } = createTabs({
    tabs,
    activeId: 'export',
    onTabChange: (tabId) => {
      if (tabId === 'export') refreshExportTemplates(cb);
    },
  });
  panelEl.appendChild(tabsRoot);

  // ── Drag support ─────────────────────────────────────────────────────
  enableDrag(header, panelEl);

  // ── Mount ────────────────────────────────────────────────────────────
  document.body.appendChild(panelEl);
  isVisible = true;
  // ── Click-outside to close ──────────────────────────────────────────
  // 使用 mousedown 而非 click，必要时可在宏主页 click 处理器之前关闭面板。
  // 排除：面板内部元素、toast 容器、标记了 [data-gmd-trigger] 的触发元素。
  clickOutsideHandler = (e: MouseEvent): void => {
    if (!isVisible || !panelEl) return;
    const target = e.target as HTMLElement;
    // 点击在面板内部
    if (panelEl.contains(target)) return;
    // 点击在 toast 容器内（toast 全局挂载在 body 上）
    if (target.closest?.('.gmd-toast-container')) return;
    // 点击在标记了 data-gmd-trigger 的触发元素上（如分享按鈕）
    if (target.closest?.('[data-gmd-trigger]')) return;
    // 点击在 FAB 上
    if (target.closest?.('.gmd-fab')) return;
    hidePanel();
  };
  document.addEventListener('mousedown', clickOutsideHandler);}

// ═══════════════════════════════════════════════════════════════════════════
// Show / Hide / Toggle / Destroy
// ═══════════════════════════════════════════════════════════════════════════

export async function showPanel(cb: PanelCallbacks): Promise<void> {
  if (!panelEl) {
    createPanel(cb);
  } else {
    panelEl.classList.remove('gmd-panel--hidden');
    isVisible = true;
    const cfg = await cb.getConfig();
    if (cfg.autoRefreshOnOpen) refreshExportTab(cb);
  }
}

export function hidePanel(): void {
  if (panelEl) {
    panelEl.classList.add('gmd-panel--hidden');
    isVisible = false;
    // Show FAB when panel is hidden (if FAB is mounted)
    if (isFabMounted()) showFab();
  }
}

export function togglePanel(cb: PanelCallbacks): void {
  if (isVisible) hidePanel();
  else showPanel(cb);
}

export function destroyPanel(): void {
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
    isVisible = false;
  }
  if (clickOutsideHandler) {
    document.removeEventListener('mousedown', clickOutsideHandler);
    clickOutsideHandler = null;
  }
}

export function isPanelVisible(): boolean {
  return isVisible;
}

// ═══════════════════════════════════════════════════════════════════════════
// Drag
// ═══════════════════════════════════════════════════════════════════════════

function enableDrag(handle: HTMLElement, target: HTMLElement): void {
  let startY = 0;
  let origY = 0;
  let dragging = false;

  handle.style.cursor = 'grab';

  function onMouseDown(e: MouseEvent): void {
    // Only left button, and not on a button/input inside the header
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;

    dragging = true;
    startY = e.clientY;
    const rect = target.getBoundingClientRect();
    origY = rect.top;
    handle.style.cursor = 'grabbing';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!dragging) return;
    const dy = e.clientY - startY;

    // Clamp to viewport vertical boundaries
    const h = target.offsetHeight;
    const vh = window.innerHeight;
    const newTop = Math.max(0, Math.min(vh - h, origY + dy));

    target.style.top = `${newTop}px`;
    target.style.bottom = 'auto';
  }

  function onMouseUp(): void {
    dragging = false;
    handle.style.cursor = 'grab';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  handle.addEventListener('mousedown', onMouseDown);
}
