#!/usr/bin/env python3

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


LEVEL_FIELDS = (
    "lev_bas",
    "lev_adv",
    "lev_exp",
    "lev_mas",
    "lev_remas",
    "lev_utage",
    "dx_lev_bas",
    "dx_lev_adv",
    "dx_lev_exp",
    "dx_lev_mas",
    "dx_lev_remas",
)
IDENTITY_FIELDS = ("image_url", "title", "comment", "kanji", "buddy")
IGNORED_FIELDS = {"sort"}
DETAIL_LIMIT = 40


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replace the pinned official maimai song snapshot and summarize changes."
    )
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--summary", required=True, type=Path)
    return parser.parse_args()


def load_snapshot(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as file:
        rows = json.load(file)

    if not isinstance(rows, list) or not rows:
        raise ValueError(f"{path} must contain a non-empty JSON array")

    required_fields = ("title", "artist", "catcode", "image_url", "version")
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"{path}[{index}] must be a JSON object")
        missing = [field for field in required_fields if field not in row]
        if missing:
            raise ValueError(
                f"{path}[{index}] is missing required fields: {', '.join(missing)}"
            )

    return rows


def identity(row: dict[str, Any]) -> tuple[str, ...]:
    return tuple(str(row.get(field, "")) for field in IDENTITY_FIELDS)


def index_rows(
    rows: list[dict[str, Any]], source_name: str
) -> dict[tuple[str, ...], dict[str, Any]]:
    keys = [identity(row) for row in rows]
    duplicates = [key for key, count in Counter(keys).items() if count > 1]
    if duplicates:
        duplicate_titles = ", ".join(sorted({key[1] for key in duplicates})[:5])
        raise ValueError(
            f"{source_name} contains ambiguous duplicate song identities: {duplicate_titles}"
        )
    return dict(zip(keys, rows, strict=True))


def maximum_version(rows: list[dict[str, Any]]) -> int:
    versions: list[int] = []
    for row in rows:
        try:
            versions.append(int(row["version"]))
        except (TypeError, ValueError):
            continue
    return max(versions, default=0)


def display_name(row: dict[str, Any]) -> str:
    title = str(row.get("title") or "(untitled)")
    comment = str(row.get("comment") or "")
    if comment:
        return f"{title} — {comment}"
    return title


def markdown_value(value: Any) -> str:
    if value is None:
        return "∅"
    return str(value).replace("|", "\\|").replace("\n", " ") or "∅"


def changed_fields(
    old: dict[str, Any], new: dict[str, Any]
) -> list[tuple[str, Any, Any]]:
    fields = sorted((old.keys() | new.keys()) - IGNORED_FIELDS)
    return [
        (field, old.get(field), new.get(field))
        for field in fields
        if old.get(field) != new.get(field)
    ]


def append_details(
    lines: list[str], heading: str, entries: list[str], limit: int = DETAIL_LIMIT
) -> None:
    lines.extend((f"### {heading} ({len(entries)})", ""))
    if not entries:
        lines.extend(("- None", ""))
        return

    lines.extend(f"- {entry}" for entry in entries[:limit])
    if len(entries) > limit:
        lines.append(f"- …and {len(entries) - limit} more")
    lines.append("")


def build_summary(
    old_rows: list[dict[str, Any]], new_rows: list[dict[str, Any]]
) -> str:
    old_by_key = index_rows(old_rows, "existing snapshot")
    new_by_key = index_rows(new_rows, "downloaded snapshot")
    old_keys = set(old_by_key)
    new_keys = set(new_by_key)

    added = [display_name(new_by_key[key]) for key in sorted(new_keys - old_keys)]
    removed = [display_name(old_by_key[key]) for key in sorted(old_keys - new_keys)]
    level_changes: list[str] = []
    metadata_changes: list[str] = []

    for key in sorted(old_keys & new_keys):
        old = old_by_key[key]
        new = new_by_key[key]
        changes = changed_fields(old, new)
        if not changes:
            continue

        level_diffs = [change for change in changes if change[0] in LEVEL_FIELDS]
        metadata_diffs = [change for change in changes if change[0] not in LEVEL_FIELDS]
        if level_diffs:
            rendered = ", ".join(
                f"`{field}`: {markdown_value(before)} → {markdown_value(after)}"
                for field, before, after in level_diffs
            )
            level_changes.append(f"**{display_name(new)}** — {rendered}")
        if metadata_diffs:
            rendered = ", ".join(
                f"`{field}`: {markdown_value(before)} → {markdown_value(after)}"
                for field, before, after in metadata_diffs
            )
            metadata_changes.append(f"**{display_name(new)}** — {rendered}")

    old_version = maximum_version(old_rows)
    new_version = maximum_version(new_rows)
    lines = [
        "## Official snapshot change summary",
        "",
        "| Metric | Before | After |",
        "| --- | ---: | ---: |",
        f"| Entries | {len(old_rows)} | {len(new_rows)} |",
        f"| Maximum version code | `{old_version}` | `{new_version}` |",
        "",
    ]
    if old_version // 500 != new_version // 500:
        lines.extend(
            (
                "> [!WARNING]",
                "> The maximum version band changed. Review version mappings and removals before merging.",
                "",
            )
        )

    append_details(lines, "Added entries", added)
    append_details(lines, "Removed entries", removed)
    append_details(lines, "Displayed level changes", level_changes)
    append_details(lines, "Other metadata changes", metadata_changes)
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    args = parse_args()
    old_rows = load_snapshot(args.snapshot)
    new_rows = load_snapshot(args.source)
    summary = build_summary(old_rows, new_rows)

    args.snapshot.write_text(
        json.dumps(new_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    args.summary.write_text(summary, encoding="utf-8")


if __name__ == "__main__":
    main()
