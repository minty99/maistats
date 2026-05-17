import { type KeyboardEvent, type ReactNode, useMemo, useState } from 'react';

import { useI18n } from '../app/i18n';
import { formatPercent } from '../app/utils';
import type { ScoreRow } from '../types';
import { getDifficultyToneClass } from './DifficultyLabel';
import { FilterFabButton } from './FilterFabButton';
import { Jacket } from './Jacket';
import type { SongDetailTarget } from './TableActionCells';

export interface UserTierSongRow {
  key: string;
  userTier: string;
  userTierStep: number;
  score: ScoreRow;
}

export interface UserTierGroup {
  label: string;
  step: number;
  rows: UserTierSongRow[];
}

interface UserTierInternalLevelGroup {
  key: string;
  label: string;
  sortValue: number;
  rows: UserTierSongRow[];
}

interface UserTierGroupSummary {
  averageAchievement: number | null;
  playedCount: number;
  totalCount: number;
}

interface UserTierPageProps {
  sidebarTopContent?: ReactNode;
  songInfoUrl: string;
  groups: UserTierGroup[];
  onOpenSongDetail: (target: SongDetailTarget) => void;
}

type UserTierRangeKey = '13' | '13plus' | '14';

const USER_TIER_RANGES: {
  key: UserTierRangeKey;
  label: string;
  rangeLabel: string;
  minStep: number;
  maxStep: number;
}[] = [
  { key: '13', label: '13', rangeLabel: '13.00 - 13.50', minStep: 1300, maxStep: 1350 },
  { key: '13plus', label: '13+', rangeLabel: '13.55 - 13.95', minStep: 1355, maxStep: 1395 },
  { key: '14', label: '14', rangeLabel: '14.00 - 14.50', minStep: 1400, maxStep: 1450 },
];

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpenSongDetail: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onOpenSongDetail();
}

function formatInternalLevel(row: ScoreRow): string {
  if (row.internalLevel === null) {
    return '-';
  }

  return `${row.isInternalLevelEstimated ? '~' : ''}${row.internalLevel.toFixed(1)}`;
}

function formatAchievementValue(row: ScoreRow): string {
  return formatPercent(row.achievementPercent).replace(/%$/, '');
}

function buildInternalLevelGroups(
  rows: UserTierSongRow[],
  formatUnknownLabel: () => string,
): UserTierInternalLevelGroup[] {
  const grouped = new Map<string, UserTierInternalLevelGroup>();

  for (const row of rows) {
    const internalLevel = row.score.internalLevel;
    const key = internalLevel === null ? 'unknown' : internalLevel.toFixed(1);
    const label = internalLevel === null ? formatUnknownLabel() : internalLevel.toFixed(1);
    const group = grouped.get(key) ?? {
      key,
      label,
      sortValue: internalLevel ?? Number.NEGATIVE_INFINITY,
      rows: [],
    };

    group.rows.push(row);
    grouped.set(key, group);
  }

  return Array.from(grouped.values()).sort((left, right) => right.sortValue - left.sortValue);
}

function isGroupInTierRange(group: UserTierGroup, range: (typeof USER_TIER_RANGES)[number]): boolean {
  return group.step >= range.minStep && group.step <= range.maxStep;
}

function buildUserTierGroupSummary(rows: UserTierSongRow[]): UserTierGroupSummary {
  const playedAchievements = rows
    .map((row) => row.score.achievementPercent)
    .filter((value): value is number => value !== null);

  return {
    averageAchievement: playedAchievements.length > 0
      ? playedAchievements.reduce((sum, value) => sum + value, 0) / playedAchievements.length
      : null,
    playedCount: playedAchievements.length,
    totalCount: rows.length,
  };
}

function UserTierSongCard({
  row,
  songInfoUrl,
  onOpenSongDetail,
}: {
  row: ScoreRow;
  songInfoUrl: string;
  onOpenSongDetail: (target: SongDetailTarget) => void;
}) {
  const { t } = useI18n();
  const handleOpenDetail = () => onOpenSongDetail(row);
  const toneClass = getDifficultyToneClass(row.difficulty);

  return (
    <article
      className={`user-tier-song-card ${toneClass}`}
      role="button"
      tabIndex={0}
      aria-label={t('rating.openSongDetail', { title: row.title })}
      onClick={handleOpenDetail}
      onKeyDown={(event) => handleCardKeyDown(event, handleOpenDetail)}
    >
      <div className={`user-tier-song-stage ${toneClass}`}>
        <div className="user-tier-song-jacket-wrap">
          <Jacket
            songInfoUrl={songInfoUrl}
            imageName={row.imageName}
            title={row.title}
            className="user-tier-song-jacket"
          />
        </div>
        <div className="user-tier-song-stage-gradient" />
        <div className="user-tier-internal-chip">{formatInternalLevel(row)}</div>
      </div>
      <div className="user-tier-song-info">
        <strong>{formatAchievementValue(row)}</strong>
      </div>
    </article>
  );
}

export function UserTierPage({
  sidebarTopContent,
  songInfoUrl,
  groups,
  onOpenSongDetail,
}: UserTierPageProps) {
  const { t } = useI18n();
  const [hideNoData, setHideNoData] = useState(false);
  const [hideBelow90, setHideBelow90] = useState(false);
  const [activeRangeKey, setActiveRangeKey] = useState<UserTierRangeKey>('13');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const tierSummaries = useMemo(
    () => new Map(groups.map((group) => [group.label, buildUserTierGroupSummary(group.rows)])),
    [groups],
  );
  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter((item) => {
            if (hideNoData && item.score.rank === null) {
              return false;
            }
            if (hideBelow90 && (item.score.achievementPercent === null || item.score.achievementPercent < 90)) {
              return false;
            }
            return true;
          }),
        }))
        .filter((group) => group.rows.length > 0),
    [groups, hideBelow90, hideNoData],
  );
  const rangeSummaries = useMemo(
    () =>
      Object.fromEntries(
        USER_TIER_RANGES.map((range) => [
          range.key,
          filteredGroups
            .filter((group) => isGroupInTierRange(group, range))
            .reduce((sum, group) => sum + group.rows.length, 0),
        ]),
      ) as Record<UserTierRangeKey, number>,
    [filteredGroups],
  );
  const activeRange = USER_TIER_RANGES.find((range) => range.key === activeRangeKey) ?? USER_TIER_RANGES[0];
  const visibleGroups = useMemo(
    () => filteredGroups.filter((group) => isGroupInTierRange(group, activeRange)),
    [activeRange, filteredGroups],
  );
  const visibleGroupedSections = useMemo(
    () =>
      visibleGroups.map((group) => ({
        ...group,
        summary: tierSummaries.get(group.label) ?? buildUserTierGroupSummary(group.rows),
        internalLevelGroups: buildInternalLevelGroups(group.rows, () => t('tiers.unknownInternalLevel')),
      })),
    [t, tierSummaries, visibleGroups],
  );
  const filterPanel = (
    <section className="panel filter-panel">
      <div className="panel-heading compact">
        <div>
          <h2>{t('tiers.filters')}</h2>
        </div>
      </div>
      <div className="user-tier-filter-actions">
        <div className="user-tier-range-tabs" role="group" aria-label="User tier range">
          {USER_TIER_RANGES.map((range) => {
            const isActive = range.key === activeRangeKey;
            return (
              <button
                key={range.key}
                type="button"
                className={isActive ? 'active' : ''}
                aria-pressed={isActive}
                onClick={() => setActiveRangeKey(range.key)}
              >
                <span className="user-tier-range-label">{range.label}</span>
                <span className="user-tier-range-meta">{range.rangeLabel}</span>
                <span className="user-tier-range-count">{rangeSummaries[range.key]}</span>
              </button>
            );
          })}
        </div>
        <label className="user-tier-filter-toggle">
          <input
            type="checkbox"
            checked={hideNoData}
            onChange={(event) => setHideNoData(event.target.checked)}
          />
          <span>{t('tiers.hideNoData')}</span>
        </label>
        <label className="user-tier-filter-toggle">
          <input
            type="checkbox"
            checked={hideBelow90}
            onChange={(event) => setHideBelow90(event.target.checked)}
          />
          <span>{t('tiers.hideBelow90')}</span>
        </label>
      </div>
    </section>
  );

  return (
    <>
      <div className="explorer-layout user-tier-layout">
        <aside className="sidebar-column">
          {sidebarTopContent}
          {filterPanel}
        </aside>

        <div className="table-column user-tier-table-column">
          {visibleGroupedSections.length === 0 ? (
            <section className="panel empty-state-panel">
              <p>{groups.length > 0 ? t('tiers.emptyAfterFilter') : t('tiers.empty')}</p>
            </section>
          ) : (
            <div className="user-tier-stack">
              {visibleGroupedSections.map((group) => (
                <section key={group.label} className="panel user-tier-section-panel">
                  <div className="panel-heading">
                    <div className="user-tier-title-row">
                      <h2>{group.label}</h2>
                      <div className="user-tier-summary">
                        <span className="user-tier-summary-item">
                          <span>{t('tiers.averageScore')}</span>
                          <strong>{formatPercent(group.summary.averageAchievement)}</strong>
                        </span>
                        <span className="user-tier-summary-item">
                          <span>{t('tiers.playedCountLabel')}</span>
                          <strong>
                            {t('tiers.playedCountValue', {
                              played: group.summary.playedCount,
                              total: group.summary.totalCount,
                            })}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="user-tier-internal-stack">
                    {group.internalLevelGroups.map((internalGroup) => (
                      <section key={internalGroup.key} className="user-tier-internal-group">
                        <div className="user-tier-internal-heading">
                          <h3>{internalGroup.label}</h3>
                        </div>
                        <div className="user-tier-card-grid">
                          {internalGroup.rows.map((item) => (
                            <UserTierSongCard
                              key={item.key}
                              row={item.score}
                              songInfoUrl={songInfoUrl}
                              onOpenSongDetail={onOpenSongDetail}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <FilterFabButton label={t('common.filters')} onClick={() => setIsFilterModalOpen(true)} />

      {isFilterModalOpen ? (
        <div className="modal-backdrop mobile-filter-backdrop" onClick={() => setIsFilterModalOpen(false)}>
          <section
            className="modal-card panel mobile-filter-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="detail-header">
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setIsFilterModalOpen(false)}
              >
                {t('common.close')}
              </button>
            </div>
            {sidebarTopContent}
            {filterPanel}
          </section>
        </div>
      ) : null}
    </>
  );
}
