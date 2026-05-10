import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { buildCoverUrl } from '../api';
import { useI18n } from '../app/i18n';
import { daysSince, parseMaimaiPlayedAtToUnix } from '../app/maimaiTime';
import type {
  ScoreApiResponse,
  SongInfoResponse,
} from '../types';
import type { SongDetailTarget } from './TableActionCells';
import type { UserTierGroup } from './UserTierPage';

interface ScatterPlotPageProps {
  sidebarTopContent?: ReactNode;
  songInfoUrl: string;
  scoreRecords: ScoreApiResponse[];
  songMetadata: Map<string, SongInfoResponse>;
  userTierGroups: UserTierGroup[];
  isLoading?: boolean;
  onOpenSongDetail: (target: SongDetailTarget) => void;
}

interface PlotPoint {
  achievement: number;
  levelTenths: number;
  title: string;
  daysElapsed: number;
  imageName: string | null;
  lastPlayedAt: string | null;
  detailTarget: SongDetailTarget;
}

interface UserTierPlotPoint {
  achievement: number;
  tier: string;
  tierStep: number;
  title: string;
  internalLevel: number | null;
  daysElapsed: number;
  imageName: string | null;
  lastPlayedAt: string | null;
  detailTarget: SongDetailTarget;
}

interface HoverTooltipData {
  title: string;
  subtitle: string;
  achievement: string;
  lastPlayedAt: string;
  imageUrl: string | null;
  detailTarget: SongDetailTarget;
}

interface HoverTooltipState {
  x: number;
  y: number;
  data: HoverTooltipData;
}

interface PlotlyHoverEvent {
  event?: MouseEvent;
  points?: Array<{ customdata?: HoverTooltipData }>;
}

interface PlotlyClickEvent {
  points?: Array<{ customdata?: HoverTooltipData }>;
}

interface PlotlyElement extends HTMLDivElement {
  on?: (eventName: string, handler: (event: PlotlyHoverEvent | PlotlyClickEvent) => void) => void;
  removeListener?: (eventName: string, handler: (event: PlotlyHoverEvent | PlotlyClickEvent) => void) => void;
}

const RANK_THRESHOLDS: Array<{ value: number; icon: string }> = [
  { value: 97.0, icon: '/rank-icons/s.png' },
  { value: 98.0, icon: '/rank-icons/sp.png' },
  { value: 99.0, icon: '/rank-icons/ss.png' },
  { value: 99.5, icon: '/rank-icons/ssp.png' },
  { value: 100.0, icon: '/rank-icons/sss.png' },
  { value: 100.5, icon: '/rank-icons/sssp.png' },
];

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

// Marker fading window: recent plays are fully opaque, plays at the far end of
// the window fade toward MIN_ALPHA so they visibly recede into the background.
const MAX_ALPHA = 0.85;
const MIN_ALPHA = 0.25;

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

function coverUrl(songInfoUrl: string, imageName: string | null): string | null {
  return imageName ? buildCoverUrl(songInfoUrl, imageName) : null;
}

function PlotTooltip({ tooltip }: { tooltip: HoverTooltipState }) {
  const { t } = useI18n();
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    setIsImageLoaded(false);
  }, [tooltip.data.imageUrl]);

  return (
    <div
      className="scatter-plot-tooltip"
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      <div className="scatter-plot-tooltip-jacket">
        {tooltip.data.imageUrl ? (
          <>
            {!isImageLoaded ? (
              <span aria-hidden="true" />
            ) : null}
            <img
              key={tooltip.data.imageUrl}
              src={tooltip.data.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              hidden={!isImageLoaded}
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(false)}
            />
          </>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="scatter-plot-tooltip-body">
        <strong>{tooltip.data.title}</strong>
        <span>{tooltip.data.subtitle}</span>
        <span>{tooltip.data.achievement}</span>
        <span>{t('common.lastPlayed')}: {tooltip.data.lastPlayedAt}</span>
      </div>
    </div>
  );
}

interface PlotTheme {
  bg: string;
  paperBg: string;
  text: string;
  grid: string;
  laneSep: string;
  rankLine: string;
  markerOutline: string;
}

const DARK_PLOT_THEME: PlotTheme = {
  bg: '#16161f',
  paperBg: '#0f0f17',
  text: '#c8c8d0',
  grid: 'rgba(255,255,255,0.06)',
  laneSep: 'rgba(255,255,255,0.10)',
  rankLine: 'rgba(255,255,255,0.18)',
  markerOutline: 'rgba(0,0,0,0.35)',
};

const LIGHT_PLOT_THEME: PlotTheme = {
  bg: '#fafaf8',
  paperBg: '#f0f0ec',
  text: '#2a2a36',
  grid: 'rgba(0,0,0,0.06)',
  laneSep: 'rgba(0,0,0,0.10)',
  rankLine: 'rgba(0,0,0,0.22)',
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

    // Watch data-theme attribute on <html>
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Watch system preference
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', update);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);

  return theme;
}

const MIN_ACHIEVEMENT_FILTER = 90;
const DEFAULT_DAYS_FILTER = 30;
const DAYS_FILTER_OPTIONS = [7, 30, 60, 90, 180, 'max'] as const;
type DaysFilterOption = typeof DAYS_FILTER_OPTIONS[number];
const PLOT_LANE_WIDTH = 64;
const PLOT_FIXED_WIDTH = 220;
const PLOT_MIN_WIDTH = 450;
const PLOT_HEIGHT = 650;
const PLOT_MARGIN = { l: 60, r: 110, t: 20, b: 40 };
const MISSING_LAST_PLAYED_LABEL = '-';
const TIER_PLOT_X_MIN = 13.0;
const TIER_PLOT_X_MAX = 14.5;
const TIER_PLOT_Y_MAX = 101.0;
const TIER_PLOT_JITTER = 0.35;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ScatterPlotPage({
  sidebarTopContent,
  songInfoUrl,
  scoreRecords,
  songMetadata,
  userTierGroups,
  isLoading = false,
  onOpenSongDetail,
}: ScatterPlotPageProps) {
  const { t } = useI18n();
  const plotRef = useRef<HTMLDivElement>(null);
  const userTierPlotRef = useRef<HTMLDivElement>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);
  const effectiveTheme = useEffectiveTheme();
  const plotTheme = effectiveTheme === 'light' ? LIGHT_PLOT_THEME : DARK_PLOT_THEME;

  const [daysWindow, setDaysWindow] = useState<DaysFilterOption>(DEFAULT_DAYS_FILTER);

  const handleDaysWindowChange = useCallback((value: DaysFilterOption) => {
    setDaysWindow(value);
  }, []);

  const points = useMemo<PlotPoint[]>(() => {
    const metadataMap = new Map<string, { levelTenths: number; imageName: string | null }>();
    for (const [, song] of songMetadata) {
      for (const sheet of song.sheets) {
        if (sheet.internal_level != null) {
          const ilTenths = Math.round(sheet.internal_level * 10);
          const key = JSON.stringify([song.title, song.genre, song.artist, sheet.chart_type, sheet.difficulty]);
          metadataMap.set(key, { levelTenths: ilTenths, imageName: song.image_name });
        }
      }
    }

    const result: PlotPoint[] = [];
    for (const score of scoreRecords) {
      if (score.achievement_x10000 == null) continue;
      const achievementPercent = score.achievement_x10000 / 10000;
      if (achievementPercent < MIN_ACHIEVEMENT_FILTER) continue;

      if (!score.last_played_at) continue;
      const playedUnix = parseMaimaiPlayedAtToUnix(score.last_played_at);
      const elapsed = daysSince(playedUnix);
      if (elapsed == null || (daysWindow !== 'max' && elapsed > daysWindow)) continue;

      const key = JSON.stringify([score.title, score.genre, score.artist, score.chart_type, score.diff_category]);
      const metadata = metadataMap.get(key);
      if (!metadata) continue;

      result.push({
        achievement: achievementPercent,
        levelTenths: metadata.levelTenths,
        title: score.title,
        daysElapsed: elapsed,
        imageName: metadata.imageName,
        lastPlayedAt: score.last_played_at,
        detailTarget: {
          title: score.title,
          genre: score.genre,
          artist: score.artist,
        },
      });
    }

    return result;
  }, [scoreRecords, songMetadata, daysWindow]);

  const levels = useMemo(
    () => [...new Set(points.map((p) => p.levelTenths))].sort((a, b) => a - b),
    [points],
  );

  const userTierPoints = useMemo<UserTierPlotPoint[]>(() => {
    return userTierGroups.flatMap((group) =>
      group.rows
        .filter((item) =>
          item.score.achievementPercent !== null
          && item.score.achievementPercent >= MIN_ACHIEVEMENT_FILTER
          && item.score.daysSinceLastPlayed !== null
          && (daysWindow === 'max' || item.score.daysSinceLastPlayed <= daysWindow)
          && item.userTierStep / 100 >= TIER_PLOT_X_MIN
          && item.userTierStep / 100 <= TIER_PLOT_X_MAX
        )
        .map((item) => ({
          achievement: item.score.achievementPercent ?? 0,
          tier: item.userTier,
          tierStep: item.userTierStep,
          title: item.score.title,
          internalLevel: item.score.internalLevel,
          daysElapsed: item.score.daysSinceLastPlayed ?? 0,
          imageName: item.score.imageName,
          lastPlayedAt: item.score.latestPlayedAtLabel,
          detailTarget: item.score,
        })),
    );
  }, [userTierGroups, daysWindow]);

  const tierTicks = useMemo(() => {
    const ticks = new Map<number, string>();
    for (const group of userTierGroups) {
      const value = group.step / 100;
      if (value >= TIER_PLOT_X_MIN && value <= TIER_PLOT_X_MAX) {
        ticks.set(value, group.label);
      }
    }
    return Array.from(ticks.entries()).sort((left, right) => left[0] - right[0]);
  }, [userTierGroups]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || points.length === 0 || levels.length === 0) {
      return;
    }

    let cancelled = false;
    let plotlyInstance: typeof import('plotly.js-dist-min').default | null = null;
    let handleHover: ((event: PlotlyHoverEvent | PlotlyClickEvent) => void) | null = null;
    let handleUnhover: (() => void) | null = null;
    let handleClick: ((event: PlotlyHoverEvent | PlotlyClickEvent) => void) | null = null;

    void (async () => {
    const Plotly = (await import('plotly.js-dist-min')).default;
    plotlyInstance = Plotly;
    if (cancelled) return;

    const rng = mulberry32(42);
    const nLevels = levels.length;
    const levelIndexMap = new Map(levels.map((lt, i) => [lt, i]));
    const colorMap = new Map(levels.map((lt, i) => [lt, PALETTE[i % PALETTE.length]]));
    const JITTER = 0.35;

    const traces = levels.map((levelTenths) => {
      const group = points.filter((p) => p.levelTenths === levelTenths);
      const idx = levelIndexMap.get(levelTenths) ?? 0;

      const xVals = group.map(() => idx + (rng() * 2 - 1) * JITTER);
      const yVals = group.map((p) => p.achievement);
      const hoverPayloads: HoverTooltipData[] = group.map((p) => ({
        title: p.title,
        subtitle: `Lv ${(p.levelTenths / 10).toFixed(1)}`,
        achievement: `${p.achievement.toFixed(4)}%`,
        lastPlayedAt: p.lastPlayedAt ?? MISSING_LAST_PLAYED_LABEL,
        imageUrl: coverUrl(songInfoUrl, p.imageName),
        detailTarget: p.detailTarget,
      }));
      const baseHex = colorMap.get(levelTenths) ?? PALETTE[0];
      const colors = group.map((p) => hexToRgba(baseHex, daysWindow === 'max' ? MAX_ALPHA : ageAlpha(p.daysElapsed, daysWindow)));

      return {
        x: xVals,
        y: yVals,
        mode: 'markers' as const,
        type: 'scatter' as const,
        name: `Lv ${(levelTenths / 10).toFixed(1)}`,
        customdata: hoverPayloads,
        hoverinfo: 'none' as const,
        marker: {
          size: 11,
          color: colors,
          line: { width: 0.6, color: plotTheme.markerOutline },
        },
      };
    });

    const minAchievement = Math.min(...points.map((p) => p.achievement));
    const yMin = Math.min(minAchievement, 100.5);

    const shapes: Array<Record<string, unknown>> = [];

    // Lane separators
    for (let i = 1; i < nLevels; i++) {
      shapes.push({
        type: 'line',
        x0: i - 0.5,
        x1: i - 0.5,
        y0: yMin,
        y1: 101.0,
        xref: 'x',
        yref: 'y',
        line: { dash: 'dash', color: plotTheme.laneSep, width: 1 },
      });
    }

    // Rank threshold lines
    const images: Array<Record<string, unknown>> = [];
    const yRange = 101.0 - yMin;
    for (const rank of RANK_THRESHOLDS) {
      if (rank.value < yMin || rank.value > 101.0) continue;
      shapes.push({
        type: 'line',
        x0: -0.5,
        x1: nLevels - 0.5,
        y0: rank.value,
        y1: rank.value,
        xref: 'x',
        yref: 'y',
        line: { dash: 'dot', color: plotTheme.rankLine, width: 1.2 },
      });
      const paperY = (rank.value - yMin) / yRange;
      images.push({
        source: rank.icon,
        xref: 'paper',
        yref: 'paper',
        x: 1.01,
        y: paperY,
        sizex: 0.08,
        sizey: 0.04,
        xanchor: 'left',
        yanchor: 'middle',
        sizing: 'contain',
        layer: 'above',
      });
    }

    const figWidth = Math.max(PLOT_MIN_WIDTH, PLOT_LANE_WIDTH * nLevels + PLOT_FIXED_WIDTH);

    // Match the rest of the app — Pretendard with the same fallback chain
    // used in styles.css.
    const FONT_FAMILY = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

    const layout: Record<string, unknown> = {
      font: { family: FONT_FAMILY, color: plotTheme.text },
      xaxis: {
        range: [-0.5, nLevels - 0.5],
        tickvals: levels.map((_, i) => i),
        ticktext: levels.map((lt) => `${(lt / 10).toFixed(1)}`),
        showgrid: false,
        zeroline: false,
        fixedrange: true,
        tickfont: { size: 11, color: plotTheme.text, family: FONT_FAMILY },
      },
      yaxis: {
        range: [yMin, 101.0],
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
      margin: PLOT_MARGIN,
      shapes,
      images,
      width: figWidth,
      height: PLOT_HEIGHT,
      dragmode: false,
    };

    const config: Record<string, unknown> = {
      displayModeBar: false,
      displaylogo: false,
      responsive: false,
      scrollZoom: false,
      doubleClick: false,
      staticPlot: false,
    };

    Plotly.react(el, traces, layout, config);

    const plotElement = el as PlotlyElement;
    handleHover = (event: PlotlyHoverEvent) => {
      const data = event.points?.[0]?.customdata;
      if (!data || !event.event) return;
      setHoverTooltip({ x: event.event.clientX, y: event.event.clientY, data });
    };
    handleUnhover = () => setHoverTooltip(null);
    handleClick = (event: PlotlyHoverEvent | PlotlyClickEvent) => {
      const data = event.points?.[0]?.customdata;
      if (!data) return;
      setHoverTooltip(null);
      onOpenSongDetail(data.detailTarget);
    };
    plotElement.on?.('plotly_hover', handleHover);
    plotElement.on?.('plotly_unhover', handleUnhover);
    plotElement.on?.('plotly_click', handleClick);
    })();

    return () => {
      cancelled = true;
      setHoverTooltip(null);
      const plotElement = el as PlotlyElement;
      if (handleHover) plotElement.removeListener?.('plotly_hover', handleHover);
      if (handleUnhover) plotElement.removeListener?.('plotly_unhover', handleUnhover);
      if (handleClick) plotElement.removeListener?.('plotly_click', handleClick);
      plotlyInstance?.purge(el);
    };
  }, [points, levels, plotTheme, daysWindow, songInfoUrl, onOpenSongDetail]);

  useEffect(() => {
    const el = userTierPlotRef.current;
    if (!el || userTierPoints.length === 0 || tierTicks.length === 0) {
      return;
    }

    let cancelled = false;
    let plotlyInstance: typeof import('plotly.js-dist-min').default | null = null;
    let handleHover: ((event: PlotlyHoverEvent | PlotlyClickEvent) => void) | null = null;
    let handleUnhover: (() => void) | null = null;
    let handleClick: ((event: PlotlyHoverEvent | PlotlyClickEvent) => void) | null = null;

    void (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      plotlyInstance = Plotly;
      if (cancelled) return;

      const FONT_FAMILY = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      const rng = mulberry32(42);
      const nTiers = tierTicks.length;
      const tierIndexMap = new Map(tierTicks.map(([tier], index) => [Math.round(tier * 100), index]));
      const colorMap = new Map(
        tierTicks.map(([tier], index) => [Math.round(tier * 100), PALETTE[index % PALETTE.length]]),
      );
      const xValues = userTierPoints.map((point) => {
        const index = tierIndexMap.get(point.tierStep) ?? 0;
        return index + (rng() * 2 - 1) * TIER_PLOT_JITTER;
      });
      const yValues = userTierPoints.map((point) => point.achievement);
      const yMin = Math.min(Math.min(...yValues), 100.5);
      const yRange = TIER_PLOT_Y_MAX - yMin;
      const figWidth = Math.max(PLOT_MIN_WIDTH, PLOT_LANE_WIDTH * nTiers + PLOT_FIXED_WIDTH);
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
          line: { dash: 'dash', color: plotTheme.laneSep, width: 1 },
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
          line: { dash: 'dot', color: plotTheme.rankLine, width: 1.2 },
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
        y: userTierPoints.map((point) => point.achievement),
        mode: 'markers' as const,
        type: 'scatter' as const,
        customdata: userTierPoints.map((point): HoverTooltipData => ({
          title: point.title,
          subtitle: `Tier ${point.tier} / Lv ${point.internalLevel === null ? '-' : point.internalLevel.toFixed(1)}`,
          achievement: `${point.achievement.toFixed(4)}%`,
          lastPlayedAt: point.lastPlayedAt ?? MISSING_LAST_PLAYED_LABEL,
          imageUrl: coverUrl(songInfoUrl, point.imageName),
          detailTarget: point.detailTarget,
        })),
        hoverinfo: 'none' as const,
        marker: {
          size: 11,
          color: userTierPoints.map((point) => {
            const baseHex = colorMap.get(point.tierStep) ?? PALETTE[0];
            return hexToRgba(baseHex, daysWindow === 'max' ? MAX_ALPHA : ageAlpha(point.daysElapsed, daysWindow));
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
        margin: PLOT_MARGIN,
        shapes,
        images,
        width: figWidth,
        height: PLOT_HEIGHT,
        dragmode: false,
      };

      const config: Record<string, unknown> = {
        displayModeBar: false,
        displaylogo: false,
        responsive: false,
        scrollZoom: false,
        doubleClick: false,
        staticPlot: false,
      };

      Plotly.react(el, [trace], layout, config);

      const plotElement = el as PlotlyElement;
      handleHover = (event: PlotlyHoverEvent) => {
        const data = event.points?.[0]?.customdata;
        if (!data || !event.event) return;
        setHoverTooltip({ x: event.event.clientX, y: event.event.clientY, data });
      };
      handleUnhover = () => setHoverTooltip(null);
      handleClick = (event: PlotlyHoverEvent | PlotlyClickEvent) => {
        const data = event.points?.[0]?.customdata;
        if (!data) return;
        setHoverTooltip(null);
        onOpenSongDetail(data.detailTarget);
      };
      plotElement.on?.('plotly_hover', handleHover);
      plotElement.on?.('plotly_unhover', handleUnhover);
      plotElement.on?.('plotly_click', handleClick);
    })();

    return () => {
      cancelled = true;
      setHoverTooltip(null);
      const plotElement = el as PlotlyElement;
      if (handleHover) plotElement.removeListener?.('plotly_hover', handleHover);
      if (handleUnhover) plotElement.removeListener?.('plotly_unhover', handleUnhover);
      if (handleClick) plotElement.removeListener?.('plotly_click', handleClick);
      plotlyInstance?.purge(el);
    };
  }, [userTierPoints, plotTheme, tierTicks, daysWindow, songInfoUrl, onOpenSongDetail]);

  return (
    <section className="scatter-plot-layout">
      <div className="scatter-plot-sidebar">
        {sidebarTopContent}
      </div>
      <section className="scatter-plot-section panel">
        <h2 className="section-heading">{t('plot.title')}</h2>
        <p className="muted scatter-plot-description">{t('plot.description')}</p>

        <div className="scatter-plot-controls">
          <div className="scatter-plot-days-control">
            <span className="scatter-plot-days-title">{t('plot.daysWindow')}</span>
            <div className="scatter-plot-days-options" role="group" aria-label={t('plot.daysWindow')}>
              {DAYS_FILTER_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="scatter-plot-days-option"
                  aria-pressed={daysWindow === value}
                  onClick={() => handleDaysWindowChange(value)}
                >
                  {value === 'max' ? t('plot.daysMax') : t('plot.daysValue', { count: value })}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && points.length === 0 ? (
          <p className="muted scatter-plot-empty">{t('common.loadingCharts')}</p>
        ) : points.length === 0 ? (
          <p className="muted scatter-plot-empty">{t('plot.empty')}</p>
        ) : (
          <div className="scatter-plot-chart-container" ref={plotRef} />
        )}
      </section>
      <section className="scatter-plot-section panel scatter-plot-main-column">
        <h2 className="section-heading">{t('plot.userTierTitle')}</h2>
        <p className="muted scatter-plot-description">{t('plot.userTierDescription')}</p>
        {isLoading && userTierPoints.length === 0 ? (
          <p className="muted scatter-plot-empty">{t('common.loadingCharts')}</p>
        ) : userTierPoints.length === 0 ? (
          <p className="muted scatter-plot-empty">{t('plot.userTierEmpty')}</p>
        ) : (
          <div className="scatter-plot-chart-container" ref={userTierPlotRef} />
        )}
      </section>
      {hoverTooltip ? <PlotTooltip tooltip={hoverTooltip} /> : null}
    </section>
  );
}
