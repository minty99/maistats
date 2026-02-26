# maistats

`song-info-server` + `record-collector-server`를 연결해, score/playlog를 고자유도로 탐색하는 웹 프론트엔드입니다.

## 요구사항

- Node.js 20+ (권장: 20 LTS 이상)
- npm 10+

## 특징

- `maimai-bot`과 분리된 독립 프로젝트
- 서버 URL을 환경 변수(`VITE_*`)와 UI 설정으로 주입 가능
- score/playlog 통합 분석
  - 곡/차트별 마지막 플레이 관측 시각(최근 500 로그 기준)
  - 달성률, DX 비율, 재킷 이미지
  - 곡 클릭 시 상세 페이지 기반 chart별 `play_count` 조회
- 다양한 필터/정렬
  - 곡명 검색, 차트 타입, 난이도, 버전
  - 랭크/FC/SYNC
  - 달성률/내부레벨/경과일 범위

## 환경 셋업

### 1. 프로젝트 디렉토리 이동

```bash
cd maistats
```

### 2. 환경 변수 파일 생성

```bash
cp .env.example .env
```

`.env` 예시 (로컬 개발 기본값):

```env
VITE_SONG_INFO_SERVER_URL=http://localhost:3001
VITE_RECORD_COLLECTOR_SERVER_URL=http://localhost:3000
```

원격/배포 서버를 사용하려면 해당 서비스 URL로 바꿔주세요:

```env
VITE_SONG_INFO_SERVER_URL=https://<your-song-info-server>
VITE_RECORD_COLLECTOR_SERVER_URL=https://<your-record-collector-server>
```

### 3. 의존성 설치

```bash
npm install
```

## 실행 방법

### 개발 모드

```bash
npm run dev
```

브라우저에서 `http://localhost:5174`로 접속합니다.

### 프로덕션 빌드

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성됩니다.

### 빌드 결과 로컬 확인

```bash
npm run preview
```

기본적으로 `http://localhost:4173`에서 프리뷰할 수 있습니다.

## npm 스크립트

- `npm run dev`: 개발 서버 실행 (Vite, 포트 5174)
- `npm run build`: TypeScript 체크 + 프로덕션 빌드
- `npm run preview`: 빌드 결과 프리뷰 서버 실행

## 참고

- Last Played/Days는 `record-collector-server`의 `/api/recent?limit=10000` 관측 데이터 기준입니다.
- chart별 `play_count`는 playlog에서 추정하지 않고, 곡별 `/api/scores/detail/{title}` 조회 결과만 사용합니다.
- 더 긴 기간 분석이 필요하면 record collector에 추가 API(예: 전체 playlog 조회)가 필요합니다.
- UI의 `Server Connection` 섹션에서 실행 중에도 API URL을 변경할 수 있으며, 변경값은 브라우저 `localStorage`에 저장됩니다.
- `.env` 파일에는 민감한 정보가 포함될 수 있으므로 저장소에 커밋하지 마세요.
