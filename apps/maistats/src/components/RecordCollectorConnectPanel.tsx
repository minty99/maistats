import { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkRecordCollectorHealth,
  formatApiErrorMessage,
  LocalizedApiError,
} from '../api';
import { useI18n } from '../app/i18n';

interface RecordCollectorConnectPanelProps {
  recordCollectorUrl: string;
  title: string;
  description?: string;
  submitLabel?: string;
  onConnect: (url: string) => void;
  onNavigateToScores: () => void;
}

export function RecordCollectorConnectPanel({
  recordCollectorUrl,
  title,
  description,
  submitLabel,
  onConnect,
  onNavigateToScores,
}: RecordCollectorConnectPanelProps) {
  const { t } = useI18n();
  const [urlDraft, setUrlDraft] = useState(recordCollectorUrl || '');
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [connectedPlayer, setConnectedPlayer] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setUrlDraft(recordCollectorUrl || '');
  }, [recordCollectorUrl]);

  const handleConnect = useCallback(async () => {
    const url = urlDraft.trim();
    if (!url) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsChecking(true);
    setCheckError(null);
    setConnectedPlayer(null);

    try {
      const profile = await checkRecordCollectorHealth(url, controller.signal);
      if (controller.signal.aborted) return;
      setConnectedPlayer(profile.user_name);
      onConnect(url);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = formatApiErrorMessage(error, t);
      setCheckError(
        error instanceof LocalizedApiError && !error.shouldWrap
          ? message
          : t('home.connect.failed', { message }),
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsChecking(false);
      }
    }
  }, [onConnect, t, urlDraft]);

  return (
    <section className="panel home-connect-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>

      <div className="home-connect-row">
        <label className="home-url-field">
          <span>{t('home.connect.serverUrl')}</span>
          <input
            type="url"
            value={urlDraft}
            placeholder={t('home.connect.placeholder')}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleConnect();
            }}
            disabled={isChecking}
          />
        </label>
        <button
          type="button"
          className="home-connect-btn"
          onClick={() => void handleConnect()}
          disabled={isChecking || !urlDraft.trim()}
        >
          {isChecking ? t('common.connecting') : (submitLabel ?? t('common.connect'))}
        </button>
      </div>

      {checkError ? <p className="home-status home-status-error">{checkError}</p> : null}
      {connectedPlayer ? (
        <div className="home-status home-status-success">
          <span>{t('home.connect.success', { name: connectedPlayer })}</span>
          <button type="button" className="home-goto-btn" onClick={onNavigateToScores}>
            {t('home.connect.goToScores')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
