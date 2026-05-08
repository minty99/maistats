from __future__ import annotations

import io
import os
import re
import urllib.parse
import zipfile
from xml.etree import ElementTree as ET

from .constants import LABEL_SET, source_levels
from .matching import EXCEPTIONS, split_slug_genre_hint
from .models import (
    CellAddress,
    ChartCategory,
    ImageFileName,
    SheetEntry,
    TierRules,
    WorkbookSheet,
)


NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}


type FormulaCell = tuple[int, int, ChartCategory, ImageFileName, str]


def parse_raveille_sheet(xlsx_bytes: bytes, tier_rules: TierRules) -> list[SheetEntry]:
    with zipfile.ZipFile(io.BytesIO(xlsx_bytes)) as zf:
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
            raise ValueError(
                f"missing Raveille tier label in {source_level} row {row}"
            )

        user_tier = tier_rules[(source_level, source_grade)]
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
                user_tier=user_tier,
                source_url=source_url,
            )
        )

    return entries


def workbook_sheets(zf: zipfile.ZipFile) -> list[WorkbookSheet]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    relationships = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in relationships.findall("p:Relationship", REL_NS)
    }

    sheets = []
    for sheet in workbook.findall(".//x:sheet", NS):
        rel_id = sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        target = rel_targets[rel_id].lstrip("/")
        sheet_path = target if target.startswith("xl/") else f"xl/{target}"
        sheets.append((sheet.attrib["name"], sheet_path))
    return sheets


def parse_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in item.findall(".//x:t", NS)) for item in root]


def parse_cell_ref(value: str) -> CellAddress:
    match = re.fullmatch(r"([A-Z]+)(\d+)", value)
    if match is None:
        raise ValueError(f"unsupported cell reference: {value}")
    return int(match.group(2)), column_to_number(match.group(1))


def column_to_number(value: str) -> int:
    number = 0
    for ch in value:
        number = number * 26 + ord(ch) - ord("A") + 1
    return number


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
