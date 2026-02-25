/**
 * Give Me Doc — Base64 ↔ ArrayBuffer utilities
 */

/** Decode a base64 string into an ArrayBuffer. */
export function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/** Encode an ArrayBuffer into a base64 string. */
export function arrayBufferToB64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
