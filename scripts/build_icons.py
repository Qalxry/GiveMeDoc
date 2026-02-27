#!/usr/bin/env python3
"""
build_icons.py — Download Lucide SVG icons and generate icons.ts

Usage:
    python3 scripts/build_icons.py

It reads the ICONS dict below, downloads each SVG from unpkg (lucide-static),
strips the root <svg> wrapper and outputs a TS file that reassembles them with
a shared attribute constant so the bundle stays small.

Output: src/ui/m3e/icons.ts
"""

import re
import sys
import urllib.request
from pathlib import Path
from textwrap import dedent

# ── Configuration ───────────────────────────────────────────────────────────

# Lucide version to pin (set to "latest" for newest)
LUCIDE_VERSION = "latest"
BASE_URL = f"https://unpkg.com/lucide-static@{LUCIDE_VERSION}/icons"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = PROJECT_ROOT / "src" / "ui" / "m3e" / "icons.ts"
CACHE_DIR = PROJECT_ROOT / "public" / "icons"

# Map of EXPORT_NAME -> (lucide_icon_id, description)
# This is the single source of truth — add/remove icons here.
ICONS: dict[str, tuple[str, str]] = {
    "ICON_LOGO":            ("logo",             "Give Me Doc logo"),
    "ICON_LOGO_FG":         ("logo-fg",          "Give Me Doc logo foreground only (for color-adaptive contexts)"),
    "ICON_FILE_TEXT":       ("file-text",        "document export"),
    "ICON_FILE_DOWN":       ("file-down",        "download file"),
    "ICON_FILE_TYPE":       ("file-type",        "file type badge (single message export)"),
    "ICON_DOWNLOAD":        ("download",         "download / export"),
    "ICON_UPLOAD":          ("upload",           "upload template"),
    "ICON_TRASH":           ("trash-2",          "delete"),
    "ICON_CHEVRON_LEFT":    ("chevron-left",     "previous branch"),
    "ICON_CHEVRON_RIGHT":   ("chevron-right",    "next branch"),
    "ICON_CHEVRON_DOWN":    ("chevron-down",     "dropdown indicator"),
    "ICON_CHECK":           ("check",            "checkmark / confirm"),
    "ICON_X":               ("x",               "close / dismiss"),
    "ICON_SETTINGS":        ("settings",         "settings tab"),
    "ICON_INFO":            ("info",             "about tab / info toast"),
    "ICON_EXTERNAL_LINK":   ("external-link",    "open in new tab"),
    "ICON_LIST":            ("list",             "export tab list"),
    "ICON_STAR":            ("star",             "set as default"),
    "ICON_REFRESH":         ("refresh-cw",       "refresh session"),
    "ICON_GITHUB":          ("github",           "GitHub link"),
    "ICON_BUG":             ("bug",              "report issue"),
    "ICON_USER":            ("user",             "user message"),
    "ICON_BOT":             ("bot",              "assistant message"),
    "ICON_CIRCLE_CHECK":    ("circle-check",     "success toast"),
    "ICON_TRIANGLE_ALERT":  ("triangle-alert",   "warning toast"),
    "ICON_CIRCLE_X":        ("circle-x",         "error toast"),
    "ICON_TEXT_CURSOR_INPUT": ("text-cursor-input", "free-text input mode"),
    "ICON_MESSAGES_SQUARE": ("messages-square",  "message export"),
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def get_svg(icon_id: str) -> str:
    """
    Get an SVG for *icon_id*.
    1. Try local cache at  public/icons/{icon_id}.svg
    2. On miss → download from unpkg, then write to cache.
    """
    cache_file = CACHE_DIR / f"{icon_id}.svg"

    # ── cache hit ──
    if cache_file.is_file():
        text = cache_file.read_text(encoding="utf-8").strip()
        if text:
            print(f"  ✓ cache  {cache_file.relative_to(PROJECT_ROOT)}")
            return text

    # ── cache miss → download ──
    url = f"{BASE_URL}/{icon_id}.svg"
    print(f"  ↓ fetch  {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "build_icons/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode("utf-8").strip()
    except Exception as e:
        print(f"  ✗ Failed to download {icon_id}: {e}", file=sys.stderr)
        raise

    # ── write cache ──
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(text + "\n", encoding="utf-8")
    print(f"  + cached {cache_file.relative_to(PROJECT_ROOT)}")
    return text


def extract_inner(svg_text: str) -> str:
    """
    Extract the inner content of an <svg ...>...</svg> element.
    The unpkg SVGs look like:
        <!-- @license ... -->
        <svg class="lucide ..." xmlns="..." ...>
          <path d="..." />
          ...
        </svg>
    We strip the comment, the outer <svg> wrapper, collapse whitespace,
    and return only the child elements on a single line.
    """
    # Remove HTML comments
    s = re.sub(r"<!--.*?-->", "", svg_text, flags=re.DOTALL).strip()
    # Remove the outer <svg ...> and </svg>
    s = re.sub(r"^<svg[^>]*>", "", s, count=1)
    s = re.sub(r"</svg>\s*$", "", s, count=1)
    # Collapse whitespace: join lines, squeeze spaces
    s = re.sub(r"\s+", " ", s).strip()
    # Self-close tags: " />" -> "/>"
    s = s.replace(" />", "/>")
    return s


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"Building icons.ts ({len(ICONS)} icons)")
    print(f"Source: {BASE_URL}/{{icon_id}}.svg\n")

    # Resolve all icons (cache or download)
    icon_inners: dict[str, str] = {}
    cached = 0
    fetched = 0
    for export_name, (icon_id, _desc) in ICONS.items():
        was_cached = (CACHE_DIR / f"{icon_id}.svg").is_file()
        svg_text = get_svg(icon_id)
        icon_inners[export_name] = extract_inner(svg_text)
        if was_cached:
            cached += 1
        else:
            fetched += 1
    print(f"\n  {cached} cached, {fetched} fetched")

    # Generate TypeScript
    lines: list[str] = []
    lines.append(dedent("""\
        /**
         * Give Me Doc — Lucide Icon SVG strings (auto-generated)
         *
         * DO NOT EDIT MANUALLY.
         * Generated by: scripts/build_icons.py
         *
         * All icons share a common SVG attribute set via the S constant.
         * Each export is a complete <svg> string ready for innerHTML injection.
         */

        const S = 'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    """).rstrip())
    lines.append("")

    for export_name, (icon_id, desc) in ICONS.items():
        inner = icon_inners[export_name]
        lines.append(f"/** {icon_id} — {desc} */")
        lines.append(f"export const {export_name} = `<svg ${{S}}>{inner}</svg>`;")
        lines.append("")

    # Helper function for size variants
    lines.append(dedent("""\
        // ── Size helper ────────────────────────────────────────────────────────
        
        /**
         * Create a size variant of an icon SVG string.
         * Replaces width="20" height="20" with the given size.
         */
        export function iconSize(svg: string, size: number): string {
          return svg
            .replace('width="20"', `width="${size}"`)
            .replace('height="20"', `height="${size}"`);
        }

        /**
         * Create an icon SVG with custom stroke-width.
         * Useful for checkbox/switch marks that need thicker strokes.
         */
        export function iconStroke(svg: string, strokeWidth: number): string {
          return svg.replace('stroke-width="2"', `stroke-width="${strokeWidth}"`);
        }
    """).rstrip())
    lines.append("")

    content = "\n".join(lines) + "\n"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(content, encoding="utf-8")
    print(f"\n✓ Generated {OUTPUT_PATH} ({len(ICONS)} icons)")


if __name__ == "__main__":
    main()
