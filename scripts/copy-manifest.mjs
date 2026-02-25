#!/usr/bin/env node
/**
 * copy-manifest.mjs <chrome|firefox>
 *
 * Post-build step for browser-specific extension packages:
 *   1. Copy dist/extension/ → dist/<browser>/
 *   2. Overlay the browser-specific manifest.json
 *
 * pandoc.wasm and icons are already present in dist/extension/ (placed by
 * the vite copyWasmPlugin and Vite's public-dir handling respectively),
 * so they are included automatically in step 1.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── CLI arg ────────────────────────────────────────────────────────────────
const browser = process.argv[2];
if (browser !== 'chrome' && browser !== 'firefox') {
  console.error('Usage: node scripts/copy-manifest.mjs <chrome|firefox>');
  process.exit(1);
}

const srcDir  = path.join(root, 'dist', 'extension');
const destDir = path.join(root, 'dist', browser);
const manifestSrc = path.join(root, 'manifests', `${browser}.manifest.json`);

// ── Helpers ────────────────────────────────────────────────────────────────
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── 1. Copy dist/extension/ → dist/<browser>/ ─────────────────────────────
if (!fs.existsSync(srcDir)) {
  console.error(`[copy-manifest] Source directory not found: ${srcDir}`);
  console.error('  Run "pnpm build:extension" first.');
  process.exit(1);
}

console.log(`[copy-manifest] Copying ${path.relative(root, srcDir)} → ${path.relative(root, destDir)}`);
copyDirRecursive(srcDir, destDir);

// ── 2. Overlay browser-specific manifest.json ──────────────────────────────
if (!fs.existsSync(manifestSrc)) {
  console.error(`[copy-manifest] Manifest not found: ${manifestSrc}`);
  process.exit(1);
}

const manifestDest = path.join(destDir, 'manifest.json');
fs.copyFileSync(manifestSrc, manifestDest);
console.log(`[copy-manifest] Manifest → ${path.relative(root, manifestDest)}`);

console.log(`[copy-manifest] ✓ dist/${browser}/ is ready.`);
