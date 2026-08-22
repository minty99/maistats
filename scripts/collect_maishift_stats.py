"""Collect maimai DX chart statistics from maishift's level distribution page.

The page fetches one packed distribution for a selected level and rating bucket.
That response already contains every score-rank count for every chart, so no
rank-specific requests are necessary.  This script discovers the current
server-function endpoint from the page assets, then collects all supported
level/rating combinations using only the Python standard library.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_URL = "https://maimai.shiftpsh.com/level-distribution"
LEVELS = ("LEVEL_13", "LEVEL_13_PLUS", "LEVEL_14", "LEVEL_14_PLUS")
RATING_RANGES = (
    (13000, 13500),
    (13500, 14000),
    (14000, 14250),
    (14250, 14500),
    (14500, 14750),
    (14750, 15000),
    (15000, 15250),
    (15250, 15500),
    (15500, 15750),
    (15750, 16000),
    (16000, 16250),
    (16250, 16500),
    (16500, 16750),
    (16750, 17000),
)
PACKED_COUNT_KEYS = (
    "LT_94",
    "AAA",
    "S",
    "S_PLUS",
    "SS",
    "SS_PLUS",
    "SSS",
    "ACH_100_5_7",
    "ACH_100_8_9",
    "SSS_PLUS",
    "SSS_PLUS_WITHOUT_AP",
    "FULL_COMBO",
    "FULL_COMBO_PLUS",
    "ALL_PERFECT",
    "ALL_PERFECT_PLUS",
)
RANK_COUNT_KEYS = {
    "AAA": ("AAA", "S", "S_PLUS", "SS", "SS_PLUS", "SSS", "SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
    "S": ("S", "S_PLUS", "SS", "SS_PLUS", "SSS", "SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
    "S+": ("S_PLUS", "SS", "SS_PLUS", "SSS", "SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
    "SS": ("SS", "SS_PLUS", "SSS", "SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
    "SS+": ("SS_PLUS", "SSS", "SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
    "SSS": ("SSS", "SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
    "SSS+": ("SSS_PLUS_WITHOUT_AP", "ALL_PERFECT", "ALL_PERFECT_PLUS"),
}
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "data" / "maishift_stats.json"

RECORD_RE = re.compile(
    r"trackId:(?P<track_id>\d+),(?P<body>.*?)(?=trackId:|\Z)", re.DOTALL
)


class CollectionError(RuntimeError):
    """Raised when the page shape is incompatible with the collector."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Collect all maimai DX charts displayed at levels 13 through 14+ "
            "from maishift's level distribution page."
        )
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"JSON output path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Seconds to wait between page requests (default: 0.5).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP request timeout in seconds (default: 30).",
    )
    parser.add_argument(
        "--user-agent",
        default="maistats-level-distribution-collector/1.0",
        help="User-Agent header used for requests.",
    )
    return parser.parse_args()


def js_string(raw: str) -> str:
    """Decode a quoted JavaScript string without executing page JavaScript."""

    if len(raw) < 2 or raw[0] != '"' or raw[-1] != '"':
        raise CollectionError(f"expected a quoted JavaScript string: {raw!r}")

    source = raw[1:-1]
    output: list[str] = []
    index = 0
    simple_escapes = {
        "b": "\b",
        "f": "\f",
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "v": "\v",
        "0": "\0",
    }
    while index < len(source):
        char = source[index]
        index += 1
        if char != "\\":
            output.append(char)
            continue

        if index >= len(source):
            raise CollectionError("unterminated JavaScript string escape")
        escape = source[index]
        index += 1
        if escape in simple_escapes:
            output.append(simple_escapes[escape])
        elif escape in ('"', "'", "\\", "/"):
            output.append(escape)
        elif escape == "x":
            if index + 2 > len(source):
                raise CollectionError("incomplete \\x escape in JavaScript string")
            output.append(chr(int(source[index : index + 2], 16)))
            index += 2
        elif escape == "u":
            if index < len(source) and source[index] == "{":
                end = source.find("}", index)
                if end < 0:
                    raise CollectionError("unterminated \\u{...} escape in JavaScript string")
                output.append(chr(int(source[index + 1 : end], 16)))
                index = end + 1
            else:
                if index + 4 > len(source):
                    raise CollectionError("incomplete \\u escape in JavaScript string")
                output.append(chr(int(source[index : index + 4], 16)))
                index += 4
        elif escape == "\n":
            # JavaScript line continuation.
            continue
        else:
            # Keep unknown escapes losslessly.  This is preferable to silently
            # changing a song title if the site introduces a new escape form.
            output.extend(("\\", escape))
    return "".join(output)


def read_quoted(source: str, start: int) -> tuple[str, int]:
    if start >= len(source) or source[start] != '"':
        raise CollectionError("expected a quoted value")

    index = start + 1
    while index < len(source):
        if source[index] == "\\":
            index += 2
            continue
        if source[index] == '"':
            return source[start : index + 1], index + 1
        index += 1
    raise CollectionError("unterminated quoted value")


def read_balanced(source: str, start: int) -> tuple[str, int]:
    opening = source[start]
    closing = {"[": "]", "{": "}"}.get(opening)
    if closing is None:
        raise CollectionError(f"expected an array or object at offset {start}")

    depth = 0
    index = start
    while index < len(source):
        char = source[index]
        if char == '"':
            _, index = read_quoted(source, index)
            continue
        if char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return source[start : index + 1], index + 1
        index += 1
    raise CollectionError(f"unterminated JavaScript {opening}...{closing} value")


def field_start(segment: str, field: str) -> int:
    match = re.search(rf"(?<![\w]){re.escape(field)}:", segment)
    if match is None:
        raise CollectionError(f"chart record is missing field {field!r}")
    return match.end()


def extract_scalar(segment: str, field: str) -> Any:
    index = field_start(segment, field)
    while index < len(segment) and segment[index].isspace():
        index += 1

    if index < len(segment) and segment[index] == '"':
        raw, _ = read_quoted(segment, index)
        return js_string(raw)

    for raw, value in (("!0", True), ("!1", False), ("void 0", None), ("null", None)):
        if segment.startswith(raw, index):
            return value

    match = re.match(r"-?\d+", segment[index:])
    if match is not None:
        return int(match.group(0))
    raise CollectionError(f"could not parse field {field!r} in chart record")


def extract_optional_scalar(segment: str, field: str) -> Any:
    """Extract a scalar field that older page records may omit."""

    if re.search(rf"(?<![\w]){re.escape(field)}:", segment) is None:
        return None
    return extract_scalar(segment, field)


def extract_assigned_array(segment: str, field: str) -> str:
    index = field_start(segment, field)
    while index < len(segment) and segment[index].isspace():
        index += 1
    reference = re.match(r"\$R\[\d+\]=", segment[index:])
    if reference is not None:
        index += reference.end()
    while index < len(segment) and segment[index].isspace():
        index += 1
    if index >= len(segment) or segment[index] != "[":
        raise CollectionError(f"field {field!r} is not an array")
    raw, _ = read_balanced(segment, index)
    return raw


def parse_string_array(raw: str) -> list[str]:
    values: list[str] = []
    index = 1
    while index < len(raw) - 1:
        if raw[index] == '"':
            value, index = read_quoted(raw, index)
            values.append(js_string(value))
        else:
            index += 1
    return values


def parse_title_translations(segment: str) -> list[dict[str, str]]:
    raw = extract_assigned_array(segment, "titleTranslations")
    translations: list[dict[str, str]] = []
    object_re = re.compile(
        r"\{title:(?P<title>\"(?:\\.|[^\"\\])*\"),"
        r"language:(?P<language>\"(?:\\.|[^\"\\])*\")\}"
    )
    for match in object_re.finditer(raw):
        translations.append(
            {
                "title": js_string(match.group("title")),
                "language": js_string(match.group("language")),
            }
        )
    return translations


def parse_chart_records(page_html: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for match in RECORD_RE.finditer(page_html):
        segment = match.group(0)
        record = {
            "track_id": int(match.group("track_id")),
            "difficulty": extract_scalar(segment, "difficulty"),
            "artist": extract_scalar(segment, "artist"),
            "jacket_url": extract_scalar(segment, "jacketUrl"),
            "genre": extract_scalar(segment, "genre"),
            "song_version": extract_scalar(segment, "songVersion"),
            "display_level": extract_scalar(segment, "displayLevel"),
            "internal_level_tenths": extract_scalar(segment, "internalLevel"),
            "internal_level_is_accurate": extract_scalar(segment, "internalLevelIsAccurate"),
            "internal_level_delta": extract_optional_scalar(segment, "internalLevelDelta"),
            "song_title": extract_scalar(segment, "title"),
            "title_ruby": parse_string_array(extract_assigned_array(segment, "titleRuby"))
            if "titleRuby:$R[" in segment
            else None,
            "title_translations": parse_title_translations(segment),
            "chart_type": extract_scalar(segment, "type"),
            "mp": extract_scalar(segment, "mp"),
            "version_folder_order": extract_scalar(segment, "versionFolderOrder"),
            "record": extract_scalar(segment, "record"),
        }
        records.append(record)

    if not records:
        raise CollectionError("no chart records found in page HTML")
    return records


def fetch_page(
    url: str,
    timeout: float,
    user_agent: str,
    extra_headers: dict[str, str] | None = None,
) -> str:
    headers = {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": user_agent,
    }
    headers.update(extra_headers or {})
    request = Request(
        url,
        headers=headers,
    )
    for attempt in range(3):
        try:
            with urlopen(request, timeout=timeout) as response:
                return response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError, UnicodeDecodeError) as exc:
            if attempt == 2:
                raise CollectionError(f"failed to fetch {url}: {exc}") from exc
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def page_url(level: str) -> str:
    query = urlencode({"lv": level})
    return f"{BASE_URL}?{query}"


def discover_distribution_server_function(page_html: str, timeout: float, user_agent: str) -> str:
    asset_match = re.search(r'(/assets/RecordDetailsContext-[^"\']+\.js)', page_html)
    if asset_match is None:
        raise CollectionError("could not discover maishift distribution asset")
    asset = fetch_page(f"https://maimai.shiftpsh.com{asset_match.group(1)}", timeout, user_agent)
    export_match = re.search(r"\b([A-Za-z_$][\w$]*) as g\b", asset)
    if export_match is None:
        raise CollectionError("could not find distribution server-function export")
    variable = re.escape(export_match.group(1))
    handler_match = re.search(
        rf"\b{variable}=.*?handler\(.*?[\"']([0-9a-f]{{64}})[\"']\)", asset
    )
    if handler_match is None:
        raise CollectionError("could not find distribution server-function id")
    return handler_match.group(1)


def seroval_request_payload(data: dict[str, Any]) -> str:
    values = []
    for value in data.values():
        if isinstance(value, str):
            values.append({"t": 1, "s": value})
        elif isinstance(value, int):
            values.append({"t": 0, "s": value})
        else:
            raise CollectionError(f"unsupported server-function input: {value!r}")
    node = {
        "t": 10,
        "i": 0,
        "p": {
            "k": ["data"],
            "v": [
                {
                    "t": 10,
                    "i": 1,
                    "p": {"k": list(data), "v": values},
                    "o": 0,
                }
            ],
        },
        "o": 0,
    }
    return json.dumps({"t": node, "f": 127, "m": []}, separators=(",", ":"))


def decode_seroval(node: Any) -> Any:
    if not isinstance(node, dict) or "t" not in node:
        raise CollectionError("unexpected maishift server-function response")
    node_type = node["t"]
    if node_type in (0, 1):
        return node["s"]
    if node_type == 2:
        return {0: None, 1: None, 2: True, 3: False}.get(node["s"])
    if node_type == 9:
        return [decode_seroval(value) for value in node["a"]]
    if node_type in (10, 11):
        return {
            key: decode_seroval(value)
            for key, value in zip(node["p"]["k"], node["p"]["v"], strict=True)
        }
    if node_type == 25:
        message = node.get("s", {}).get("message")
        detail = decode_seroval(message) if message else "unknown server error"
        raise CollectionError(f"maishift server function failed: {detail}")
    raise CollectionError(f"unsupported Seroval node type: {node_type}")


def fetch_distribution(
    server_function_id: str,
    level: str,
    rating_index: int,
    timeout: float,
    user_agent: str,
) -> list[dict[str, Any]]:
    payload = seroval_request_payload(
        {"region": "ASIA", "bucketIdx": rating_index, "displayLevel": level}
    )
    url = (
        f"https://maimai.shiftpsh.com/_serverFn/{server_function_id}?"
        + urlencode({"payload": payload})
    )
    try:
        response = json.loads(
            fetch_page(
                url,
                timeout,
                user_agent,
                {"Accept": "application/json", "x-tsr-serverFn": "true"},
            )
        )
    except json.JSONDecodeError as exc:
        raise CollectionError("maishift server function returned invalid JSON") from exc
    decoded = decode_seroval(response)
    if decoded.get("error") is not None:
        raise CollectionError(f"maishift server function failed: {decoded['error']}")
    result = decoded.get("result")
    if not isinstance(result, dict) or not isinstance(result.get("packed"), str):
        raise CollectionError("maishift distribution response has no packed data")
    if result.get("ratingMin") != RATING_RANGES[rating_index][0]:
        raise CollectionError("maishift distribution returned the wrong rating bucket")
    return parse_packed_distribution(result["packed"])


def parse_packed_distribution(packed: str) -> list[dict[str, Any]]:
    if not packed:
        return []
    rows = []
    for raw_row in packed.split(";"):
        values = [int(value) for value in raw_row.split(",")]
        expected = 2 + len(PACKED_COUNT_KEYS)
        if len(values) != expected:
            raise CollectionError(
                f"packed distribution row has {len(values)} values; expected {expected}"
            )
        counts = dict(zip(PACKED_COUNT_KEYS, values[2:], strict=True))
        achieved = {
            rank: sum(counts[key] for key in keys)
            for rank, keys in RANK_COUNT_KEYS.items()
        }
        rows.append({"track_id": values[0], "total": values[1], "achieved": achieved})
    return rows


def collect(delay: float, timeout: float, user_agent: str) -> dict[str, Any]:
    if delay < 0:
        raise CollectionError("--delay must not be negative")

    print("Fetching maishift chart metadata ...", file=sys.stderr)
    page_html = fetch_page(page_url(LEVELS[0]), timeout, user_agent)
    records = [record for record in parse_chart_records(page_html) if record["display_level"] in LEVELS]
    server_function_id = discover_distribution_server_function(page_html, timeout, user_agent)
    charts = {
        record["track_id"]: {
            "track_id": record["track_id"],
            "song_title": record["song_title"],
            "artist": record["artist"],
            "genre": record["genre"],
            "chart_type": record["chart_type"],
            "difficulty": record["difficulty"],
            "display_level": record["display_level"],
            "internal_level": record["internal_level_tenths"] / 10,
            "stats": {},
        }
        for record in records
    }

    request_index = 0
    for level in LEVELS:
        print(f"Fetching distributions for {level} ...", file=sys.stderr)
        for rating_index in range(len(RATING_RANGES)):
            if request_index:
                time.sleep(delay)
            request_index += 1
            for row in fetch_distribution(
                server_function_id, level, rating_index, timeout, user_agent
            ):
                chart = charts.get(row["track_id"])
                if chart is None:
                    # Distribution history can retain retired tracks that are
                    # no longer present in the current chart catalog.
                    continue
                chart["stats"][str(rating_index)] = {
                    "total": row["total"],
                    "achieved": row["achieved"],
                }
        print(
            f"  collected {sum(chart['display_level'] == level for chart in charts.values())} charts",
            file=sys.stderr,
        )

    return {
        "schema_version": 1,
        "source": BASE_URL,
        "levels": list(LEVELS),
        "rating_ranges": [
            {"index": index, "min": minimum, "max_exclusive": maximum}
            for index, (minimum, maximum) in enumerate(RATING_RANGES)
        ],
        "ranks": list(RANK_COUNT_KEYS),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(charts),
        "charts": list(charts.values()),
    }


def main() -> int:
    args = parse_args()
    try:
        data = collect(args.delay, args.timeout, args.user_agent)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    except (CollectionError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {data['count']} charts to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
