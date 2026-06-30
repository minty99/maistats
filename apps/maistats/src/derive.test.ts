import { describe, expect, it } from 'vitest';

import {
  buildScoreHistoryPoints,
  buildSongDetailRows,
  toDateLabel,
} from './derive';
import type { PlaylogRow, ScoreRow } from './types';

function buildScoreRow(overrides: Partial<ScoreRow> = {}): ScoreRow {
  return {
    key: 'score-row',
    songKey: 'song-1',
    title: 'Song',
    genre: 'Genre',
    artist: 'Artist',
    aliases: {},
    chartType: 'DX',
    difficulty: 'MASTER',
    achievementX10000: 1005000,
    achievementPercent: 100.5,
    rank: 'SSS',
    fc: null,
    sync: null,
    dxScore: 1000,
    dxScoreMax: 1200,
    dxRatio: 0.8,
    rating: 15,
    level: '14+',
    internalLevel: 14.7,
    isInternalLevelEstimated: false,
    version: 'DX',
    imageName: null,
    latestPlayedAtUnix: 100,
    latestPlayedAtLabel: null,
    daysSinceLastPlayed: 1,
    playCount: 1,
    ...overrides,
  };
}

function buildPlaylogRow(key: string, achievementX10000: number): PlaylogRow {
  return {
    key,
    songKey: 'song-1',
    title: 'Song',
    genre: 'Genre',
    artist: 'Artist',
    aliases: {},
    chartType: 'DX',
    difficulty: 'MASTER',
    level: '14+',
    internalLevel: 14.7,
    isInternalLevelEstimated: false,
    playedAtUnix: 100,
    playedAtLabel: null,
    track: 1,
    achievementX10000,
    achievementPercent: achievementX10000 / 10000,
    rank: 'SSS',
    fc: null,
    sync: null,
    dxScore: 1000,
    dxScoreMax: 1200,
    dxRatio: 0.8,
    rating: 15,
    creditId: 1,
    isNewRecord: true,
    imageName: null,
  };
}

describe('buildScoreHistoryPoints', () => {
  it('keeps deterministic key ordering for tied timestamps', () => {
    const points = buildScoreHistoryPoints(
      [buildPlaylogRow('100-2', 1002000), buildPlaylogRow('100-1', 1001000)],
      buildScoreRow(),
    );

    expect(points.map((point) => point.key)).toEqual(['100-1', '100-2']);
  });
});

describe('buildSongDetailRows', () => {
  it('attaches matching user tier details', () => {
    const score = buildScoreRow({ key: 'song-chart-key' });
    const rows = buildSongDetailRows(
      [score],
      score.songKey,
      new Map([[score.key, { label: '13.0 A+ = 13.15', value: '13.15' }]]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.userTier).toEqual({ label: '13.0 A+ = 13.15', value: '13.15' });
  });
});

describe('toDateLabel', () => {
  it('formats using the provided locale', () => {
    expect(toDateLabel(0, 'en-US')).toContain('1970');
  });

  it('returns null for null timestamps', () => {
    expect(toDateLabel(null, 'en-US')).toBeNull();
  });
});
