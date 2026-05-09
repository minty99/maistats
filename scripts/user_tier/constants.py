from __future__ import annotations

from .models import TierRules


RAVEILLE_TIER_SPREADSHEET_ID = "19jn6ZFmg_aMRXKK90y58IUQE-4P32wUC7XkwwnEs7Oo"
RAVEILLE_TIER_SPREADSHEET_XLSX_URL = (
    f"https://docs.google.com/spreadsheets/d/{RAVEILLE_TIER_SPREADSHEET_ID}/export?format=xlsx"
)
DEFAULT_SONG_DATABASE_URL = "https://maimai-charts.muhwan.dev"

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
TARGET_USER_TIER_COUNT = 31


def source_levels() -> list[str]:
    return [f"{13 + index // 10}.{index % 10}" for index in range(16)]


def load_tier_rules(lomo_xlsx_path: str | None = None) -> TierRules:
    from .build_lomo_tier_rules import load_lomo_tier_rules

    tier_rules: TierRules = {}
    for user_tier, entries in load_lomo_tier_rules(lomo_xlsx_path):
        for level, grade in entries:
            key = (level, grade)
            if key in tier_rules:
                raise ValueError(f"duplicate Lomo mapping rule for {key}")
            tier_rules[key] = user_tier

    expected_entries = {
        (level, grade) for level in source_levels() for grade in LABEL_SET
    }
    missing_entries = sorted(expected_entries - set(tier_rules))
    if missing_entries:
        formatted = ", ".join(f"{level} {grade}" for level, grade in missing_entries)
        raise ValueError(f"tier rules are missing Raveille grade mappings: {formatted}")
    return tier_rules
