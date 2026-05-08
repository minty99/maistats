import { useMemo, useState } from 'react';

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
  songInfoUrl: string;
  groups: UserTierGroup[];
  onOpenSongDetail: (target: SongDetailTarget) => void;
}

export function UserTierPage({
  songInfoUrl,
  groups,
  onOpenSongDetail,
}: UserTierPageProps) {
  const { locale, t } = useI18n();
  const [hideNoData, setHideNoData] = useState(false);
  const [hideBelow90, setHideBelow90] = useState(false);
  const visibleGroups = useMemo(
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
  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="explorer-layout user-tier-layout">
      <aside className="sidebar-column">
        <section className="panel filter-panel">
          <div className="panel-heading compact">
            <div>
              <h2>{t('tiers.filters')}</h2>
            </div>
          </div>
          <div className="user-tier-filter-actions">
            <button
              type="button"
              className={`user-tier-filter-button ${hideNoData ? 'is-active' : ''}`}
              aria-pressed={hideNoData}
              onClick={() => setHideNoData((value) => !value)}
            >
              {t('tiers.hideNoData')}
            </button>
            <button
              type="button"
              className={`user-tier-filter-button ${hideBelow90 ? 'is-active' : ''}`}
              aria-pressed={hideBelow90}
              onClick={() => setHideBelow90((value) => !value)}
            >
              {t('tiers.hideBelow90')}
            </button>
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
            <span className="panel-count">{t('units.songs', { count: visibleCount })}</span>
          </div>
        </section>

        {visibleGroups.length === 0 ? (
          <section className="panel empty-state-panel">
            <p>{groups.length > 0 ? t('tiers.emptyAfterFilter') : t('tiers.empty')}</p>
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
