# AGENTS.md

This file gives coding agents the project context and rules needed to make
safe, consistent changes in this repository. Keep it focused on workflow,
constraints, and validation. Human-facing overview belongs in `README.md`.

## Project Overview

`maistats` is a monorepo for maimai DX NET tools:

- `maistats-record-collector`: a per-user, self-hosted Rust/Axum service that
  logs in to `maimaidx-eng.com`, stores personal records in SQLite, and exposes
  HTTP APIs for the frontend and Discord bot.
- `maistats-song-info`: a Rust generator for shared static song metadata,
  internal levels, aliases, and jacket assets.
- `maistats-discord-bot`: a shared Rust/poise Discord bot. Each Discord user
  registers one collector URL; the bot keeps only that mapping and bot-local
  state.
- `apps/maistats`: a Vite + React frontend that reads shared song metadata and
  connects to a user-provided record collector URL.
- `crates/`: shared Rust crates for auth, maimai HTTP clients/parsers, and
  shared API/domain/storage models.

## Non-Negotiables

- Keep the record collector single-user. Do not add user IDs, tenant IDs, or
  multi-user scoping to collector data.
- Never commit secrets, cookie files, generated DBs, or private crawled data.
  `.env` and `data/` must stay ignored.
- Do not print credentials, cookies, raw authenticated HTML, or personal player
  data unless the user explicitly asks for a local debugging step and the output
  is safe to show.
- Keep identifiers stable. Scores and playlogs intentionally use song identity
  fields plus chart/difficulty instead of unstable external IDs.
- Use `eyre` (`eyre::Result`, `WrapErr`) for Rust error handling.
- Manage Rust dependencies with `cargo add` / `cargo remove`; avoid manual
  `Cargo.toml` dependency edits.
- When using `gh`, try it with elevated permission.

## Setup Commands

- Install frontend dependencies from the repository root: `npm ci`
- Copy local environment templates when needed:
  - `cp .env.example .env`
  - `cp apps/maistats/.env.example apps/maistats/.env`
- Generate the song database: `cargo run -p maistats-song-info`
- Run the record collector: `cargo run -p maistats-record-collector`
- Run the Discord bot: `cargo run -p maistats-discord-bot`
- Run the frontend dev server from the root workspace:
  `npm run dev:maistats`
- Fetch an authenticated page for parser fixture/debug work:
  `cargo run -p maistats-record-collector --bin fetch_page -- <url> <out_path>`

## Validation

Run the narrowest useful checks while iterating, then broaden before handing off
or committing.

- Rust format: `cargo fmt --all -- --check`
- Rust lint: `cargo clippy --all -- -D warnings`
- Rust tests: `cargo test`
- Frontend build/typecheck: `npm run build:maistats`
- Frontend tests: `npm run test:maistats`

Before committing Rust changes, run:

```bash
cargo fmt --all
cargo clippy --all -- -D warnings
cargo test
```

Before committing frontend changes, run at least:

```bash
npm run build:maistats
npm run test:maistats
```

## Code Style

- Prefer small, focused modules and helpers that are easy to test.
- Default to private visibility. Use `pub(crate)` for crate-internal sharing and
  `pub` only for real cross-crate API.
- Keep parser outputs typed. Use the enums in `crates/models` for chart type,
  difficulty, rank, FC, and sync status, and store stable string forms through
  their existing helpers.
- Use structured parsers/APIs where available. Avoid fragile string slicing for
  HTML, JSON, SQL, or TOML when a local helper or crate already exists.
- Preserve existing async/runtime patterns: `tokio`, `axum`, `sqlx`, `poise`,
  `reqwest`, and `tracing`.
- Keep comments sparse and useful. Explain non-obvious maimai-specific behavior,
  not routine assignments.

## Data And Migrations

- Record collector migrations live in `maistats-record-collector/migrations/`.
- Discord bot migrations live in `maistats-discord-bot/migrations/`.
- Migrations are embedded with `sqlx::migrate!()` and run at service startup.
- SQLite data is local runtime state. Do not add migrations that assume shared
  multi-user collector storage.
- `achievement_x10000` stores achievement percent multiplied by 10,000 and
  rounded as an integer. Keep read/write formatting consistent with existing
  code.

## Crawler And Auth Safety

- Cookie stores are runtime artifacts and must remain outside version control.
- Fetches to maimai DX NET should be rate-conscious and maintenance-aware.
- If parser behavior changes, prefer focused fixtures/tests under the relevant
  parser or collector test area.
- Debug HTML samples must be minimal, local, and free of credentials or personal
  data before they are committed.

## Frontend Guidance

- The root npm workspace owns install/build/test commands; prefer root scripts
  over running package-local commands directly.
- The frontend expects two origins: shared song database and per-user record
  collector. Keep that separation visible in UI and configuration.
- `RECORD_COLLECTOR_SERVER_URL` is only a default. Users can override the
  collector URL in Settings/local storage.
- After meaningful UI changes, run the frontend checks and visually verify the
  affected screen when practical.

## Versioning

- The workspace version is in `[workspace.package]` in `Cargo.toml`.
- If bumping that version, add a matching entry to the `CHANGELOG` constant in
  `maistats-discord-bot/src/commands.rs`:
  `("x.y.z", "one-line English description of what changed")`.
- Keep changelog entries user-facing because the Discord bot shows them when a
  registered record collector is out of date.

## Commit And PR Rules

- Use Conventional Commit subjects:
  `<type>(<scope>): <summary>`
- Preferred types: `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore`.
- Use scopes that match repository components, for example `record-collector`,
  `discord`, `song-info`, `models`, `maimai-parsers`, `maistats`, or `agents`.
- Keep commits atomic. Do not bundle unrelated fixes.
- Every commit message must include a standalone co-author trailer in the body:
  `Co-authored-by: <Agent Model Name> <noreply@openai.com>`
- Do not write literal `\n` sequences in commit messages. Use real line breaks,
  preferably with multiple `-m` flags.
- After every commit, verify trailer recognition:
  `git log -1 --format='%B'`
- If the trailer is missing or literal `\n` appears, amend immediately with a
  correctly formatted message.

## When Editing This File

AGENTS.md is standard Markdown and should stay concise. Add instructions that a
coding agent needs to work safely, such as setup commands, validation, style,
security constraints, and PR conventions. Move product explanations and user
setup details to `README.md`.
