import re
import argparse
import sys
from pathlib import Path


def build_hierarchical_md_index(filepath, max_level=6):
    """
    分析 Markdown 文件大纲，返回具有严格层级包含关系、带有行号范围的索引内容。
    max_level: 最深索引层级（1~6），超过该层级的标题会被忽略（视为正文）。
    """
    if not (1 <= max_level <= 6):
        raise ValueError(f"max_level 必须在 1~6 之间，当前为 {max_level}")

    input_path = Path(filepath)

    if not input_path.is_file() or input_path.suffix.lower() not in [".md", ".txt"]:
        raise FileNotFoundError(f"无法读取文件或文件不是 Markdown/TXT 格式 -> {filepath}")

    with open(input_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()

    if not lines:
        return ""

    sections = []
    active_stack = []  # 用于存储 sections 中的索引，追踪尚未闭合的父级标题
    heading_pattern = re.compile(r"^(#{1,6})\s+(.*)")
    in_code_block = False

    first_heading_line = None

    for i, line in enumerate(lines):
        line_num = i + 1

        # 跳过代码块内的内容（``` 或 ~~~ 围栏）
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        match = heading_pattern.match(line)

        if match:
            level = len(match.group(1))

            # 超过 max_level 的标题忽略（当作正文）
            if level > max_level:
                continue

            if first_heading_line is None:
                first_heading_line = line_num

            # 1. 结算上一个标题的“直接内容范围” (Direct Content)
            if sections:
                last_section = sections[-1]
                if last_section["direct_end"] is None:
                    last_section["direct_end"] = line_num - 1

            # 2. 栈处理：闭合所有级别 >= 当前级别的标题
            while active_stack and sections[active_stack[-1]]["level"] >= level:
                idx = active_stack.pop()
                sections[idx]["total_end"] = line_num - 1

            # 3. 新标题入栈
            section = {
                "level": level,
                "title": line,  # 保留原标题
                "start": line_num,
                "total_end": None,  # 包含所有子标题
                "direct_end": None,  # 不含子标题
            }
            sections.append(section)
            active_stack.append(len(sections) - 1)

    # 文件读取完毕，闭合所有剩余未闭合标题
    total_lines = len(lines)
    if sections:
        if sections[-1]["direct_end"] is None:
            sections[-1]["direct_end"] = total_lines

        while active_stack:
            idx = active_stack.pop()
            sections[idx]["total_end"] = total_lines

    # Frontmatter（第一个被索引标题之前）
    frontmatter = None
    if first_heading_line is not None and first_heading_line > 1:
        frontmatter = {"start": 1, "end": first_heading_line - 1}
    elif first_heading_line is None and total_lines > 0:
        frontmatter = {"start": 1, "end": total_lines}

    out_lines = [
        f"> Index of `{input_path.name}`",
        "> **Guide for LLM Agent:** This outline maps the document's hierarchical structure.",
        "> - **Total Span**: Includes this heading AND all its nested sub-headings.",
        "> - **Direct Content**: Lines under this heading *before* the next sub-heading begins.",
        f"> - **Max Indexed Level**: {max_level}",
        "",
        "---",
        "",
    ]

    if frontmatter:
        out_lines.append(
            f"(Frontmatter / Document Start) *[Direct Content: Lines {frontmatter['start']} - {frontmatter['end']}]*\n"
        )

    for sec in sections:
        total_range = (
            f"{sec['start']} - {sec['total_end']}"
            if sec["start"] != sec["total_end"]
            else f"{sec['start']}"
        )
        direct_range = (
            f"{sec['start']} - {sec['direct_end']}"
            if sec["start"] != sec["direct_end"]
            else f"{sec['start']}"
        )

        span_info = [f"Total Span: {total_range}"]
        if total_range != direct_range:
            span_info.append(f"Direct Content: {direct_range}")

        out_lines.append(f"{sec['title']} *[{' | '.join(span_info)}]*\n")

    return "\n".join(out_lines)


def get_default_output_path(input_path):
    return input_path.with_name(
        f"{input_path.stem}.index.{input_path.suffix.lstrip('.')}"
    )


def resolve_output_path(input_path, output):
    if output is None:
        return None

    if output == "__AUTO__":
        return get_default_output_path(input_path)

    output_path = Path(output)
    if output_path.exists() and output_path.is_dir():
        return output_path / get_default_output_path(input_path).name

    return output_path


def write_output(content, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)


def configure_stdio():
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8")


def main():
    configure_stdio()
    parser = argparse.ArgumentParser(
        description="生成 Markdown 分层索引，默认输出到标准输出"
    )
    parser.add_argument("filepath", help="Markdown/TXT 文件路径")
    parser.add_argument(
        "--max-level",
        type=int,
        default=6,
        help="最深索引层级（1~6），例如 1 表示只索引一级标题",
    )
    parser.add_argument(
        "-o",
        "--output",
        nargs="?",
        const="__AUTO__",
        help=(
            "写入文件而不是标准输出。"
            "可省略路径直接使用默认文件名 <原文件名>.index.<后缀>；"
            "也可指定输出文件路径，若指定的是已存在目录，则写入该目录下的默认文件名。"
        ),
    )
    args = parser.parse_args()

    try:
        input_path = Path(args.filepath)
        content = build_hierarchical_md_index(input_path, max_level=args.max_level)
        output_path = resolve_output_path(input_path, args.output)

        if output_path is None:
            if content:
                print(content)
            return 0

        write_output(content, output_path)
        print(f"已写入: {output_path.resolve()}", file=sys.stderr)
        return 0
    except (ValueError, FileNotFoundError) as exc:
        print(f"错误: {exc}", file=sys.stderr)
        return 1



if __name__ == "__main__":
    raise SystemExit(main())
