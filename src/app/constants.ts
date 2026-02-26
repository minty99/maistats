import type { ChartType, DifficultyCategory, FcStatus, ScoreRank, SyncStatus } from '../types';

export const SONG_INFO_STORAGE_KEY = 'maistats.song-info-url';
export const RECORD_STORAGE_KEY = 'maistats.record-url';
export const SCORE_FILTERS_STORAGE_KEY = 'maistats.score-filters';
export const PLAYLOG_FILTERS_STORAGE_KEY = 'maistats.playlog-filters';

const ENV_SONG_INFO_URL = import.meta.env.VITE_SONG_INFO_SERVER_URL?.trim();
const ENV_RECORD_COLLECTOR_URL =
  import.meta.env.VITE_RECORD_COLLECTOR_SERVER_URL?.trim();

export const DEFAULT_SONG_INFO_URL =
  ENV_SONG_INFO_URL || 'http://localhost:3001';
export const DEFAULT_RECORD_COLLECTOR_URL =
  ENV_RECORD_COLLECTOR_URL || 'http://localhost:3000';

export const CHART_TYPES: ChartType[] = ['STD', 'DX'];
export const DIFFICULTIES: DifficultyCategory[] = [
  'BASIC',
  'ADVANCED',
  'EXPERT',
  'MASTER',
  'Re:MASTER',
];

export const VERSION_ORDER = [
  'maimai',
  'maimai PLUS',
  'GreeN',
  'GreeN PLUS',
  'ORANGE',
  'ORANGE PLUS',
  'PiNK',
  'PiNK PLUS',
  'MURASAKi',
  'MURASAKi PLUS',
  'MiLK',
  'MiLK PLUS',
  'FiNALE',
  'maimaiでらっくす',
  'maimaiでらっくす PLUS',
  'Splash',
  'Splash PLUS',
  'UNiVERSE',
  'UNiVERSE PLUS',
  'FESTiVAL',
  'FESTiVAL PLUS',
  'BUDDiES',
  'BUDDiES PLUS',
  'PRiSM',
  'PRiSM PLUS',
  'CiRCLE',
] as const;

export const SCORE_RANK_ORDER: ScoreRank[] = [
  'SSS+',
  'SSS',
  'SS+',
  'SS',
  'S+',
  'S',
  'AAA',
  'AA',
  'A',
  'BBB',
  'BB',
  'B',
  'C',
  'D',
];

export const RANK_FILTER_AAA_OR_BELOW_LABEL = '~AAA';
export const AAA_OR_BELOW_RANKS: ScoreRank[] = SCORE_RANK_ORDER.slice(
  SCORE_RANK_ORDER.indexOf('AAA'),
);

export const FC_ORDER: FcStatus[] = ['AP+', 'AP', 'FC+', 'FC'];
export const SYNC_ORDER: SyncStatus[] = ['FDX+', 'FDX', 'FS+', 'FS', 'SYNC'];

export const VERSION_ORDER_MAP = new Map(VERSION_ORDER.map((value, index) => [value, index]));
export const SCORE_RANK_ORDER_MAP = new Map(
  SCORE_RANK_ORDER.map((value, index) => [value, index]),
);
export const FC_ORDER_MAP = new Map(FC_ORDER.map((value, index) => [value, index]));
export const SYNC_ORDER_MAP = new Map(SYNC_ORDER.map((value, index) => [value, index]));

export type ActiveTab = 'scores' | 'playlogs';

export type ScoreSortKey =
  | 'title'
  | 'achievement'
  | 'days'
  | 'internal'
  | 'dxRatio'
  | 'lastPlayed';

export type PlaylogSortKey = 'playedAt' | 'achievement' | 'dxRatio' | 'title';
