#!/usr/bin/env python3
"""
build_templates.py — 根据 config.yaml 生成内置 Word 模板

读取 templates/config.yaml 中的样式定义，基于 pandoc 默认 reference.docx
修改字体/字号/行距等样式，输出:
    1. templates/<id>.docx               — 可作为 pandoc reference-doc 使用
    2. src/core/builtin-templates.generated.ts — base64 嵌入，运行时种子数据

用法:
    python3 scripts/build_templates.py           # 从项目根目录运行
    pnpm build:templates                         # 等效 npm script

依赖:
    pip install python-docx pyyaml
"""
from __future__ import annotations

import base64
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML not found. Please install it with `pip install pyyaml`.", file=sys.stderr)
    sys.exit(1)

# Check for pandoc in PATH before importing python-docx, since it's a hard dependency for the generated .docx files to be usable as pandoc reference docs.
if not shutil.which("pandoc"):
    print("ERROR: pandoc not found in PATH. Please install pandoc and ensure it's available as a command-line tool.", file=sys.stderr)
    sys.exit(1)

# Verify python-docx can be imported and is functional
try:
    from docx import Document
    from docx.shared import Pt, Cm, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.style import WD_STYLE_TYPE
    from docx.oxml.ns import qn
except ImportError:
    print("ERROR: python-docx not found. Please install it with `pip install python-docx`.", file=sys.stderr)
    sys.exit(1)

# Styles that should be created as CHARACTER type when missing
_CHAR_STYLES = {"Verbatim Char", "Body Text Char", "Footnote Reference",
                "Hyperlink", "Section Number", "Default Paragraph Font"}

# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
TEMPLATES_DIR = ROOT_DIR / "templates"
CONFIG_PATH = TEMPLATES_DIR / "config.yaml"
OUTPUT_TS_PATH = ROOT_DIR / "src" / "core" / "builtin-templates.generated.ts"

ALIGNMENT_MAP = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}


def load_config() -> dict[str, Any]:
    """Load and validate config.yaml."""
    if not CONFIG_PATH.exists():
        print(f"ERROR: config not found: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if "templates" not in cfg or not cfg["templates"]:
        print("ERROR: config.yaml must define at least one template", file=sys.stderr)
        sys.exit(1)
    return cfg


def generate_base_reference_doc(output_path: Path) -> None:
    """Use pandoc to generate the default reference.docx."""
    pandoc = shutil.which("pandoc")
    if not pandoc:
        print("ERROR: pandoc not found in PATH", file=sys.stderr)
        sys.exit(1)
    subprocess.run(
        [pandoc, "--print-default-data-file", "reference.docx"],
        stdout=open(output_path, "wb"),
        check=True,
    )


def set_run_font(run_or_rpr, *, ascii: str | None, east_asia: str | None) -> None:
    """Set font names on a run or rPr element using OOXML."""
    # Find or create rFonts element
    rpr = run_or_rpr
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.insert(0, rfonts)
    if ascii:
        rfonts.set(qn("w:ascii"), ascii)
        rfonts.set(qn("w:hAnsi"), ascii)
    if east_asia:
        rfonts.set(qn("w:eastAsia"), east_asia)


def apply_style(doc: Document, style_name: str, props: dict[str, Any]) -> None:
    """Apply style properties to a named style in the document."""
    # Find the style object
    style = None
    for s in doc.styles:
        if s.name == style_name:
            style = s
            break

    if style is None:
        # Auto-create missing styles so pandoc picks them up
        try:
            if style_name in _CHAR_STYLES:
                style = doc.styles.add_style(style_name, WD_STYLE_TYPE.CHARACTER)
            else:
                style = doc.styles.add_style(style_name, WD_STYLE_TYPE.PARAGRAPH)
                style.base_style = doc.styles["Normal"]
            print(f"    + created style: '{style_name}'")
        except Exception as e:
            print(f"  WARNING: could not create style '{style_name}': {e}")
            return

    # Font settings
    font_ascii = props.get("font_ascii")
    font_east_asia = props.get("font_eastAsia")
    font_size = props.get("font_size_pt")
    bold = props.get("bold")
    color = props.get("color")

    if font_ascii or font_east_asia:
        # Use low-level API for full CJK font control
        rpr = style.element.find(qn("w:rPr"))
        if rpr is None:
            rpr = style.element.makeelement(qn("w:rPr"), {})
            style.element.append(rpr)
        set_run_font(rpr, ascii=font_ascii, east_asia=font_east_asia)

        # Also set via python-docx high-level API for ascii/hAnsi
        if font_ascii and hasattr(style, "font"):
            style.font.name = font_ascii

    if font_size is not None and hasattr(style, "font"):
        style.font.size = Pt(font_size)

    if bold is not None and hasattr(style, "font"):
        style.font.bold = bold

    italic = props.get("italic")
    if italic is not None and hasattr(style, "font"):
        style.font.italic = italic

    if color and hasattr(style, "font"):
        style.font.color.rgb = RGBColor.from_string(color)

    # Paragraph settings
    if hasattr(style, "paragraph_format"):
        pf = style.paragraph_format
        if "line_spacing" in props:
            pf.line_spacing = props["line_spacing"]
        if "space_before_pt" in props:
            pf.space_before = Pt(props["space_before_pt"])
        if "space_after_pt" in props:
            pf.space_after = Pt(props["space_after_pt"])
        if "alignment" in props:
            align = props["alignment"]
            if align in ALIGNMENT_MAP:
                pf.alignment = ALIGNMENT_MAP[align]
        if "first_line_indent_pt" in props:
            pf.first_line_indent = Pt(props["first_line_indent_pt"])


def apply_page_setup(doc: Document, page_cfg: dict[str, Any]) -> None:
    """Apply page size and margins."""
    for section in doc.sections:
        if "width_cm" in page_cfg:
            section.page_width = Cm(page_cfg["width_cm"])
        if "height_cm" in page_cfg:
            section.page_height = Cm(page_cfg["height_cm"])
        if "margin_top_cm" in page_cfg:
            section.top_margin = Cm(page_cfg["margin_top_cm"])
        if "margin_bottom_cm" in page_cfg:
            section.bottom_margin = Cm(page_cfg["margin_bottom_cm"])
        if "margin_left_cm" in page_cfg:
            section.left_margin = Cm(page_cfg["margin_left_cm"])
        if "margin_right_cm" in page_cfg:
            section.right_margin = Cm(page_cfg["margin_right_cm"])


def build_template(
    base_docx_path: Path,
    tpl_cfg: dict[str, Any],
    global_defaults: dict[str, Any],
) -> Path:
    """Create a styled .docx template and return its output path."""
    tpl_id = tpl_cfg["id"]
    tpl_name = tpl_cfg["name"]
    output_path = TEMPLATES_DIR / f"{tpl_id}.docx"

    print(f"  Building: {tpl_id} ({tpl_name})")

    doc = Document(str(base_docx_path))

    # Apply global page setup
    page_cfg = global_defaults.get("page", {})
    apply_page_setup(doc, page_cfg)

    # Apply template-specific page setup (overrides global)
    tpl_page_cfg = tpl_cfg.get("page", {})
    if tpl_page_cfg:
        apply_page_setup(doc, tpl_page_cfg)

    # Apply global paragraph defaults to Normal style first
    para_defaults = global_defaults.get("paragraph", {})
    if para_defaults:
        apply_style(doc, "Normal", {
            "line_spacing": para_defaults.get("line_spacing"),
            "space_after_pt": para_defaults.get("space_after_pt"),
        })

    # Apply template-specific style overrides
    styles = tpl_cfg.get("styles", {})
    for style_name, style_props in styles.items():
        apply_style(doc, style_name, style_props)

    doc.save(str(output_path))
    print(f"    → {output_path.relative_to(ROOT_DIR)}")
    return output_path


def generate_ts_embed(template_paths: list[tuple[str, str, str, Path]]) -> None:
    """Generate builtin-templates.generated.ts with base64-encoded template data."""
    print(f"\n  Generating TypeScript embed: {OUTPUT_TS_PATH.relative_to(ROOT_DIR)}")

    lines = [
        "/**",
        " * Auto-generated by scripts/build_templates.py",
        " * DO NOT EDIT MANUALLY — run `pnpm build:templates` to regenerate.",
        " */",
        "",
        "export interface BuiltinTemplate {",
        "  name: string;",
        "  description: string;",
        "  data: string; // base64-encoded .docx",
        "}",
        "",
        "export const BUILTIN_TEMPLATES: Record<string, BuiltinTemplate> = {",
    ]

    for tpl_id, tpl_name, tpl_desc, docx_path in template_paths:
        with open(docx_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        # Split into 80-char lines for readability
        chunks = [b64[i : i + 80] for i in range(0, len(b64), 80)]
        joined = "' +\n    '".join(chunks)
        lines.append(f"  '{tpl_id}': {{")
        lines.append(f"    name: '{tpl_name}',")
        lines.append(f"    description: '{tpl_desc}',")
        lines.append(f"    data:")
        lines.append(f"    '{joined}',")
        lines.append(f"  }},")

    lines.append("};")
    lines.append("")

    OUTPUT_TS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_TS_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # Report sizes
    for tpl_id, tpl_name, tpl_desc, docx_path in template_paths:
        size_kb = docx_path.stat().st_size / 1024
        print(f"    {tpl_id}: {size_kb:.1f} KB")


def main() -> None:
    print("=== Give Me Doc: Building Word templates ===\n")

    cfg = load_config()
    global_defaults = cfg.get("defaults", {})

    # Step 1: Generate pandoc default reference.docx as base
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        base_path = Path(tmp.name)

    try:
        print("  Generating pandoc base reference.docx ...")
        generate_base_reference_doc(base_path)
        print(f"    → base: {base_path.stat().st_size / 1024:.1f} KB\n")

        # Step 2: Build each template
        template_paths: list[tuple[str, str, str, Path]] = []
        for tpl_cfg in cfg["templates"]:
            out = build_template(base_path, tpl_cfg, global_defaults)
            template_paths.append((
                tpl_cfg["id"],
                tpl_cfg["name"],
                tpl_cfg.get("description", ""),
                out,
            ))

        # Step 3: Generate TypeScript embed
        generate_ts_embed(template_paths)

    finally:
        base_path.unlink(missing_ok=True)

    print("\n=== Done! ===")


if __name__ == "__main__":
    main()
