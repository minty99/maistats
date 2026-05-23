import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type SupportedLanguage = 'ko' | 'en';
export type LanguagePreference = 'system' | SupportedLanguage;

export const LANGUAGE_STORAGE_KEY = 'maistats.language';

const LOCALE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

function defineTranslations<T extends Record<string, string>>(value: {
  ko: T;
  en: { [K in keyof T]: string };
}) {
  return value;
}

const translations = defineTranslations({
  ko: {
    'nav.home': 'Home',
    'nav.setup': 'Setup',
    'nav.scores': 'Scores',
    'nav.rating': 'Rating',
    'nav.tiers': 'User Tier',
    'nav.playlogs': 'Playlogs',
    'nav.plot': 'Plot',
    'nav.settings': 'Settings',
    'nav.primary': 'Primary',
    'nav.openPages': '페이지 목록 열기',
    'common.filters': 'Filters',
    'common.chartTraits': '채보 특성',
    'common.recordTraits': '기록 특성',
    'common.close': '닫기',
    'common.connect': '연결',
    'common.connecting': '연결 중...',
    'common.all': 'ALL',
    'common.apply': '적용',
    'common.search': '검색',
    'common.loadingCharts': '차트 불러오는 중...',
    'common.loadingPlaylogs': '플레이 기록 불러오는 중...',
    'common.loadingVersions': '버전 불러오는 중...',
    'common.jacket': 'Jacket',
    'common.title': 'Title',
    'common.chart': 'Chart',
    'common.levelShort': 'Lv',
    'common.achievementShort': 'Achv',
    'common.rating': 'Rating',
    'common.rank': 'Rank',
    'common.fc': 'FC',
    'common.sync': 'Sync',
    'common.dx': 'DX',
    'common.lastPlayed': 'Last Played',
    'common.playCount': 'Play Count',
    'common.version': 'Version',
    'common.track': 'Track',
    'common.type': 'Type',
    'common.diff': 'Diff',
    'common.achievement': 'Achievement',
    'common.error': '에러',
    'common.min': 'MIN',
    'common.max': 'MAX',
    'common.from': 'FROM',
    'common.to': 'TO',
    'common.none': '없음',
    'common.ready': 'Ready',
    'units.songs': '{{count}}곡',
    'units.credits': '{{count}} 크레딧',
    'units.daysAgo': '{{count}}일 전',
    'player.connected': 'Connected player',
    'player.totalPlayCount': 'Total play count',
    'player.refresh': '최신 기록 갱신',
    'player.refreshing': '최신 기록을 가져오는 중...',
    'home.connect.title': '개인 기록 수집 서버 연결',
    'home.connect.description': '개인 기록 수집 서버 URL을 입력하고 연결을 확인합니다.',
    'home.connect.serverUrl': '서버 URL',
    'home.connect.placeholder': 'https://your-server.example.com',
    'home.connect.failed': '연결 실패: {{message}}',
    'home.connect.success': '연결 성공! 플레이어: {{name}}',
    'home.connect.goToScores': 'Scores로 이동 →',
    'home.quickStart.title': '첫 방문이 아니신가요?',
    'home.quickStart.submit': '로그인',
    'home.welcome.title': 'Welcome to maistats!',
    'home.intro.description': 'maistats는 개인 서버를 활용해서 자신의 maimai 플레이 기록을 추적하고, 통계를 만들어 관리할 수 있도록 돕는 서비스입니다.',
    'home.intro.helper': '개인 기록 수집 서버를 직접 운영하는 환경을 전제로 하며, 처음이라면 설정 가이드부터 확인하면 됩니다.',
    'home.menu.title': 'Quickstart',
    'home.startCard.title': '개인 기록 수집 서버 설정하기',
    'home.discordCard.title': 'Discord Bot 추가하기',
    'home.supportCard.title': '지원 서버 참여하기',
    'home.openSetup': '설정 가이드 보기',
    'home.guide.title': '개인 기록 수집 서버 설정 가이드',
    'home.guide.prerequisiteTitle': '준비물',
    'home.guide.prerequisiteBody': '항상 켜져 있고 Docker를 실행할 수 있는 컴퓨터',
    'home.guide.step1Title': 'compose.yaml 파일 생성',
    'home.guide.step1BodyA': '서버를 실행할 폴더에 아래 내용으로 ',
    'home.guide.step1BodyB': ' 파일을 만듭니다. ',
    'home.guide.step1BodyC': '와 ',
    'home.guide.step1BodyD': '에 maimai DX NET 계정 정보를 입력하세요.',
    'home.guide.step1Port': '이 설정은 컨테이너의 3000번 포트를 컴퓨터의 포트로 연결합니다. 기본값은 3000번 포트이며, MAISTATS_HOST_PORT 환경변수로 변경할 수 있습니다.',
    'home.guide.step2Title': 'Docker Compose 실행',
    'home.guide.step2BodyA': 'Docker가 설치된 환경에서 ',
    'home.guide.step2BodyB': '이 있는 폴더에서 아래 명령어로 컨테이너를 시작합니다.',
    'home.guide.step2BodyC': '첫 실행 시 maimai DX NET 로그인 후 초기 데이터를 모으기 시작합니다. maimai DX에 수록된 모든 곡의 기록을 가져와야 해서 몇 분~수십 분 정도의 시간이 소요될 수 있습니다.',
    'home.guide.step3Title': '외부 접근 설정 (선택)',
    'home.guide.step3Body': '외부에서 접근하려면 이 컴퓨터의 개인 기록 수집 서버 포트를 공개 IP 또는 도메인으로 노출하세요. 기본 포트는 3000번이며, MAISTATS_HOST_PORT를 바꿨다면 해당 포트를 노출하면 됩니다. ngrok, Cloudflare Tunnel 등을 활용할 수 있습니다.',
    'home.guide.step4Title': 'URL 연결',
    'home.guide.step4BodyA': '서버가 준비되면 아래 입력창에 서버 URL을 입력하고 ',
    'home.guide.step4BodyB': ' 버튼을 클릭하세요. 연결에 성공하면 자동으로 Scores 페이지로 이동합니다.',
    'home.discord.title': 'Discord Bot',
    'home.discord.description': 'Discord 서버에 maistats 봇을 추가하면 ',
    'home.discord.descriptionTail': ' 명령어로 스코어와 최근 플레이 기록을 바로 조회할 수 있습니다.',
    'home.discord.addButton': 'Discord Bot 추가하기',
    'home.discord.supportButton': '지원 서버 참여하기',
    'home.footer.aliases': '곡 제목의 alias들의 일부는 ',
    'home.footer.aliasesTail': '으로부터 허가를 받아 가져왔습니다.',
    'home.footer.parsing': '곡의 파싱은 ',
    'home.footer.parsingTail': '를 참고했습니다.',
    'home.footer.source': 'maistats의 소스 코드는 ',
    'home.footer.sourceTail': '에 공개되어 있습니다.',
    'home.footer.developer': '개발자:',
    'home.footer.copyrightA': '본 사이트는 개인 성과 기록 및 추적을 위해 만든 ',
    'home.footer.copyrightB': '의 팬 사이트이며, 사이트 내에 사용된 게임 관련 컨텐츠의 저작권은 ',
    'home.footer.copyrightC': ' 및 ',
    'home.footer.copyrightOwners': '각 소유자들',
    'home.footer.copyrightD': '에게 있습니다.',
    'settings.title': 'Connections',
    'settings.description': 'Song Database와 개인 기록 수집 서버 연결 정보를 관리합니다.',
    'settings.recordCollectorUrl': '개인 기록 수집 서버 URL',
    'settings.songInfoWarning': '⚠ 디버깅 목적이 아니라면 변경하지 마세요.',
    'settings.language.title': 'Language',
    'settings.language.description': '앱 언어를 기기 언어 또는 직접 선택한 언어로 설정합니다.',
    'settings.language.label': 'App language',
    'settings.language.helperSystem': '현재 기기 언어를 따라갑니다. 현재 적용 언어: {{language}}',
    'settings.language.helperManual': '현재 적용 언어: {{language}}',
    'settings.language.optionSystem': 'System default',
    'settings.language.optionKo': '한국어',
    'settings.language.optionEn': 'English',
    'settings.theme.title': 'Theme',
    'settings.theme.description': '앱의 색상 테마를 선택합니다.',
    'settings.theme.label': 'Color theme',
    'settings.theme.optionSystem': 'System default',
    'settings.theme.optionLight': 'Light',
    'settings.theme.optionDark': 'Dark',
    'settings.recordCollector.success': '연결 성공! 플레이어: {{name}}',
    'settings.recordCollector.failed': '연결 실패: {{message}}',
    'settings.logs.title': 'Collector Logs',
    'settings.logs.description': '개인 기록 수집 서버가 tracing으로 남긴 최근 로그를 확인합니다.',
    'settings.logs.refresh': '로그 새로고침',
    'settings.logs.refreshing': '로그 불러오는 중...',
    'settings.logs.save': '파일로 저장',
    'settings.logs.emptyUrl': '먼저 개인 기록 수집 서버를 연결하면 로그를 불러올 수 있습니다.',
    'settings.logs.empty': '아직 표시할 로그가 없습니다.',
    'settings.logs.failed': '로그를 불러오지 못했습니다: {{message}}',
    'settings.logs.count': '최근 {{shown}}줄 표시 중',
    'scores.resetAll': '전체 초기화',
    'scores.searchLabel': '검색 (곡명/alias/버전/레벨)',
    'scores.searchPlaceholder': '예: VERTeX, 버텍스, PRiSM, 14+',
    'scores.chartType': '채보 유형',
    'scores.difficulty': '난이도',
    'scores.level': '레벨',
    'scores.levelMin': '레벨 최소',
    'scores.levelMax': '레벨 최대',
    'scores.playedOnly': '플레이 기록이 있는 곡만 보여주기',
    'scores.score': '스코어',
    'scores.achievementMin': '달성률 최소',
    'scores.achievementMax': '달성률 최대',
    'scores.version': '버전',
    'scores.daysSince': '경과일',
    'scores.daysMin': '경과일 최소',
    'scores.daysMax': '경과일 최대',
    'scores.chartsTitle': 'Charts',
    'scores.chartsDescription': '점수 데이터와 차트 메타데이터를 함께 확인합니다. 회색 소수점은 추정 내부레벨입니다.',
    'scores.versionAll': 'ALL',
    'scores.versionNew': 'NEW',
    'scores.versionOld': 'OLD',
    'playlogs.searchLabel': '검색 (곡명/alias/시각)',
    'playlogs.searchPlaceholder': '예: 2026/02/25, BUDDiES, 배드애플',
    'playlogs.showAll': '전체 플레이 기록 보기',
    'playlogs.dayLabel': '플레이 날짜 (maimai day 04:00 기준)',
    'playlogs.summaryAll': '전체: {{songCount}}곡',
    'playlogs.summaryDay': '{{songCount}}곡 · {{creditCount}} 크레딧',
    'playlogs.bestOnly': '곡/채보별 최고 기록만 보기',
    'playlogs.newRecordOnly': 'new record만 보기',
    'playlogs.creditNumber': 'Credit #',
    'playlogs.playedAt': 'Played At',
    'playlogs.dayOption': '{{date}} ({{credits}} credits)',
    'rating.title': 'RATING',
    'rating.description': 'NEW 상위 15곡과 OLD 상위 35곡의 레이팅 합계입니다. 보면상수가 알려지지 않은 곡의 경우 계산값이 잘못될 수 있습니다.',
    'rating.current': 'Current Rating',
    'rating.newTop15': 'NEW TOP 15',
    'rating.oldTop35': 'OLD TOP 35',
    'rating.avg': 'AVG {{value}}',
    'rating.avgProjection': 'AVG {{avg}}, ~{{projection}}',
    'rating.newDescription': 'NEW 분류 상위 15곡. 카드를 클릭하면 Song Detail을 엽니다.',
    'rating.oldDescription': 'OLD 분류 상위 35곡. 카드를 클릭하면 Song Detail을 엽니다.',
    'rating.openSongDetail': '{{title}} Song Detail 열기',
    'tiers.filters': '필터',
    'tiers.displayMode': '표시 기준',
    'tiers.displayMode.normalized': 'Normalized tier',
    'tiers.displayMode.raveille': 'Raveille 원본',
    'tiers.info.beforeLink': '이 페이지의 티어 정보는 ',
    'tiers.info.linkLabel': 'Raveille의 티어표',
    'tiers.info.afterLink': '에서 가져왔습니다. normalized tier는 해당 티어표에 기반해 Lomo가 작업한 매핑을 maistats에서 정리해 13.00 - 14.50 범위로 맞춘 값입니다.',
    'tiers.hideNoData': '플레이 기록 없는 곡 숨기기',
    'tiers.hideBelow90': '90% 미만 숨기기',
    'tiers.empty': 'User tier 데이터를 찾지 못했습니다. Song Database가 raveille_user_tier.json을 제공하는지 확인하세요.',
    'tiers.emptyAfterFilter': '현재 필터로 표시할 기록이 없습니다.',
    'tiers.unknownInternalLevel': 'Internal level 없음',
    'tiers.unknownRaveilleInternalLevel': 'Raveille level 없음',
    'tiers.unknownRaveilleTier': 'Raveille tier 없음',
    'tiers.averageScore': 'AVG',
    'tiers.playedCountLabel': 'PLAYED',
    'tiers.playedCountValue': '{{played}} / {{total}}',
    'plot.title': 'Score Distribution',
    'plot.description': '지정한 기간 안에 플레이한 곡(달성률 90% 이상)을 공식 레벨과 달성률 기준으로 표시합니다.',
    'plot.daysWindow': '기간',
    'plot.daysValue': '{{count}}일',
    'plot.daysMax': 'max',
    'plot.displayMode': '표시',
    'plot.displayMode.scatter': 'Scatter',
    'plot.displayMode.box': 'Box',
    'plot.empty': '조건에 맞는 곡이 없습니다.',
    'plot.userTierTitle': 'User Tier Distribution',
    'plot.userTierDescription': '같은 기간 안에 플레이한 90% 이상 기록을 user tier와 달성률 기준으로 표시합니다.',
    'plot.userTierEmpty': '표시할 tier 기록이 없습니다.',
    'songDetail.title': 'Song Detail',
    'songDetail.refreshing': '갱신 중...',
    'songDetail.refresh': 'Score 갱신',
    'songDetail.refreshUnavailable': '곡 식별 정보가 부족해서 새로고침할 수 없습니다.',
    'songDetail.empty': '조회 가능한 상세 데이터가 없습니다.',
    'history.title': 'History',
    'history.description': 'playlogs 기준으로 최고 달성률이 갱신된 시점만 표시합니다.',
    'history.loading': 'playlogs를 불러오는 중입니다.',
    'history.empty': '이 채보에 대한 최고기록 변동 이력을 playlogs에서 찾지 못했습니다.',
    'history.graphLabel': '{{title}} 최고 달성률 변화 그래프',
    'history.axisAchievement': 'Achievement',
    'history.axisTime': 'Time',
    'history.openChartHistory': '{{title}} 채보 History 열기',
    'app.missingUrls': 'Scores와 Playlogs 페이지는 Song Database URL과 개인 기록 수집 서버 URL이 모두 필요합니다.',
    'api.enterUrl': 'URL을 입력하세요.',
    'api.connectionFailed': 'HTTP {{status}} 응답을 받았습니다.',
    'api.recordCollectorRequired': '개인 기록 수집 서버 URL이 비어 있습니다.',
    'recordCollector.version.outdated': '개인 기록 수집 서버 업데이트가 필요합니다. 앱 버전은 {{currentVersion}}, 서버 버전은 {{collectorVersion}}입니다.',
    'recordCollector.version.invalid': '개인 기록 수집 서버가 유효하지 않은 semantic version({{collectorVersion}})을 반환했습니다. 서버를 업데이트하세요.',
    'recordCollector.version.unreachable': '개인 기록 수집 서버의 `/api/version`을 확인할 수 없습니다. {{currentVersion}} 이상 버전으로 서버를 업데이트하세요.',
  },
  en: {
    'nav.home': 'Home',
    'nav.setup': 'Setup',
    'nav.scores': 'Scores',
    'nav.rating': 'Rating',
    'nav.tiers': 'User Tier',
    'nav.playlogs': 'Playlogs',
    'nav.plot': 'Plot',
    'nav.settings': 'Settings',
    'nav.primary': 'Primary',
    'nav.openPages': 'Open page list',
    'common.filters': 'Filters',
    'common.chartTraits': 'Chart traits',
    'common.recordTraits': 'Record traits',
    'common.close': 'Close',
    'common.connect': 'Connect',
    'common.connecting': 'Connecting...',
    'common.all': 'ALL',
    'common.apply': 'Apply',
    'common.search': 'Search',
    'common.loadingCharts': 'Loading charts...',
    'common.loadingPlaylogs': 'Loading playlogs...',
    'common.loadingVersions': 'Loading versions...',
    'common.jacket': 'Jacket',
    'common.title': 'Title',
    'common.chart': 'Chart',
    'common.levelShort': 'Lv',
    'common.achievementShort': 'Achv',
    'common.rating': 'Rating',
    'common.rank': 'Rank',
    'common.fc': 'FC',
    'common.sync': 'Sync',
    'common.dx': 'DX',
    'common.lastPlayed': 'Last Played',
    'common.playCount': 'Play Count',
    'common.version': 'Version',
    'common.track': 'Track',
    'common.type': 'Type',
    'common.diff': 'Diff',
    'common.achievement': 'Achievement',
    'common.error': 'Error',
    'common.min': 'MIN',
    'common.max': 'MAX',
    'common.from': 'FROM',
    'common.to': 'TO',
    'common.none': 'None',
    'common.ready': 'Ready',
    'units.songs': '{{count}} song(s)',
    'units.credits': '{{count}} credit(s)',
    'units.daysAgo': '{{count}} days ago',
    'player.connected': 'Connected player',
    'player.totalPlayCount': 'Total play count',
    'player.refresh': 'Refresh latest records',
    'player.refreshing': 'Refreshing latest records...',
    'home.connect.title': 'Connect Record Collector',
    'home.connect.description': 'Enter your Record Collector server URL and verify the connection.',
    'home.connect.serverUrl': 'Server URL',
    'home.connect.placeholder': 'https://your-server.example.com',
    'home.connect.failed': 'Connection failed: {{message}}',
    'home.connect.success': 'Connected. Player: {{name}}',
    'home.connect.goToScores': 'Go to Scores →',
    'home.quickStart.title': 'Not your first visit?',
    'home.quickStart.submit': 'Log in',
    'home.welcome.title': 'Welcome to maistats!',
    'home.intro.description': 'maistats helps you use a personal server to track your maimai play records, generate statistics, and manage your progress.',
    'home.intro.helper': 'It assumes you run your own Record Collector. If this is your first visit, start with the setup guide.',
    'home.menu.title': 'Quickstart',
    'home.startCard.title': 'Set up Record Collector',
    'home.discordCard.title': 'Add Discord Bot',
    'home.supportCard.title': 'Join Support Server',
    'home.openSetup': 'Open setup guide',
    'home.guide.title': 'Personal Record Collection Server Setup Guide',
    'home.guide.prerequisiteTitle': 'Prerequisites',
    'home.guide.prerequisiteBody': 'A computer that stays on and can run Docker.',
    'home.guide.step1Title': 'Create a compose.yaml file',
    'home.guide.step1BodyA': 'Create a ',
    'home.guide.step1BodyB': ' file in the folder where you want to run the server, using the content below. Fill in ',
    'home.guide.step1BodyC': ' and ',
    'home.guide.step1BodyD': ' with your maimai DX NET account credentials.',
    'home.guide.step1Port': 'This maps port 3000 inside the container to a port on your computer. The default host port is 3000, and you can change it with the MAISTATS_HOST_PORT environment variable.',
    'home.guide.step2Title': 'Run Docker Compose',
    'home.guide.step2BodyA': 'On a machine with Docker installed, run the command below in the folder containing ',
    'home.guide.step2BodyB': '.',
    'home.guide.step2BodyC': 'On first launch, the server logs in to maimai DX NET and starts collecting initial data. It needs to fetch records for every song in maimai DX, so this can take several minutes to tens of minutes.',
    'home.guide.step3Title': 'Expose the server (optional)',
    'home.guide.step3Body': 'If you want to connect from outside, expose the personal record collection server port on this computer through a public IP or domain. The default port is 3000; if you changed MAISTATS_HOST_PORT, expose that port instead. Tools like ngrok or Cloudflare Tunnel work well.',
    'home.guide.step4Title': 'Connect the URL',
    'home.guide.step4BodyA': 'Once the server is ready, enter the server URL below and click ',
    'home.guide.step4BodyB': '. On success, the app will move to the Scores page automatically.',
    'home.discord.title': 'Discord Bot',
    'home.discord.description': 'Add the maistats bot to your Discord server to look up scores and recent plays directly with ',
    'home.discord.descriptionTail': '.',
    'home.discord.addButton': 'Add Discord Bot',
    'home.discord.supportButton': 'Join Support Server',
    'home.footer.aliases': 'Song title aliases were imported with permission from ',
    'home.footer.aliasesTail': '.',
    'home.footer.parsing': 'Song parsing was implemented with reference to ',
    'home.footer.parsingTail': '.',
    'home.footer.source': 'The source code for maistats is available at ',
    'home.footer.sourceTail': '.',
    'home.footer.developer': 'Developer:',
    'home.footer.copyrightA': 'This site is a fan-made ',
    'home.footer.copyrightB': ' site built for personal score tracking. Copyright for the in-game content used here belongs to ',
    'home.footer.copyrightC': ' and ',
    'home.footer.copyrightOwners': 'the respective owners',
    'home.footer.copyrightD': '.',
    'settings.title': 'Connections',
    'settings.description': 'Manage the Song Database and Record Collector connection settings.',
    'settings.recordCollectorUrl': 'Record Collector URL',
    'settings.songInfoWarning': 'Do not change this unless you are debugging.',
    'settings.language.title': 'Language',
    'settings.language.description': 'Use your device language by default, or override it for the app.',
    'settings.language.label': 'App language',
    'settings.language.helperSystem': 'Following your device language. Current app language: {{language}}',
    'settings.language.helperManual': 'Current app language: {{language}}',
    'settings.language.optionSystem': 'System default',
    'settings.language.optionKo': 'Korean',
    'settings.language.optionEn': 'English',
    'settings.theme.title': 'Theme',
    'settings.theme.description': 'Choose the app color theme.',
    'settings.theme.label': 'Color theme',
    'settings.theme.optionSystem': 'System default',
    'settings.theme.optionLight': 'Light',
    'settings.theme.optionDark': 'Dark',
    'settings.recordCollector.success': 'Connected. Player: {{name}}',
    'settings.recordCollector.failed': 'Connection failed: {{message}}',
    'settings.logs.title': 'Collector Logs',
    'settings.logs.description': 'Review the latest tracing output captured by the record collector.',
    'settings.logs.refresh': 'Refresh logs',
    'settings.logs.refreshing': 'Loading logs...',
    'settings.logs.save': 'Save to file',
    'settings.logs.emptyUrl': 'Connect a Record Collector first to load logs.',
    'settings.logs.empty': 'No log lines are available yet.',
    'settings.logs.failed': 'Failed to load logs: {{message}}',
    'settings.logs.count': 'Showing {{shown}} recent lines',
    'scores.resetAll': 'Reset all',
    'scores.searchLabel': 'Search (title/alias/version/level)',
    'scores.searchPlaceholder': 'Example: VERTeX, Vertex, PRiSM, 14+',
    'scores.chartType': 'Chart Type',
    'scores.difficulty': 'Difficulty',
    'scores.level': 'Level',
    'scores.levelMin': 'Minimum level',
    'scores.levelMax': 'Maximum level',
    'scores.playedOnly': 'Show only songs with play records',
    'scores.score': 'Score',
    'scores.achievementMin': 'Minimum achievement',
    'scores.achievementMax': 'Maximum achievement',
    'scores.version': 'Version',
    'scores.daysSince': 'Days Since',
    'scores.daysMin': 'Minimum days since',
    'scores.daysMax': 'Maximum days since',
    'scores.chartsTitle': 'Charts',
    'scores.chartsDescription': 'Browse score data with chart metadata. Gray decimal digits indicate an estimated internal level.',
    'scores.versionAll': 'ALL',
    'scores.versionNew': 'NEW',
    'scores.versionOld': 'OLD',
    'playlogs.searchLabel': 'Search (title/alias/time)',
    'playlogs.searchPlaceholder': 'Example: 2026/02/25, BUDDiES, Bad Apple',
    'playlogs.showAll': 'Show all playlogs',
    'playlogs.dayLabel': 'Play date (maimai day starts at 04:00)',
    'playlogs.summaryAll': 'All: {{songCount}} song(s)',
    'playlogs.summaryDay': '{{songCount}} song(s) · {{creditCount}} credit(s)',
    'playlogs.bestOnly': 'Show only best record per song/chart',
    'playlogs.newRecordOnly': 'Show only new records',
    'playlogs.creditNumber': 'Credit #',
    'playlogs.playedAt': 'Played At',
    'playlogs.dayOption': '{{date}} ({{credits}} credits)',
    'rating.title': 'RATING',
    'rating.description': 'This is the total of your top 15 NEW songs and top 35 OLD songs. Ratings may be inaccurate for songs without a known internal level.',
    'rating.current': 'Current Rating',
    'rating.newTop15': 'NEW TOP 15',
    'rating.oldTop35': 'OLD TOP 35',
    'rating.avg': 'AVG {{value}}',
    'rating.avgProjection': 'AVG {{avg}}, ~{{projection}}',
    'rating.newDescription': 'Top 15 songs in the NEW category. Click a card to open Song Detail.',
    'rating.oldDescription': 'Top 35 songs in the OLD category. Click a card to open Song Detail.',
    'rating.openSongDetail': 'Open Song Detail for {{title}}',
    'tiers.filters': 'Filters',
    'tiers.displayMode': 'View by',
    'tiers.displayMode.normalized': 'Normalized tier',
    'tiers.displayMode.raveille': 'Raveille source',
    'tiers.info.beforeLink': 'Tier data on this page comes from ',
    'tiers.info.linkLabel': "Raveille's tier sheet",
    'tiers.info.afterLink': '. The normalized tier is based on Lomo’s mapping from that sheet, organized by maistats into the 13.00 - 14.50 range.',
    'tiers.hideNoData': 'Hide charts without play records',
    'tiers.hideBelow90': 'Hide below 90%',
    'tiers.empty': 'No user tier data is available. Check that the Song Database serves raveille_user_tier.json.',
    'tiers.emptyAfterFilter': 'No records remain with the current filters.',
    'tiers.unknownInternalLevel': 'No internal level',
    'tiers.unknownRaveilleInternalLevel': 'No Raveille level',
    'tiers.unknownRaveilleTier': 'No Raveille tier',
    'tiers.averageScore': 'AVG',
    'tiers.playedCountLabel': 'PLAYED',
    'tiers.playedCountValue': '{{played}} / {{total}}',
    'plot.title': 'Score Distribution',
    'plot.description': 'Shows songs played within the selected period (achievement >= 90%) by official level and achievement.',
    'plot.daysWindow': 'Period',
    'plot.daysValue': '{{count}} days',
    'plot.daysMax': 'max',
    'plot.displayMode': 'View',
    'plot.displayMode.scatter': 'Scatter',
    'plot.displayMode.box': 'Box',
    'plot.empty': 'No songs match the given criteria.',
    'plot.userTierTitle': 'User Tier Distribution',
    'plot.userTierDescription': 'Plots records played within the same period with achievement >= 90% by user tier and achievement.',
    'plot.userTierEmpty': 'No tier records are available.',
    'songDetail.title': 'Song Detail',
    'songDetail.refreshing': 'Refreshing...',
    'songDetail.refresh': 'Refresh Score',
    'songDetail.refreshUnavailable': 'Cannot refresh because the song identifiers are incomplete.',
    'songDetail.empty': 'No detail data is available for this song.',
    'history.title': 'History',
    'history.description': 'Only points where the best achievement improved are shown, based on playlogs.',
    'history.loading': 'Loading playlogs for this chart.',
    'history.empty': 'No history entries for this chart were found in the playlogs.',
    'history.graphLabel': 'Achievement history graph for {{title}}',
    'history.axisAchievement': 'Achievement',
    'history.axisTime': 'Time',
    'history.openChartHistory': 'Open chart history for {{title}}',
    'app.missingUrls': 'Scores and Playlogs require both the Song Database URL and the Record Collector URL.',
    'api.enterUrl': 'Please enter a URL.',
    'api.connectionFailed': 'Received HTTP {{status}} from the server.',
    'api.recordCollectorRequired': 'Record Collector URL is empty.',
    'recordCollector.version.outdated': 'Your Record Collector needs an update. The app is on {{currentVersion}}, but the collector reports {{collectorVersion}}.',
    'recordCollector.version.invalid': 'The Record Collector returned an invalid semantic version ({{collectorVersion}}). Please update the server.',
    'recordCollector.version.unreachable': 'The frontend could not verify `/api/version` on the Record Collector. Please update the server to {{currentVersion}} or newer.',
  },
});

export type TranslationKey = keyof typeof translations.ko;
export type TranslationVariables = Record<string, string | number>;

export function interpolate(template: string, variables?: TranslationVariables): string {
  if (!variables) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === undefined ? `{{${key}}}` : String(value);
  });
}

export function detectSystemLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter((value): value is string => Boolean(value));

  for (const value of candidates) {
    if (value.toLowerCase().startsWith('ko')) {
      return 'ko';
    }
  }

  return 'en';
}

export function normalizeLanguagePreference(value: string | null): LanguagePreference {
  if (value === 'ko' || value === 'en' || value === 'system') {
    return value;
  }
  return 'system';
}

interface I18nContextValue {
  languagePreference: LanguagePreference;
  setLanguagePreference: (value: LanguagePreference) => void;
  language: SupportedLanguage;
  locale: string;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
  formatNumber: (value: number) => string;
  compareText: (left: string, right: string) => number;
  formatLanguageName: (value: SupportedLanguage) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(() => {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }
    return normalizeLanguagePreference(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  });
  const [systemLanguage, setSystemLanguage] = useState<SupportedLanguage>(() => detectSystemLanguage());

  const language = languagePreference === 'system'
    ? systemLanguage
    : languagePreference;
  const locale = LOCALE_BY_LANGUAGE[language];

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languagePreference);
  }, [languagePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleLanguageChange = () => {
      setSystemLanguage(detectSystemLanguage());
    };

    window.addEventListener('languagechange', handleLanguageChange);
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, variables?: TranslationVariables) => {
      return interpolate(translations[language][key], variables);
    },
    [language],
  );

  const formatNumber = useCallback(
    (value: number) => value.toLocaleString(locale),
    [locale],
  );

  const compareText = useCallback(
    (left: string, right: string) => left.localeCompare(right, locale),
    [locale],
  );

  const formatLanguageName = useCallback(
    (value: SupportedLanguage) => (value === 'ko' ? t('settings.language.optionKo') : t('settings.language.optionEn')),
    [t],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      languagePreference,
      setLanguagePreference: setLanguagePreferenceState,
      language,
      locale,
      t,
      formatNumber,
      compareText,
      formatLanguageName,
    }),
    [compareText, formatLanguageName, formatNumber, language, languagePreference, locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return value;
}
