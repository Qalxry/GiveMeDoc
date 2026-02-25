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
  ICON_LIST, ICON_SETTINGS, ICON_INFO, ICON_FILE_TEXT,
} from './m3e/icons';
import { renderExportTab } from './panel-export';
import { renderSettingsTab } from './panel-settings';
import { renderAboutTab } from './panel-about';

// ═══════════════════════════════════════════════════════════════════════════
// Panel state
// ═══════════════════════════════════════════════════════════════════════════

let panelEl: HTMLElement | null = null;
let isVisible = false;

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
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
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

  const { root: tabsRoot } = createTabs({ tabs, activeId: 'export' });
  panelEl.appendChild(tabsRoot);

  // ── Drag support ─────────────────────────────────────────────────────
  enableDrag(header, panelEl);

  // ── Mount ────────────────────────────────────────────────────────────
  document.body.appendChild(panelEl);
  isVisible = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Show / Hide / Toggle / Destroy
// ═══════════════════════════════════════════════════════════════════════════

export function showPanel(cb: PanelCallbacks): void {
  if (!panelEl) {
    createPanel(cb);
  } else {
    panelEl.classList.remove('gmd-panel--hidden');
    isVisible = true;
  }
}

export function hidePanel(): void {
  if (panelEl) {
    panelEl.classList.add('gmd-panel--hidden');
    isVisible = false;
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
}

export function isPanelVisible(): boolean {
  return isVisible;
}

// ═══════════════════════════════════════════════════════════════════════════
// Drag
// ═══════════════════════════════════════════════════════════════════════════

function enableDrag(handle: HTMLElement, target: HTMLElement): void {
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;
  let dragging = false;

  handle.style.cursor = 'grab';

  function onMouseDown(e: MouseEvent): void {
    // Only left button, and not on a button/input inside the header
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;

    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = target.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    handle.style.cursor = 'grabbing';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    target.style.left = `${origX + dx}px`;
    target.style.top = `${origY + dy}px`;
    target.style.right = 'auto';
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
