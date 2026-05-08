import type { KeyboardEvent } from 'react';

import { useI18n } from '../app/i18n';
import { formatNumber, formatPercent } from '../app/utils';
import { toIntegerRating } from '../derive';
import type { ScoreRow } from '../types';
import { ChartTypeLabel } from './ChartTypeLabel';
import { DifficultyLabel, getDifficultyToneClass } from './DifficultyLabel';
import { Jacket } from './Jacket';
import { LevelCell } from './LevelCell';
import type { SongDetailTarget } from './TableActionCells';

interface SongRecordCardProps {
  row: ScoreRow;
  songInfoUrl: string;
  topLeft: string;
  topRight: string;
  onOpenSongDetail: (target: SongDetailTarget) => void;
}

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpenSongDetail: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onOpenSongDetail();
}

export function SongRecordCard({
  row,
  songInfoUrl,
  topLeft,
  topRight,
  onOpenSongDetail,
}: SongRecordCardProps) {
  const { locale, t } = useI18n();
  const handleOpenDetail = () => onOpenSongDetail(row);

  return (
    <article
      className={`rating-song-card ${getDifficultyToneClass(row.difficulty)}`}
      role="button"
      tabIndex={0}
      aria-label={t('rating.openSongDetail', { title: row.title })}
      onClick={handleOpenDetail}
      onKeyDown={(event) => handleCardKeyDown(event, handleOpenDetail)}
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
