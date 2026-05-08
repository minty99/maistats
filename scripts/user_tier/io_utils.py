from __future__ import annotations

import json
import urllib.request
from typing import Any

from .constants import RAVEILLE_TIER_SPREADSHEET_XLSX_URL


def read_xlsx(xlsx_path: str | None) -> bytes:
    if xlsx_path:
        with open(xlsx_path, "rb") as f:
            return f.read()
    with urllib.request.urlopen(
        build_request(RAVEILLE_TIER_SPREADSHEET_XLSX_URL), timeout=30
    ) as resp:
        return resp.read()


def fetch_json(url: str) -> Any:
    with urllib.request.urlopen(build_request(url), timeout=30) as resp:
        return json.load(resp)


def build_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={"User-Agent": "maistats-raveille-user-tier-builder/1.0"},
    )
