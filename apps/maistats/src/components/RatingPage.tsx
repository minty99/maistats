import type { ReactNode } from 'react';

import { useI18n } from '../app/i18n';
import { formatNumber, formatVersionLabel } from '../app/utils';
import type { ScoreRow } from '../types';
import { SongRecordCard } from './SongRecordCard';
import type { SongDetailTarget } from './TableActionCells';

interface RatingPageProps {
  sidebarTopContent?: ReactNode;
  songInfoUrl: string;
  ratingTotal: number;
  newRatingTotal: number;
  oldRatingTotal: number;
  newRows: ScoreRow[];
  oldRows: ScoreRow[];
  onOpenSongDetail: (target: SongDetailTarget) => void;
}

function formatRatingAvg(total: number, count: number): string {
  if (count === 0) return '-';
  return (total / count).toFixed(2);
}

function formatRatingProjection(total: number, count: number, locale: string): string {
  if (count === 0) return '-';
  const avg = total / count;
  return Math.round(avg * 50).toLocaleString(locale);
}

function RatingCardSection({
  title,
  summary,
  rows,
  songInfoUrl,
  onOpenSongDetail,
}: {
  title: string;
  summary: string;
  rows: ScoreRow[];
  songInfoUrl: string;
  onOpenSongDetail: (target: SongDetailTarget) => void;
}) {
  return (
    <section className="panel rating-section-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
        </div>
        <span className="panel-count">{summary}</span>
      </div>
      <div className="rating-card-grid">
        {rows.map((row, index) => (
          <SongRecordCard
            key={row.key}
            row={row}
            songInfoUrl={songInfoUrl}
            topLeft={`#${index + 1}`}
            topRight={formatVersionLabel(row.version)}
            onOpenSongDetail={onOpenSongDetail}
          />
        ))}
      </div>
    </section>
  );
}

export function RatingPage({
  sidebarTopContent,
  songInfoUrl,
  ratingTotal,
  newRatingTotal,
  oldRatingTotal,
  newRows,
  oldRows,
  onOpenSongDetail,
}: RatingPageProps) {
  const { locale, t } = useI18n();
  const newSummary = `avg ${formatRatingAvg(newRatingTotal, newRows.length)} (~${formatRatingProjection(newRatingTotal, newRows.length, locale)})`;
  const oldSummary = `avg ${formatRatingAvg(oldRatingTotal, oldRows.length)} (~${formatRatingProjection(oldRatingTotal, oldRows.length, locale)})`;

  return (
    <div className="explorer-layout">
      <aside className="sidebar-column">
        {sidebarTopContent}
        <section className="panel filter-panel">
          <div className="panel-heading compact">
            <div>
              <h2>RATING</h2>
            </div>
          </div>
          <div className="rating-stat-grid">
            <div className="rating-stat-card">
              <span>{t('rating.current')}</span>
              <strong>{formatNumber(ratingTotal, locale)}</strong>
              <small className="rating-stat-sub">
                {t('rating.avg', { value: formatRatingAvg(ratingTotal, newRows.length + oldRows.length) })}
              </small>
            </div>
          </div>
        </section>
      </aside>

      <div className="table-column rating-table-column">
        <RatingCardSection
          title="NEW"
          summary={newSummary}
          rows={newRows}
          songInfoUrl={songInfoUrl}
          onOpenSongDetail={onOpenSongDetail}
        />
        <RatingCardSection
          title="OLD"
          summary={oldSummary}
          rows={oldRows}
          songInfoUrl={songInfoUrl}
          onOpenSongDetail={onOpenSongDetail}
        />
      </div>
    </div>
  );
}
