from __future__ import annotations

import http.client
import io
import json
import re
import time
import urllib.error
import urllib.request
import zipfile
from typing import Any
from xml.etree import ElementTree as ET

from .models import CellAddress, WorkbookSheet


RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY_SECONDS = 1.0
RETRYABLE_HTTP_STATUS_CODES = {408, 429, 500, 502, 503, 504}

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def read_xlsx(xlsx_path: str | None, default_url: str) -> bytes:
    if xlsx_path:
        with open(xlsx_path, "rb") as f:
            return f.read()
    return fetch_url_bytes(default_url)


def fetch_json(url: str) -> Any:
    return json.loads(fetch_url_bytes(url).decode("utf-8"))


def fetch_url_bytes(
    url: str,
    *,
    user_agent: str = "maistats-user-tier-builder/1.0",
) -> bytes:
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            request = build_request(url, user_agent)
            with urllib.request.urlopen(request, timeout=30) as resp:
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


def build_request(url: str, user_agent: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={"User-Agent": user_agent},
    )


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


def first_worksheet_path(zf: zipfile.ZipFile, workbook_name: str) -> str:
    sheets = workbook_sheets(zf)
    if not sheets:
        raise ValueError(f"{workbook_name} workbook does not contain any sheets")
    return sheets[0][1]


def parse_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
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


def zip_xlsx(xlsx_bytes: bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(xlsx_bytes))
