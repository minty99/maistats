import { useMemo, useState, type ReactNode } from 'react';

import { useI18n } from '../app/i18n';
import { formatNumber, formatVersionLabel } from '../app/utils';
import type { ScoreRow } from '../types';
import { SongRecordCard } from './SongRecordCard';
import type { SongDetailTarget } from './TableActionCells';

export interface UserTierSongRow {
  key: string;
  userTier: string;
  userTierStep: number;
  score: ScoreRow;
}

interface UserTierGroup {
  label: string;
  step: number;
  rows: UserTierSongRow[];
}

interface UserTierPageProps {
  sidebarTopContent?: ReactNode;
  songInfoUrl: string;
  groups: UserTierGroup[];
  totalCount: number;
  playedCount: number;
  onOpenSongDetail: (target: SongDetailTarget) => void;
}

export function UserTierPage({
  sidebarTopContent,
  songInfoUrl,
  groups,
  totalCount,
  playedCount,
  onOpenSongDetail,
}: UserTierPageProps) {
  const { locale, t } = useI18n();
  const [hideNoData, setHideNoData] = useState(false);
  const visibleGroups = useMemo(
    () =>
      hideNoData
        ? groups
            .map((group) => ({
              ...group,
              rows: group.rows.filter((item) => item.score.rank !== null),
            }))
            .filter((group) => group.rows.length > 0)
        : groups,
    [groups, hideNoData],
  );
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.rows.length, 0);
  const topGroup = visibleGroups[0] ?? null;
  const bottomGroup = visibleGroups[visibleGroups.length - 1] ?? null;

  return (
    <div className="explorer-layout user-tier-layout">
      <aside className="sidebar-column">
        {sidebarTopContent}
        <section className="panel filter-panel">
          <div className="panel-heading compact">
            <div>
              <h2>{t('tiers.title')}</h2>
            </div>
          </div>
          <div className="rating-stat-grid">
            <div className="rating-stat-card">
              <span>{t('tiers.coverage')}</span>
              <strong>{formatNumber(playedCount, locale)}/{formatNumber(totalCount, locale)}</strong>
              <small className="rating-stat-sub">{t('tiers.coverageHelp')}</small>
            </div>
            <div className="rating-stat-card">
              <span>{t('tiers.range')}</span>
              <strong>{bottomGroup && topGroup ? `${bottomGroup.label} - ${topGroup.label}` : '-'}</strong>
              <small className="rating-stat-sub">{t('tiers.rangeHelp')}</small>
            </div>
          </div>
        </section>
      </aside>

      <div className="table-column user-tier-table-column">
        <section className="panel user-tier-intro-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('tiers.heading')}</h2>
              <p>{t('tiers.description')}</p>
            </div>
            <div className="user-tier-top-actions">
              <label className="score-special-toggle user-tier-no-data-toggle">
                <input
                  type="checkbox"
                  checked={hideNoData}
                  onChange={(event) => setHideNoData(event.target.checked)}
                />
                <span>{t('tiers.hideNoData')}</span>
              </label>
              <span className="panel-count">{t('units.songs', { count: visibleCount })}</span>
            </div>
          </div>
        </section>

        {visibleGroups.length === 0 ? (
          <section className="panel empty-state-panel">
            <p>{hideNoData && groups.length > 0 ? t('tiers.emptyAfterFilter') : t('tiers.empty')}</p>
          </section>
        ) : (
          <div className="user-tier-stack">
            {visibleGroups.map((group) => {
              const playedInGroup = group.rows.filter((item) => item.score.rank !== null).length;
              return (
                <section key={group.label} className="panel user-tier-section-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{group.label}</h2>
                    </div>
                    <span className="panel-count">
                      {formatNumber(playedInGroup, locale)}/{formatNumber(group.rows.length, locale)}
                    </span>
                  </div>
                  <div className="user-tier-card-grid">
                    {group.rows.map((item) => (
                      <SongRecordCard
                        key={item.key}
                        row={item.score}
                        songInfoUrl={songInfoUrl}
                        topLeft={item.userTier}
                        topRight={formatVersionLabel(item.score.version)}
                        onOpenSongDetail={onOpenSongDetail}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
