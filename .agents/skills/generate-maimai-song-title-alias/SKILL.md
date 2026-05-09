---
name: generate-maimai-song-title-alias
description: Generate English and Korean aliases for Japanese maimai song titles from https://maimai-charts.muhwan.dev/data.json by checking namu.moe mirrors of NamuWiki song pages. Use when explicitly invoked to produce aliases for one requested song title or for all unique songs in the maimai data source, especially for overwriting this repository's generated English and Korean alias TSV files from clear NamuWiki evidence while preserving title-only rows for unclear songs.
---

# Generate Maimai Song Title Alias

## Overview

Generate concise English and Korean search aliases for maimai song titles by using the title in `songs[]` as the source key and `namu.moe/w/{title}` as the main evidence source. `namu.moe` is a NamuWiki mirror that is easier to inspect reliably from tools; treat its page content as NamuWiki evidence and include the corresponding NamuWiki or Namu mirror URL in summaries.

Default to this repo's generated alias storage:

- Generated English aliases: `maistats-song-info/src/songdb/data/en_generated_aliases.tsv`
- Generated Korean aliases: `maistats-song-info/src/songdb/data/ko_generated_aliases.tsv`
- Fetched upstream aliases at runtime: see `maistats-song-info/src/songdb/aliases.rs`

## Workflow

1. Determine targets:
   - If the user specifies one or more song titles, process only those titles.
   - Otherwise fetch `https://maimai-charts.muhwan.dev/data.json`, read its top-level `songs` array, and process unique `title` values only.
   - Use only `title` for matching and output. Do not use chart rows as separate songs.
2. Ignore existing alias contents:
   - Do not merge, preserve, or infer from existing generated aliases.
   - When the user asks for a repo update, regenerate the generated TSV output from the current target set and overwrite the generated TSV files.
   - Existing upstream GCM aliases linked in `aliases.rs` are separate runtime inputs; do not edit them.
3. Open and verify the NamuWiki page for each remaining title:
   - Build `https://namu.moe/w/{encoded_title}`.
   - Percent-encode the title path segment with UTF-8. Spaces must be encoded as `%20`, not `+`.
   - Follow redirects before judging whether the page is useful. Use the final redirected page title and URL as the candidate source.
   - Confirm the page is about the requested song by checking the article title/header and one of: overview text, `maimai 시리즈`, `CHUNITHM`, `온게키`, artist/BPM/version table, or categories for rhythm-game songs.
   - Ignore navigation templates, folded song lists, category lists, related-song tables, and other page furniture when extracting aliases. These often appear before the real article body.
   - If the final page is a disambiguation page, wrong song, missing page, or still unclear after redirect, search within NamuWiki for the title and choose the page that clearly describes the maimai収録曲 or original song.
   - If no page can be matched clearly, do not guess aliases. Preserve the song as a title-only row in generated TSV output.
4. Extract only evidence-backed aliases by understanding the page semantically:
   - Do not depend on a fixed NamuWiki layout. Song pages are case-by-case: the Korean/English title may appear in a heading, image caption, infobox, overview prose, lyrics/album context, redirect title, parenthetical disambiguation, or another nearby explanation.
   - Read the page as a human would and identify which text is naming the requested song itself. Prefer candidates that are semantically attached to the requested title, the song's cover/info block, or prose that describes the song.
   - Treat explicit Korean translations/readings, official English titles, romanized titles used by the article, and established shorthand as aliases when the page makes clear they refer to the requested song.
   - Do not invent aliases from pronunciation unless the page evidence supports it.
   - Do not include the original Japanese title as an alias.
   - Avoid extracting unrelated page furniture: navigation templates, folded lists of many songs, category lists, neighboring song links, table syntax, and raw wiki/HTML markup are context, not aliases. Use them only to understand the page, not as alias text.
   - Reject any candidate that cannot be explained as a name for the requested song in one sentence from the page context.
5. Normalize, validate, and dedupe:
   - Trim whitespace and collapse repeated spaces.
   - Remove aliases identical to the original title or already present for that title.
   - Keep useful punctuation only when users are likely to type it; otherwise prefer plain searchable forms.
   - Keep 1-4 aliases per language when evidence exists.
   - Before accepting a row, sanity-check every alias against the page context: it must name the same song, not a neighboring song from a game-wide list or raw wiki markup. If unsure, leave it empty rather than guessing.
   - If neither language has clear evidence, keep the title with no aliases in each generated TSV file.
6. Produce a reviewable result:
   - For one-off use, return a compact table with `title`, `en`, `ko`, and `source`.
   - For repo updates, overwrite `en_generated_aliases.tsv` and `ko_generated_aliases.tsv` with every target title. Rows with aliases contain only evidence-backed aliases; rows without aliases contain the title only, making ungenerated aliases visible during review.

## Helper Script

Use `scripts/prepare_namu_alias_targets.py` to list target titles and direct NamuWiki mirror URLs:

```bash
python3 skills/generate-maimai-song-title-alias/scripts/prepare_namu_alias_targets.py \
  --limit 20
```

For a specific song:

```bash
python3 skills/generate-maimai-song-title-alias/scripts/prepare_namu_alias_targets.py \
  --title "タイトル"
```

The script emits JSON Lines with `title` and `namu_url`. It does not decide aliases; use it to avoid mistakes in title extraction, deduplication, and URL encoding. Use `--existing-tsv` only for ad hoc investigation, not for full generated TSV refreshes.

To follow HTTP redirects and emit the final URL when investigating specific titles, pass `--resolve-redirects`:

```bash
python3 skills/generate-maimai-song-title-alias/scripts/prepare_namu_alias_targets.py \
  --title "タイトル" \
  --resolve-redirects
```

## Output Rules

- Preserve TSV format as `title<TAB>alias1<TAB>alias2`. If no alias exists for that language, write a title-only row.
- Overwrite `maistats-song-info/src/songdb/data/en_generated_aliases.tsv` and `maistats-song-info/src/songdb/data/ko_generated_aliases.tsv` for full repo updates. Create the English file if it does not exist. Do not omit target songs from either file solely because no alias was found.
- Do not add source URLs to TSV rows.
- In user-facing summaries, include the NamuWiki source URL for each accepted alias group.
- If NamuWiki does not clearly identify the song or alias, leave the alias columns empty instead of guessing.
- Do not print cookies, credentials, or unrelated local data.

## Validation

For repo patches, run the smallest relevant checks:

```bash
cargo fmt --all
cargo test -p maistats-song-info aliases
```

If broader alias behavior changed, also run:

```bash
cargo test -p maistats-song-info
```
