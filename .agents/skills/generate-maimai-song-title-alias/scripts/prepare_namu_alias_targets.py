#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_DATA_URL = "https://maimai-charts.muhwan.dev/data.json"
NAMU_BASE_URL = "https://namu.moe/w/"
USER_AGENT = "Mozilla/5.0 maistats-alias-helper"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="List unique maimai song titles and direct NamuWiki URLs."
    )
    parser.add_argument("--data-url", default=DEFAULT_DATA_URL)
    parser.add_argument("--data-json", type=Path)
    parser.add_argument(
        "--title",
        action="append",
        help="Process an explicit title. May be passed multiple times.",
    )
    parser.add_argument(
        "--existing-tsv",
        action="append",
        type=Path,
        default=[],
        help="Skip titles already present as the first column of this TSV.",
    )
    parser.add_argument("--limit", type=int)
    parser.add_argument(
        "--resolve-redirects",
        action="store_true",
        help="Open each Namu mirror URL and emit the final URL after HTTP redirects.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit is not None and args.limit < 0:
        raise SystemExit("--limit must be zero or positive")

    titles = explicit_titles(args.title) if args.title else load_titles(args)
    covered_titles = load_covered_titles(args.existing_tsv)
    pending_titles = [title for title in titles if title not in covered_titles]
    if args.limit is not None:
        pending_titles = pending_titles[: args.limit]

    for title in pending_titles:
        direct_url = namu_url(title)
        row = {
            "title": title,
            "namu_url": direct_url,
        }
        if args.resolve_redirects:
            row.update(resolve_redirects(direct_url))
        print(
            json.dumps(
                row,
                ensure_ascii=False,
            )
        )
    return 0


def explicit_titles(raw_titles: list[str]) -> list[str]:
    return dedupe_titles(title.strip() for title in raw_titles if title.strip())


def load_titles(args: argparse.Namespace) -> list[str]:
    if args.data_json is not None:
        payload = json.loads(args.data_json.read_text(encoding="utf-8"))
    else:
        request = urllib.request.Request(
            args.data_url,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
        )
        with urllib.request.urlopen(request) as response:
            payload = json.loads(response.read().decode("utf-8"))

    songs = payload.get("songs")
    if not isinstance(songs, list):
        raise SystemExit("data source does not contain a top-level songs array")

    return dedupe_titles(extract_title(song) for song in songs)


def extract_title(song: Any) -> str:
    if not isinstance(song, dict):
        return ""
    title = song.get("title")
    return title.strip() if isinstance(title, str) else ""


def load_covered_titles(paths: list[Path]) -> set[str]:
    covered: set[str] = set()
    for path in paths:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            title = line.split("\t", 1)[0].strip()
            if title:
                covered.add(title)
    return covered


def dedupe_titles(titles: Any) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for title in titles:
        if not title or title in seen:
            continue
        seen.add(title)
        unique.append(title)
    return unique


def namu_url(title: str) -> str:
    return NAMU_BASE_URL + urllib.parse.quote(title, safe="")


def resolve_redirects(url: str) -> dict[str, str | bool]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            final_url = response.geturl()
    except urllib.error.URLError as error:
        return {
            "final_namu_url": url,
            "redirected": False,
            "redirect_error": str(error.reason),
        }

    return {
        "final_namu_url": final_url,
        "redirected": final_url != url,
    }


if __name__ == "__main__":
    sys.exit(main())
