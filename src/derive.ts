import type {
  ChartType,
  DifficultyCategory,
  PlayAgg,
  PlayRecordApiResponse,
  PlaylogRow,
  ScoreApiResponse,
  ScoreRow,
  SongInfoResponse,
} from './types';
import { normalizeTitleKey } from './api';

export function chartKey(
  title: string,
  chartType: ChartType,
  difficulty: DifficultyCategory,
): string {
  return `${normalizeTitleKey(title)}::${chartType}::${difficulty}`;
}

function toUnixMillis(unixtime: number): number {
  if (unixtime > 10_000_000_000) {
    return unixtime;
  }
  return unixtime * 1000;
}

export function toDateLabel(unixtime: number | null): string | null {
  if (unixtime === null) {
    return null;
  }

  const ms = toUnixMillis(unixtime);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toAchievementPercent(achievementX10000: number | null): number | null {
  if (achievementX10000 === null) {
    return null;
  }
  return achievementX10000 / 10000;
}

export function toDxRatio(dxScore: number | null, dxScoreMax: number | null): number | null {
  if (dxScore === null || dxScoreMax === null || dxScoreMax <= 0) {
    return null;
  }
  return dxScore / dxScoreMax;
}

export function daysSince(unixtime: number | null): number | null {
  if (unixtime === null) {
    return null;
  }
  const ms = toUnixMillis(unixtime);
  const diffMs = Date.now() - ms;
  if (diffMs < 0) {
    return 0;
  }
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function buildPlayAggMap(playlogs: PlayRecordApiResponse[]): Map<string, PlayAgg> {
  const aggMap = new Map<string, PlayAgg>();

  for (const log of playlogs) {
    if (log.diff_category === null) {
      continue;
    }

    const key = chartKey(log.title, log.chart_type, log.diff_category);
    const current = aggMap.get(key);
    if (!current) {
      aggMap.set(key, {
        latestPlayedAtUnix: log.played_at_unixtime,
        latestPlayedAtLabel: log.played_at,
      });
      continue;
    }

    if (log.played_at_unixtime > current.latestPlayedAtUnix) {
      current.latestPlayedAtUnix = log.played_at_unixtime;
      current.latestPlayedAtLabel = log.played_at;
    }

  }

  return aggMap;
}

export function buildScoreRows(
  scores: ScoreApiResponse[],
  playAggMap: Map<string, PlayAgg>,
  songInfoByTitle: Map<string, SongInfoResponse>,
): ScoreRow[] {
  return scores.map((score) => {
    const normalizedTitle = normalizeTitleKey(score.title);
    const key = chartKey(score.title, score.chart_type, score.diff_category);

    const songInfo = songInfoByTitle.get(normalizedTitle);
    const sheet = songInfo?.sheets.find(
      (item) =>
        item.chart_type === score.chart_type && item.difficulty === score.diff_category,
    );

    const playAgg = playAggMap.get(key);

    const latestPlayedAtUnix = playAgg?.latestPlayedAtUnix ?? null;

    return {
      key,
      title: score.title,
      normalizedTitle,
      chartType: score.chart_type,
      difficulty: score.diff_category,
      achievementX10000: score.achievement_x10000,
      achievementPercent: toAchievementPercent(score.achievement_x10000),
      rank: score.rank,
      fc: score.fc,
      sync: score.sync,
      dxScore: score.dx_score,
      dxScoreMax: score.dx_score_max,
      dxRatio: toDxRatio(score.dx_score, score.dx_score_max),
      level: sheet?.level ?? null,
      internalLevel: sheet?.internal_level ?? null,
      userLevel: sheet?.user_level ?? null,
      version: sheet?.version ?? null,
      imageName: songInfo?.image_name ?? null,
      latestPlayedAtUnix,
      latestPlayedAtLabel: playAgg?.latestPlayedAtLabel ?? toDateLabel(latestPlayedAtUnix),
      daysSinceLastPlayed: daysSince(latestPlayedAtUnix),
    };
  });
}

export function buildPlaylogRows(
  playlogs: PlayRecordApiResponse[],
  songInfoByTitle: Map<string, SongInfoResponse>,
): PlaylogRow[] {
  return playlogs.map((log, index) => {
    const normalizedTitle = normalizeTitleKey(log.title);
    const songInfo = songInfoByTitle.get(normalizedTitle);

    return {
      key: `${log.played_at_unixtime}-${index}`,
      title: log.title,
      normalizedTitle,
      chartType: log.chart_type,
      difficulty: log.diff_category,
      playedAtUnix: log.played_at_unixtime,
      playedAtLabel: log.played_at ?? toDateLabel(log.played_at_unixtime),
      track: log.track,
      achievementX10000: log.achievement_x10000,
      achievementPercent: toAchievementPercent(log.achievement_x10000),
      rank: log.score_rank,
      fc: log.fc,
      sync: log.sync,
      dxScore: log.dx_score,
      dxScoreMax: log.dx_score_max,
      dxRatio: toDxRatio(log.dx_score, log.dx_score_max),
      creditPlayCount: log.credit_play_count,
      isNewRecord: (log.achievement_new_record ?? 0) > 0,
      isFirstPlay: (log.first_play ?? 0) > 0,
      imageName: songInfo?.image_name ?? null,
    };
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
