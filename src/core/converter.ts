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
  if (_version.startsWith('"') && _version.endsWith('"')) {
    _version = _version.slice(1, -1);
  }
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

  // ── Protect code regions from math processing ───────────────────────
  // Temporarily replace fenced code blocks and inline code with placeholders
  // so that $ signs inside them are not touched.
  const codeSlots: string[] = [];
  function stash(m: string): string {
    codeSlots.push(m);
    return `\x00CODE${codeSlots.length - 1}\x00`;
  }
  // Fenced code blocks (``` or ~~~)
  s = s.replace(/^(`{3,}|~{3,}).*\n[\s\S]*?\n\1\s*$/gm, stash);
  // Inline code (backtick runs)
  s = s.replace(/`[^`]+`/g, stash);

  // 1. Inline math: \(...\) → $...$
  s = s.replace(/\\\((.+?)\\\)/gs, (_, inner) => `$${inner}$`);

  // 2. Display math: \[...\] → $$...$$
  s = s.replace(/\\\[(.+?)\\\]/gs, (_, inner) => `$$${inner}$$`);

  // 3. Normalize inline math spacing: $ content $ → $content$
  //    Trim leading/trailing whitespace inside single-$ delimiters.
  //    Uses negative lookahead/lookbehind to skip $$ (display math).
  //    Inner content must not contain $ or newlines, preventing cross-formula spans.
  s = s.replace(
    /(?<!\$)\$(?!\$)([^\S\n]*)([^\$\n]+?)([^\S\n]*)\$(?!\$)/g,
    (match, pre, inner, post) => {
      const trimmed = inner.trim();
      if (trimmed === inner && !pre && !post) return match; // already tight — no change
      return `$${trimmed}$`;
    },
  );

  // 4. Remove citation references: [citation:N]
  s = s.replace(/\[citation:\d+\]/g, '');

  // 5. Collapse excessive blank lines
  s = s.replace(/\n{3,}/g, '\n\n');

  // 6. Unify list bullets at line start: •, *, + → -
  s = s.replace(/^([^\S\n]*)[•*+]\s/gm, '$1- ');

  // 7. Fix heading levels — ensure no gaps (e.g. # then ### without ##)
  // s = fixHeadingLevels(s);

  // ── Restore code regions ────────────────────────────────────────────
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeSlots[Number(idx)]);

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
    const template = msg.role === 'user' ? config.userMessageTemplate : config.assistantMessageTemplate;
    doc += renderTemplate(template, msg, config);
  }

  return doc;
}

/** Replace placeholders in a single message template. */
function renderTemplate(template: string, msg: IMessage, config: UserConfig): string {
  let result = template;

  // {content} — use function replacement to avoid $$ / $& / $' etc. being interpreted
  result = result.replace(/\{content\}/g, () => msg.content);

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
    result = result.replace(/\{thinking_content\}/g, () => msg.thinkingContent);
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

  console.debug('[GiveMeDoc] Assembled Markdown before formatting:', '\n' + raw);
  const formatted = formatMarkdown(raw);
  console.debug('[GiveMeDoc] Formatted Markdown for export:', '\n' + formatted);
  
  const buffer = await pandoc.convert(formatted, referenceDocx, config.lineBreaks);

  const safeName = sessionTitle.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100) || 'export';
  return {
    blob: new Blob([buffer], { type: DOCX_MIME }),
    filename: `${safeName}.docx`,
  };
}

/**
 * Export raw Markdown text to DOCX — skips assembleDocument(), applies only formatMarkdown().
 * Used for the free-text mode where users paste their own Markdown.
 */
export async function exportRawToDocx(
  markdown: string,
  filename: string,
  referenceDocx?: ArrayBuffer,
  lineBreaks?: string,
): Promise<{ blob: Blob; filename: string }> {
  if (!pandoc) throw new Error('Pandoc Worker not initialized');

  console.debug('[GiveMeDoc] Raw Markdown before formatting:', '\n' + markdown);
  const formatted = formatMarkdown(markdown);
  console.debug('[GiveMeDoc] Formatted raw Markdown for export:', '\n' + formatted);

  const buffer = await pandoc.convert(formatted, referenceDocx, lineBreaks);

  const safeName = filename.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100) || 'export';
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
