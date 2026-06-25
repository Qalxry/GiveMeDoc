#!/usr/bin/env python3
"""Create empty INDEX.md / INDEX.REPO.* / INDEX.TOPIC.* templates."""

from __future__ import annotations

import argparse
import datetime as _dt
import re
import subprocess
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = SKILL_DIR / "templates"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9._-]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    if not value:
        raise SystemExit("slug cannot be empty")
    return value


def remote_url(repo_path: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_path), "remote", "get-url", "origin"],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
    return result.stdout.strip() or "unknown"


def write_new(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        raise SystemExit(f"refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(path)


def render_template(name: str, values: dict[str, str]) -> str:
    template_path = TEMPLATES_DIR / name
    content = template_path.read_text(encoding="utf-8")
    for key, value in values.items():
        content = content.replace("{{" + key + "}}", value)
    return content


def root_template(collection: Path, today: str) -> str:
    return render_template(
        "root-index.md",
        {
            "collection_path": str(collection),
            "date": today,
        },
    )


def repo_template(collection: Path, repo_slug: str, today: str) -> str:
    repo_path = collection / repo_slug
    url = remote_url(repo_path)
    return render_template(
        "repo-index.md",
        {
            "repo_slug": repo_slug,
            "repo_path": str(repo_path),
            "remote_url": url,
            "date": today,
        },
    )


def topic_template(collection: Path, topic_slug: str, today: str) -> str:
    return render_template(
        "topic-index.md",
        {
            "topic_slug": topic_slug,
            "date": today,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=["root", "repo", "topic"])
    parser.add_argument("collection", help="Reference repository collection path, e.g. ref_repos")
    parser.add_argument("slug", nargs="?", help="Repo or topic slug")
    parser.add_argument("--force", action="store_true", help="Overwrite existing template")
    args = parser.parse_args()

    collection = Path(args.collection)
    today = _dt.date.today().isoformat()

    if args.kind == "root":
        target = collection / "INDEX.md"
        content = root_template(collection, today)
    else:
        if not args.slug:
            raise SystemExit(f"{args.kind} requires a slug")
        slug = slugify(args.slug)
        if args.kind == "repo":
            target = collection / f"INDEX.REPO.{slug}.md"
            content = repo_template(collection, slug, today)
        else:
            target = collection / f"INDEX.TOPIC.{slug}.md"
            content = topic_template(collection, slug, today)

    write_new(target, content, args.force)


if __name__ == "__main__":
    main()
