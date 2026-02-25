/**
 * Give Me Doc — Browser Extension Storage Adapter
 *
 * Shared between extension-content.ts and extension-popup.ts.
 * Wraps browser.storage.local with the IStorage interface and
 * provides a reusable WASM cache-clearing helper.
 */
import type { IStorage } from './types';
import browser from 'webextension-polyfill';
import { b64ToArrayBuffer, arrayBufferToB64 } from './b64';

export const extStorage: IStorage = {
  async get<T>(key: string): Promise<T | null> {
    const result = await browser.storage.local.get(key);
    return (result[key] as T) ?? null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },
  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },
  async getBlob(key: string): Promise<ArrayBuffer | null> {
    const result = await browser.storage.local.get(key);
    const b64 = result[key] as string | undefined;
    if (!b64) return null;
    return b64ToArrayBuffer(b64);
  },
  async setBlob(key: string, value: ArrayBuffer): Promise<void> {
    await browser.storage.local.set({ [key]: arrayBufferToB64(value) });
  },
};

/** Remove all pandoc-wasm-related keys from browser.storage.local. */
export async function clearExtWasmCache(): Promise<void> {
  const keys = await browser.storage.local.get(null);
  const wasmKeys = Object.keys(keys).filter((k) => k.startsWith('pandoc-wasm'));
  if (wasmKeys.length > 0) await browser.storage.local.remove(wasmKeys);
}
