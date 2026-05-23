# maistats

`maistats` is a monorepo for collecting and viewing maimai DX NET play data.
It separates shared song metadata from private play records: song data can be
hosted publicly, while each user's records stay in their own self-hosted
collector.

## How It Fits Together

- `maistats-song-info` builds the shared song database: titles, aliases,
  chart metadata, internal levels, and jacket assets.
- `maistats-record-collector` is the per-user service. It logs in with one SEGA
  ID, stores records in local SQLite, and exposes APIs used by the web app and
  Discord bot.
- `maistats-discord-bot` is a shared Discord bot. Users register their own
  collector URL with the bot, and the bot reads only from that collector.
- `apps/maistats` is the web frontend. It reads the shared song database and
  connects to a collector URL configured by the user.
- `crates/` contains shared Rust crates for auth, parsing, clients, and common
  models.

The intended deployment model is:

1. Shared infrastructure hosts the song database, Discord bot, and frontend.
2. Each player hosts their own record collector with their own SEGA ID.
3. The frontend and Discord bot connect to that user's collector URL.

## Repository Layout

```text
.
|-- apps/maistats/                # Vite + React frontend
|-- maistats-record-collector/    # Self-hosted personal record API
|-- maistats-song-info/           # Shared song database generator
|-- maistats-discord-bot/         # Shared Discord bot
|-- crates/
|   |-- maimai-auth/              # maimai DX NET auth helpers
|   |-- maimai-client/            # API clients for maistats services
|   |-- maimai-parsers/           # HTML parsers
|   `-- models/                   # Shared API/domain/storage models
`-- .github/workflows/            # CI and deployment workflows
```

## Requirements

- Rust stable
- Node.js 20+
- npm
- A SEGA ID account for collector or song database generation
- A Discord bot token if running the Discord bot

## Configuration

Root Rust services use `.env`:

```bash
cp .env.example .env
```

Important groups:

- Record collector: `SEGA_ID`, `SEGA_PASSWORD`,
  `RECORD_COLLECTOR_PORT`, `DATA_DIR`, `DATABASE_URL`
- Song database: `SONG_DATA_PATH`
- Song database authenticated source: `MAIMAI_INTL_SEGA_ID`,
  `MAIMAI_INTL_SEGA_PASSWORD`, `USER_AGENT`
- Discord bot: `DISCORD_BOT_TOKEN`, `DISCORD_DEV_USER_ID`,
  `SONG_DATABASE_URL`, `DISCORD_BOT_DATABASE_URL`
- Song database publishing: R2 credentials and public base URL

The frontend has its own template:

```bash
cp apps/maistats/.env.example apps/maistats/.env
```

- `SONG_DATABASE_URL`
- `RECORD_COLLECTOR_SERVER_URL`

`RECORD_COLLECTOR_SERVER_URL` is only the default connection target. In normal
use, each user can set their own collector URL in the web app.

## Local Development

Install frontend dependencies from the repository root:

```bash
npm ci
```

Generate shared song data:

```bash
cargo run -p maistats-song-info
```

Run a personal record collector:

```bash
cargo run -p maistats-record-collector
```

By default it listens on `http://localhost:3000`. Useful endpoints include:

- `GET /health`
- `GET /health/ready`
- `GET /api/version`
- `GET /api/player`
- `GET /api/scores/rated`
- `GET /api/songs/scores`
- `GET /api/recent`
- `GET /api/today`
- `GET /api/rating/targets`
- `POST /api/poll`

Run the Discord bot:

```bash
cargo run -p maistats-discord-bot
```

Run the frontend:

```bash
npm run dev:maistats
```

The Vite dev server normally starts at `http://localhost:5174` unless that port
is already in use.

## Docker

Published images are available from GHCR:

- `ghcr.io/minty99/maistats-record-collector:latest`
- `ghcr.io/minty99/maistats-discord-bot:latest`

Example compose files are included:

```bash
docker compose -f compose.record_collector.yaml up -d
docker compose -f compose.discord_bot.yaml up -d
```

The record collector compose file stores SQLite data under `./data`.

## Web App Features

The frontend provides pages for setup, score browsing, rating breakdowns, user
tier views, playlogs, achievement plots, and connection settings. It can use the
public song database while reading personal records from any compatible
self-hosted collector.

## Discord Bot Features

Users connect their collector with `/register <url>`. The bot can then show
score summaries, song metadata, recent plays, today's plays, up/down sessions,
user-tier up/down sessions, and rating plots through slash commands.

## Data Storage

- Record collector SQLite: usually `data/maimai.sqlite3`
- Discord bot SQLite: usually `data/maistats-discord-bot.sqlite3`
- Song database output: usually `data/song_data/data.json` and
  `data/song_data/cover/`
- Runtime cookies: temporary process-local files outside committed source

Do not commit `.env`, `data/`, generated databases, cookies, or private crawl
artifacts.

## Checks

Rust:

```bash
cargo fmt --all -- --check
cargo clippy --all -- -D warnings
cargo test
```

Frontend:

```bash
npm run build:maistats
npm run test:maistats
```

## Deployment Notes

- `maistats-song-info` is validated in CI and published by the scheduled
  `Song Database` workflow when the required secrets are configured.
- `maistats-record-collector` and `maistats-discord-bot` are built as Docker
  images by the GHCR workflow.
- `apps/maistats` is validated separately by the frontend workflow and is
  configured for Cloudflare/Vite deployment.
