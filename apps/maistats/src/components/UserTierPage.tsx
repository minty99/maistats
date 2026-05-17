import { type KeyboardEvent, type ReactNode, useMemo, useState } from 'react';

import { useI18n } from '../app/i18n';
import { formatPercent } from '../app/utils';
import type {
  RaveilleUserTierConversionEntry,
  RaveilleUserTierConversionMapping,
  ScoreRow,
} from '../types';
import { ChartTypeLabel } from './ChartTypeLabel';
import { getDifficultyToneClass } from './DifficultyLabel';
import { FilterFabButton } from './FilterFabButton';
import { Jacket } from './Jacket';

export interface UserTierSongRow {
  key: string;
  userTier: string;
  userTierStep: number;
  lomoSourceTier: number | null;
  raveilleInternalLevel: string | null;
  raveilleTier: string | null;
  score: ScoreRow;
}

export interface UserTierGroup {
  label: string;
  step: number;
  rows: UserTierSongRow[];
}

interface UserTierRowGroup {
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

interface UserTierConversionLine {
  key: number;
  label: string;
}

interface UserTierPageProps {
  sidebarTopContent?: ReactNode;
  songInfoUrl: string;
  groups: UserTierGroup[];
  conversions: RaveilleUserTierConversionEntry[];
  isLoading: boolean;
  onOpenHistory: (row: ScoreRow) => void;
}

type UserTierRangeKey = '13' | '13plus' | '14';
type UserTierDisplayMode = 'normalized' | 'raveille';

const USER_TIER_RANGES: {
  key: UserTierRangeKey;
  label: string;
  normalizedRangeLabel: string;
  raveilleRangeLabel: string;
  minStep: number;
  maxStep: number;
  minRaveilleLevel: number;
  maxRaveilleLevel: number;
}[] = [
  {
    key: '13',
    label: '13',
    normalizedRangeLabel: '13.00 - 13.50',
    raveilleRangeLabel: '13.0 - 13.5',
    minStep: 1300,
    maxStep: 1350,
    minRaveilleLevel: 13.0,
    maxRaveilleLevel: 13.5,
  },
  {
    key: '13plus',
    label: '13+',
    normalizedRangeLabel: '13.55 - 13.95',
    raveilleRangeLabel: '13.6 - 13.9',
    minStep: 1355,
    maxStep: 1395,
    minRaveilleLevel: 13.6,
    maxRaveilleLevel: 13.9,
  },
  {
    key: '14',
    label: '14',
    normalizedRangeLabel: '14.00 - 14.50',
    raveilleRangeLabel: '14.0 - 14.5',
    minStep: 1400,
    maxStep: 1450,
    minRaveilleLevel: 14.0,
    maxRaveilleLevel: 14.5,
  },
];

const USER_TIER_DISPLAY_MODES: UserTierDisplayMode[] = ['normalized', 'raveille'];
const RAVEILLE_TIER_SOURCE_URL =
  'https://docs.google.com/spreadsheets/d/19jn6ZFmg_aMRXKK90y58IUQE-4P32wUC7XkwwnEs7Oo/edit?gid=2097072641#gid=2097072641';
const RAVEILLE_TIER_ORDER = [
  'S',
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D+',
  'D',
  'D-',
  'E+',
  'E',
  'E-',
  'F',
];

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpenHistory: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onOpenHistory();
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

function formatRaveillePosition(row: UserTierSongRow): string | null {
  if (!row.raveilleInternalLevel || !row.raveilleTier) {
    return null;
  }
  return `${row.raveilleInternalLevel} ${row.raveilleTier}`;
}

function formatConversionMapping(mapping: RaveilleUserTierConversionMapping): string {
  return `${mapping.raveilleInternalLevel} ${mapping.raveilleTier}`;
}

function buildConversionLines(
  conversion: RaveilleUserTierConversionEntry,
): UserTierConversionLine[] {
  const mappingsBySourceTier = new Map<number, RaveilleUserTierConversionMapping[]>();

  for (const mapping of conversion.mappings) {
    const mappings = mappingsBySourceTier.get(mapping.lomoSourceTier) ?? [];
    mappings.push(mapping);
    mappingsBySourceTier.set(mapping.lomoSourceTier, mappings);
  }

  return conversion.lomoSourceTiers
    .map((sourceTier) => {
      const mappings = mappingsBySourceTier.get(sourceTier) ?? [];
      return {
        key: sourceTier,
        label: mappings.map(formatConversionMapping).join(', '),
      };
    })
    .filter((line) => line.label.length > 0);
}

function buildInternalLevelGroups(
  rows: UserTierSongRow[],
  formatUnknownLabel: () => string,
): UserTierRowGroup[] {
  const grouped = new Map<string, UserTierRowGroup>();

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

function parseRaveilleInternalLevelSortValue(value: string | null): number {
  if (value === null) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function raveilleTierSortValue(value: string | null): number {
  if (value === null) {
    return Number.POSITIVE_INFINITY;
  }

  const index = RAVEILLE_TIER_ORDER.indexOf(value);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function compareTierSongRows(left: UserTierSongRow, right: UserTierSongRow): number {
  const achievementDiff =
    (right.score.achievementPercent ?? -1) - (left.score.achievementPercent ?? -1);
  if (achievementDiff !== 0) {
    return achievementDiff;
  }

  const levelDiff = (right.score.internalLevel ?? -1) - (left.score.internalLevel ?? -1);
  if (levelDiff !== 0) {
    return levelDiff;
  }

  return left.score.title.localeCompare(right.score.title);
}

function buildRaveilleTierGroups(
  rows: UserTierSongRow[],
  formatUnknownLabel: () => string,
): UserTierRowGroup[] {
  const grouped = new Map<string, UserTierRowGroup>();

  for (const row of rows) {
    const key = row.raveilleTier ?? 'unknown';
    const group = grouped.get(key) ?? {
      key,
      label: row.raveilleTier ?? formatUnknownLabel(),
      sortValue: raveilleTierSortValue(row.raveilleTier),
      rows: [],
    };

    group.rows.push(row);
    grouped.set(key, group);
  }

  return Array.from(grouped.values()).sort((left, right) => left.sortValue - right.sortValue);
}

function buildRaveilleGroupedSections(
  rows: UserTierSongRow[],
  formatUnknownInternalLevelLabel: () => string,
  formatUnknownTierLabel: () => string,
) {
  const grouped = new Map<string, { label: string; sortValue: number; rows: UserTierSongRow[] }>();

  for (const row of rows) {
    const key = row.raveilleInternalLevel ?? 'unknown';
    const section = grouped.get(key) ?? {
      label: row.raveilleInternalLevel ?? formatUnknownInternalLevelLabel(),
      sortValue: parseRaveilleInternalLevelSortValue(row.raveilleInternalLevel),
      rows: [],
    };

    section.rows.push(row);
    grouped.set(key, section);
  }

  return Array.from(grouped.entries())
    .map(([key, section]) => {
      const rows = [...section.rows].sort(compareTierSongRows);
      return {
        key,
        label: section.label,
        summary: buildUserTierGroupSummary(rows),
        rowGroups: buildRaveilleTierGroups(rows, formatUnknownTierLabel),
        sortValue: section.sortValue,
      };
    })
    .sort((left, right) => right.sortValue - left.sortValue);
}

function isGroupInTierRange(group: UserTierGroup, range: (typeof USER_TIER_RANGES)[number]): boolean {
  return group.step >= range.minStep && group.step <= range.maxStep;
}

function isRowInRaveilleTierRange(
  row: UserTierSongRow,
  range: (typeof USER_TIER_RANGES)[number],
): boolean {
  const internalLevel = parseRaveilleInternalLevelSortValue(row.raveilleInternalLevel);
  return internalLevel >= range.minRaveilleLevel && internalLevel <= range.maxRaveilleLevel;
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
  item,
  songInfoUrl,
  displayMode,
  onOpenHistory,
}: {
  item: UserTierSongRow;
  songInfoUrl: string;
  displayMode: UserTierDisplayMode;
  onOpenHistory: (row: ScoreRow) => void;
}) {
  const { t } = useI18n();
  const row = item.score;
  const handleOpenHistory = () => onOpenHistory(row);
  const toneClass = getDifficultyToneClass(row.difficulty);
  const raveillePosition = formatRaveillePosition(item);
  const detailText = displayMode === 'raveille' ? item.userTier : raveillePosition;

  return (
    <article
      className={`user-tier-song-card ${toneClass}`}
      role="button"
      tabIndex={0}
      aria-label={t('history.openChartHistory', { title: row.title })}
      onClick={handleOpenHistory}
      onKeyDown={(event) => handleCardKeyDown(event, handleOpenHistory)}
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
        <div className="user-tier-stage-badges">
          <ChartTypeLabel chartType={row.chartType} className="user-tier-chart-chip" />
          <div className="user-tier-internal-chip">{formatInternalLevel(row)}</div>
        </div>
      </div>
      <div className="user-tier-song-info">
        <strong>{formatAchievementValue(row)}</strong>
        {detailText ? <span>{detailText}</span> : null}
      </div>
    </article>
  );
}

export function UserTierPage({
  sidebarTopContent,
  songInfoUrl,
  groups,
  conversions,
  isLoading,
  onOpenHistory,
}: UserTierPageProps) {
  const { t } = useI18n();
  const [hideNoData, setHideNoData] = useState(false);
  const [hideBelow90, setHideBelow90] = useState(false);
  const [activeRangeKey, setActiveRangeKey] = useState<UserTierRangeKey>('13');
  const [displayMode, setDisplayMode] = useState<UserTierDisplayMode>('normalized');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const tierSummaries = useMemo(
    () => new Map(groups.map((group) => [group.label, buildUserTierGroupSummary(group.rows)])),
    [groups],
  );
  const conversionsByTier = useMemo(
    () => new Map(conversions.map((conversion) => [conversion.userTier, conversion])),
    [conversions],
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
    () => {
      const rows = filteredGroups.flatMap((group) => group.rows);
      return Object.fromEntries(
        USER_TIER_RANGES.map((range) => {
          const count =
            displayMode === 'normalized'
              ? filteredGroups
                .filter((group) => isGroupInTierRange(group, range))
                .reduce((sum, group) => sum + group.rows.length, 0)
              : rows.filter((row) => isRowInRaveilleTierRange(row, range)).length;
          return [range.key, count];
        }),
      ) as Record<UserTierRangeKey, number>;
    },
    [displayMode, filteredGroups],
  );
  const activeRange = USER_TIER_RANGES.find((range) => range.key === activeRangeKey) ?? USER_TIER_RANGES[0];
  const visibleGroups = useMemo(
    () => filteredGroups.filter((group) => isGroupInTierRange(group, activeRange)),
    [activeRange, filteredGroups],
  );
  const visibleRaveilleRows = useMemo(
    () => filteredGroups.flatMap((group) => group.rows).filter((row) => isRowInRaveilleTierRange(row, activeRange)),
    [activeRange, filteredGroups],
  );
  const visibleGroupedSections = useMemo(
    () =>
      visibleGroups.map((group) => ({
        key: group.label,
        ...group,
        conversion: conversionsByTier.get(group.label) ?? null,
        summary: tierSummaries.get(group.label) ?? buildUserTierGroupSummary(group.rows),
        rowGroups: buildInternalLevelGroups(group.rows, () => t('tiers.unknownInternalLevel')),
      })),
    [conversionsByTier, t, tierSummaries, visibleGroups],
  );
  const raveilleGroupedSections = useMemo(
    () =>
      buildRaveilleGroupedSections(
        visibleRaveilleRows,
        () => t('tiers.unknownRaveilleInternalLevel'),
        () => t('tiers.unknownRaveilleTier'),
      ),
    [t, visibleRaveilleRows],
  );
  const groupedSections = displayMode === 'normalized' ? visibleGroupedSections : raveilleGroupedSections;
  const filterPanel = (
    <section className="panel filter-panel">
      <div className="panel-heading compact">
        <div>
          <h2>{t('tiers.filters')}</h2>
        </div>
      </div>
      <div className="user-tier-filter-actions">
        <div className="user-tier-control-group">
          <span className="user-tier-control-title">{t('tiers.displayMode')}</span>
          <div className="user-tier-display-options" role="group" aria-label={t('tiers.displayMode')}>
            {USER_TIER_DISPLAY_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={displayMode === mode}
                onClick={() => setDisplayMode(mode)}
              >
                {t(`tiers.displayMode.${mode}`)}
              </button>
            ))}
          </div>
        </div>
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
                <span className="user-tier-range-meta">
                  {displayMode === 'normalized' ? range.normalizedRangeLabel : range.raveilleRangeLabel}
                </span>
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
          <section className="panel user-tier-info-panel">
            <div className="user-tier-info-marker">i</div>
            <p>
              {t('tiers.info.beforeLink')}
              <a href={RAVEILLE_TIER_SOURCE_URL} target="_blank" rel="noreferrer">
                {t('tiers.info.linkLabel')}
              </a>
              {t('tiers.info.afterLink')}
            </p>
          </section>

          {groupedSections.length === 0 ? (
            <section className="panel empty-state-panel">
              <p>
                {isLoading
                  ? t('common.loadingCharts')
                  : groups.length > 0
                    ? t('tiers.emptyAfterFilter')
                    : t('tiers.empty')}
              </p>
            </section>
          ) : (
            <div className="user-tier-stack">
              {groupedSections.map((group) => (
                <section key={group.key} className="panel user-tier-section-panel">
                  <div className="panel-heading">
                    {'conversion' in group && group.conversion ? (
                      <details className="user-tier-conversion-details">
                        <summary>
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
                        </summary>
                        <div className="user-tier-conversion-lines">
                          {buildConversionLines(group.conversion).map((line) => (
                            <div key={line.key}>{line.label}</div>
                          ))}
                        </div>
                      </details>
                    ) : (
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
                    )}
                  </div>
                  <div className="user-tier-internal-stack">
                    {group.rowGroups.map((internalGroup) => (
                      <section key={internalGroup.key} className="user-tier-internal-group">
                        <div className="user-tier-internal-heading">
                          <h3>{internalGroup.label}</h3>
                        </div>
                        <div className="user-tier-card-grid">
                          {internalGroup.rows.map((item) => (
                            <UserTierSongCard
                              key={item.key}
                              item={item}
                              songInfoUrl={songInfoUrl}
                              displayMode={displayMode}
                              onOpenHistory={onOpenHistory}
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
