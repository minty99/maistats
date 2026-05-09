import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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

interface UserTierPlotPoint {
  x: number;
  y: number;
  tier: string;
  tierStep: number;
  title: string;
  internalLevel: number | null;
  daysElapsed: number;
}

interface TierPlotTheme {
  bg: string;
  paperBg: string;
  text: string;
  grid: string;
  hoverBg: string;
  hoverBorder: string;
  markerOutline: string;
}

const TIER_PLOT_X_MIN = 13.0;
const TIER_PLOT_X_MAX = 14.5;
const TIER_PLOT_Y_MAX = 101.0;
const MIN_ACHIEVEMENT_FILTER = 90;
const DAYS_FILTER = 90;
const TIER_PLOT_JITTER = 0.35;
const MAX_ALPHA = 0.85;
const MIN_ALPHA = 0.25;

const PALETTE = [
  '#5b9ef5',
  '#f0a050',
  '#6dd58c',
  '#e86080',
  '#a07af0',
  '#50c8c8',
  '#f07878',
  '#88b0e0',
  '#d0a060',
  '#c888e0',
];

const RANK_THRESHOLDS: Array<{ value: number; label: string; icon: string }> = [
  { value: 97.0, label: 'S', icon: '/rank-icons/s.png' },
  { value: 98.0, label: 'S+', icon: '/rank-icons/sp.png' },
  { value: 99.0, label: 'SS', icon: '/rank-icons/ss.png' },
  { value: 99.5, label: 'SS+', icon: '/rank-icons/ssp.png' },
  { value: 100.0, label: 'SSS', icon: '/rank-icons/sss.png' },
  { value: 100.5, label: 'SSS+', icon: '/rank-icons/sssp.png' },
];

const DARK_TIER_PLOT_THEME: TierPlotTheme = {
  bg: '#16161f',
  paperBg: '#0f0f17',
  text: '#c8c8d0',
  grid: 'rgba(255,255,255,0.08)',
  hoverBg: '#1e1e2e',
  hoverBorder: 'rgba(255,255,255,0.15)',
  markerOutline: 'rgba(0,0,0,0.35)',
};

const LIGHT_TIER_PLOT_THEME: TierPlotTheme = {
  bg: '#fafaf8',
  paperBg: '#f0f0ec',
  text: '#2a2a36',
  grid: 'rgba(0,0,0,0.08)',
  hoverBg: '#ffffff',
  hoverBorder: 'rgba(0,0,0,0.15)',
  markerOutline: 'rgba(255,255,255,0.65)',
};

function resolveEffectiveTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light') return 'light';
  if (attr === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function useEffectiveTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return resolveEffectiveTheme();
  });

  useEffect(() => {
    const update = () => setTheme(resolveEffectiveTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', update);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);

  return theme;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function ageAlpha(daysElapsed: number, windowDays: number): number {
  const ratio = Math.max(0, Math.min(1, daysElapsed / windowDays));
  return MAX_ALPHA - (MAX_ALPHA - MIN_ALPHA) * ratio;
}

export function UserTierPage({
  sidebarTopContent,
  songInfoUrl,
  groups,
  onOpenSongDetail,
}: UserTierPageProps) {
  const { t } = useI18n();
  const plotRef = useRef<HTMLDivElement>(null);
  const effectiveTheme = useEffectiveTheme();
  const plotTheme = effectiveTheme === 'light' ? LIGHT_TIER_PLOT_THEME : DARK_TIER_PLOT_THEME;
  const [hideNoData, setHideNoData] = useState(false);
  const [hideBelow90, setHideBelow90] = useState(false);
  const [showPlot, setShowPlot] = useState(false);
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
  const plotPoints = useMemo<UserTierPlotPoint[]>(() => {
    return visibleGroups.flatMap((group) =>
      group.rows
        .filter((item) =>
          item.score.achievementPercent !== null
          && item.score.achievementPercent >= MIN_ACHIEVEMENT_FILTER
          && item.score.daysSinceLastPlayed !== null
          && item.score.daysSinceLastPlayed <= DAYS_FILTER
          && item.userTierStep / 100 >= TIER_PLOT_X_MIN
          && item.userTierStep / 100 <= TIER_PLOT_X_MAX
        )
        .map((item) => ({
          x: item.userTierStep / 100,
          y: item.score.achievementPercent ?? 0,
          tier: item.userTier,
          tierStep: item.userTierStep,
          title: item.score.title,
          internalLevel: item.score.internalLevel,
          daysElapsed: item.score.daysSinceLastPlayed ?? DAYS_FILTER,
        })),
    );
  }, [visibleGroups]);
  const tierTicks = useMemo(() => {
    const ticks = new Map<number, string>();
    for (const group of visibleGroups) {
      const value = group.step / 100;
      if (value >= TIER_PLOT_X_MIN && value <= TIER_PLOT_X_MAX) {
        ticks.set(value, group.label);
      }
    }
    return Array.from(ticks.entries()).sort((left, right) => left[0] - right[0]);
  }, [visibleGroups]);

  useEffect(() => {
    const el = plotRef.current;
    if (!showPlot || !el || plotPoints.length === 0 || tierTicks.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;

      const FONT_FAMILY = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      const rng = mulberry32(42);
      const nTiers = tierTicks.length;
      const tierIndexMap = new Map(tierTicks.map(([tier], index) => [Math.round(tier * 100), index]));
      const colorMap = new Map(
        tierTicks.map(([tier], index) => [Math.round(tier * 100), PALETTE[index % PALETTE.length]]),
      );
      const xValues = plotPoints.map((point) => {
        const index = tierIndexMap.get(point.tierStep) ?? 0;
        return index + (rng() * 2 - 1) * TIER_PLOT_JITTER;
      });
      const yValues = plotPoints.map((point) => point.y);
      const yMin = Math.min(Math.min(...yValues), 100.5);
      const yRange = TIER_PLOT_Y_MAX - yMin;
      const figWidth = Math.min(1320, Math.max(760, 100 * nTiers + 220));
      const shapes: Array<Record<string, unknown>> = [];
      const images: Array<Record<string, unknown>> = [];
      for (let i = 1; i < nTiers; i++) {
        shapes.push({
          type: 'line',
          x0: i - 0.5,
          x1: i - 0.5,
          y0: yMin,
          y1: TIER_PLOT_Y_MAX,
          xref: 'x',
          yref: 'y',
          line: { dash: 'dash', color: plotTheme.grid, width: 1 },
        });
      }
      for (const rank of RANK_THRESHOLDS) {
        if (rank.value < yMin || rank.value > TIER_PLOT_Y_MAX) continue;
        shapes.push({
          type: 'line',
          x0: -0.5,
          x1: nTiers - 0.5,
          y0: rank.value,
          y1: rank.value,
          xref: 'x',
          yref: 'y',
          line: { dash: 'dot', color: plotTheme.grid, width: 1.2 },
        });
        images.push({
          source: rank.icon,
          xref: 'paper',
          yref: 'paper',
          x: 1.01,
          y: (rank.value - yMin) / yRange,
          sizex: 0.08,
          sizey: 0.04,
          xanchor: 'left',
          yanchor: 'middle',
          sizing: 'contain',
          layer: 'above',
        });
      }

      const trace = {
        x: xValues,
        y: plotPoints.map((point) => point.y),
        mode: 'markers' as const,
        type: 'scatter' as const,
        text: plotPoints.map((point) => {
          const level = point.internalLevel === null ? '-' : point.internalLevel.toFixed(2);
          return `<b>${point.title}</b><br>Tier ${point.tier}<br>Lv ${level}<br>${point.y.toFixed(4)}%`;
        }),
        hoverinfo: 'text' as const,
        marker: {
          size: 11,
          color: plotPoints.map((point) => {
            const baseHex = colorMap.get(point.tierStep) ?? PALETTE[0];
            return hexToRgba(baseHex, ageAlpha(point.daysElapsed, DAYS_FILTER));
          }),
          line: { width: 0.6, color: plotTheme.markerOutline },
        },
      };

      const layout: Record<string, unknown> = {
        font: { family: FONT_FAMILY, color: plotTheme.text },
        xaxis: {
          range: [-0.5, nTiers - 0.5],
          tickvals: tierTicks.map((_, index) => index),
          ticktext: tierTicks.map(([, label]) => label),
          showgrid: false,
          zeroline: false,
          fixedrange: true,
          tickfont: { size: 11, color: plotTheme.text, family: FONT_FAMILY },
        },
        yaxis: {
          range: [yMin, TIER_PLOT_Y_MAX],
          tickformat: '.2f',
          showgrid: true,
          gridcolor: plotTheme.grid,
          zeroline: false,
          fixedrange: true,
          tickfont: { size: 11, color: plotTheme.text, family: FONT_FAMILY },
        },
        plot_bgcolor: plotTheme.bg,
        paper_bgcolor: plotTheme.paperBg,
        showlegend: false,
        margin: { l: 60, r: 110, t: 16, b: 46 },
        shapes,
        images,
        width: figWidth,
        height: 560,
        hoverlabel: {
          bgcolor: plotTheme.hoverBg,
          bordercolor: plotTheme.hoverBorder,
          font: { color: plotTheme.text, size: 12, family: FONT_FAMILY },
        },
        dragmode: false,
      };

      const config: Record<string, unknown> = {
        displayModeBar: false,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        doubleClick: false,
        staticPlot: false,
      };

      Plotly.react(el, [trace], layout, config);
    })();

    return () => {
      cancelled = true;
      void import('plotly.js-dist-min').then(({ default: P }) => P.purge(el));
    };
  }, [plotPoints, plotTheme, showPlot, tierTicks]);

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
            <button
              type="button"
              className="user-tier-plot-button"
              onClick={() => setShowPlot(true)}
            >
              {t('tiers.showPlot')}
            </button>
          </div>
        </section>

        {showPlot ? (
          <div className="modal-backdrop" onClick={() => setShowPlot(false)}>
            <section
              className="modal-card panel user-tier-plot-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="detail-header">
                <div>
                  <h2>{t('tiers.plotTitle')}</h2>
                  <p className="muted">{t('tiers.plotDescription')}</p>
                </div>
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={() => setShowPlot(false)}
                >
                  {t('common.close')}
                </button>
              </div>
              {plotPoints.length === 0 ? (
                <p className="muted user-tier-plot-empty">{t('tiers.plotEmpty')}</p>
              ) : (
                <div className="user-tier-plot-chart-container" ref={plotRef} />
              )}
            </section>
          </div>
        ) : null}

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
