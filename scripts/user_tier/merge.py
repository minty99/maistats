from __future__ import annotations

from collections import defaultdict

from .models import OutputEntry, UserTier


def merge_sparse_user_tiers(
    entries: list[OutputEntry], min_charts: int
) -> list[OutputEntry]:
    counts: dict[UserTier, int] = defaultdict(int)
    for entry in entries:
        counts[int(entry["userTier"])] += 1

    groups: list[list[UserTier]] = []
    current_group: list[UserTier] = []
    current_count = 0
    for user_tier in sorted(counts):
        current_group.append(user_tier)
        current_count += counts[user_tier]
        if current_count >= min_charts:
            groups.append(current_group)
            current_group = []
            current_count = 0

    if current_group:
        if groups:
            groups[-1].extend(current_group)
        else:
            groups.append(current_group)

    tier_mapping = {
        original_tier: merged_tier
        for merged_tier, group in enumerate(groups)
        for original_tier in group
    }
    merged_entries = [
        {
            **entry,
            "userTier": tier_mapping[int(entry["userTier"])],
        }
        for entry in entries
    ]

    merged_counts: dict[UserTier, int] = defaultdict(int)
    for entry in merged_entries:
        merged_counts[int(entry["userTier"])] += 1
    too_small = {
        user_tier: count
        for user_tier, count in merged_counts.items()
        if count < min_charts
    }
    if too_small:
        raise ValueError(f"user tiers below {min_charts} charts after merge: {too_small}")

    merged_entries.sort(
        key=lambda item: (
            item["userTier"],
            item["title"],
            item["chartType"],
            item["difficulty"],
        )
    )
    return merged_entries
