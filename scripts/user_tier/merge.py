from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import TypedDict

from .models import OutputEntry, SourceTier, UserTier


USER_TIER_LABEL_START = 13.00
USER_TIER_LABEL_STEP = 0.05


@dataclass
class TierGroup:
    source_tiers: list[SourceTier]
    chart_count: int


class UserTierSourceTierGroup(TypedDict):
    userTier: UserTier
    lomoSourceTiers: list[SourceTier]


def merge_to_target_user_tiers(
    entries: list[OutputEntry], target_tier_count: int
) -> tuple[list[OutputEntry], list[UserTierSourceTierGroup]]:
    groups = initial_tier_groups(entries)
    if len(groups) < target_tier_count:
        raise ValueError(
            f"cannot split {len(groups)} source tiers into {target_tier_count} user tiers"
        )

    while len(groups) > target_tier_count:
        merge_index = sparsest_adjacent_pair_index(groups)
        groups[merge_index] = TierGroup(
            source_tiers=groups[merge_index].source_tiers
            + groups[merge_index + 1].source_tiers,
            chart_count=groups[merge_index].chart_count
            + groups[merge_index + 1].chart_count,
        )
        del groups[merge_index + 1]

    tier_mapping = {
        source_tier: user_tier_label(group_index)
        for group_index, group in enumerate(groups)
        for source_tier in group.source_tiers
    }
    source_tier_groups: list[UserTierSourceTierGroup] = [
        {
            "userTier": user_tier_label(group_index),
            "lomoSourceTiers": sorted(group.source_tiers),
        }
        for group_index, group in enumerate(groups)
    ]
    merged_entries: list[OutputEntry] = [
        {
            **entry,
            "userTier": tier_mapping[int(entry["userTier"])],
        }
        for entry in entries
    ]

    merged_entries.sort(
        key=lambda item: (
            item["userTier"],
            item["title"],
            item["chartType"],
            item["difficulty"],
        )
    )
    return merged_entries, source_tier_groups


def initial_tier_groups(entries: list[OutputEntry]) -> list[TierGroup]:
    counts: dict[SourceTier, int] = defaultdict(int)
    for entry in entries:
        counts[int(entry["userTier"])] += 1

    return [
        TierGroup(source_tiers=[source_tier], chart_count=counts[source_tier])
        for source_tier in sorted(counts)
    ]


def sparsest_adjacent_pair_index(groups: list[TierGroup]) -> int:
    pair_counts = [
        (groups[index].chart_count + groups[index + 1].chart_count, index)
        for index in range(len(groups) - 1)
    ]
    smallest_pair_count = min(count for count, _index in pair_counts)
    return max(index for count, index in pair_counts if count == smallest_pair_count)


def user_tier_label(index: int) -> UserTier:
    return f"{USER_TIER_LABEL_START + index * USER_TIER_LABEL_STEP:.2f}"
