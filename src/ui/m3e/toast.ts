/**
 * Give Me Doc — M3E Toast / Snackbar
 *
 * A lightweight, auto-dismissing notification bar.
 * BEM: .gmd-toast, .gmd-toast--info, .gmd-toast--error, etc.
 */
import type { ToastLevel } from '../../core/types';
import { el } from './dom';
import { ICON_INFO, ICON_CIRCLE_CHECK, ICON_TRIANGLE_ALERT, ICON_CIRCLE_X, ICON_X, iconSize } from './icons';

let container: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (container && document.body.contains(container)) return container;
  container = el('div', 'gmd-toast-container');
  document.body.appendChild(container);
  return container;
}

export interface ToastOptions {
  message: string;
  level?: ToastLevel;
  duration?: number; // ms, 0 = sticky
  action?: { label: string; onClick: () => void };
}

/**
 * Show a toast notification.
 * Returns a function to dismiss it programmatically.
 */
export function showToast(opts: ToastOptions): () => void {
  const c = ensureContainer();
  const level = opts.level ?? 'info';
  const duration = opts.duration ?? 4000;

  const toast = el('div', `gmd-toast gmd-toast--${level}`);

  // Icon
  const iconMap: Record<ToastLevel, string> = {
    info: ICON_INFO,
    success: ICON_CIRCLE_CHECK,
    warning: ICON_TRIANGLE_ALERT,
    error: ICON_CIRCLE_X,
  };

  const iconEl = el('span', 'gmd-toast__icon');
  iconEl.innerHTML = iconMap[level];
  toast.appendChild(iconEl);

  const msgEl = el('span', 'gmd-toast__message');
  msgEl.textContent = opts.message;
  toast.appendChild(msgEl);

  if (opts.action) {
    const actionBtn = el('button', 'gmd-toast__action');
    actionBtn.textContent = opts.action.label;
    actionBtn.addEventListener('click', () => {
      opts.action!.onClick();
      dismiss();
    });
    toast.appendChild(actionBtn);
  }

  // Close button
  const closeBtn = el('button', 'gmd-toast__close');
  closeBtn.innerHTML = iconSize(ICON_X, 16);
  closeBtn.addEventListener('click', dismiss);
  toast.appendChild(closeBtn);

  c.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => toast.classList.add('gmd-toast--visible'));

  let timer: ReturnType<typeof setTimeout> | null = null;

  function dismiss() {
    if (timer) clearTimeout(timer);
    toast.classList.remove('gmd-toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => toast.remove(), 400);
  }

  if (duration > 0) {
    timer = setTimeout(dismiss, duration);
  }

  return dismiss;
}
