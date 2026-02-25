/**
 * Give Me Doc — M3E Switch (toggle) Component
 *
 * A Material 3 Expressive styled toggle switch.
 * BEM: .gmd-switch, .gmd-switch__track, .gmd-switch__thumb
 */
import { el } from './dom';
import { ICON_CHECK, iconSize, iconStroke } from './icons';

export interface SwitchOptions {
  checked?: boolean;
  label?: string;
  onChange?: (checked: boolean) => void;
}

/**
 * Create an M3E-style toggle switch with optional label.
 */
export function createSwitch(opts: SwitchOptions): HTMLElement {
  const wrapper = el('label', 'gmd-switch');

  const input = el('input', 'gmd-switch__input', { type: 'checkbox' });
  if (opts.checked) input.checked = true;

  const track = el('span', 'gmd-switch__track');
  const thumb = el('span', 'gmd-switch__thumb');
  track.appendChild(thumb);

  // Icon inside thumb (check)
  const thumbIcon = el('span', 'gmd-switch__icon');
  thumbIcon.innerHTML = iconStroke(iconSize(ICON_CHECK, 14), 3);
  thumb.appendChild(thumbIcon);

  wrapper.appendChild(input);
  wrapper.appendChild(track);

  if (opts.label) {
    const lbl = el('span', 'gmd-switch__label');
    lbl.textContent = opts.label;
    wrapper.appendChild(lbl);
  }

  // Sync state class
  function sync(): void {
    track.classList.toggle('gmd-switch__track--checked', input.checked);
  }
  sync();

  input.addEventListener('change', () => {
    sync();
    opts.onChange?.(input.checked);
  });

  return wrapper;
}

/** Programmatically set switch state. */
export function setSwitchState(wrapper: HTMLElement, checked: boolean): void {
  const input = wrapper.querySelector('input') as HTMLInputElement | null;
  if (input) {
    input.checked = checked;
    const track = wrapper.querySelector('.gmd-switch__track');
    track?.classList.toggle('gmd-switch__track--checked', checked);
  }
}

export function getSwitchState(wrapper: HTMLElement): boolean {
  const input = wrapper.querySelector('input') as HTMLInputElement | null;
  return input?.checked ?? false;
}
