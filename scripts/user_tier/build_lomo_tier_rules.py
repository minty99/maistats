from __future__ import annotations

import argparse
import http.client
import io
import os
import sys
import time
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from xml.etree import ElementTree as ET

if __package__ is None or __package__ == "":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from scripts.user_tier.models import (  # noqa: E402
    CellAddress,
    InternalLevel,
    LevelGrade,
    RaveilleGrade,
    SourceTier,
)


LOMO_TIER_SPREADSHEET_ID = "1SlploeLf6BseGDe97DftuBqTHQK8h16rk8M6EgnXG3s"
LOMO_TIER_SPREADSHEET_XLSX_URL = (
    f"https://docs.google.com/spreadsheets/d/{LOMO_TIER_SPREADSHEET_ID}/export?format=xlsx"
)
LOMO_SOURCE_TIER_ROW_BASE = 69
LABELS_HARD_TO_EASY = [
    "S",
    "A+",
    "A",
    "A-",
    "B+",
    "B",
    "B-",
    "C+",
    "C",
    "C-",
    "D+",
    "D",
    "D-",
    "E+",
    "E",
    "E-",
    "F",
]
LABEL_SET = set(LABELS_HARD_TO_EASY)
RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY_SECONDS = 1.0
RETRYABLE_HTTP_STATUS_CODES = {408, 429, 500, 502, 503, 504}

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def column_to_number(value: str) -> int:
    number = 0
    for ch in value:
        number = number * 26 + ord(ch) - ord("A") + 1
    return number


def source_levels() -> list[str]:
    return [f"{13 + index // 10}.{index % 10}" for index in range(16)]


@dataclass(frozen=True)
class LevelColumnRange:
    internal_level: InternalLevel
    min_col: int
    max_col: int

    def contains(self, col: int) -> bool:
        return self.min_col <= col <= self.max_col


type LomoTierLayout = tuple[LevelColumnRange, ...]


# The published XLSX stores the level labels visually rather than as ordinary
# cells, so internal levels are resolved from their hardcoded column bands.
DEFAULT_LOMO_TIER_LAYOUT: LomoTierLayout = (
    LevelColumnRange("13.0", column_to_number("A"), column_to_number("M")),
    LevelColumnRange("13.1", column_to_number("N"), column_to_number("S")),
    LevelColumnRange("13.2", column_to_number("T"), column_to_number("AJ")),
    LevelColumnRange("13.3", column_to_number("AK"), column_to_number("BC")),
    LevelColumnRange("13.4", column_to_number("BD"), column_to_number("BS")),
    LevelColumnRange("13.5", column_to_number("BT"), column_to_number("BZ")),
    LevelColumnRange("13.6", column_to_number("CA"), column_to_number("CG")),
    LevelColumnRange("13.7", column_to_number("CH"), column_to_number("CW")),
    LevelColumnRange("13.8", column_to_number("CX"), column_to_number("DO")),
    LevelColumnRange("13.9", column_to_number("DP"), column_to_number("EB")),
    LevelColumnRange("14.0", column_to_number("EC"), column_to_number("EH")),
    LevelColumnRange("14.1", column_to_number("EI"), column_to_number("EM")),
    LevelColumnRange("14.2", column_to_number("EN"), column_to_number("EQ")),
    LevelColumnRange("14.3", column_to_number("ER"), column_to_number("EX")),
    LevelColumnRange("14.4", column_to_number("EY"), column_to_number("FD")),
    LevelColumnRange("14.5", column_to_number("FE"), column_to_number("FJ")),
)


def build_lomo_tier_rules(
    xlsx_bytes: bytes,
    layout: LomoTierLayout = DEFAULT_LOMO_TIER_LAYOUT,
) -> tuple[tuple[SourceTier, tuple[LevelGrade, ...]], ...]:
    rules_by_tier: dict[SourceTier, list[LevelGrade]] = defaultdict(list)
    seen: dict[LevelGrade, CellAddress] = {}

    for row, col, grade in iter_lomo_grade_cells(xlsx_bytes):
        internal_level = resolve_internal_level(row, col, layout)
        source_tier = LOMO_SOURCE_TIER_ROW_BASE - row
        level_grade = (internal_level, grade)

        if level_grade in seen:
            previous_row, previous_col = seen[level_grade]
            raise ValueError(
                "duplicate Lomo tier rule for "
                f"{internal_level} {grade}: "
                f"{format_cell(previous_row, previous_col)} and {format_cell(row, col)}"
            )

        seen[level_grade] = (row, col)
        rules_by_tier[source_tier].append(level_grade)

    validate_lomo_tier_rules(rules_by_tier, seen)
    return tuple(
        (source_tier, tuple(entries))
        for source_tier, entries in sorted(rules_by_tier.items())
    )


def iter_lomo_grade_cells(xlsx_bytes: bytes) -> list[tuple[int, int, RaveilleGrade]]:
    with zipfile.ZipFile(io.BytesIO(xlsx_bytes)) as zf:
        shared_strings = parse_shared_strings(zf)
        sheet_path = first_worksheet_path(zf)
        worksheet = ET.fromstring(zf.read(sheet_path))

        cells = []
        for cell in worksheet.findall(".//x:c", NS):
            row, col = parse_cell_ref(cell.attrib["r"])
            value = parse_cell_value(cell, shared_strings)
            if not value:
                continue
            if value not in LABEL_SET:
                raise ValueError(
                    f"unexpected Lomo sheet value {value!r} at {format_cell(row, col)}"
                )
            cells.append((row, col, value))
        return cells


def resolve_internal_level(
    row: int,
    col: int,
    layout: LomoTierLayout,
) -> InternalLevel:
    matches = [area.internal_level for area in layout if area.contains(col)]
    if len(matches) != 1:
        rendered = format_cell(row, col)
        if not matches:
            raise ValueError(f"could not resolve internal level for {rendered}")
        raise ValueError(
            f"ambiguous internal level for {rendered}: {', '.join(matches)}"
        )
    return matches[0]


def validate_lomo_tier_rules(
    rules_by_tier: dict[SourceTier, list[LevelGrade]],
    seen: dict[LevelGrade, CellAddress],
) -> None:
    expected_entries = {(level, grade) for level in source_levels() for grade in LABEL_SET}
    missing_entries = sorted(expected_entries - set(seen))
    if missing_entries:
        formatted = ", ".join(f"{level} {grade}" for level, grade in missing_entries)
        raise ValueError(f"Lomo tier rules are missing grade mappings: {formatted}")

    extra_entries = sorted(set(seen) - expected_entries)
    if extra_entries:
        formatted = ", ".join(f"{level} {grade}" for level, grade in extra_entries)
        raise ValueError(f"Lomo tier rules contain unexpected mappings: {formatted}")

    invalid_tiers = sorted(tier for tier in rules_by_tier if tier < 0)
    if invalid_tiers:
        raise ValueError(f"Lomo tier rules contain negative tiers: {invalid_tiers}")


def first_worksheet_path(zf: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    relationships = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in relationships.findall("p:Relationship", REL_NS)
    }

    sheet = workbook.find(".//x:sheet", NS)
    if sheet is None:
        raise ValueError("Lomo tier workbook does not contain any sheets")

    rel_id = sheet.attrib[
        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    ]
    target = rel_targets[rel_id].lstrip("/")
    return target if target.startswith("xl/") else f"xl/{target}"


def parse_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in item.findall(".//x:t", NS)) for item in root]


def parse_cell_ref(value: str) -> CellAddress:
    letters = ""
    digits = ""
    for ch in value:
        if ch.isalpha():
            letters += ch
        elif ch.isdigit():
            digits += ch
        else:
            raise ValueError(f"unsupported cell reference: {value}")
    if not letters or not digits:
        raise ValueError(f"unsupported cell reference: {value}")
    return int(digits), column_to_number(letters)


def number_to_column(value: int) -> str:
    if value < 1:
        raise ValueError(f"column number must be positive: {value}")
    letters = ""
    while value:
        value, remainder = divmod(value - 1, 26)
        letters = chr(ord("A") + remainder) + letters
    return letters


def format_cell(row: int, col: int) -> str:
    return f"{number_to_column(col)}{row}"


def parse_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "s":
        value = cell.find("x:v", NS)
        return (
            shared_strings[int(value.text)] if value is not None and value.text else ""
        )
    if cell_type == "inlineStr":
        return "".join(t.text or "" for t in cell.findall(".//x:t", NS))
    value = cell.find("x:v", NS)
    return value.text if value is not None and value.text else ""


def fetch_url_bytes(url: str) -> bytes:
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(build_request(url), timeout=30) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_HTTP_STATUS_CODES or attempt == RETRY_ATTEMPTS:
                raise
            sleep_before_retry(attempt)
        except (
            http.client.IncompleteRead,
            TimeoutError,
            urllib.error.URLError,
            ConnectionError,
        ):
            if attempt == RETRY_ATTEMPTS:
                raise
            sleep_before_retry(attempt)

    raise RuntimeError("unreachable retry state")


def sleep_before_retry(attempt: int) -> None:
    time.sleep(RETRY_BASE_DELAY_SECONDS * 2 ** (attempt - 1))


def build_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={"User-Agent": "maistats-lomo-tier-rules-builder/1.0"},
    )


LOMO_TIER_RULES: tuple[tuple[SourceTier, tuple[LevelGrade, ...]], ...] = (
    build_lomo_tier_rules(fetch_url_bytes(LOMO_TIER_SPREADSHEET_XLSX_URL))
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--xlsx-path",
        help="Use a local exported XLSX instead of downloading the Google Sheet",
    )
    args = parser.parse_args()

    if args.xlsx_path:
        with open(args.xlsx_path, "rb") as f:
            xlsx_bytes = f.read()
    else:
        xlsx_bytes = fetch_url_bytes(LOMO_TIER_SPREADSHEET_XLSX_URL)

    rules = build_lomo_tier_rules(xlsx_bytes)
    print(format_lomo_tier_rules(rules))
    return 0


def format_lomo_tier_rules(
    rules: tuple[tuple[SourceTier, tuple[LevelGrade, ...]], ...],
) -> str:
    lines = ["LOMO_TIER_RULES: tuple[tuple[SourceTier, tuple[LevelGrade, ...]], ...] = ("]
    for source_tier, entries in rules:
        lines.append(f"    ({source_tier}, (")
        for internal_level, grade in entries:
            lines.append(f'        ("{internal_level}", "{grade}"),')
        lines.append("    )),")
    lines.append(")")
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
