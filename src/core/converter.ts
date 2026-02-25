/**
 * Give Me Doc — Markdown formatter, template assembler, and conversion dispatcher.
 *
 * Three responsibilities in one file:
 * 1. formatMarkdown()  — normalize math delimiters, whitespace, headings
 * 2. assembleDocument() — fill message templates and concatenate
 * 3. exportToDocx()      — orchestrate: assemble → format → worker.convert → Blob
 *
 * The Pandoc Worker is managed here as a singleton.
 */
import * as Comlink from 'comlink';
import type { PandocWorkerAPI, IMessage, UserConfig } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// Pandoc Worker singleton
// ═══════════════════════════════════════════════════════════════════════════
let worker: Worker | null = null;
let pandoc: Comlink.Remote<PandocWorkerAPI> | null = null;
let _ready = false;
let _version = '';

/**
 * Initialise the Pandoc WASM worker.
 * @param wasmSource          ArrayBuffer of pandoc.wasm content
 * @param workerUrlOrInstance URL / blob URL pointing to the worker JS, or a pre-constructed Worker instance.
 *                            Pass a Worker instance in IIFE (userscript) mode where URL resolution is unreliable.
 */
export async function initPandoc(wasmSource: ArrayBuffer, workerUrlOrInstance: string | URL | Worker): Promise<void> {
  if (_ready) return;
  worker = workerUrlOrInstance instanceof Worker
    ? workerUrlOrInstance
    : new Worker(workerUrlOrInstance, { type: 'module' });
  pandoc = Comlink.wrap<PandocWorkerAPI>(worker);
  await pandoc.init(wasmSource);
  _version = await pandoc.getVersion();
  _ready = true;
}

export function isPandocReady(): boolean {
  return _ready;
}

export async function getPandocVersion(): Promise<string> {
  if (!_ready || !pandoc) return '';
  return _version;
}

// ═══════════════════════════════════════════════════════════════════════════
// Markdown formatting
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize Markdown for best Pandoc-to-DOCX results.
 *
 * - Math delimiters: \(...\) → $...$,  \[...\] → $$...$$
 * - Collapse 3+ consecutive blank lines → 2
 * - Normalize list markers (•, -, *) → -
 * - Minimal heading-level fix (ensure contiguous levels)
 */
export function formatMarkdown(raw: string): string {
  let s = raw;

  // 1. Inline math: \(...\) → $...$
  s = s.replace(/\\\((.+?)\\\)/gs, (_, inner) => `$${inner}$`);

  // 2. Display math: \[...\] → $$...$$
  s = s.replace(/\\\[(.+?)\\\]/gs, (_, inner) => `$$${inner}$$`);

  // 3. Collapse excessive blank lines
  s = s.replace(/\n{3,}/g, '\n\n');

  // 4. Unify list bullets at line start: •, *, + → -
  s = s.replace(/^([^\S\n]*)[•*+]\s/gm, '$1- ');

  // 5. Fix heading levels — ensure no gaps (e.g. # then ### without ##)
  s = fixHeadingLevels(s);

  return s;
}

/** Ensure heading levels are contiguous: if a jump > 1 is detected, shift down. */
function fixHeadingLevels(md: string): string {
  const lines = md.split('\n');
  let lastLevel = 0;
  const result: string[] = [];

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s/);
    if (m) {
      let level = m[1].length;
      if (lastLevel > 0 && level > lastLevel + 1) {
        level = lastLevel + 1;
      }
      lastLevel = level;
      result.push('#'.repeat(level) + line.slice(m[1].length));
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Template assembly
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble a complete Markdown document from messages using the user's templates.
 */
export function assembleDocument(
  messages: IMessage[],
  config: UserConfig,
  sessionTitle: string,
): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Document prefix
  let doc = config.documentPrefix
    .replace(/\{title\}/g, sessionTitle)
    .replace(/\{output_date\}/g, dateStr);

  // Append each message
  for (const msg of messages) {
    if (msg.role === 'user') {
      doc += renderTemplate(config.userMessageTemplate, msg, config);
    } else {
      doc += renderTemplate(config.assistantMessageTemplate, msg, config);
    }
  }

  return doc;
}

/** Replace placeholders in a single message template. */
function renderTemplate(template: string, msg: IMessage, config: UserConfig): string {
  let result = template;

  // {content}
  result = result.replace(/\{content\}/g, msg.content);

  // {thinking_content}
  if (!config.includeThinking || !msg.thinkingContent) {
    // Remove the placeholder AND its surrounding line (if it's in a blockquote line)
    result = result.replace(/^>?\s*\{thinking_content\}\s*\n?/gm, '');
    // Also clean up empty blockquote artifacts
    result = result.replace(/^>\s*$/gm, '');
    // Remove leftover blank lines caused by removal (collapse to single \n)
    result = result.replace(/\n{3,}/g, '\n\n');
  } else {
    // Expand thinking content — if the placeholder is on a `> ` line, prefix each line with `> `
    const thinkLines = msg.thinkingContent.split('\n');
    result = result.replace(
      /^(>\s*)\{thinking_content\}/gm,
      (_, prefix) => thinkLines.map((l) => `${prefix}${l}`).join('\n'),
    );
    // If placeholder is NOT in a blockquote
    result = result.replace(/\{thinking_content\}/g, msg.thinkingContent);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// One-shot export
// ═══════════════════════════════════════════════════════════════════════════

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Full pipeline: assemble → format → convert via Worker → return downloadable Blob.
 */
export async function exportToDocx(
  messages: IMessage[],
  config: UserConfig,
  sessionTitle: string,
  referenceDocx?: ArrayBuffer,
): Promise<{ blob: Blob; filename: string }> {
  if (!pandoc) throw new Error('Pandoc Worker not initialized');

  const raw = assembleDocument(messages, config, sessionTitle);
  const formatted = formatMarkdown(raw);
  const buffer = await pandoc.convert(formatted, referenceDocx);

  const safeName = sessionTitle.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100) || 'export';
  return {
    blob: new Blob([buffer], { type: DOCX_MIME }),
    filename: `${safeName}.docx`,
  };
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
