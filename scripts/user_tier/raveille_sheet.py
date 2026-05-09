from __future__ import annotations

import os
import re
import urllib.parse
from xml.etree import ElementTree as ET

from .constants import LABEL_SET, source_levels
from .io_utils import (
    NS,
    parse_cell_ref,
    parse_cell_value,
    parse_shared_strings,
    workbook_sheets,
    zip_xlsx,
)
from .matching import EXCEPTIONS, split_slug_genre_hint
from .models import (
    CellAddress,
    ChartCategory,
    ImageFileName,
    SheetEntry,
    TierRules,
)


type FormulaCell = tuple[int, int, ChartCategory, ImageFileName, str]


def parse_raveille_sheet(xlsx_bytes: bytes, tier_rules: TierRules) -> list[SheetEntry]:
    with zip_xlsx(xlsx_bytes) as zf:
        shared_strings = parse_shared_strings(zf)
        sheets = workbook_sheets(zf)

        entries = []
        for sheet_name, sheet_path in sheets:
            if sheet_name not in source_levels():
                continue
            worksheet = ET.fromstring(zf.read(sheet_path))
            entries.extend(
                parse_raveille_level_sheet(
                    worksheet,
                    shared_strings,
                    sheet_name,
                    tier_rules,
                )
            )

    return entries


def parse_raveille_level_sheet(
    worksheet: ET.Element,
    shared_strings: list[str],
    source_level: str,
    tier_rules: TierRules,
) -> list[SheetEntry]:
    values: dict[CellAddress, str] = {}
    formulas: list[FormulaCell] = []

    for cell in worksheet.findall(".//x:c", NS):
        row, col = parse_cell_ref(cell.attrib["r"])
        value = parse_cell_value(cell, shared_strings)
        if value:
            values[(row, col)] = value

        formula = cell.find("x:f", NS)
        if formula is None or not formula.text or "lom0.kr" not in formula.text:
            continue

        match = re.search(r'https://lom0\.kr/([^/]+)/([^")]+)', formula.text)
        if match is None:
            continue

        category = match.group(1)
        file_name = urllib.parse.unquote(match.group(2))
        source_url = f"https://lom0.kr/{category}/{urllib.parse.quote(file_name)}"
        formulas.append((row, col, category, file_name, source_url))

    entries = []
    source_internal_level_tenths = round(float(source_level) * 10)

    for row, col, category, file_name, source_url in formulas:
        source_grade = values.get((row, 2))
        if source_grade not in LABEL_SET:
            raise ValueError(f"missing Raveille tier label in {source_level} row {row}")

        source_tier = tier_rules[(source_level, source_grade)]
        base_name = os.path.basename(file_name)
        slug = EXCEPTIONS.get(base_name, os.path.splitext(base_name)[0])
        lookup_slug, genre_hint = split_slug_genre_hint(slug)
        entries.append(
            SheetEntry(
                row=row,
                col=col,
                category=category,
                file_name=file_name,
                slug=slug,
                lookup_slug=lookup_slug,
                genre_hint=genre_hint,
                source_internal_level_tenths=source_internal_level_tenths,
                source_grade=source_grade,
                source_tier=source_tier,
                source_url=source_url,
            )
        )

    return entries
