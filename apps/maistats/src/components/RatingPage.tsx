import type { ReactNode } from 'react';

import { useI18n } from '../app/i18n';
import { formatNumber, formatVersionLabel } from '../app/utils';
import type { ScoreRow } from '../types';
import { SongRecordCard } from './SongRecordCard';

interface RatingPageProps {
  sidebarTopContent?: ReactNode;
  songInfoUrl: string;
  ratingTotal: number;
  newRatingTotal: number;
  oldRatingTotal: number;
  newRows: ScoreRow[];
  oldRows: ScoreRow[];
  onOpenHistory: (row: ScoreRow) => void;
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

function RatingStatCard({
  ratingTotal,
  newRatingTotal,
  oldRatingTotal,
  average,
  locale,
  label,
}: {
  ratingTotal: number;
  newRatingTotal: number;
  oldRatingTotal: number;
  average: string;
  locale: string;
  label: string;
}) {
  return (
    <div className="rating-stat-card">
      <span>{label}</span>
      <strong>{formatNumber(ratingTotal, locale)}</strong>
      <small className="rating-stat-breakdown">
        NEW {formatNumber(newRatingTotal, locale)} + OLD {formatNumber(oldRatingTotal, locale)}
      </small>
      <small className="rating-stat-sub">AVG {average}</small>
    </div>
  );
}

function RatingCardSection({
  title,
  summary,
  rows,
  songInfoUrl,
  onOpenHistory,
}: {
  title: string;
  summary: string;
  rows: ScoreRow[];
  songInfoUrl: string;
  onOpenHistory: (row: ScoreRow) => void;
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
            onOpenHistory={onOpenHistory}
          />
        ))}
      </div>
    </section>
  );
}

export function RatingPage({
  sidebarTopContent,
  songInfoUrl,
  newRatingTotal,
  oldRatingTotal,
  newRows,
  oldRows,
  onOpenHistory,
}: RatingPageProps) {
  const { locale, t } = useI18n();
  const combinedRatingTotal = newRatingTotal + oldRatingTotal;
  const combinedAverage = formatRatingAvg(combinedRatingTotal, newRows.length + oldRows.length);
  const newSummary = `AVG ${formatRatingAvg(newRatingTotal, newRows.length)} (~${formatRatingProjection(newRatingTotal, newRows.length, locale)})`;
  const oldSummary = `AVG ${formatRatingAvg(oldRatingTotal, oldRows.length)} (~${formatRatingProjection(oldRatingTotal, oldRows.length, locale)})`;

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
            <RatingStatCard
              ratingTotal={combinedRatingTotal}
              newRatingTotal={newRatingTotal}
              oldRatingTotal={oldRatingTotal}
              average={combinedAverage}
              locale={locale}
              label={t('rating.current')}
            />
          </div>
        </section>
      </aside>

      <div className="table-column rating-table-column">
        <section className="panel rating-mobile-summary-panel">
          <RatingStatCard
            ratingTotal={combinedRatingTotal}
            newRatingTotal={newRatingTotal}
            oldRatingTotal={oldRatingTotal}
            average={combinedAverage}
            locale={locale}
            label={t('rating.current')}
          />
        </section>
        <RatingCardSection
          title="NEW"
          summary={newSummary}
          rows={newRows}
          songInfoUrl={songInfoUrl}
          onOpenHistory={onOpenHistory}
        />
        <RatingCardSection
          title="OLD"
          summary={oldSummary}
          rows={oldRows}
          songInfoUrl={songInfoUrl}
          onOpenHistory={onOpenHistory}
        />
      </div>
    </div>
  );
}
