/**
 * Give Me Doc — M3E DOM Utilities
 *
 * Tiny helpers for creating DOM elements with BEM classes,
 * without any framework or UI library.
 * All functions are pure and stateless.
 */
import { ICON_CHECK, iconStroke } from './icons';

/** Shorthand: create an element with BEM class and optional attributes. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      e.setAttribute(k, v);
    }
  }
  return e;
}

/** Create a text node. */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/** Create an element, set innerHTML, return it. Useful for SVG injection. */
export function html<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  innerHTML: string,
): HTMLElementTagNameMap[K] {
  const e = el(tag, className);
  e.innerHTML = innerHTML;
  return e;
}

/** Append multiple children to a parent. */
export function append(parent: HTMLElement, ...children: (Node | string)[]): HTMLElement {
  for (const c of children) {
    if (typeof c === 'string') {
      parent.appendChild(text(c));
    } else {
      parent.appendChild(c);
    }
  }
  return parent;
}

/** Create a BEM block element. */
export function block(tag: keyof HTMLElementTagNameMap, blockName: string): HTMLElement {
  return el(tag, blockName);
}

/** Create a BEM element (block__element). */
export function bem(
  tag: keyof HTMLElementTagNameMap,
  blockName: string,
  elementName: string,
  modifiers?: string[],
): HTMLElement {
  const base = `${blockName}__${elementName}`;
  const mods = modifiers ? modifiers.map((m) => `${base}--${m}`).join(' ') : '';
  return el(tag, `${base}${mods ? ' ' + mods : ''}`);
}

// ── M3E Button ─────────────────────────────────────────────────────────────

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  icon?: string; // SVG string
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  className?: string;
}

/**
 * Create an M3E-styled button.
 * BEM: .gmd-btn, .gmd-btn--filled, .gmd-btn--tonal, etc.
 */
export function createButton(opts: ButtonOptions): HTMLButtonElement {
  const variant = opts.variant || 'filled';
  const btn = el('button', `gmd-btn gmd-btn--${variant}${opts.className ? ' ' + opts.className : ''}`);
  btn.type = 'button';
  if (opts.disabled) btn.disabled = true;

  if (opts.icon) {
    const iconSpan = html('span', 'gmd-btn__icon', opts.icon);
    btn.appendChild(iconSpan);
  }

  const labelSpan = el('span', 'gmd-btn__label');
  labelSpan.textContent = opts.label;
  btn.appendChild(labelSpan);

  if (opts.onClick) {
    btn.addEventListener('click', opts.onClick);
  }
  return btn;
}

// ── M3E Icon Button ────────────────────────────────────────────────────────

export interface IconButtonOptions {
  icon: string; // SVG string
  title?: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  onClick?: (e: MouseEvent) => void;
}

export function createIconButton(opts: IconButtonOptions): HTMLButtonElement {
  const variant = opts.variant || 'standard';
  const btn = el('button', `gmd-icon-btn gmd-icon-btn--${variant}`);
  btn.type = 'button';
  btn.innerHTML = opts.icon;
  if (opts.title) btn.title = opts.title;
  if (opts.onClick) btn.addEventListener('click', opts.onClick);
  return btn;
}

// ── M3E Checkbox ───────────────────────────────────────────────────────────

export interface CheckboxOptions {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export function createCheckbox(opts: CheckboxOptions): HTMLElement {
  const wrapper = el('label', 'gmd-checkbox');
  const input = el('input', 'gmd-checkbox__input', { type: 'checkbox' });
  if (opts.checked) input.checked = true;

  const box = el('span', 'gmd-checkbox__box');
  // Checkmark SVG — uses ICON_CHECK with heavier stroke for visibility
  box.innerHTML = iconStroke(ICON_CHECK, 3).replace('<svg ', '<svg class="gmd-checkbox__check" ');

  wrapper.appendChild(input);
  wrapper.appendChild(box);

  if (opts.label) {
    const lbl = el('span', 'gmd-checkbox__label');
    lbl.textContent = opts.label;
    wrapper.appendChild(lbl);
  }

  if (opts.onChange) {
    input.addEventListener('change', () => opts.onChange!(input.checked));
  }

  return wrapper;
}

/** Programmatically set a gmd-checkbox's state. */
export function setCheckboxState(wrapper: HTMLElement, checked: boolean): void {
  const input = wrapper.querySelector('input') as HTMLInputElement | null;
  if (input) input.checked = checked;
}

export function getCheckboxState(wrapper: HTMLElement): boolean {
  const input = wrapper.querySelector('input') as HTMLInputElement | null;
  return input?.checked ?? false;
}

// ── M3E Select ─────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptions {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function createSelect(opts: SelectOptions): HTMLSelectElement {
  const select = el('select', 'gmd-select');
  if (opts.placeholder) {
    const ph = el('option', undefined, { value: '', disabled: 'true', selected: 'true' });
    ph.textContent = opts.placeholder;
    select.appendChild(ph);
  }
  for (const o of opts.options) {
    const option = el('option', undefined, { value: o.value });
    option.textContent = o.label;
    if (opts.value === o.value) option.selected = true;
    select.appendChild(option);
  }
  if (opts.onChange) {
    select.addEventListener('change', () => opts.onChange!(select.value));
  }
  return select;
}

// ── M3E Segmented Control ──────────────────────────────────────────────────

export interface Segment {
  id: string;
  label: string;
  icon?: string; // SVG string
}

export interface SegmentedControlOptions {
  segments: Segment[];
  activeId: string;
  onChange?: (id: string) => void;
}

/**
 * Create an M3E-styled segmented button group.
 * BEM: .gmd-segmented, .gmd-segmented__btn, .gmd-segmented__btn--active
 */
export function createSegmentedControl(opts: SegmentedControlOptions): HTMLElement {
  const root = el('div', 'gmd-segmented');
  const buttons: HTMLButtonElement[] = [];

  for (const seg of opts.segments) {
    const btn = el('button', 'gmd-segmented__btn');
    btn.type = 'button';
    btn.dataset.segmentId = seg.id;
    if (seg.icon) {
      const iconSpan = html('span', 'gmd-segmented__icon', seg.icon);
      btn.appendChild(iconSpan);
    }
    const labelSpan = el('span', 'gmd-segmented__label');
    labelSpan.textContent = seg.label;
    btn.appendChild(labelSpan);
    if (seg.id === opts.activeId) btn.classList.add('gmd-segmented__btn--active');
    btn.addEventListener('click', () => {
      for (const b of buttons) b.classList.remove('gmd-segmented__btn--active');
      btn.classList.add('gmd-segmented__btn--active');
      opts.onChange?.(seg.id);
    });
    buttons.push(btn);
    root.appendChild(btn);
  }

  return root;
}

// ── M3E Input ──────────────────────────────────────────────────────────────

export interface InputOptions {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  label?: string;
}

/**
 * Create an M3E-styled text input.
 * BEM: .gmd-input, .gmd-input__label, .gmd-input__field
 */
export function createInput(opts: InputOptions): HTMLElement {
  const wrapper = el('div', 'gmd-input');

  if (opts.label) {
    const lbl = el('label', 'gmd-input__label');
    lbl.textContent = opts.label;
    wrapper.appendChild(lbl);
  }

  const input = el('input', 'gmd-input__field', { type: 'text' });
  if (opts.value) input.value = opts.value;
  if (opts.placeholder) input.placeholder = opts.placeholder;

  if (opts.onChange) {
    input.addEventListener('input', () => opts.onChange!(input.value));
  }

  wrapper.appendChild(input);
  return wrapper;
}

// ── M3E Textarea ───────────────────────────────────────────────────────────

export interface TextareaOptions {
  value?: string;
  placeholder?: string;
  rows?: number;
  wrap?: 'off' | 'soft' | 'hard';
  onChange?: (value: string) => void;
  label?: string;
}

export function createTextarea(opts: TextareaOptions): HTMLElement {
  const wrapper = el('div', 'gmd-textarea');

  if (opts.label) {
    const lbl = el('label', 'gmd-textarea__label');
    lbl.textContent = opts.label;
    wrapper.appendChild(lbl);
  }

  const textarea = el('textarea', 'gmd-textarea__input');
  if (opts.value) textarea.value = opts.value;
  if (opts.placeholder) textarea.placeholder = opts.placeholder;
  textarea.rows = opts.rows ?? 4;
  if (opts.wrap) {
    textarea.wrap = opts.wrap;
    if (opts.wrap === 'off') textarea.classList.add('gmd-textarea__input--nowrap');
  }

  if (opts.onChange) {
    textarea.addEventListener('input', () => opts.onChange!(textarea.value));
  }

  wrapper.appendChild(textarea);
  return wrapper;
}
