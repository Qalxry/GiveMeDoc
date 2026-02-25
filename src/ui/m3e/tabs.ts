/**
 * Give Me Doc — M3E Tabs Component
 *
 * Vanilla TS implementation of M3E-style tabs.
 * BEM: .gmd-tabs, .gmd-tabs__bar, .gmd-tabs__tab, .gmd-tabs__indicator, .gmd-tabs__panel
 */
import { el, append } from './dom';

export interface Tab {
  id: string;
  label: string;
  icon?: string; // SVG string
  render: () => HTMLElement;
}

export interface TabsOptions {
  tabs: Tab[];
  activeId?: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * Create a full tabs component: tab bar + panels.
 * Returns the root element and a method to switch tabs programmatically.
 */
export function createTabs(opts: TabsOptions): {
  root: HTMLElement;
  setActive: (tabId: string) => void;
} {
  const root = el('div', 'gmd-tabs');
  const bar = el('div', 'gmd-tabs__bar');
  bar.setAttribute('role', 'tablist');
  const panelContainer = el('div', 'gmd-tabs__panels');
  const indicator = el('div', 'gmd-tabs__indicator');

  // Build tabs
  const tabEls: Map<string, HTMLElement> = new Map();
  const panelEls: Map<string, HTMLElement> = new Map();

  for (const tab of opts.tabs) {
    // Tab button
    const tabEl = el('button', 'gmd-tabs__tab');
    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('data-tab-id', tab.id);
    tabEl.type = 'button';

    if (tab.icon) {
      const iconSpan = el('span', 'gmd-tabs__tab-icon');
      iconSpan.innerHTML = tab.icon;
      tabEl.appendChild(iconSpan);
    }

    const labelSpan = el('span', 'gmd-tabs__tab-label');
    labelSpan.textContent = tab.label;
    tabEl.appendChild(labelSpan);

    bar.appendChild(tabEl);
    tabEls.set(tab.id, tabEl);

    // Panel
    const panel = el('div', 'gmd-tabs__panel');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('data-panel-id', tab.id);
    panelEls.set(tab.id, panel);
    panelContainer.appendChild(panel);
  }

  bar.appendChild(indicator);
  root.appendChild(bar);
  root.appendChild(panelContainer);

  let activeId = opts.activeId ?? opts.tabs[0]?.id ?? '';

  function setActive(tabId: string): void {
    activeId = tabId;

    // Update tab states
    for (const [id, tabEl] of tabEls) {
      const isActive = id === tabId;
      tabEl.classList.toggle('gmd-tabs__tab--active', isActive);
      tabEl.setAttribute('aria-selected', String(isActive));
    }

    // Update indicator position
    const activeTabEl = tabEls.get(tabId);
    if (activeTabEl) {
      const barRect = bar.getBoundingClientRect();
      const tabRect = activeTabEl.getBoundingClientRect();
      indicator.style.left = `${tabRect.left - barRect.left}px`;
      indicator.style.width = `${tabRect.width}px`;
    }

    // Update panels
    for (const [id, panel] of panelEls) {
      const isActive = id === tabId;
      panel.classList.toggle('gmd-tabs__panel--active', isActive);
      panel.hidden = !isActive;

      // Lazy render: only populate panel content when first activated
      if (isActive && panel.children.length === 0) {
        const tab = opts.tabs.find((t) => t.id === id);
        if (tab) {
          panel.appendChild(tab.render());
        }
      }
    }

    opts.onTabChange?.(tabId);
  }

  // Click handlers
  for (const [id, tabEl] of tabEls) {
    tabEl.addEventListener('click', () => setActive(id));
  }

  // Initial selection (use rAF to ensure layout is ready for indicator positioning)
  requestAnimationFrame(() => setActive(activeId));

  return { root, setActive };
}
