from __future__ import annotations

import http.client
import json
import time
import urllib.error
import urllib.request
from typing import Any

from .constants import RAVEILLE_TIER_SPREADSHEET_XLSX_URL


RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY_SECONDS = 1.0
RETRYABLE_HTTP_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def read_xlsx(xlsx_path: str | None) -> bytes:
    if xlsx_path:
        with open(xlsx_path, "rb") as f:
            return f.read()
    return fetch_url_bytes(RAVEILLE_TIER_SPREADSHEET_XLSX_URL)


def fetch_json(url: str) -> Any:
    return json.loads(fetch_url_bytes(url).decode("utf-8"))


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
        headers={"User-Agent": "maistats-raveille-user-tier-builder/1.0"},
    )
