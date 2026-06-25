/**
 * Give Me Doc — Multi-strategy DOM Query Engine
 *
 * Given an array of ElementStrategy, tries each lookup method in priority order
 * and returns the first matching element. Supports:
 *   - SVG path fingerprint  (most stable across UI versions)
 *   - Attribute / ARIA role
 *   - CSS selector + index
 *   - Text content
 *   - First-child
 *
 * Each strategy has an optional `scope` override:
 *   - omitted / 'toolbar'  -> use the caller-provided defaultScope
 *   - 'document'           -> search the whole document
 *   - 'parent'             -> search defaultScope.parentElement
 */
import type { ElementStrategy, AdapterConfig } from './deepseek-config';

export class AdapterEngine {
  constructor(private config: AdapterConfig) {}

  // -- High-level helpers (used by deepseek.ts) --------------------------

  findToolbars(): NodeListOf<Element> {
    return document.querySelectorAll(this.config.toolbar.containerSelector);
  }

  findCopyButton(toolbar: Element): Element | null {
    return this.findElement(this.config.toolbar.copyButton, toolbar);
  }

  findShareTrigger(): Element | null {
    return this.findElement(this.config.sharePanel.triggerButton, document);
  }

  getMessageCheckboxes(): Element[] {
    const cfg = this.config.sharePanel.checkbox;
    const all = document.querySelectorAll<Element>(cfg.selector);
    const result: Element[] = [];
    for (const cb of all) {
      if (this.isSelectAll(cb, cfg)) continue;
      result.push(cb);
    }
    return result;
  }

  isCheckboxActive(cb: Element): boolean {
    return cb.classList.contains(this.config.sharePanel.checkbox.activeClass);
  }

  createToolbarExportButton(iconSvg: string): HTMLElement {
    return this.createButton(this.config.toolbar.exportButton, iconSvg);
  }

  createShareExportButton(iconSvg: string): HTMLElement {
    return this.createButton(this.config.sharePanel.exportButton, iconSvg);
  }

  /** Expose API config for use by deepseek.ts. */
  getApiConfig() {
    return this.config.api;
  }

  /** Build a full API URL from an endpoint template. */
  buildApiUrl(endpointKey: string, params: Record<string, string>): string {
    const template = this.config.endpoints[endpointKey];
    if (!template) throw new Error('Unknown endpoint: ' + endpointKey);
    let url = this.config.api.base + template;
    for (const [k, v] of Object.entries(params)) {
      url = url.replace('{{' + k + '}}', encodeURIComponent(v));
    }
    return url;
  }

  // -- Insertion helper --------------------------------------------------

  insertButton(btn: Element, ref: Element, position: string): void {
    const parent = ref.parentElement;
    if (!parent) return;
    switch (position) {
      case 'append':  ref.appendChild(btn); break;
      case 'prepend': ref.insertBefore(btn, ref.firstChild); break;
      case 'before':  parent.insertBefore(btn, ref); break;
      case 'after':   parent.insertBefore(btn, ref.nextSibling); break;
    }
  }

  // -- Core multi-strategy engine ----------------------------------------

  /**
   * Resolve the effective scope: strategy.scope overrides the default scope.
   *   - 'toolbar' (or omitted) -> use defaultScope as-is
   *   - 'document'             -> document
   *   - 'parent'               -> defaultScope.parentElement
   */
  private resolveScope(
    s: ElementStrategy,
    defaultScope: Element | Document,
  ): Element | Document {
    const scope = s.scope;
    if (!scope || scope === 'toolbar') return defaultScope;
    if (scope === 'document') return document;
    if (scope === 'parent') return (defaultScope as Element).parentElement ?? defaultScope;
    return defaultScope;
  }

  findElement(
    strategies: ElementStrategy[],
    defaultScope: Element | Document,
  ): Element | null {
    const sorted = [...strategies].sort((a, b) => a.priority - b.priority);
    for (const s of sorted) {
      const scope = this.resolveScope(s, defaultScope);
      const result = this.tryStrategy(s, scope);
      if (result) return result;
    }
    return null;
  }

  private tryStrategy(
    s: ElementStrategy,
    scope: Element | Document,
  ): Element | null {
    switch (s.method) {
      case 'svg-fingerprint': return this.bySvgFingerprint(s, scope);
      case 'attr':            return this.byAttr(s, scope);
      case 'role':            return this.byRole(s, scope);
      case 'selector':        return this.bySelector(s, scope);
      case 'text':            return this.byText(s, scope);
      case 'first-child':     return scope.firstElementChild as HTMLElement | null;
      default:                return null;
    }
  }

  // -- Strategy implementations ------------------------------------------

  private bySvgFingerprint(
    s: ElementStrategy,
    scope: Element | Document,
  ): Element | null {
    if (!s.pathPrefix) return null;
    const candidates = scope.querySelectorAll<HTMLElement>(
      'button, [role="button"]',
    );
    for (const el of candidates) {
      const paths = el.querySelectorAll('svg path');
      for (const path of paths) {
        const d = path.getAttribute('d') || '';
        if (d.startsWith(s.pathPrefix)) return el;
      }
    }
    return null;
  }

  private byAttr(
    s: ElementStrategy,
    scope: Element | Document,
  ): Element | null {
    if (!s.attrName) return null;
    const candidates = scope.querySelectorAll<HTMLElement>(
      '[' + s.attrName + ']',
    );
    for (const el of candidates) {
      const val = el.getAttribute(s.attrName) || '';
      if (s.attrValue != null && val === s.attrValue) return el;
      if (s.attrPattern != null && new RegExp(s.attrPattern, 'i').test(val))
        return el;
    }
    return null;
  }

  private byRole(
    s: ElementStrategy,
    scope: Element | Document,
  ): Element | null {
    if (!s.role) return null;
    return scope.querySelector<HTMLElement>('[role="' + s.role + '"]');
  }

  private bySelector(
    s: ElementStrategy,
    scope: Element | Document,
  ): Element | null {
    if (!s.selector) return null;
    const all = scope.querySelectorAll<HTMLElement>(s.selector);
    if (all.length === 0) return null;
    if (s.index == null) return all[0];
    if (s.index < 0) return all[all.length + s.index];
    return all[s.index] ?? null;
  }

  private byText(
    s: ElementStrategy,
    scope: Element | Document,
  ): Element | null {
    if (!s.text) return null;
    // Only match interactive elements — never child text spans.
    const candidates = scope.querySelectorAll<HTMLElement>(
      'button, [role="button"]',
    );
    for (const el of candidates) {
      if (el.textContent?.includes(s.text)) return el;
    }
    return null;
  }

  // -- Button factory ----------------------------------------------------

  private createButton(
    cfg: { className: string; innerHTML: string },
    iconSvg: string,
  ): HTMLElement {
    const btn = document.createElement('div');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.className = cfg.className;
    btn.innerHTML = cfg.innerHTML.replace('{{ICON}}', iconSvg);
    return btn;
  }

  // -- Checkbox helpers --------------------------------------------------

  private isSelectAll(
    cb: Element,
    cfg: AdapterConfig['sharePanel']['checkbox'],
  ): boolean {
    switch (cfg.selectAllFilter) {
      case 'wrapper':
        return cfg.selectAllWrapper != null &&
          cb.closest(cfg.selectAllWrapper) !== null;
      case 'position': {
        const all = document.querySelectorAll(cfg.selector);
        const idx = cfg.selectAllIndex ?? -1;
        const target = idx < 0 ? all[all.length + idx] : all[idx];
        return cb === target;
      }
      case 'text':
        return cfg.selectAllText != null &&
          cb.textContent?.includes(cfg.selectAllText) === true;
      default:
        return false;
    }
  }
}
