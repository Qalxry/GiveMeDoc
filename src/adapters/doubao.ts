/**
 * Give Me Doc — Doubao platform adapter
 *
 * Only supports single-message export via DOM injection.
 * Doubao messages show a toolbar on hover with buttons.
 */
import { ICON_FILE_TYPE, iconSize } from '../ui/m3e/icons';
import type { AdapterConfig } from './deepseek-config';
import doubaoCfg from './doubao.adapter.json';

const FILE_TYPE_SVG = iconSize(ICON_FILE_TYPE, 16);

/** Cast the JSON import to typed interface (validated by build). */
const config = doubaoCfg as unknown as AdapterConfig;

/**
 * Inject a "export to docx" icon button into each Doubao message toolbar.
 * Uses MutationObserver to handle dynamically added messages.
 */
export function injectSingleExportButtons(onClick: (md: string, title: string) => void): void {
  const MARKER_ATTR = 'data-gmd-injected';
  const SVG_PREFIX = config.toolbar.copyButton[0].pathPrefix || '';

  function processToolbar(toolbar: Element): void {
    // Guard: skip if already injected or toolbar was recreated by React
    if (toolbar.hasAttribute(MARKER_ATTR)) return;
    // Additional dedup: check if our button is already there
    if (toolbar.querySelector('[title="导出为 Word"]')) return;
    toolbar.setAttribute(MARKER_ATTR, '1');

    // Use native <button> to match Doubao's button styling
    const exportBtn = document.createElement('button');
    exportBtn.className = config.toolbar.exportButton.className;
    const iconHTML = config.toolbar.exportButton.innerHTML.replace('{{ICON}}', FILE_TYPE_SVG);
    exportBtn.innerHTML = iconHTML;
    exportBtn.title = '导出为 Word';

    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // Find the copy button live from the toolbar — DO NOT cache it,
      // because Doubao's React DOM may detach/recreate buttons on hover.
      const copyBtn = findCopyButton(toolbar, SVG_PREFIX);
      if (!copyBtn) {
        console.warn('[GiveMeDoc] Copy button not found in toolbar');
        return;
      }

      // 1. Simulate click on the copy button
      (copyBtn as HTMLElement).click();

      // 2. Brief delay — clipboard write is async
      await new Promise((r) => setTimeout(r, 300));

      // 3. Read clipboard
      try {
        const md = await navigator.clipboard.readText();
        if (md) {
          const title = document.title.replace(/ - 豆包$/, '').trim() || '单条消息导出';
          onClick(md, title);
        }
      } catch (err) {
        console.error('[GiveMeDoc] Clipboard read failed:', err);
      }
    });

    toolbar.appendChild(exportBtn);
  }

  function scanAll(): void {
    const toolbars = document.querySelectorAll(config.toolbar.containerSelector);
    toolbars.forEach(processToolbar);
  }

  // Initial scan
  scanAll();

  // Watch for new messages
  const observer = new MutationObserver(() => scanAll());
  observer.observe(document.body, { childList: true, subtree: true });
}

/** Locate the copy button inside a toolbar using SVG fingerprint. */
function findCopyButton(toolbar: Element, svgPrefix: string): Element | null {
  const candidates = toolbar.querySelectorAll('button, [role="button"]');
  for (const el of candidates) {
    const paths = el.querySelectorAll('svg path');
    for (const path of paths) {
      const d = path.getAttribute('d') || '';
      if (d.startsWith(svgPrefix)) return el;
    }
  }
  return null;
}
