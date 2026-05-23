import type { ReactNode } from 'react';

import { useI18n } from '../app/i18n';
import { RecordCollectorConnectPanel } from './RecordCollectorConnectPanel';

const COMPOSE_YAML = `name: maistats-record-collector

services:
  maistats-record-collector:
    image: ghcr.io/minty99/maistats-record-collector:latest
    container_name: maistats-record-collector
    ports:
      - "\${MAISTATS_HOST_PORT:-3000}:3000"
    environment:
      SEGA_ID: \${SEGA_ID}
      SEGA_PASSWORD: \${SEGA_PASSWORD}
      RECORD_COLLECTOR_PORT: "3000"
      DATA_DIR: /app/data
      DATABASE_URL: sqlite:/app/data/records.sqlite3
      RUST_LOG: \${RUST_LOG:-info}
    volumes:
      - ./data:/app/data
    restart: unless-stopped`;

interface SetupGuidePageProps {
  sidebarTopContent?: ReactNode;
  recordCollectorUrl: string;
  onConnect: (url: string) => void;
  onNavigateToScores: () => void;
}

export function SetupGuidePage({
  sidebarTopContent,
  recordCollectorUrl,
  onConnect,
  onNavigateToScores,
}: SetupGuidePageProps) {
  const { t } = useI18n();

  return (
    <div className="explorer-layout">
      <aside className="sidebar-column">{sidebarTopContent}</aside>

      <div className="table-column home-content">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{t('home.guide.title')}</h2>
            </div>
          </div>

          <div className="home-steps">
            <article className="home-step">
              <div className="home-step-num">1</div>
              <div className="home-step-body">
                <strong>{t('home.guide.prerequisiteTitle')}</strong>
                <p>{t('home.guide.prerequisiteBody')}</p>
              </div>
            </article>

            <article className="home-step">
              <div className="home-step-num">2</div>
              <div className="home-step-body">
                <strong>{t('home.guide.step1Title')}</strong>
                <p>
                  {t('home.guide.step1BodyA')}
                  <code>compose.yaml</code>
                  {t('home.guide.step1BodyB')}
                  <code>SEGA_ID</code>
                  {t('home.guide.step1BodyC')}
                  <code>SEGA_PASSWORD</code>
                  {t('home.guide.step1BodyD')}
                </p>
                <pre className="home-code">{COMPOSE_YAML}</pre>
                <p>{t('home.guide.step1Port')}</p>
              </div>
            </article>

            <article className="home-step">
              <div className="home-step-num">3</div>
              <div className="home-step-body">
                <strong>{t('home.guide.step2Title')}</strong>
                <p>
                  {t('home.guide.step2BodyA')}
                  <code>compose.yaml</code>
                  {t('home.guide.step2BodyB')}
                </p>
                <pre className="home-code">docker compose up -d</pre>
                <p>{t('home.guide.step2BodyC')}</p>
              </div>
            </article>

            <article className="home-step">
              <div className="home-step-num">4</div>
              <div className="home-step-body">
                <strong>{t('home.guide.step3Title')}</strong>
                <p>{t('home.guide.step3Body')}</p>
              </div>
            </article>

            <article className="home-step">
              <div className="home-step-num">5</div>
              <div className="home-step-body">
                <strong>{t('home.guide.step4Title')}</strong>
                <p>
                  {t('home.guide.step4BodyA')}
                  <strong>{t('common.connect')}</strong>
                  {t('home.guide.step4BodyB')}
                </p>
              </div>
            </article>
          </div>
        </section>

        <RecordCollectorConnectPanel
          recordCollectorUrl={recordCollectorUrl}
          title={t('home.connect.title')}
          description={t('home.connect.description')}
          onConnect={onConnect}
          onNavigateToScores={onNavigateToScores}
        />
      </div>
    </div>
  );
}
