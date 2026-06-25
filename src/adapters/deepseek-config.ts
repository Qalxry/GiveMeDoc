/**
 * Give Me Doc — DeepSeek Adapter Configuration
 *
 * Single source of truth design:
 *   src/adapters/deepseek.adapter.json  ← the ONLY place to edit DOM config
 *        ↓
 *   TypeScript import (build-time)     ← compiled-in local fallback
 *        ↓
 *   CDN fetch (runtime)                ← remote override if version > local
 *
 * CDN fetch is silent (3s timeout) — failure gracefully degrades to local config.
 * Results are cached in localStorage for 24h to avoid redundant requests.
 */

import defaultCfg from './deepseek.adapter.json';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** A single strategy to locate a DOM element. Strategies are tried in priority order. */
export interface ElementStrategy {
  /** Lower number = higher priority. Tried first. */
  priority: number;
  method: 'svg-fingerprint' | 'attr' | 'role' | 'selector' | 'text' | 'first-child';
  pathPrefix?: string;
  attrName?: string;
  attrValue?: string;
  attrPattern?: string;
  role?: string;
  selector?: string;
  index?: number;
  text?: string;
  /**
   * Search scope override. Overrides the default scope passed by the caller.
   * - omitted / `'toolbar'` — use the caller-provided scope
   * - `'document'` — search the whole document
   * - `'parent'`  — search the parent of the caller-provided scope
   */
  scope?: 'toolbar' | 'document' | 'parent';
  label?: string;
}

export interface InjectButtonConfig {
  className: string;
  innerHTML: string;
  insertPosition: 'append' | 'prepend' | 'before' | 'after';
  insertRelativeTo: 'copy' | 'share' | 'trigger' | 'last' | 'first';
}

export interface CheckboxConfig {
  selector: string;
  selectAllFilter: 'wrapper' | 'position' | 'text';
  selectAllWrapper?: string;
  selectAllText?: string;
  selectAllIndex?: number;
  activeClass: string;
}

export interface ApiConfig {
  base: string;
  headers: Record<string, string>;
}

export interface AdapterConfig {
  version: number;
  platform: string;
  toolbar: {
    containerSelector: string;
    copyButton: ElementStrategy[];
    exportButton: InjectButtonConfig;
  };
  sharePanel: {
    triggerButton: ElementStrategy[];
    exportButton: InjectButtonConfig;
    checkbox: CheckboxConfig;
  };
  api: ApiConfig;
  endpoints: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Default config (compiled-in fallback from JSON)
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_ADAPTER_CONFIG = defaultCfg as unknown as AdapterConfig;

// ═══════════════════════════════════════════════════════════════════════════
// Runtime config loader — CDN first, cache second, local JSON fallback
// ═══════════════════════════════════════════════════════════════════════════

const CDN_URL =
  'https://cdn.jsdelivr.net/gh/Qalxry/GiveMeDoc@main/src/adapters/deepseek.adapter.json';

const STORAGE_KEY = 'gmd-adapter-config';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  version: number;
  fetchedAt: number;
  data: AdapterConfig;
}

export async function loadAdapterConfig(): Promise<AdapterConfig> {
  const cdnConfig = await tryFetchCDN();
  if (cdnConfig) {
    cacheConfig(cdnConfig);
    return cdnConfig;
  }

  const cached = readCache();
  if (cached) return cached;

  return DEFAULT_ADAPTER_CONFIG;
}

/**
 * Fetch the remote adapter config version from CDN **only**.
 * Returns the version number if available, or null if unreachable/failure.
 * Unlike loadAdapterConfig(), this does NOT fall back to cache or local config.
 */
export async function checkRemoteVersion(): Promise<number | null> {
  try {
    const res = await fetch(CDN_URL, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-cache',
    });
    if (!res.ok) return null;
    const remote: AdapterConfig = await res.json();
    if (!remote.version) return null;
    return remote.version;
  } catch {
    return null;
  }
}

async function tryFetchCDN(): Promise<AdapterConfig | null> {
  try {
    const res = await fetch(CDN_URL, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-cache',
    });
    if (!res.ok) return null;

    const remote: AdapterConfig = await res.json();
    if (!remote.version || !remote.platform || !remote.toolbar || !remote.sharePanel) {
      console.warn('[GiveMeDoc] Remote adapter config invalid, ignoring');
      return null;
    }

    const cached = readCache();
    const localVersion = cached?.version ?? DEFAULT_ADAPTER_CONFIG.version;
    if (remote.version <= localVersion) return null;

    return remote;
  } catch {
    return null;
  }
}

function readCache(): AdapterConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function cacheConfig(config: AdapterConfig): void {
  try {
    const entry: CacheEntry = { version: config.version, fetchedAt: Date.now(), data: config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch { /* ignore */ }
}

export function clearAdapterConfigCache(): void {
  localStorage.removeItem(STORAGE_KEY);
}
