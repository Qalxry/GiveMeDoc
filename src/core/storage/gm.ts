/**
 * Give Me Doc — Tampermonkey (GM_*) Storage Adapter
 *
 * Wraps GM_getValue / GM_setValue / GM_deleteValue with the IStorage interface.
 */
import type { IStorage } from '../types';
import { b64ToArrayBuffer, arrayBufferToB64 } from '../b64';

declare function GM_getValue<T>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_deleteValue(key: string): void;

export const gmStorage: IStorage = {
  async get<T>(key: string): Promise<T | null> {
    const v = GM_getValue<T | null>(key, null);
    return v;
  },
  async set<T>(key: string, value: T): Promise<void> {
    GM_setValue(key, value);
  },
  async remove(key: string): Promise<void> {
    GM_deleteValue(key);
  },
  async getBlob(key: string): Promise<ArrayBuffer | null> {
    const b64 = GM_getValue<string | null>(key, null);
    if (!b64) return null;
    return b64ToArrayBuffer(b64);
  },
  async setBlob(key: string, value: ArrayBuffer): Promise<void> {
    GM_setValue(key, arrayBufferToB64(value));
  },
};
