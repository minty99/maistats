#!/usr/bin/env python3
"""Build Discord-bot-ready Raveille chart tiers using Lomo's tier mapping."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from typing import cast

if __package__ is None or __package__ == "":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from scripts.user_tier.constants import (  # noqa: E402
    DEFAULT_SONG_DATABASE_URL,
    MIN_USER_TIER_CHARTS,
    RAVEILLE_TIER_SPREADSHEET_ID,
    load_tier_rules,
)
from scripts.user_tier.io_utils import fetch_json, read_xlsx  # noqa: E402
from scripts.user_tier.matching import match_entries  # noqa: E402
from scripts.user_tier.merge import merge_sparse_user_tiers  # noqa: E402
from scripts.user_tier.models import (  # noqa: E402
    IssueEntry,
    OutputEntry,
    SongRecord,
    UserLevelsOutput,
    UserTier,
)
from scripts.user_tier.raveille_sheet import parse_raveille_sheet  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        default="raveille_user_tier.json",
        help="JSON output path",
    )
    parser.add_argument(
        "--song-database-url",
        default=DEFAULT_SONG_DATABASE_URL,
        help="Song database base URL, without /data.json",
    )
    parser.add_argument(
        "--xlsx-path",
        help="Use a local exported XLSX instead of downloading the Google Sheet",
    )
    args = parser.parse_args()

    xlsx_bytes = read_xlsx(args.xlsx_path)
    sheet_entries = parse_raveille_sheet(xlsx_bytes, load_tier_rules())
    song_database = fetch_json(args.song_database_url.rstrip("/") + "/data.json")
    songs = cast(list[SongRecord], song_database["songs"])
    matched, unresolved, ambiguous = match_entries(sheet_entries, songs)

    if unresolved or ambiguous:
        print_user_tier_summary(matched)
        print_issue_report(unresolved, ambiguous)
        return 1

    matched = merge_sparse_user_tiers(matched, MIN_USER_TIER_CHARTS)
    output: UserLevelsOutput = {
        "source": {
            "raveilleSpreadsheetId": RAVEILLE_TIER_SPREADSHEET_ID,
            "raveilleUrl": f"https://docs.google.com/spreadsheets/d/{RAVEILLE_TIER_SPREADSHEET_ID}",
            "songDatabaseUrl": args.song_database_url.rstrip("/"),
            "minUserTierCharts": MIN_USER_TIER_CHARTS,
        },
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "entries": matched,
    }

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    print(f"wrote {len(matched)} matched entries to {args.output}", file=sys.stderr)
    print_user_tier_summary(matched)
    return 0


def print_issue_report(
    unresolved: list[IssueEntry], ambiguous: list[IssueEntry]
) -> None:
    print(
        f"failed to resolve Raveille tier sheet: {len(unresolved)} unresolved, {len(ambiguous)} ambiguous",
        file=sys.stderr,
    )
    if unresolved:
        print("\nunresolved:", file=sys.stderr)
        for issue in unresolved:
            print(
                f"- row {issue['row']} col {issue['col']} "
                f"{issue['raveilleInternalLevel']} {issue['raveilleGrade']} "
                f"slug={issue['slug']} category={issue['category']} "
                f"url={issue['raveilleUrl']}",
                file=sys.stderr,
            )
    if ambiguous:
        print("\nambiguous:", file=sys.stderr)
        for issue in ambiguous:
            print(
                f"- row {issue['row']} col {issue['col']} "
                f"{issue['raveilleInternalLevel']} {issue['raveilleGrade']} "
                f"slug={issue['slug']} category={issue['category']} "
                f"between {len(issue['candidates'])} candidates:",
                file=sys.stderr,
            )
            for candidate in issue["candidates"]:
                print(
                    "  * "
                    f"{candidate['title']} / {candidate['genre']} / {candidate['artist']} "
                    f"[{candidate['chartType']} {candidate['difficulty']} "
                    f"{candidate['internalLevel'] or '-'}]",
                    file=sys.stderr,
                )


def print_user_tier_summary(entries: list[OutputEntry]) -> None:
    by_user_tier: dict[UserTier, list[OutputEntry]] = defaultdict(list)
    for entry in entries:
        by_user_tier[entry["userTier"]].append(entry)

    print(
        f"classified {len(entries)} resolved charts into {len(by_user_tier)} user tiers:",
        file=sys.stderr,
    )
    for user_tier in sorted(by_user_tier):
        internal_levels = tier_internal_levels(by_user_tier[user_tier])
        level_summary = (
            f"avg internal level {sum(internal_levels) / len(internal_levels):.2f}, "
            f"range {min(internal_levels):.1f}-{max(internal_levels):.1f}"
            if internal_levels
            else "internal level unavailable"
        )
        print(
            f"- userTier {user_tier}: {len(by_user_tier[user_tier])} charts, "
            f"{level_summary}",
            file=sys.stderr,
        )


def tier_internal_levels(entries: list[OutputEntry]) -> list[float]:
    return [
        float(entry["internalLevel"])
        for entry in entries
        if entry["internalLevel"] is not None
    ]


if __name__ == "__main__":
    raise SystemExit(main())
