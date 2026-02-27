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
  createSegmentedControl,
} from './m3e/dom';
import { createSwitch, setSwitchState } from './m3e/switch';
import { showToast } from './m3e/toast';
import {
  ICON_UPLOAD, ICON_TRASH, ICON_REFRESH,
} from './m3e/icons';
// FAB control is delegated to callbacks (onFabToggle) to support popup context

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
let fabSwitch: HTMLElement;
let thinkingSwitch: HTMLElement;
let singleExportSwitch: HTMLElement;
let autoRefreshSwitch: HTMLElement;
let lineBreaksSelect: HTMLSelectElement;
let prefixTextarea: HTMLElement;
let userTplTextarea: HTMLElement;
let assistantTplTextarea: HTMLElement;
let editorSegmented: HTMLElement;
let activeEditorId: 'prefix' | 'user' | 'assistant' = 'prefix';
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

  // ── Section: Display settings ────────────────────────────────────────
  const displaySection = createSection('显示设置');

  fabSwitch = createSwitch({
    label: '显示悬浮球',
    checked: true,
    onChange: (checked) => {
      config.showFab = checked;
      cb.onConfigChange({ showFab: checked });
      cb.onFabToggle?.(checked);
    },
  });
  displaySection.appendChild(fabSwitch);

  autoRefreshSwitch = createSwitch({
    label: '打开面板时自动刷新',
    checked: true,
    onChange: (checked) => {
      config.autoRefreshOnOpen = checked;
      cb.onConfigChange({ autoRefreshOnOpen: checked });
    },
  });
  displaySection.appendChild(autoRefreshSwitch);

  root.appendChild(displaySection);

  // ── Section: Export settings ──────────────────────────────────────────
  const exportSettingsSection = createSection('导出设置');

  thinkingSwitch = createSwitch({
    label: '导出时包含思考内容',
    checked: false,
    onChange: (checked) => {
      config.includeThinking = checked;
      cb.onConfigChange({ includeThinking: checked });
    },
  });
  exportSettingsSection.appendChild(thinkingSwitch);

  singleExportSwitch = createSwitch({
    label: '单条导出时使用模板',
    checked: false,
    onChange: (checked) => {
      config.singleExportWithTemplate = checked;
      cb.onConfigChange({ singleExportWithTemplate: checked });
    },
  });
  exportSettingsSection.appendChild(singleExportSwitch);

  // Line breaks mode selector
  const lineBreaksLabel = el('label', 'gmd-settings__select-label');
  lineBreaksLabel.textContent = '软换行处理';
  exportSettingsSection.appendChild(lineBreaksLabel);

  lineBreaksSelect = createSelect({
    options: [
      { value: 'soft', label: '保留为软换行（Word 中显示为 ↓）' },
      { value: 'paragraph', label: '转为硬换行（每行成为独立段落，Word 中显示为 ↩）' },
      { value: 'east_asian', label: '合并为一行（东亚优化：中日韩文字间不添加空格）' },
      { value: 'default', label: '合并为一行（Pandoc 默认：软换行作为一个空格处理）' },
    ],
    value: 'soft',
    onChange: (value) => {
      config.lineBreaks = value as UserConfig['lineBreaks'];
      cb.onConfigChange({ lineBreaks: config.lineBreaks });
    },
  });
  exportSettingsSection.appendChild(lineBreaksSelect);

  root.appendChild(exportSettingsSection);

  // ── Section: Template editors ────────────────────────────────────────
  const editorSection = createSection('模板文本编辑');

  // Segmented control to switch between the three editors
  editorSegmented = createSegmentedControl({
    segments: [
      { id: 'prefix', label: '文档前缀' },
      { id: 'user', label: '用户消息' },
      { id: 'assistant', label: '助手消息' },
    ],
    activeId: activeEditorId,
    onChange: (id) => {
      activeEditorId = id as typeof activeEditorId;
      applyEditorSwitch();
    },
  });
  editorSection.appendChild(editorSegmented);

  prefixTextarea = createTextarea({
    label: '文档前缀（document prefix）',
    rows: 6,
    onChange: debounce((v) => {
      config.documentPrefix = v;
      cb.onConfigChange({ documentPrefix: v });
    }, 400),
  });
  editorSection.appendChild(prefixTextarea);

  userTplTextarea = createTextarea({
    label: '用户消息模板（user message）',
    rows: 6,
    onChange: debounce((v) => {
      config.userMessageTemplate = v;
      cb.onConfigChange({ userMessageTemplate: v });
    }, 400),
  });
  userTplTextarea.style.display = 'none';
  editorSection.appendChild(userTplTextarea);

  assistantTplTextarea = createTextarea({
    label: '助手消息模板（assistant message）',
    rows: 6,
    onChange: debounce((v) => {
      config.assistantMessageTemplate = v;
      cb.onConfigChange({ assistantMessageTemplate: v });
    }, 400),
  });
  assistantTplTextarea.style.display = 'none';
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
      wrap: 'off',
      onChange: debounce((v) => {
        const urls = v.split('\n').map((l) => l.trim()).filter(Boolean);
        config.cdnUrls = urls;
        cb.onConfigChange({ cdnUrls: urls });
      }, 400),
    });
    cdnSection.appendChild(cdnTextarea);

    root.appendChild(cdnSection);
  }

  // ── Section: Danger zone ─────────────────────────────────────────────
  const dangerSection = createSection('危险区域');

  const resetBtn = createButton({
    label: '重置设置',
    icon: ICON_REFRESH,
    variant: 'tonal',
    onClick: async () => {
      try {
        config = await cb.onResetConfig();
        // Refresh all UI elements with the fresh config
        setSwitchState(fabSwitch, config.showFab);
        setSwitchState(autoRefreshSwitch, config.autoRefreshOnOpen);
        setSwitchState(thinkingSwitch, config.includeThinking);
        setSwitchState(singleExportSwitch, config.singleExportWithTemplate);
        lineBreaksSelect.value = config.lineBreaks;
        setTextareaValue(prefixTextarea, config.documentPrefix);
        setTextareaValue(userTplTextarea, config.userMessageTemplate);
        setTextareaValue(assistantTplTextarea, config.assistantMessageTemplate);
        if (cdnSection && __PLATFORM__ === 'userscript') {
          setTextareaValue(cdnTextarea, config.cdnUrls.join('\n'));
        }
        // Sync FAB mount state with the reset config
        cb.onFabToggle?.(config.showFab);
        showToast({ message: '设置已重置为默认值', level: 'success' });
      } catch (err) {
        showToast({ message: `重置失败: ${(err as Error).message}`, level: 'error' });
      }
    },
  });
  dangerSection.appendChild(resetBtn);

  const clearCacheBtn = createButton({
    label: '清除缓存',
    icon: ICON_TRASH,
    variant: 'tonal',
    onClick: async () => {
      try {
        await cb.onClearCache();
        showToast({ message: '缓存已清除，下次加载将重新下载', level: 'success' });
      } catch (err) {
        showToast({ message: `清除缓存失败: ${(err as Error).message}`, level: 'error' });
      }
    },
  });
  dangerSection.appendChild(clearCacheBtn);

  root.appendChild(dangerSection);

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
          // If the deleted template was the default, fall back to the first built-in
          if (config.selectedTemplateId === tpl.id) {
            const fallback = templates.find((t) => t.isBuiltin) ?? templates[0];
            if (fallback) {
              config.selectedTemplateId = fallback.id;
              await cb.onConfigChange({ selectedTemplateId: fallback.id });
            }
          }
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

    // Sync switches
    setSwitchState(fabSwitch, config.showFab);
    setSwitchState(autoRefreshSwitch, config.autoRefreshOnOpen);
    setSwitchState(thinkingSwitch, config.includeThinking);
    setSwitchState(singleExportSwitch, config.singleExportWithTemplate);

    // Sync select
    lineBreaksSelect.value = config.lineBreaks;

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

/** Show only the active template editor, hide others. */
function applyEditorSwitch(): void {
  prefixTextarea.style.display = activeEditorId === 'prefix' ? '' : 'none';
  userTplTextarea.style.display = activeEditorId === 'user' ? '' : 'none';
  assistantTplTextarea.style.display = activeEditorId === 'assistant' ? '' : 'none';
}
