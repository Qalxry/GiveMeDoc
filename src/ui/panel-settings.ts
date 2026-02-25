/**
 * Give Me Doc — Settings Tab
 *
 * Template management (list / upload / delete / set default),
 * template text editors (documentPrefix, user/assistant templates),
 * includeThinking toggle, and CDN config (userscript only).
 *
 * BEM: .gmd-settings, .gmd-settings__*
 */
import type { PanelCallbacks, UserConfig, TemplateMeta } from '../core/types';
import {
  el, append,
  createButton, createIconButton, createTextarea, createSelect,
} from './m3e/dom';
import { createSwitch, setSwitchState } from './m3e/switch';
import { showToast } from './m3e/toast';
import {
  ICON_UPLOAD, ICON_TRASH,
} from './m3e/icons';

declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════════════

function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: T) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); timer = null; }, ms);
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let config: UserConfig;
let templates: TemplateMeta[] = [];

// DOM refs
let templateListEl: HTMLElement;
let thinkingSwitch: HTMLElement;
let prefixTextarea: HTMLElement;
let userTplTextarea: HTMLElement;
let assistantTplTextarea: HTMLElement;
let cdnSection: HTMLElement | null = null;
let cdnTextarea: HTMLElement;

// ═══════════════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════════════

export function renderSettingsTab(cb: PanelCallbacks): HTMLElement {
  const root = el('div', 'gmd-settings');

  // ── Section: Template management ─────────────────────────────────────
  const tplSection = createSection('模板管理');

  templateListEl = el('div', 'gmd-settings__tpl-list');
  tplSection.appendChild(templateListEl);

  const uploadBtn = createButton({
    label: '上传模板',
    icon: ICON_UPLOAD,
    variant: 'tonal',
    onClick: () => handleUpload(cb),
  });
  tplSection.appendChild(uploadBtn);

  root.appendChild(tplSection);

  // ── Section: Thinking toggle ─────────────────────────────────────────
  const thinkSection = createSection('思考过程');

  thinkingSwitch = createSwitch({
    label: '导出时包含思考内容',
    checked: false,
    onChange: (checked) => {
      config.includeThinking = checked;
      cb.onConfigChange({ includeThinking: checked });
    },
  });
  thinkSection.appendChild(thinkingSwitch);

  root.appendChild(thinkSection);

  // ── Section: Template editors ────────────────────────────────────────
  const editorSection = createSection('模板文本编辑');

  prefixTextarea = createTextarea({
    label: '文档前缀（document prefix）',
    rows: 5,
    onChange: debounce((v) => {
      config.documentPrefix = v;
      cb.onConfigChange({ documentPrefix: v });
    }, 400),
  });
  editorSection.appendChild(prefixTextarea);

  userTplTextarea = createTextarea({
    label: '用户消息模板（user message）',
    rows: 4,
    onChange: debounce((v) => {
      config.userMessageTemplate = v;
      cb.onConfigChange({ userMessageTemplate: v });
    }, 400),
  });
  editorSection.appendChild(userTplTextarea);

  assistantTplTextarea = createTextarea({
    label: '助手消息模板（assistant message）',
    rows: 5,
    onChange: debounce((v) => {
      config.assistantMessageTemplate = v;
      cb.onConfigChange({ assistantMessageTemplate: v });
    }, 400),
  });
  editorSection.appendChild(assistantTplTextarea);

  const placeholderHint = el('p', 'gmd-settings__hint');
  placeholderHint.textContent =
    '可用占位符: {title}, {output_date}, {content}, {thinking_content}';
  editorSection.appendChild(placeholderHint);

  root.appendChild(editorSection);

  // ── Section: CDN (userscript only) ───────────────────────────────────
  if (__PLATFORM__ === 'userscript') {
    cdnSection = createSection('Pandoc WASM CDN');

    cdnTextarea = createTextarea({
      label: 'CDN URL 列表（每行一个，按顺序尝试）',
      rows: 3,
      onChange: debounce((v) => {
        const urls = v.split('\n').map((l) => l.trim()).filter(Boolean);
        config.cdnUrls = urls;
        cb.onConfigChange({ cdnUrls: urls });
      }, 400),
    });
    cdnSection.appendChild(cdnTextarea);

    root.appendChild(cdnSection);
  }

  // ── Load data ────────────────────────────────────────────────────────
  loadData(cb);

  return root;
}

// ═══════════════════════════════════════════════════════════════════════════
// Template list
// ═══════════════════════════════════════════════════════════════════════════

function renderTemplateList(cb: PanelCallbacks): void {
  templateListEl.innerHTML = '';

  for (const tpl of templates) {
    const isSelected = tpl.id === config.selectedTemplateId;
    const row = el('div', 'gmd-settings__tpl-row');
    if (isSelected) row.classList.add('gmd-settings__tpl-row--selected');

    // 整行点击以选中模板
    row.style.cursor = isSelected ? 'default' : 'pointer';
    row.addEventListener('click', async (e) => {
      // 如果点击的是操作按钮，不触发行选择
      if ((e.target as HTMLElement).closest('.gmd-icon-btn')) return;
      if (tpl.id === config.selectedTemplateId) return;
      config.selectedTemplateId = tpl.id;
      await cb.onConfigChange({ selectedTemplateId: tpl.id });
      renderTemplateList(cb);
      showToast({ message: `已将 "${tpl.name}" 设为默认模板`, level: 'success' });
    });

    const nameEl = el('span', 'gmd-settings__tpl-name');
    nameEl.textContent = tpl.name;
    row.appendChild(nameEl);

    if (tpl.description) {
      const descEl = el('span', 'gmd-settings__tpl-desc');
      descEl.textContent = tpl.description;
      row.appendChild(descEl);
    }

    // Delete button (custom templates only)
    if (!tpl.isBuiltin) {
      const delBtn = createIconButton({
        icon: ICON_TRASH,
        title: '删除',
        variant: 'standard',
        onClick: async () => {
          await cb.onTemplateDelete(tpl.id);
          templates = templates.filter((t) => t.id !== tpl.id);
          renderTemplateList(cb);
          showToast({ message: `已删除 "${tpl.name}"`, level: 'info' });
        },
      });
      row.appendChild(delBtn);
    }

    const badge = el('span', 'gmd-settings__tpl-badge');
    badge.textContent = tpl.isBuiltin ? '内置' : '自定义';
    row.appendChild(badge);

    templateListEl.appendChild(row);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Upload
// ═══════════════════════════════════════════════════════════════════════════

function handleUpload(cb: PanelCallbacks): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.docx';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const name = file.name.replace(/\.docx$/i, '');
      await cb.onTemplateUpload(name, buffer);
      templates = await cb.getTemplateList();
      renderTemplateList(cb);
      showToast({ message: `已上传模板 "${name}"`, level: 'success' });
    } catch (err) {
      showToast({ message: `上传失败: ${(err as Error).message}`, level: 'error' });
    }
  });
  input.click();
}

// ═══════════════════════════════════════════════════════════════════════════
// Data loading & sync
// ═══════════════════════════════════════════════════════════════════════════

async function loadData(cb: PanelCallbacks): Promise<void> {
  try {
    config = await cb.getConfig();
    templates = await cb.getTemplateList();

    // Sync thinking switch
    setSwitchState(thinkingSwitch, config.includeThinking);

    // Sync textareas
    setTextareaValue(prefixTextarea, config.documentPrefix);
    setTextareaValue(userTplTextarea, config.userMessageTemplate);
    setTextareaValue(assistantTplTextarea, config.assistantMessageTemplate);

    // CDN
    if (cdnSection && __PLATFORM__ === 'userscript') {
      setTextareaValue(cdnTextarea, config.cdnUrls.join('\n'));
    }

    // Template list
    renderTemplateList(cb);
  } catch (err) {
    showToast({ message: `加载设置失败: ${(err as Error).message}`, level: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function createSection(title: string): HTMLElement {
  const section = el('div', 'gmd-settings__section');
  const heading = el('h3', 'gmd-settings__section-title');
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function setTextareaValue(wrapper: HTMLElement, value: string): void {
  const ta = wrapper.querySelector('textarea');
  if (ta) ta.value = value;
}
