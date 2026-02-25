/**
 * Give Me Doc — Shared Storage Helpers
 *
 * All config / template management logic that is identical between
 * userscript.ts and extension-content.ts lives here.
 * Both entry points pass their platform-specific IStorage instance in.
 */
import type { IStorage, UserConfig, TemplateMeta, PanelCallbacks } from './types';
import { DEFAULT_CONFIG } from './types';
import { exportToDocx, downloadBlob, isPandocReady, getPandocVersion } from './converter';
import { getCurrentSessionId, getSession, getActiveChain } from '../adapters/deepseek';
import { BUILTIN_TEMPLATES } from './builtin-templates.generated';

// ═══════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════

export async function loadConfig(storage: IStorage): Promise<UserConfig> {
  const saved = await storage.get<Partial<UserConfig>>('config');
  return { ...DEFAULT_CONFIG, ...saved };
}

export async function saveConfigPartial(
  storage: IStorage,
  partial: Partial<UserConfig>,
): Promise<void> {
  const current = await loadConfig(storage);
  await storage.set('config', { ...current, ...partial });
}

// ═══════════════════════════════════════════════════════════════════════════
// Built-in templates metadata
// ═══════════════════════════════════════════════════════════════════════════

export const builtinTemplates: TemplateMeta[] = Object.entries(BUILTIN_TEMPLATES).map(
  ([id, tpl]) => ({ id, name: tpl.name, isBuiltin: true, description: tpl.description }),
);

// ═══════════════════════════════════════════════════════════════════════════
// Template management
// ═══════════════════════════════════════════════════════════════════════════

export async function getTemplateList(storage: IStorage): Promise<TemplateMeta[]> {
  const custom = (await storage.get<TemplateMeta[]>('custom-templates')) ?? [];
  return [...builtinTemplates, ...custom];
}

export async function uploadTemplate(
  storage: IStorage,
  name: string,
  data: ArrayBuffer,
): Promise<void> {
  const id = `custom-${Date.now()}`;
  const meta: TemplateMeta = { id, name, isBuiltin: false };
  const list = (await storage.get<TemplateMeta[]>('custom-templates')) ?? [];
  list.push(meta);
  await storage.set('custom-templates', list);
  await storage.setBlob(`tpl-blob-${id}`, data);
}

export async function deleteTemplate(storage: IStorage, id: string): Promise<void> {
  const list = (await storage.get<TemplateMeta[]>('custom-templates')) ?? [];
  await storage.set('custom-templates', list.filter((t) => t.id !== id));
  await storage.remove(`tpl-blob-${id}`);
}

export async function getTemplateBlob(
  storage: IStorage,
  id: string,
): Promise<ArrayBuffer | undefined> {
  if (id.startsWith('builtin-')) {
    const tpl = BUILTIN_TEMPLATES[id];
    if (!tpl) return undefined;
    const bin = atob(tpl.data);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }
  return (await storage.getBlob(`tpl-blob-${id}`)) ?? undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// Panel Callbacks factory
// ═══════════════════════════════════════════════════════════════════════════

export function createCallbacks(storage: IStorage): PanelCallbacks {
  return {
    async onExport(selectedIds, templateId) {
      const sessionId = getCurrentSessionId();
      if (!sessionId) throw new Error('未检测到会话 ID');

      const session = await getSession(sessionId);
      const chain = getActiveChain(session);
      const selectedSet = new Set(selectedIds);
      const messages = chain.filter((m) => selectedSet.has(m.id));
      if (messages.length === 0) throw new Error('没有选中任何消息');

      const config = await loadConfig(storage);
      const refDocx = await getTemplateBlob(storage, templateId);
      const { blob, filename } = await exportToDocx(messages, config, session.title, refDocx);
      downloadBlob(blob, filename);
    },

    async onTemplateUpload(name, data) {
      await uploadTemplate(storage, name, data);
    },

    async onTemplateDelete(id) {
      await deleteTemplate(storage, id);
    },

    async onConfigChange(partial) {
      await saveConfigPartial(storage, partial);
    },

    async getConfig() {
      return loadConfig(storage);
    },

    async getTemplateList() {
      return getTemplateList(storage);
    },

    async getSession() {
      const id = getCurrentSessionId();
      if (!id) return null;
      return getSession(id);
    },

    async getPandocVersion() {
      return getPandocVersion();
    },

    isPandocReady() {
      return isPandocReady();
    },
  };
}
