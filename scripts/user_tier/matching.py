from __future__ import annotations

import re
import unicodedata
from collections import defaultdict

from .models import (
    CandidateIssue,
    CandidateKey,
    ChartCandidate,
    ChartCategory,
    IssueEntry,
    ManualMatchIdentity,
    OutputEntry,
    SheetCandidateSet,
    SheetEntry,
    SongChart,
    SongRecord,
    SongSlug,
)


EXCEPTIONS = {
    "1e44516a8a3b5a51.png": "link-maimai",
    "a565687e7a656aab.png": "plus-danshi",
    "5bb69b619f266d0a.png": "kisaragi-station",
    "e01e7560acc1348d.png": "a",
    "dadc9d2b98ecf1c8.png": "trust-gv",
}

MANUAL_MATCH_OVERRIDES: dict[tuple[SongSlug, ChartCategory], ManualMatchIdentity] = {
    # (slug, source category): (title, genre, artist, chart type, difficulty)
}

SLUG_GENRE_HINTS = {
    "gv": "GAME＆VARIETY",
    "maimai": "maimai",
}


def slugify(value: str, allow_unicode: bool = False) -> str:
    value = str(value)
    if allow_unicode:
        value = unicodedata.normalize("NFKC", value)
    else:
        value = (
            unicodedata.normalize("NFKD", value)
            .encode("ascii", "ignore")
            .decode("ascii")
        )
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[-\s]+", "-", value).strip("-_")


def match_entries(
    sheet_entries: list[SheetEntry], songs: list[SongRecord]
) -> tuple[list[OutputEntry], list[IssueEntry], list[IssueEntry]]:
    index: dict[SongSlug, list[ChartCandidate]] = defaultdict(list)
    for song in songs:
        slugs = song_slugs(song)
        for sheet in song["sheets"]:
            if not sheet.get("region", {}).get("intl"):
                continue
            for slug in slugs:
                if slug:
                    index[slug].append((song, sheet))

    candidate_sets: list[SheetCandidateSet] = []
    for entry in sheet_entries:
        candidates = [
            (song, sheet)
            for song, sheet in index.get(entry.lookup_slug, [])
            if category_matches(entry.category, sheet)
            and genre_hint_matches(entry.genre_hint, song)
        ]
        candidates = apply_manual_override(entry, candidates)
        candidate_sets.append((entry, candidates))

    candidate_sets = resolve_by_fixedpoint(candidate_sets)
    candidate_sets = apply_internal_level_fallback(candidate_sets)
    candidate_sets = resolve_by_fixedpoint(candidate_sets)

    matched: list[OutputEntry] = []
    unresolved: list[IssueEntry] = []
    ambiguous: list[IssueEntry] = []
    for entry, candidates in candidate_sets:
        if len(candidates) == 1:
            song, sheet = candidates[0]
            matched.append(build_output_entry(entry, song, sheet))
        elif len(candidates) == 0:
            unresolved.append(build_issue_entry(entry))
        else:
            ambiguous.append(
                build_issue_entry(
                    entry,
                    candidates=[
                        candidate_issue(song, sheet) for song, sheet in candidates
                    ],
                )
            )

    matched.sort(
        key=lambda item: (
            int(item["userTier"]),
            item["title"],
            item["chartType"],
            item["difficulty"],
        )
    )
    return matched, unresolved, ambiguous


def resolve_by_fixedpoint(
    candidate_sets: list[SheetCandidateSet],
) -> list[SheetCandidateSet]:
    resolved_keys: set[CandidateKey] = set()

    while True:
        singleton_keys = [
            candidate_key(*candidates[0])
            for _entry, candidates in candidate_sets
            if len(candidates) == 1
        ]
        unique_singleton_keys = {
            key for key in singleton_keys if singleton_keys.count(key) == 1
        }
        new_keys = unique_singleton_keys - resolved_keys
        if not new_keys:
            return candidate_sets

        resolved_keys |= new_keys
        next_candidate_sets: list[SheetCandidateSet] = []
        for entry, candidates in candidate_sets:
            if len(candidates) <= 1:
                next_candidate_sets.append((entry, candidates))
                continue

            narrowed = [
                (song, sheet)
                for song, sheet in candidates
                if candidate_key(song, sheet) not in resolved_keys
            ]
            next_candidate_sets.append((entry, narrowed))
        candidate_sets = next_candidate_sets


def apply_internal_level_fallback(
    candidate_sets: list[SheetCandidateSet],
) -> list[SheetCandidateSet]:
    next_candidate_sets: list[SheetCandidateSet] = []
    for entry, candidates in candidate_sets:
        if len(candidates) <= 1:
            next_candidate_sets.append((entry, candidates))
            continue

        narrowed = [
            (song, sheet)
            for song, sheet in candidates
            if sheet_internal_level_tenths(sheet) == entry.source_internal_level_tenths
        ]
        next_candidate_sets.append((entry, narrowed if narrowed else candidates))
    return next_candidate_sets


def sheet_internal_level_tenths(sheet: SongChart) -> int | None:
    internal_level = sheet.get("internalLevel")
    if internal_level is None:
        return None
    return round(float(internal_level) * 10)


def candidate_key(song: SongRecord, sheet: SongChart) -> CandidateKey:
    return (
        song["title"],
        song["genre"],
        song["artist"],
        sheet["type"],
        sheet["difficulty"],
    )


def candidate_issue(song: SongRecord, sheet: SongChart) -> CandidateIssue:
    return {
        "title": song["title"],
        "genre": song["genre"],
        "artist": song["artist"],
        "chartType": sheet["type"],
        "difficulty": sheet["difficulty"],
        "internalLevel": sheet.get("internalLevel"),
    }


def apply_manual_override(
    entry: SheetEntry, candidates: list[ChartCandidate]
) -> list[ChartCandidate]:
    identity = MANUAL_MATCH_OVERRIDES.get((entry.slug, entry.category))
    if identity is None:
        return candidates

    title, genre, artist, chart_type, difficulty = identity
    return [
        (song, sheet)
        for song, sheet in candidates
        if song["title"] == title
        and song["genre"] == genre
        and song["artist"] == artist
        and sheet["type"] == chart_type
        and sheet["difficulty"] == difficulty
    ]


def split_slug_genre_hint(slug: SongSlug) -> tuple[SongSlug, str | None]:
    base_slug, separator, suffix = slug.rpartition("-")
    if separator and suffix in SLUG_GENRE_HINTS:
        return base_slug, SLUG_GENRE_HINTS[suffix]
    return slug, None


def genre_hint_matches(genre_hint: str | None, song: SongRecord) -> bool:
    return genre_hint is None or song["genre"] == genre_hint


def song_slugs(song: SongRecord) -> set[SongSlug]:
    values = [song["title"]]
    aliases = song.get("aliases", {})
    values.extend(aliases.get("en", []))
    values.extend(aliases.get("ko", []))
    slugs = set()
    for value in values:
        slugs.add(slugify(value, allow_unicode=True))
        slugs.add(slugify(value, allow_unicode=False))
    return slugs


def category_matches(category: ChartCategory, sheet: SongChart) -> bool:
    chart_type = sheet["type"].lower()
    difficulty = sheet["difficulty"].lower()
    if category == "exp":
        return difficulty == "expert"
    if category == "rem":
        return difficulty == "remaster"
    if category == "st":
        return chart_type == "std" and difficulty == "master"
    if category == "dx":
        return chart_type == "dx" and difficulty == "master"
    return difficulty == "master"


def build_output_entry(
    entry: SheetEntry, song: SongRecord, sheet: SongChart
) -> OutputEntry:
    return {
        "title": song["title"],
        "genre": song["genre"],
        "artist": song["artist"],
        "chartType": sheet["type"],
        "difficulty": sheet["difficulty"],
        "internalLevel": sheet.get("internalLevel"),
        "userTier": entry.source_tier,
        "lomoSourceTier": entry.source_tier,
        "raveilleInternalLevel": f"{entry.source_internal_level_tenths / 10:.1f}",
        "raveilleTier": entry.source_grade,
    }


def build_issue_entry(
    entry: SheetEntry, candidates: list[CandidateIssue] | None = None
) -> IssueEntry:
    issue: IssueEntry = {
        "row": entry.row,
        "col": entry.col,
        "category": entry.category,
        "fileName": entry.file_name,
        "slug": entry.slug,
        "lookupSlug": entry.lookup_slug,
        "genreHint": entry.genre_hint,
        "raveilleInternalLevel": f"{entry.source_internal_level_tenths / 10:.1f}",
        "raveilleGrade": entry.source_grade,
        "userTier": entry.source_tier,
        "raveilleUrl": entry.source_url,
    }
    if candidates is not None:
        issue["candidates"] = candidates
    return issue
