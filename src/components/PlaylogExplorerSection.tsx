import type { Dispatch, SetStateAction } from 'react';

import type { PlaylogSortKey } from '../app/constants';
import {
  formatDifficultyShort,
  formatNumber,
  formatPercent,
  formatRatio,
  sortIndicator,
  toggleArrayValue,
} from '../app/utils';
import type { ChartType, DifficultyCategory, PlaylogRow } from '../types';
import { toDateLabel } from '../derive';
import { Jacket } from './Jacket';
import { ToggleGroup } from './ToggleGroup';

interface PlaylogExplorerSectionProps {
  playlogCountLabel: string;
  playlogQuery: string;
  setPlaylogQuery: Dispatch<SetStateAction<string>>;
  chartTypes: ChartType[];
  playlogChartFilter: ChartType[];
  setPlaylogChartFilter: Dispatch<SetStateAction<ChartType[]>>;
  difficulties: DifficultyCategory[];
  playlogDifficultyFilter: DifficultyCategory[];
  setPlaylogDifficultyFilter: Dispatch<SetStateAction<DifficultyCategory[]>>;
  playlogAchievementMin: number;
  setPlaylogAchievementMin: Dispatch<SetStateAction<number>>;
  playlogAchievementMax: number;
  setPlaylogAchievementMax: Dispatch<SetStateAction<number>>;
  playlogIncludeUnknownDiff: boolean;
  setPlaylogIncludeUnknownDiff: Dispatch<SetStateAction<boolean>>;
  playlogNewRecordOnly: boolean;
  setPlaylogNewRecordOnly: Dispatch<SetStateAction<boolean>>;
  playlogFirstPlayOnly: boolean;
  setPlaylogFirstPlayOnly: Dispatch<SetStateAction<boolean>>;
  filteredPlaylogRows: PlaylogRow[];
  songInfoUrl: string;
  playlogSortKey: PlaylogSortKey;
  playlogSortDesc: boolean;
  onSortBy: (key: PlaylogSortKey) => void;
}

export function PlaylogExplorerSection({
  playlogCountLabel,
  playlogQuery,
  setPlaylogQuery,
  chartTypes,
  playlogChartFilter,
  setPlaylogChartFilter,
  difficulties,
  playlogDifficultyFilter,
  setPlaylogDifficultyFilter,
  playlogAchievementMin,
  setPlaylogAchievementMin,
  playlogAchievementMax,
  setPlaylogAchievementMax,
  playlogIncludeUnknownDiff,
  setPlaylogIncludeUnknownDiff,
  playlogNewRecordOnly,
  setPlaylogNewRecordOnly,
  playlogFirstPlayOnly,
  setPlaylogFirstPlayOnly,
  filteredPlaylogRows,
  songInfoUrl,
  playlogSortKey,
  playlogSortDesc,
  onSortBy,
}: PlaylogExplorerSectionProps) {
  return (
    <div className="explorer-layout">
      <aside className="sidebar-column">
        <section className="panel filter-panel">
          <h2>Playlog Filters</h2>
          <div className="filter-grid">
            <label className="search-box">
              <span>검색 (곡명/시각)</span>
              <input
                type="search"
                value={playlogQuery}
                onChange={(event) => setPlaylogQuery(event.target.value)}
                placeholder="예: 2026/02/25, BUDDiES"
              />
            </label>

            <ToggleGroup
              label="Chart Type"
              options={chartTypes}
              selected={playlogChartFilter}
              onToggle={(value) => setPlaylogChartFilter((prev) => toggleArrayValue(prev, value))}
            />

            <ToggleGroup
              label="Difficulty"
              options={difficulties}
              selected={playlogDifficultyFilter}
              onToggle={(value) => setPlaylogDifficultyFilter((prev) => toggleArrayValue(prev, value))}
              formatLabel={formatDifficultyShort}
            />

            <div className="range-grid compact">
              <label>
                <span>달성률 최소</span>
                <input
                  type="number"
                  value={playlogAchievementMin}
                  min={0}
                  max={101}
                  step={0.0001}
                  onChange={(event) => setPlaylogAchievementMin(Number(event.target.value))}
                />
              </label>
              <label>
                <span>달성률 최대</span>
                <input
                  type="number"
                  value={playlogAchievementMax}
                  min={0}
                  max={101}
                  step={0.0001}
                  onChange={(event) => setPlaylogAchievementMax(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="toggle-grid">
              <label>
                <input
                  type="checkbox"
                  checked={playlogIncludeUnknownDiff}
                  onChange={(event) => setPlaylogIncludeUnknownDiff(event.target.checked)}
                />
                난이도 정보 없는 로그 포함
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={playlogNewRecordOnly}
                  onChange={(event) => setPlaylogNewRecordOnly(event.target.checked)}
                />
                New Record만 보기
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={playlogFirstPlayOnly}
                  onChange={(event) => setPlaylogFirstPlayOnly(event.target.checked)}
                />
                First Play만 보기
              </label>
            </div>
          </div>
        </section>
      </aside>

      <div className="table-column">
        <section className="panel">
          <h2>Playlog Table ({playlogCountLabel})</h2>
          <div className="table-wrap">
            <table className="playlog-table compact-table">
              <thead>
                <tr>
                  <th>Jacket</th>
                  <th className="sortable">
                    <button type="button" className="th-sort-button" onClick={() => onSortBy('playedAt')}>
                      <span>Played At</span>
                      <span className="sort-indicator">
                        {sortIndicator(playlogSortKey === 'playedAt', playlogSortDesc)}
                      </span>
                    </button>
                  </th>
                  <th>Track</th>
                  <th className="sortable">
                    <button type="button" className="th-sort-button" onClick={() => onSortBy('title')}>
                      <span>Title</span>
                      <span className="sort-indicator">{sortIndicator(playlogSortKey === 'title', playlogSortDesc)}</span>
                    </button>
                  </th>
                  <th>Chart</th>
                  <th>Diff</th>
                  <th className="sortable">
                    <button type="button" className="th-sort-button" onClick={() => onSortBy('achievement')}>
                      <span>Achv</span>
                      <span className="sort-indicator">
                        {sortIndicator(playlogSortKey === 'achievement', playlogSortDesc)}
                      </span>
                    </button>
                  </th>
                  <th className="sortable">
                    <button type="button" className="th-sort-button" onClick={() => onSortBy('rating')}>
                      <span>Rating</span>
                      <span className="sort-indicator">
                        {sortIndicator(playlogSortKey === 'rating', playlogSortDesc)}
                      </span>
                    </button>
                  </th>
                  <th>Rank</th>
                  <th>FC</th>
                  <th>Sync</th>
                  <th className="sortable">
                    <button type="button" className="th-sort-button" onClick={() => onSortBy('dxRatio')}>
                      <span>DX</span>
                      <span className="sort-indicator">
                        {sortIndicator(playlogSortKey === 'dxRatio', playlogSortDesc)}
                      </span>
                    </button>
                  </th>
                  <th>Credit Count</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlaylogRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <Jacket songInfoUrl={songInfoUrl} imageName={row.imageName} title={row.title} />
                    </td>
                    <td>{row.playedAtLabel ?? toDateLabel(row.playedAtUnix) ?? '-'}</td>
                    <td>{row.track ?? '-'}</td>
                    <td>{row.title}</td>
                    <td>{row.chartType}</td>
                    <td>{formatDifficultyShort(row.difficulty)}</td>
                    <td>{formatPercent(row.achievementPercent)}</td>
                    <td>{formatNumber(row.ratingPoints)}</td>
                    <td>{row.rank ?? '-'}</td>
                    <td>{row.fc ?? '-'}</td>
                    <td>{row.sync ?? '-'}</td>
                    <td>
                      {formatNumber(row.dxScore)} / {formatNumber(row.dxScoreMax)}
                      <div className="muted">{formatRatio(row.dxRatio)}</div>
                    </td>
                    <td>{row.creditPlayCount ?? '-'}</td>
                    <td>
                      {row.isNewRecord ? 'NEW ' : ''}
                      {row.isFirstPlay ? 'FIRST' : ''}
                      {!row.isNewRecord && !row.isFirstPlay ? '-' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
