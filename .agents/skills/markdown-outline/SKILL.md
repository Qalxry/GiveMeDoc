---
name: markdown-outline
description: "**READING SKILL** — Generate a hierarchical outline index (with line-number ranges) for a long Markdown file, then use it to navigate precisely to sections of interest. USE FOR: reading/understanding large .md documents; answering questions about specific sections without loading the entire file; exploring document structure. DO NOT USE FOR: editing Markdown; non-.md files."
argument-hint: "Path to the Markdown file to outline and read"
---

# Markdown Outline Index

Generate a structured outline of a long Markdown file with line-number ranges, then use the outline to read only the sections you need. This avoids loading entire large documents into context.

## When to Use

- You need to read or answer questions about a **long Markdown file** (hundreds+ lines)
- You want to understand the **structure** of a Markdown document before diving in
- You need to find a **specific section** in a large document efficiently
- User asks about content in a `.md` file and you want to navigate precisely

## Procedure

### Step 1 — Generate the Outline

Run the bundled script on the target file:

```
python <skill-root>/scripts/get_markdown_outline.py "<target-file>.md"
# Optional: add `--max-level N` to limit heading depth (default 6)
# Optional: add `-o <output-file>` to write the outline to a file instead of stdout
# Example: python ./.agent/skills/markdown-outline/scripts/get_markdown_outline.py "long-document.md" --max-level 3
# Example: python ./.agent/skills/markdown-outline/scripts/get_markdown_outline.py "long-document.md" --max-level 3 -o "long-document.index.md" 
```

- Use `--max-level N` (1–6) to limit heading depth if the file is deeply nested. Default is 6.
- The script outputs to stdout by default.

### Step 2 — Parse the Outline

The output contains each heading with two key ranges:

| Range | Meaning |
|-------|---------|
| **Total Span** | This heading + all nested sub-headings (the full section) |
| **Direct Content** | Lines under this heading *before* the next sub-heading starts |

Example output line:
```
## 1.1 Topic Name *[Total Span: 10 - 85 | Direct Content: 10 - 15]*
```

### Step 3 — Read Target Sections

Use the line ranges from the outline to read only the sections relevant to the task:

- To read a **specific topic** and all its sub-sections → use **Total Span**
- To read **just the intro/overview** of a section (skipping children) → use **Direct Content**
- Read multiple non-adjacent sections in parallel using their respective ranges

### Tips

- For very large files (1000+ lines), start with `--max-level 2` or `--max-level 3` to get a high-level overview, then drill down.
- If the user asks about a topic, match keywords to heading titles in the outline before reading.
- Prefer reading the narrowest range that answers the question.

## Script Reference

- Input: Any `.md` or `.txt` file path
- Output: Hierarchical index with `Total Span` and `Direct Content` line ranges
- Options: `--max-level N` (1–6), `-o [path]` (write to file instead of stdout)
