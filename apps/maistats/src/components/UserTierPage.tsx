import { type ReactNode, useMemo, useState } from 'react';

import { useI18n } from '../app/i18n';
import { formatVersionLabel } from '../app/utils';
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
  onOpenSongDetail: (target: SongDetailTarget) => void;
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

  return (
    <div className="explorer-layout user-tier-layout">
      <aside className="sidebar-column">
        {sidebarTopContent}
        <section className="panel filter-panel">
          <div className="panel-heading compact">
            <div>
              <h2>{t('tiers.filters')}</h2>
            </div>
          </div>
          <div className="user-tier-filter-actions">
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
      </aside>

      <div className="table-column user-tier-table-column">
        <section className="panel user-tier-intro-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('tiers.heading')}</h2>
              <p>{t('tiers.description')}</p>
            </div>
          </div>
        </section>

        {visibleGroups.length === 0 ? (
          <section className="panel empty-state-panel">
            <p>{groups.length > 0 ? t('tiers.emptyAfterFilter') : t('tiers.empty')}</p>
          </section>
        ) : (
          <div className="user-tier-stack">
            {visibleGroups.map((group) => (
              <section key={group.label} className="panel user-tier-section-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{group.label}</h2>
                  </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
