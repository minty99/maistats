import type {
  ApiErrorResponse,
  PlayRecordApiResponse,
  ScoreApiResponse,
  SongDetailScoreApiResponse,
  SongInfoResponse,
  SongVersionsListResponse,
} from './types';

export interface ExplorerPayload {
  ratedScores: ScoreApiResponse[];
  playlogs: PlayRecordApiResponse[];
  versions: SongVersionsListResponse | null;
}

const RECENT_LIMIT = 10000;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function safeParseJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errJson = await safeParseJson<ApiErrorResponse>(response);
    const code = errJson?.code ? `[${errJson.code}] ` : '';
    const message = errJson?.message ?? response.statusText;
    throw new Error(`${code}${message} (HTTP ${response.status})`);
  }

  const data = await safeParseJson<T>(response);
  if (data === null) {
    throw new Error(`Non-JSON response from ${url}`);
  }
  return data;
}

export async function fetchExplorerPayload(
  songInfoBaseUrl: string,
  recordCollectorBaseUrl: string,
  signal?: AbortSignal,
): Promise<ExplorerPayload> {
  const songInfoBase = normalizeBaseUrl(songInfoBaseUrl);
  const recordBase = normalizeBaseUrl(recordCollectorBaseUrl);

  const [ratedScores, playlogs, versionsResult] = await Promise.all([
    getJson<ScoreApiResponse[]>(`${recordBase}/api/scores/rated`, signal),
    getJson<PlayRecordApiResponse[]>(`${recordBase}/api/recent?limit=${RECENT_LIMIT}`, signal),
    getJson<SongVersionsListResponse>(`${songInfoBase}/api/songs/versions`, signal).catch(
      () => null,
    ),
  ]);

  return {
    ratedScores,
    playlogs,
    versions: versionsResult,
  };
}

interface MetadataProgress {
  done: number;
  total: number;
}

interface FetchSongMetadataBatchParams {
  songInfoBaseUrl: string;
  titles: string[];
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: MetadataProgress) => void;
}

export async function fetchSongMetadataBatch({
  songInfoBaseUrl,
  titles,
  concurrency = 8,
  signal,
  onProgress,
}: FetchSongMetadataBatchParams): Promise<Map<string, SongInfoResponse>> {
  const songInfoBase = normalizeBaseUrl(songInfoBaseUrl);
  const dedupedTitles = Array.from(new Set(titles));
  const total = dedupedTitles.length;

  if (total === 0) {
    return new Map();
  }

  let index = 0;
  let done = 0;
  const metadata = new Map<string, SongInfoResponse>();

  const workerCount = Math.max(1, Math.min(concurrency, total));

  const worker = async () => {
    while (true) {
      if (signal?.aborted) {
        return;
      }

      const currentIndex = index;
      index += 1;
      if (currentIndex >= total) {
        return;
      }

      const title = dedupedTitles[currentIndex];
      try {
        const encoded = encodeURIComponent(title);
        const info = await getJson<SongInfoResponse>(
          `${songInfoBase}/api/songs/by-title/${encoded}`,
          signal,
        );
        metadata.set(normalizeTitleKey(info.title), info);
      } catch {
        // Ignore unresolved songs; score/playlog rows still render without metadata.
      } finally {
        done += 1;
        onProgress?.({ done, total });
      }
    }
  };

  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return metadata;
}

export function normalizeTitleKey(title: string): string {
  return title.trim().toLocaleLowerCase();
}

export function buildCoverUrl(songInfoBaseUrl: string, imageName: string): string {
  return `${normalizeBaseUrl(songInfoBaseUrl)}/api/cover/${encodeURIComponent(imageName)}`;
}

export async function fetchSongDetailScores(
  recordCollectorBaseUrl: string,
  title: string,
  signal?: AbortSignal,
): Promise<SongDetailScoreApiResponse[]> {
  const recordBase = normalizeBaseUrl(recordCollectorBaseUrl);
  const encodedTitle = encodeURIComponent(title);
  return getJson<SongDetailScoreApiResponse[]>(
    `${recordBase}/api/scores/detail/${encodedTitle}`,
    signal,
  );
}
