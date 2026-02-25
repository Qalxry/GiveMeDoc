/**
 * Give Me Doc — Floating Action Button (FAB)
 *
 * A half-hidden FAB pinned to the right edge of the viewport.
 * Reveals on hover; supports vertical drag to reposition (stored as %).
 * Coordinates with panel.ts: hides when panel is open, shows when closed.
 *
 * BEM: .gmd-fab
 */
import type { PanelCallbacks } from '../core/types';
import { el, html } from './m3e/dom';
import { ICON_FILE_TEXT } from './m3e/icons';
import { showPanel, isPanelVisible } from './panel';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const LS_KEY = 'gmd-fab-pos';
const DEFAULT_PCT = 50;
const MIN_PCT = 5;
const MAX_PCT = 95;
const DRAG_THRESHOLD = 4; // px — movement below this counts as click, not drag

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let fabEl: HTMLButtonElement | null = null;
let callbacks: PanelCallbacks | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// Create
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create and mount the FAB. No-op if already mounted.
 */
export function createFab(cb: PanelCallbacks): void {
  if (fabEl) return;
  callbacks = cb;

  fabEl = el('button', 'gmd-fab') as HTMLButtonElement;
  fabEl.type = 'button';
  fabEl.title = 'Give Me Doc';
  fabEl.setAttribute('aria-label', 'Toggle Give Me Doc panel');
  fabEl.innerHTML = ICON_FILE_TEXT;

  // Restore saved vertical position
  const savedPct = loadPosition();
  applyPosition(savedPct);

  // ── Drag + click handling ────────────────────────────────────────────
  let startY = 0;
  let startPct = 0;
  let dragging = false;
  let didDrag = false;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    fabEl!.setPointerCapture(e.pointerId);

    startY = e.clientY;
    startPct = loadPosition();
    dragging = true;
    didDrag = false;

    fabEl!.classList.add('gmd-fab--dragging');

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const dy = Math.abs(e.clientY - startY);
    if (dy >= DRAG_THRESHOLD) didDrag = true;

    const pct = (e.clientY / window.innerHeight) * 100;
    const clamped = clampPct(pct);
    applyPosition(clamped);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    fabEl!.classList.remove('gmd-fab--dragging');

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    if (didDrag) {
      // Save final position
      const pct = (e.clientY / window.innerHeight) * 100;
      const clamped = clampPct(pct);
      savePosition(clamped);
      applyPosition(clamped);
    } else {
      // It was a click — toggle panel
      handleClick();
    }
  }

  fabEl.addEventListener('pointerdown', onPointerDown);

  // ── Initial visibility ───────────────────────────────────────────────
  if (isPanelVisible()) {
    fabEl.classList.add('gmd-fab--hidden');
  }

  document.body.appendChild(fabEl);
}

// ═══════════════════════════════════════════════════════════════════════════
// Show / Hide / Destroy
// ═══════════════════════════════════════════════════════════════════════════

/** Slide FAB out (panel opened). */
export function hideFab(): void {
  fabEl?.classList.add('gmd-fab--hidden');
}

/** Slide FAB back in (panel closed). */
export function showFab(): void {
  fabEl?.classList.remove('gmd-fab--hidden');
}

/** Remove FAB from DOM entirely. */
export function destroyFab(): void {
  if (fabEl) {
    fabEl.remove();
    fabEl = null;
    callbacks = null;
  }
}

/** Returns whether the FAB element exists in the DOM. */
export function isFabMounted(): boolean {
  return fabEl !== null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

function handleClick(): void {
  if (!callbacks) return;
  hideFab();
  showPanel(callbacks);
}

function clampPct(pct: number): number {
  return Math.max(MIN_PCT, Math.min(MAX_PCT, pct));
}

function applyPosition(pct: number): void {
  if (!fabEl) return;
  fabEl.style.top = `${pct}%`;
}

function loadPosition(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (!Number.isNaN(n)) return clampPct(n);
    }
  } catch { /* localStorage unavailable */ }
  return DEFAULT_PCT;
}

function savePosition(pct: number): void {
  try {
    localStorage.setItem(LS_KEY, String(pct));
  } catch { /* localStorage unavailable */ }
}
