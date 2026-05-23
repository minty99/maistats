import type { ReactNode } from 'react';

import { useI18n } from '../app/i18n';
import { HomeFooter } from './HomeFooter';
import { RecordCollectorConnectPanel } from './RecordCollectorConnectPanel';

const DISCORD_OAUTH_URL =
  'https://discord.com/oauth2/authorize?client_id=1463175635974361183';
const DISCORD_SUPPORT_URL = 'https://discord.gg/6d7QamA297';

interface HomePageProps {
  sidebarTopContent?: ReactNode;
  recordCollectorUrl: string;
  onConnect: (url: string) => void;
  onNavigateToSetup: () => void;
  onNavigateToScores: () => void;
}

export function HomePage({
  sidebarTopContent,
  recordCollectorUrl,
  onConnect,
  onNavigateToSetup,
  onNavigateToScores,
}: HomePageProps) {
  const { t } = useI18n();

  return (
    <div className="explorer-layout">
      <aside className="sidebar-column">{sidebarTopContent}</aside>

      <div className="table-column home-content">
        <RecordCollectorConnectPanel
          recordCollectorUrl={recordCollectorUrl}
          title={t('home.quickStart.title')}
          submitLabel={t('home.quickStart.submit')}
          onConnect={onConnect}
          onNavigateToScores={onNavigateToScores}
        />

        <section className="panel home-welcome-panel">
          <h2>{t('home.welcome.title')}</h2>
          <p>{t('home.intro.description')}</p>

          <section className="home-menu-section">
            <h3>{t('home.menu.title')}</h3>
            <div className="home-menu-list">
              <button type="button" className="home-menu-item" onClick={onNavigateToSetup}>
                <span className="home-menu-index">01</span>
                <span>{t('home.startCard.title')}</span>
              </button>

              <a
                href={DISCORD_OAUTH_URL}
                target="_blank"
                rel="noreferrer"
                className="home-menu-item"
              >
                <span className="home-menu-index">02</span>
                <span>{t('home.discordCard.title')}</span>
              </a>

              <a
                href={DISCORD_SUPPORT_URL}
                target="_blank"
                rel="noreferrer"
                className="home-menu-item"
              >
                <span className="home-menu-index">03</span>
                <span>{t('home.supportCard.title')}</span>
              </a>
            </div>
          </section>
        </section>

        <HomeFooter />
      </div>
    </div>
  );
}
