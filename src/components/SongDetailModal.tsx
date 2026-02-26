import type { SongDetailScoreApiResponse } from '../types';
import { formatDifficultyShort, formatNumber, formatPercent } from '../app/utils';

interface SongDetailModalProps {
  selectedDetailTitle: string | null;
  selectedDetailRows: SongDetailScoreApiResponse[];
  detailLoading: boolean;
  detailError: string | null;
  onClose: () => void;
}

export function SongDetailModal({
  selectedDetailTitle,
  selectedDetailRows,
  detailLoading,
  detailError,
  onClose,
}: SongDetailModalProps) {
  if (!selectedDetailTitle) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card panel" onClick={(event) => event.stopPropagation()}>
        <h2>Song Detail</h2>
        <div className="detail-content">
          <div className="detail-header">
            <strong>{selectedDetailTitle}</strong>
            <button type="button" onClick={onClose}>
              닫기
            </button>
          </div>
          <p className="muted">
            `play_count`는 playlogs 추정치가 아니라 maimai 상세 페이지 파싱 결과입니다.
          </p>
          {detailLoading ? <p>상세 정보를 불러오는 중...</p> : null}
          {detailError ? <p className="error-inline">에러: {detailError}</p> : null}
          {!detailLoading && !detailError && selectedDetailRows.length === 0 ? (
            <p className="muted">조회 가능한 상세 데이터가 없습니다.</p>
          ) : null}
          {!detailLoading && !detailError ? (
            <div className="table-wrap">
              <table className="detail-table compact-table">
                <thead>
                  <tr>
                    <th>Chart</th>
                    <th>Diff</th>
                    <th>Achv</th>
                    <th>Rank</th>
                    <th>FC</th>
                    <th>Sync</th>
                    <th>DX</th>
                    <th>Last Played</th>
                    <th>Play Count</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetailRows.map((row) => (
                    <tr key={`${row.chart_type}-${row.diff_category}`}>
                      <td>{row.chart_type}</td>
                      <td>{formatDifficultyShort(row.diff_category)}</td>
                      <td>
                        {formatPercent(
                          row.achievement_x10000 === undefined || row.achievement_x10000 === null
                            ? null
                            : row.achievement_x10000 / 10000,
                        )}
                      </td>
                      <td>{row.rank ?? '-'}</td>
                      <td>{row.fc ?? '-'}</td>
                      <td>{row.sync ?? '-'}</td>
                      <td>
                        {formatNumber(row.dx_score ?? null)} / {formatNumber(row.dx_score_max ?? null)}
                      </td>
                      <td>{row.last_played_at ?? '-'}</td>
                      <td>{row.play_count ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
