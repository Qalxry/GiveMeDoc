/**
 * Give Me Doc — Pandoc WASM Web Worker
 *
 * Runs pandoc.wasm inside a dedicated Worker thread, exposed via Comlink.
 * Handles WASI shim setup, Haskell RTS initialization, convert(), and query().
 *
 * References: docs/pandoc.md §4
 */
import * as Comlink from 'comlink';
import {
  WASI,
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
} from '@bjorn3/browser_wasi_shim';
import type { PandocWorkerAPI } from './types';

// ── State ──────────────────────────────────────────────────────────────────
let instance: WebAssembly.Instance | null = null;
let fileSystem: Map<string, InstanceType<typeof File>> = new Map();

/** Convenience: get DataView over WASM linear memory. */
function mem(): DataView {
  return new DataView((instance!.exports.memory as WebAssembly.Memory).buffer);
}
function memU8(): Uint8Array {
  return new Uint8Array((instance!.exports.memory as WebAssembly.Memory).buffer);
}
// Cast exports for easier access
function exp(): Record<string, Function> {
  return instance!.exports as unknown as Record<string, Function>;
}

// ── WASI File helpers ──────────────────────────────────────────────────────
function addFileSync(name: string, data: Uint8Array, readonly: boolean): void {
  const f = new File(data, { readonly });
  fileSystem.set(name, f);
}

async function addFileFromBlob(name: string, blob: Blob, readonly: boolean): Promise<void> {
  const buf = await blob.arrayBuffer();
  addFileSync(name, new Uint8Array(buf), readonly);
}

// ── API ────────────────────────────────────────────────────────────────────
const api: PandocWorkerAPI = {
  async init(wasmBytes: ArrayBuffer): Promise<void> {
    const args = ['pandoc.wasm', '+RTS', '-H64m', '-RTS'];
    const env: string[] = [];
    fileSystem = new Map();

    const fds = [
      new OpenFile(new File(new Uint8Array(), { readonly: true })),     // fd 0 stdin
      ConsoleStdout.lineBuffered((m: string) => console.log(`[pandoc] ${m}`)),  // fd 1
      ConsoleStdout.lineBuffered((m: string) => console.warn(`[pandoc] ${m}`)), // fd 2
      new PreopenDirectory('/', fileSystem),                            // fd 3
    ];

    const wasi = new WASI(args, env, fds, { debug: false });
    const { instance: inst } = await WebAssembly.instantiate(wasmBytes, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    instance = inst;

    wasi.initialize(instance);
    exp().__wasm_call_ctors();

    // Haskell RTS init — construct C-style argc/argv
    const argc_ptr = exp().malloc(4);
    mem().setUint32(argc_ptr, args.length, true);
    const argv = exp().malloc(4 * (args.length + 1));
    for (let i = 0; i < args.length; i++) {
      const arg = exp().malloc(args[i].length + 1);
      new TextEncoder().encodeInto(
        args[i],
        new Uint8Array((instance.exports.memory as WebAssembly.Memory).buffer, arg, args[i].length),
      );
      mem().setUint8(arg + args[i].length, 0); // null terminator
      mem().setUint32(argv + 4 * i, arg, true);
    }
    mem().setUint32(argv + 4 * args.length, 0, true);
    const argv_ptr = exp().malloc(4);
    mem().setUint32(argv_ptr, argv, true);
    exp().hs_init_with_rtsopts(argc_ptr, argv_ptr);
  },

  async convert(markdown: string, referenceDocx?: ArrayBuffer): Promise<ArrayBuffer> {
    if (!instance) throw new Error('Pandoc not initialized');

    // Build pandoc options JSON
    const options: Record<string, unknown> = {
      from: 'markdown',
      to: 'docx',
      'output-file': 'output.docx',
      standalone: true,
    };
    if (referenceDocx) {
      options['reference-doc'] = 'reference.docx';
    }

    const optsStr = JSON.stringify(options);
    const optsBytes = new TextEncoder().encode(optsStr);
    const optsPtr = exp().malloc(optsBytes.length);
    memU8().set(optsBytes, optsPtr);

    // Reset virtual filesystem
    fileSystem.clear();
    addFileSync('stdin', new TextEncoder().encode(markdown), true);
    addFileSync('stdout', new Uint8Array(), false);
    addFileSync('stderr', new Uint8Array(), false);
    addFileSync('warnings', new Uint8Array(), false);
    addFileSync('output.docx', new Uint8Array(), false);

    if (referenceDocx) {
      addFileSync('reference.docx', new Uint8Array(referenceDocx), true);
    }

    // Execute conversion
    exp().convert(optsPtr, optsBytes.length);

    // Read output
    const outFile = fileSystem.get('output.docx');
    if (!outFile || !outFile.data || outFile.data.byteLength === 0) {
      const stderrFile = fileSystem.get('stderr');
      const errText = stderrFile
        ? new TextDecoder().decode(stderrFile.data)
        : 'Unknown error';
      throw new Error(`Pandoc conversion failed: ${errText}`);
    }

    // Return a copy of the buffer (detachable)
    return outFile.data.slice().buffer;
  },

  async getVersion(): Promise<string> {
    if (!instance) throw new Error('Pandoc not initialized');

    const queryObj = { query: 'version' };
    const qStr = JSON.stringify(queryObj);
    const qBytes = new TextEncoder().encode(qStr);
    const qPtr = exp().malloc(qBytes.length);
    memU8().set(qBytes, qPtr);

    fileSystem.clear();
    addFileSync('stdin', new Uint8Array(), true);
    addFileSync('stdout', new Uint8Array(), false);
    addFileSync('stderr', new Uint8Array(), false);
    addFileSync('warnings', new Uint8Array(), false);

    exp().query(qPtr, qBytes.length);

    const outFile = fileSystem.get('stdout');
    if (!outFile) return 'unknown';
    return new TextDecoder().decode(outFile.data).trim();
  },
};

Comlink.expose(api);
