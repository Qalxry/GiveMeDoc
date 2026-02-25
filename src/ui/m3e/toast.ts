/**
 * Give Me Doc — M3E Toast / Snackbar
 *
 * A lightweight, auto-dismissing notification bar.
 * BEM: .gmd-toast, .gmd-toast--info, .gmd-toast--error, etc.
 */
import type { ToastLevel } from '../../core/types';
import { el } from './dom';

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
    info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
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
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
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
