import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useI18n } from '../app/i18n';
import type { CompareSortKey } from '../app/constants';
import type { ChartType, CompareScoreRow, DifficultyCategory } from '../types';
import {
  formatAliasSummary,
  formatPercent,
  formatVersionLabel,
  sortIndicator,
  toggleArrayValue,
} from '../app/utils';
import { ChartTypeLabel, getChartTypeToneClass } from './ChartTypeLabel';
import { DifficultyLabel, getDifficultyToneClass } from './DifficultyLabel';
import { FilterFabButton } from './FilterFabButton';
import { Jacket } from './Jacket';
import { LevelCell } from './LevelCell';
import { SearchInput } from './SearchInput';
import type { SongDetailTarget } from './TableActionCells';
import { AchievementHistoryButton, SongTitleButton } from './TableActionCells';
import { ToggleGroup } from './ToggleGroup';

interface CompareExplorerSectionProps {
  sidebarTopContent?: ReactNode;
  scoreCountLabel: string;
  isLoading: boolean;
  rivalUrlDraft: string;
  setRivalUrlDraft: Dispatch<SetStateAction<string>>;
  onLoadRival: () => void;
  isRivalLoading: boolean;
  rivalErrorMessage: string | null;
  rivalPlayerName: string | null;
  appliedQuery: string;
  onApplyQuery: (query: string) => void;
  chartTypes: ChartType[];
  chartFilter: ChartType[];
  setChartFilter: Dispatch<SetStateAction<ChartType[]>>;
  difficulties: DifficultyCategory[];
  difficultyFilter: DifficultyCategory[];
  setDifficultyFilter: Dispatch<SetStateAction<DifficultyCategory[]>>;
  versionOptions: string[];
  versionSelection: string;
  setVersionSelection: Dispatch<SetStateAction<string>>;
  playedOnly: boolean;
  setPlayedOnly: Dispatch<SetStateAction<boolean>>;
  rivalOnly: boolean;
  onChangeRivalOnly: (checked: boolean) => void;
  bothPlayedOnly: boolean;
  onChangeBothPlayedOnly: (checked: boolean) => void;
  internalLevelPresetOptions: string[];
  selectedInternalLevelPresets: string[];
  onToggleInternalLevelPreset: (value: string) => void;
  scoreRankOptions: string[];
  selectedScoreRankPresets: string[];
  onToggleScoreRankPreset: (value: string) => void;
  fcOptions: string[];
  fcFilter: string[];
  onToggleFcFilter: (value: string) => void;
  syncOptions: string[];
  syncFilter: string[];
  onToggleSyncFilter: (value: string) => void;
  achievementMin: number;
  onChangeAchievementMin: (value: number) => void;
  achievementMax: number;
  onChangeAchievementMax: (value: number) => void;
  internalMin: number;
  onChangeInternalMin: (value: number) => void;
  internalMax: number;
  onChangeInternalMax: (value: number) => void;
  daysMin: number;
  setDaysMin: Dispatch<SetStateAction<number>>;
  daysMax: number;
  setDaysMax: Dispatch<SetStateAction<number>>;
  filteredScoreRows: CompareScoreRow[];
  songInfoUrl: string;
  onOpenSongDetail: (target: SongDetailTarget) => void;
  onOpenHistory: (row: CompareScoreRow) => void;
  scoreSortKey: CompareSortKey;
  scoreSortDesc: boolean;
  onSortBy: (key: CompareSortKey) => void;
  onResetFilters: () => void;
}

function formatSignedPercent(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(4)}%`;
}

function diffClassName(value: number | null): string {
  if (value === null || value === 0) {
    return 'compare-diff-value';
  }
  return value > 0
    ? 'compare-diff-value compare-diff-value-positive'
    : 'compare-diff-value compare-diff-value-negative';
}

export function CompareExplorerSection({
  sidebarTopContent,
  scoreCountLabel,
  isLoading,
  rivalUrlDraft,
  setRivalUrlDraft,
  onLoadRival,
  isRivalLoading,
  rivalErrorMessage,
  rivalPlayerName,
  appliedQuery,
  onApplyQuery,
  chartTypes,
  chartFilter,
  setChartFilter,
  difficulties,
  difficultyFilter,
  setDifficultyFilter,
  versionOptions,
  versionSelection,
  setVersionSelection,
  playedOnly,
  setPlayedOnly,
  rivalOnly,
  onChangeRivalOnly,
  bothPlayedOnly,
  onChangeBothPlayedOnly,
  internalLevelPresetOptions,
  selectedInternalLevelPresets,
  onToggleInternalLevelPreset,
  scoreRankOptions,
  selectedScoreRankPresets,
  onToggleScoreRankPreset,
  fcOptions,
  fcFilter,
  onToggleFcFilter,
  syncOptions,
  syncFilter,
  onToggleSyncFilter,
  achievementMin,
  onChangeAchievementMin,
  achievementMax,
  onChangeAchievementMax,
  internalMin,
  onChangeInternalMin,
  internalMax,
  onChangeInternalMax,
  daysMin,
  setDaysMin,
  daysMax,
  setDaysMax,
  filteredScoreRows,
  songInfoUrl,
  onOpenSongDetail,
  onOpenHistory,
  scoreSortKey,
  scoreSortDesc,
  onSortBy,
  onResetFilters,
}: CompareExplorerSectionProps) {
  const { t } = useI18n();
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const virtualizer = useVirtualizer({
    count: filteredScoreRows.length,
    getScrollElement: () => tableWrapRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  useEffect(() => {
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  }, [filteredScoreRows]);

  const virtualItems = virtualizer.getVirtualItems();
  const colCount = 7;
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  const renderSearchControl = () => (
    <SearchInput
      label={t('scores.searchLabel')}
      placeholder={t('scores.searchPlaceholder')}
      appliedQuery={appliedQuery}
      onApplyQuery={onApplyQuery}
    />
  );

  const rivalPanel = (
    <section className="panel compare-connect-panel">
      <div className="panel-heading compact">
        <div>
          <h2>{t('compare.connectTitle')}</h2>
          <p>{t('compare.connectDescription')}</p>
        </div>
      </div>
      <form
        className="compare-connect-form"
        onSubmit={(event) => {
          event.preventDefault();
          onLoadRival();
        }}
      >
        <label className="home-url-field">
          <span>{t('compare.rivalUrl')}</span>
          <input
            type="url"
            value={rivalUrlDraft}
            onChange={(event) => setRivalUrlDraft(event.target.value)}
            placeholder={t('home.connect.placeholder')}
          />
        </label>
        <button
          type="submit"
          className="home-connect-btn"
          disabled={isRivalLoading || !rivalUrlDraft.trim()}
        >
          {isRivalLoading ? t('common.connecting') : t('common.apply')}
        </button>
      </form>
      {rivalPlayerName ? (
        <p className="home-status success">{t('compare.connectedRival', { name: rivalPlayerName })}</p>
      ) : null}
      {rivalErrorMessage ? (
        <p className="home-status error">{t('compare.loadFailed', { message: rivalErrorMessage })}</p>
      ) : null}
    </section>
  );

  const filterPanel = (
    <section className="panel filter-panel">
      <div className="panel-heading compact">
        <div>
          <h2>{t('common.filters')}</h2>
        </div>
        <div className="panel-heading-actions">
          <button type="button" className="filter-reset-button" onClick={onResetFilters}>
            {t('scores.resetAll')}
          </button>
          {isFilterModalOpen ? (
            <button
              type="button"
              className="modal-close-button"
              onClick={() => setIsFilterModalOpen(false)}
            >
              {t('common.close')}
            </button>
          ) : null}
        </div>
      </div>
      <div className="filter-grid">
        <ToggleGroup
          label={t('scores.chartType')}
          options={chartTypes}
          selected={chartFilter}
          onToggle={(value) => setChartFilter((prev) => toggleArrayValue(prev, value))}
          optionClassName={(value) => `chart-type-chip ${getChartTypeToneClass(value)}`}
        />

        <ToggleGroup
          label={t('scores.difficulty')}
          options={difficulties}
          selected={difficultyFilter}
          onToggle={(value) => setDifficultyFilter((prev) => toggleArrayValue(prev, value))}
          renderLabel={(value) => <DifficultyLabel difficulty={value} short />}
          optionClassName={(value) => `difficulty-chip ${getDifficultyToneClass(value)}`}
        />

        <div className="filter-block filter-block-select">
          <div className="filter-label">{t('scores.version')}</div>
          <label>
            <select
              value={versionSelection}
              onChange={(event) => setVersionSelection(event.target.value)}
            >
              <option value="ALL">{t('scores.versionAll')}</option>
              <option value="NEW">{t('scores.versionNew')}</option>
              <option value="OLD">{t('scores.versionOld')}</option>
              {versionOptions.map((version) => (
                <option key={version} value={version}>
                  {formatVersionLabel(version)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filter-block score-special-filters">
          <label className="score-special-toggle">
            <input
              type="checkbox"
              checked={playedOnly}
              onChange={(event) => setPlayedOnly(event.target.checked)}
            />
            <span>{t('scores.playedOnly')}</span>
          </label>
          <label className="score-special-toggle">
            <input
              type="checkbox"
              checked={rivalOnly}
              onChange={(event) => onChangeRivalOnly(event.target.checked)}
            />
            <span>{t('compare.rivalOnly')}</span>
          </label>
          <label className="score-special-toggle">
            <input
              type="checkbox"
              checked={bothPlayedOnly}
              onChange={(event) => onChangeBothPlayedOnly(event.target.checked)}
            />
            <span>{t('compare.bothPlayedOnly')}</span>
          </label>
        </div>

        <div className="filter-block">
          <div className="filter-label">{t('scores.level')}</div>
          <div className="range-pair">
            <label>
              <input
                type="number"
                value={internalMin}
                min={1}
                max={15.5}
                step={0.1}
                aria-label={t('scores.levelMin')}
                onChange={(event) => onChangeInternalMin(Number(event.target.value))}
              />
            </label>
            <span className="range-separator">~</span>
            <label>
              <input
                type="number"
                value={internalMax}
                min={1}
                max={15.5}
                step={0.1}
                aria-label={t('scores.levelMax')}
                onChange={(event) => onChangeInternalMax(Number(event.target.value))}
              />
            </label>
          </div>
          <ToggleGroup
            label=""
            options={internalLevelPresetOptions}
            selected={selectedInternalLevelPresets}
            onToggle={onToggleInternalLevelPreset}
            hideLabel
          />
        </div>

        <div className="filter-block">
          <div className="filter-label">{t('scores.score')}</div>
          <div className="range-pair">
            <label>
              <input
                type="number"
                value={achievementMin}
                min={0}
                max={101}
                step={0.0001}
                aria-label={t('scores.achievementMin')}
                onChange={(event) => onChangeAchievementMin(Number(event.target.value))}
              />
            </label>
            <span className="range-separator">~</span>
            <label>
              <input
                type="number"
                value={achievementMax}
                min={0}
                max={101}
                step={0.0001}
                aria-label={t('scores.achievementMax')}
                onChange={(event) => onChangeAchievementMax(Number(event.target.value))}
              />
            </label>
          </div>
          <ToggleGroup
            label=""
            options={scoreRankOptions}
            selected={selectedScoreRankPresets}
            onToggle={onToggleScoreRankPreset}
            hideLabel
          />
        </div>

        <ToggleGroup
          label="FC"
          options={fcOptions}
          selected={fcFilter}
          onToggle={onToggleFcFilter}
        />

        <ToggleGroup
          label="Sync"
          options={syncOptions}
          selected={syncFilter}
          onToggle={onToggleSyncFilter}
        />

        <div className="filter-block">
          <div className="filter-label">{t('scores.daysSince')}</div>
          <div className="range-pair">
            <label>
              <input
                type="number"
                value={daysMin}
                min={0}
                max={5000}
                step={1}
                aria-label={t('scores.daysMin')}
                onChange={(event) => setDaysMin(Number(event.target.value))}
              />
            </label>
            <span className="range-separator">~</span>
            <label>
              <input
                type="number"
                value={daysMax}
                min={0}
                max={5000}
                step={1}
                aria-label={t('scores.daysMax')}
                onChange={(event) => setDaysMax(Number(event.target.value))}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <div className="explorer-layout table-explorer-layout compare-explorer-layout">
        <aside className="sidebar-column">
          {sidebarTopContent}
          {rivalPanel}
          <section className="panel search-panel">
            {renderSearchControl()}
          </section>
          {filterPanel}
        </aside>

        <div className="table-column">
          <section className="panel mobile-search-panel">
            {renderSearchControl()}
          </section>
          <section className="panel explorer-table-panel">
            <div className="panel-heading">
              <div>
                <h2>{t('compare.title')}</h2>
                <p>{t('compare.description')}</p>
              </div>
              <div className="panel-heading-actions">
                <span className="panel-count">{scoreCountLabel}</span>
              </div>
            </div>
            <div className="table-wrap" ref={tableWrapRef}>
              {isLoading ? <div className="table-loading-state">{t('compare.loading')}</div> : null}
              <table className="score-table compare-table compact-table">
                <thead>
                  <tr>
                    <th className="jacket-col">{t('common.jacket')}</th>
                    <th className="sortable title-col">
                      <button type="button" className="th-sort-button" onClick={() => onSortBy('title')}>
                        <span>{t('common.title')}</span>
                        <span className="sort-indicator">{sortIndicator(scoreSortKey === 'title', scoreSortDesc)}</span>
                      </button>
                    </th>
                    <th className="chart-col">{t('common.chart')}</th>
                    <th className="sortable level-col">
                      <button type="button" className="th-sort-button" onClick={() => onSortBy('internal')}>
                        <span>{t('common.levelShort')}</span>
                        <span className="sort-indicator">
                          {sortIndicator(scoreSortKey === 'internal', scoreSortDesc)}
                        </span>
                      </button>
                    </th>
                    <th className="sortable achievement-col">
                      <button type="button" className="th-sort-button" onClick={() => onSortBy('achievement')}>
                        <span>{t('compare.myRecord')}</span>
                        <span className="sort-indicator">
                          {sortIndicator(scoreSortKey === 'achievement', scoreSortDesc)}
                        </span>
                      </button>
                    </th>
                    <th className="sortable achievement-col">
                      <button type="button" className="th-sort-button" onClick={() => onSortBy('rivalAchievement')}>
                        <span>{t('compare.rivalRecord')}</span>
                        <span className="sort-indicator">
                          {sortIndicator(scoreSortKey === 'rivalAchievement', scoreSortDesc)}
                        </span>
                      </button>
                    </th>
                    <th className="sortable diff-col">
                      <button type="button" className="th-sort-button" onClick={() => onSortBy('diff')}>
                        <span>diff</span>
                        <span className="sort-indicator">{sortIndicator(scoreSortKey === 'diff', scoreSortDesc)}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr style={{ height: paddingTop }}>
                      <td colSpan={colCount} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = filteredScoreRows[virtualRow.index];
                    return (
                      <tr key={row.key} data-index={virtualRow.index} ref={virtualizer.measureElement}>
                        <td className="jacket-col">
                          <Jacket songInfoUrl={songInfoUrl} imageName={row.imageName} title={row.title} />
                        </td>
                        <td className="title-col">
                          <div className="title-cell">
                            <SongTitleButton
                              target={row.hasOwnRecord ? row : null}
                              title={row.title}
                              subtitle={formatAliasSummary(row.aliases)}
                              onOpenSongDetail={onOpenSongDetail}
                            />
                          </div>
                        </td>
                        <td className="chart-col">
                          <ChartTypeLabel chartType={row.chartType} />
                        </td>
                        <td className="level-col">
                          <LevelCell
                            internalLevel={row.internalLevel}
                            isInternalLevelEstimated={row.isInternalLevelEstimated}
                            difficulty={row.difficulty}
                          />
                        </td>
                        <td className="achievement-col">
                          <AchievementHistoryButton
                            achievementPercent={row.achievementPercent}
                            onOpenHistory={row.achievementPercent === null ? null : () => onOpenHistory(row)}
                          />
                        </td>
                        <td className="achievement-col">{formatPercent(row.rivalAchievementPercent)}</td>
                        <td className="diff-col">
                          <span className={diffClassName(row.diffPercent)}>{formatSignedPercent(row.diffPercent)}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr style={{ height: paddingBottom }}>
                      <td colSpan={colCount} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <FilterFabButton
        label={t('common.filters')}
        className="compare-filter-fab"
        onClick={() => setIsFilterModalOpen(true)}
      />

      {isFilterModalOpen ? (
        <div className="modal-backdrop mobile-filter-backdrop" onClick={() => setIsFilterModalOpen(false)}>
          <section
            className="modal-card panel mobile-filter-modal"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebarTopContent}
            {rivalPanel}
            {filterPanel}
          </section>
        </div>
      ) : null}
    </>
  );
}
