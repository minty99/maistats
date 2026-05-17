import type { KeyboardEvent } from 'react';

import { useI18n } from '../app/i18n';
import { formatNumber, formatPercent } from '../app/utils';
import { toIntegerRating } from '../derive';
import type { ScoreRow } from '../types';
import { ChartTypeLabel } from './ChartTypeLabel';
import { DifficultyLabel, getDifficultyToneClass } from './DifficultyLabel';
import { Jacket } from './Jacket';
import { LevelCell } from './LevelCell';

interface SongRecordCardProps {
  row: ScoreRow;
  songInfoUrl: string;
  topLeft: string;
  topRight: string;
  onOpenHistory: (row: ScoreRow) => void;
}

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpenHistory: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onOpenHistory();
}

export function SongRecordCard({
  row,
  songInfoUrl,
  topLeft,
  topRight,
  onOpenHistory,
}: SongRecordCardProps) {
  const { locale, t } = useI18n();
  const handleOpenHistory = () => onOpenHistory(row);

  return (
    <article
      className={`rating-song-card ${getDifficultyToneClass(row.difficulty)}`}
      role="button"
      tabIndex={0}
      aria-label={t('history.openChartHistory', { title: row.title })}
      onClick={handleOpenHistory}
      onKeyDown={(event) => handleCardKeyDown(event, handleOpenHistory)}
    >
      <div className={`rating-song-stage ${getDifficultyToneClass(row.difficulty)}`}>
        <div className="rating-song-jacket-wrap">
          <Jacket
            songInfoUrl={songInfoUrl}
            imageName={row.imageName}
            title={row.title}
            className="rating-song-jacket"
          />
        </div>
        <div className="rating-song-stage-gradient" />
        <div className="rating-song-stage-topline">
          <span>{topLeft}</span>
          <span>{topRight}</span>
        </div>
        <div className="rating-song-stage-badges">
          <ChartTypeLabel chartType={row.chartType} />
          <DifficultyLabel difficulty={row.difficulty} short className="rating-difficulty-chip" />
        </div>
        <div className="rating-song-rating-chip">
          <strong>{formatNumber(toIntegerRating(row.rating), locale)}</strong>
        </div>
      </div>
      <div className="rating-song-info">
        <h3>{row.title}</h3>
        <div className="rating-song-level-row">
          <span>{row.level ? `Lv ${row.level}` : 'Lv -'}</span>
          <LevelCell
            internalLevel={row.internalLevel}
            isInternalLevelEstimated={row.isInternalLevelEstimated}
            difficulty={row.difficulty}
          />
        </div>
        <div className="rating-song-stat-grid">
          <div className="rating-song-stat">
            <strong>{formatPercent(row.achievementPercent)}</strong>
          </div>
          <div className="rating-song-stat">
            <strong>{row.rank ?? '-'}</strong>
          </div>
          <div className="rating-song-stat">
            <strong>{row.fc ?? '-'}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
