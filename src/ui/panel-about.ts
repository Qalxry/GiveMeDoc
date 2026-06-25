/**
 * Give Me Doc — About Tab
 *
 * Shows system status (Pandoc ready / version), project info,
 * and useful links (GitHub, bug report).
 *
 * BEM: .gmd-about, .gmd-about__*
 */
import type { PanelCallbacks } from '../core/types';
import { el, append, html } from './m3e/dom';
import {
  ICON_INFO, ICON_GITHUB, ICON_BUG, ICON_EXTERNAL_LINK, ICON_CHECK, ICON_REFRESH,
} from './m3e/icons';
import { DEFAULT_ADAPTER_CONFIG, checkRemoteVersion } from '../adapters/deepseek-config';

declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════════════

export function renderAboutTab(cb: PanelCallbacks): HTMLElement {
  const root = el('div', 'gmd-about');

  // ── Status card ──────────────────────────────────────────────────────
  const statusCard = el('div', 'gmd-about__card');

  const statusTitle = el('h3', 'gmd-about__card-title');
  statusTitle.textContent = '系统状态';
  statusCard.appendChild(statusTitle);

  // Platform row
  statusCard.appendChild(
    createInfoRow('运行环境', __PLATFORM__ === 'userscript' ? 'Tampermonkey 油猴脚本' : '浏览器扩展'),
  );

  // Pandoc status row (will be updated async)
  const pandocStatusRow = createInfoRow('Pandoc 引擎', '检测中…');
  statusCard.appendChild(pandocStatusRow);

  // Pandoc version row
  const pandocVersionRow = createInfoRow('Pandoc 版本', '—');
  statusCard.appendChild(pandocVersionRow);

  root.appendChild(statusCard);

  // Update status asynchronously
  updatePandocStatus(cb, pandocStatusRow, pandocVersionRow);

  // ── Project info card ────────────────────────────────────────────────
  const infoCard = el('div', 'gmd-about__card');

  const infoTitle = el('h3', 'gmd-about__card-title');
  infoTitle.textContent = '项目信息';
  infoCard.appendChild(infoTitle);

  infoCard.appendChild(createInfoRow('名称', 'Give Me Doc'));
  infoCard.appendChild(createInfoRow('版本', '1.0.0'));
  infoCard.appendChild(
    createInfoRow('描述', '将 AI 对话导出为 Word 文档 — 由 Pandoc WASM 驱动'),
  );
  infoCard.appendChild(createInfoRow('许可证', 'AGPL-3.0'));

  root.appendChild(infoCard);

  // ── Links card ───────────────────────────────────────────────────────
  const linksCard = el('div', 'gmd-about__card');

  const linksTitle = el('h3', 'gmd-about__card-title');
  linksTitle.textContent = '链接';
  linksCard.appendChild(linksTitle);

  linksCard.appendChild(
    createLinkRow(ICON_GITHUB, 'GitHub 仓库', 'https://github.com/Qalxry/GiveMeDoc'),
  );
  linksCard.appendChild(
    createLinkRow(ICON_BUG, '报告问题', 'https://github.com/Qalxry/GiveMeDoc/issues/new'),
  );
  linksCard.appendChild(
    createLinkRow(ICON_EXTERNAL_LINK, 'Pandoc 官网', 'https://pandoc.org'),
  );

  root.appendChild(linksCard);

  // ── Adapter rule card ────────────────────────────────────────────────
  const adapterCard = el('div', 'gmd-about__card');

  const adapterTitle = el('h3', 'gmd-about__card-title');
  adapterTitle.textContent = '适配规则';
  adapterCard.appendChild(adapterTitle);

  // Local version row
  const localVersionRow = createInfoRow('本地版本', 'v' + DEFAULT_ADAPTER_CONFIG.version);
  adapterCard.appendChild(localVersionRow);

  // Remote version row (will be updated after fetching)
  const remoteVersionRow = createInfoRow('远程版本', '检测中…');
  adapterCard.appendChild(remoteVersionRow);

  // Refresh button row
  const refreshRow = document.createElement('div');
  refreshRow.className = 'gmd-about__refresh';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'gmd-about__refresh-btn';
  refreshBtn.innerHTML = ICON_REFRESH + ' 检查更新';
  refreshBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    refreshBtn.disabled = true;
    refreshBtn.textContent = '检查中…';
    const remoteVersion = await checkRemoteVersion();
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = ICON_REFRESH + ' 检查更新';

    const localVal = localVersionRow.querySelector('.gmd-about__value');
    const remoteVal = remoteVersionRow.querySelector('.gmd-about__value');

    const localVer = DEFAULT_ADAPTER_CONFIG.version;

    if (remoteVal) {
      if (remoteVersion == null) {
        remoteVal.textContent = '连接失败';
        remoteVal.className = 'gmd-about__value gmd-about__value--warn';
      } else {
        remoteVal.textContent = 'v' + remoteVersion;
        remoteVal.className = 'gmd-about__value';
        if (remoteVersion > localVer) {
          remoteVal.classList.add('gmd-about__value--ok');
        }
      }
    }
  });
  refreshRow.appendChild(refreshBtn);

  adapterCard.appendChild(refreshRow);

  root.appendChild(adapterCard);

  // Fetch remote version asynchronously for initial display
  checkRemoteVersion().then((remoteVersion) => {
    const remoteVal = remoteVersionRow.querySelector('.gmd-about__value');
    if (remoteVal) {
      if (remoteVersion == null) {
        remoteVal.textContent = '连接失败';
        remoteVal.className = 'gmd-about__value gmd-about__value--warn';
      } else {
        remoteVal.textContent = 'v' + remoteVersion;
        if (remoteVersion > DEFAULT_ADAPTER_CONFIG.version) {
          remoteVal.classList.add('gmd-about__value--ok');
        }
      }
    }
  });

  return root;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function createInfoRow(label: string, value: string): HTMLElement {
  const row = el('div', 'gmd-about__row');

  const labelEl = el('span', 'gmd-about__label');
  labelEl.textContent = label;
  row.appendChild(labelEl);

  const valueEl = el('span', 'gmd-about__value');
  valueEl.textContent = value;
  row.appendChild(valueEl);

  return row;
}

function createLinkRow(icon: string, text: string, href: string): HTMLElement {
  const row = el('a', 'gmd-about__link');
  row.href = href;
  row.target = '_blank';
  row.rel = 'noopener noreferrer';

  const iconEl = html('span', 'gmd-about__link-icon', icon);
  row.appendChild(iconEl);

  const labelEl = el('span', 'gmd-about__link-label');
  labelEl.textContent = text;
  row.appendChild(labelEl);

  const arrow = html('span', 'gmd-about__link-arrow', ICON_EXTERNAL_LINK);
  row.appendChild(arrow);

  return row;
}

async function updatePandocStatus(
  cb: PanelCallbacks,
  statusRow: HTMLElement,
  versionRow: HTMLElement,
): Promise<void> {
  const statusVal = statusRow.querySelector('.gmd-about__value');
  const versionVal = versionRow.querySelector('.gmd-about__value');

  if (cb.isPandocReady()) {
    if (statusVal) {
      statusVal.textContent = '已就绪';
      statusVal.classList.add('gmd-about__value--ok');
    }
    if (versionVal) {
      const v = await cb.getPandocVersion();
      versionVal.textContent = v || '未知';
    }
  } else {
    if (statusVal) {
      statusVal.textContent = '未加载';
      statusVal.classList.add('gmd-about__value--warn');
    }
    if (versionVal) {
      versionVal.textContent = '—';
    }
  }
}
