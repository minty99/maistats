from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict


type InternalLevel = str
type RaveilleGrade = str
type SourceTier = int
type UserTier = str
type ChartCategory = str
type ImageFileName = str
type SongSlug = str

type LevelGrade = tuple[InternalLevel, RaveilleGrade]
type TierRules = dict[LevelGrade, SourceTier]
type CellAddress = tuple[int, int]
type WorkbookSheet = tuple[str, str]
type InternalLevelValue = str | int | float | None

type CandidateKey = tuple[str, str, str, str, str]
type ManualMatchIdentity = CandidateKey


class SongRegion(TypedDict, total=False):
    intl: bool


class SongAliases(TypedDict, total=False):
    en: list[str]
    ko: list[str]


class SongChart(TypedDict, total=False):
    type: str
    difficulty: str
    internalLevel: InternalLevelValue
    region: SongRegion


class SongRecord(TypedDict, total=False):
    title: str
    genre: str
    artist: str
    aliases: SongAliases
    sheets: list[SongChart]


type ChartCandidate = tuple[SongRecord, SongChart]
type SheetCandidateSet = tuple[SheetEntry, list[ChartCandidate]]


class CandidateIssue(TypedDict, total=False):
    title: str
    genre: str
    artist: str
    chartType: str
    difficulty: str
    internalLevel: InternalLevelValue


class OutputEntry(TypedDict):
    title: str
    genre: str
    artist: str
    chartType: str
    difficulty: str
    internalLevel: InternalLevelValue
    userTier: SourceTier | UserTier


class IssueEntry(TypedDict, total=False):
    row: int
    col: int
    category: ChartCategory
    fileName: ImageFileName
    slug: SongSlug
    lookupSlug: SongSlug
    genreHint: str | None
    raveilleInternalLevel: str
    raveilleGrade: RaveilleGrade
    userTier: SourceTier
    raveilleUrl: str
    candidates: list[CandidateIssue]


class UserLevelsSource(TypedDict):
    raveilleSpreadsheetId: str
    raveilleUrl: str
    songDatabaseUrl: str
    targetUserTierCount: int


class UserLevelsOutput(TypedDict):
    source: UserLevelsSource
    generatedAt: str
    entries: list[OutputEntry]


@dataclass(frozen=True)
class SheetEntry:
    row: int
    col: int
    category: ChartCategory
    file_name: ImageFileName
    slug: SongSlug
    lookup_slug: SongSlug
    genre_hint: str | None
    source_internal_level_tenths: int
    source_grade: RaveilleGrade
    source_tier: SourceTier
    source_url: str
