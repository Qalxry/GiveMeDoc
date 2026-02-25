/**
 * Give Me Doc — All shared types and interfaces.
 *
 * This single file defines every type used across the project:
 * messages, sessions, storage, config, pandoc worker API, and panel callbacks.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Platform declaration
// ═══════════════════════════════════════════════════════════════════════════
declare const __PLATFORM__: 'userscript' | 'extension';

// ═══════════════════════════════════════════════════════════════════════════
// Message & Chat Session
// ═══════════════════════════════════════════════════════════════════════════

/** A single message in the conversation tree. */
export interface IMessage {
  id: string;
  parentId: string | null;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent: string;
  timestamp: number;
  status: 'finished' | 'incomplete' | 'error';
  childrenIds: string[];
}

/** A full chat session with its message tree. */
export interface IChatSession {
  id: string;
  title: string;
  updatedAt: number;
  /** All messages keyed by id — enables O(1) lookup for tree ops. */
  messages: Map<string, IMessage>;
  /** The leaf node id that identifies the current active branch. */
  currentMessageId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage abstraction
// ═══════════════════════════════════════════════════════════════════════════

/** Platform-agnostic key-value storage. Implemented per distribution target. */
export interface IStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getBlob(key: string): Promise<ArrayBuffer | null>;
  setBlob(key: string, value: ArrayBuffer): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// User Configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface UserConfig {
  locale: 'zh-CN' | 'en-US';
  includeThinking: boolean;
  selectedTemplateId: string;
  documentPrefix: string;
  userMessageTemplate: string;
  assistantMessageTemplate: string;
  /** CDN URLs for pandoc.wasm — only used in userscript mode. */
  cdnUrls: string[];
}

export const DEFAULT_CONFIG: UserConfig = {
  locale: 'zh-CN',
  includeThinking: false,
  selectedTemplateId: 'builtin-gb',
  documentPrefix: `---
title: {title}
date: {output_date}
---

`,
  userMessageTemplate: `***

**用户：**

{content}

`,
  assistantMessageTemplate: `***

**助手：**

> {thinking_content}

{content}

`,
  cdnUrls: [
    'https://pandoc.org/app/pandoc.wasm?sha1=2ab8055eb0803168da93d4b784fe40aa06551dfa',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Template metadata (stored alongside config)
// ═══════════════════════════════════════════════════════════════════════════

export interface TemplateMeta {
  id: string;
  name: string;
  isBuiltin: boolean;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc Worker API (exposed via Comlink)
// ═══════════════════════════════════════════════════════════════════════════

export interface PandocWorkerAPI {
  /** Load & initialise the WASM module from an ArrayBuffer. */
  init(wasmBytes: ArrayBuffer): Promise<void>;
  /** Convert markdown to docx. Returns the .docx ArrayBuffer. */
  convert(markdown: string, referenceDocx?: ArrayBuffer): Promise<ArrayBuffer>;
  /** Query pandoc version string. */
  getVersion(): Promise<string>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Panel Callbacks — the bridge between Panel UI and host entry-point
// ═══════════════════════════════════════════════════════════════════════════

export interface PanelCallbacks {
  /** Export selected messages to Word. */
  onExport(selectedIds: string[], templateId: string): Promise<void>;
  /** Upload a custom template. */
  onTemplateUpload(name: string, data: ArrayBuffer): Promise<void>;
  /** Delete a custom template. */
  onTemplateDelete(id: string): Promise<void>;
  /** Persist a partial config change. */
  onConfigChange(partial: Partial<UserConfig>): Promise<void>;
  /** Reset config to DEFAULT_CONFIG and return the fresh config. */
  onResetConfig(): Promise<UserConfig>;
  /** Clear Pandoc WASM cache. */
  onClearCache(): Promise<void>;
  /** Read the current config. */
  getConfig(): Promise<UserConfig>;
  /** List all available templates (builtin + custom). */
  getTemplateList(): Promise<TemplateMeta[]>;
  /** Fetch the current session's messages. */
  getSession(): Promise<IChatSession | null>;
  /** Get Pandoc engine version (or empty string if not ready). */
  getPandocVersion(): Promise<string>;
  /** Check if Pandoc engine is loaded and ready. */
  isPandocReady(): boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DeepSeek API raw response types (for parsing)
// ═══════════════════════════════════════════════════════════════════════════

export interface DSFragment {
  id: number;
  type: 'REQUEST' | 'THINK' | 'RESPONSE';
  content: string;
  elapsed_secs?: number;
  references?: unknown[];
  stage_id?: number;
}

export interface DSRawMessage {
  message_id: number;
  parent_id: number | null;
  role: 'USER' | 'ASSISTANT';
  status: 'FINISHED' | 'INCOMPLETE' | 'ERROR';
  inserted_at: number;
  fragments: DSFragment[];
  [key: string]: unknown; // other fields we don't use
}

export interface DSRawSession {
  id: string;
  title: string;
  updated_at: number;
  current_message_id: number;
  version: number;
  [key: string]: unknown;
}

export interface DSHistoryResponse {
  code: number;
  data: {
    biz_data: {
      chat_session: DSRawSession;
      chat_messages: DSRawMessage[];
    };
  };
}

export interface DSIDBRecord {
  data: {
    chat_session: DSRawSession;
    chat_messages: DSRawMessage[];
  };
  version: number;
  key: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast notification types
// ═══════════════════════════════════════════════════════════════════════════

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';
