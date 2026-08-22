use crate::BotData;
use crate::chart_links::linked_chart_label;
use crate::db;
use crate::embeds::{embed_base, format_level_with_internal};
use crate::emoji::{format_fc, format_rank, format_sync};
use eyre::WrapErr;
use maimai_client::{
    MaishiftChart, MaishiftRatingRange, MaishiftStats, RaveilleUserTierEntry,
    RecordCollectorClient, SongCatalogSong,
};
use models::{ChartType, DifficultyCategory, ScoreApiResponse};
use poise::serenity_prelude as serenity;
use rand::seq::SliceRandom;
use serenity::builder::{CreateMessage, CreateThread, EditThread};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use time::OffsetDateTime;

type Error = Box<dyn std::error::Error + Send + Sync>;
type PoiseContext<'a> = poise::Context<'a, BotData, Error>;

/// In-memory lock table preventing concurrent reaction handling for the same
/// user's session. Maps a user ID to the pick message ID currently being
/// processed. Session metadata itself lives in SQLite (`updown_sessions`).
pub(crate) type UpdownInFlightLocks = Arc<Mutex<HashMap<serenity::UserId, serenity::MessageId>>>;

const MIN_INTERNAL_LEVEL_STEP: isize = 10;
const MAX_INTERNAL_LEVEL_STEP: isize = 150;
const MIN_USER_TIER_STEP: isize = 1300;
const MAX_USER_TIER_STEP: isize = 1450;
pub(crate) const MAISHIFT_START_STEP: isize = 0;
const REACTION_DOWN: &str = "⬇️";
const REACTION_STAY: &str = "⏺️";
const REACTION_UP: &str = "⬆️";

#[derive(Debug, Clone)]
struct UpdownCandidate {
    title: String,
    image_name: Option<String>,
    version: Option<String>,
    chart_type: ChartType,
    diff_category: DifficultyCategory,
    level: String,
    internal_level: f32,
    user_tier: Option<String>,
    maishift_standing: Option<MaishiftStanding>,
    score: Option<ScoreApiResponse>,
}

#[derive(Debug, Clone)]
struct MaishiftStanding {
    position: usize,
    chart_count: usize,
    rank: String,
    achieved: u32,
    player_count: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, poise::ChoiceParameter)]
pub(crate) enum MaishiftLevel {
    #[name = "12"]
    Level12,
    #[name = "12+"]
    Level12Plus,
    #[name = "13"]
    Level13,
    #[name = "13+"]
    Level13Plus,
    #[name = "14"]
    Level14,
    #[name = "14+"]
    Level14Plus,
}

impl MaishiftLevel {
    pub(crate) const fn as_key(self) -> &'static str {
        match self {
            Self::Level12 => "LEVEL_12",
            Self::Level12Plus => "LEVEL_12_PLUS",
            Self::Level13 => "LEVEL_13",
            Self::Level13Plus => "LEVEL_13_PLUS",
            Self::Level14 => "LEVEL_14",
            Self::Level14Plus => "LEVEL_14_PLUS",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, poise::ChoiceParameter)]
pub(crate) enum MaishiftRank {
    #[name = "SSS+"]
    SssPlus,
    #[name = "SSS"]
    Sss,
    #[name = "SS+"]
    SsPlus,
    #[name = "SS"]
    Ss,
    #[name = "S+"]
    SPlus,
    #[name = "S"]
    S,
    #[name = "AAA"]
    Aaa,
}

impl MaishiftRank {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::SssPlus => "SSS+",
            Self::Sss => "SSS",
            Self::SsPlus => "SS+",
            Self::Ss => "SS",
            Self::SPlus => "S+",
            Self::S => "S",
            Self::Aaa => "AAA",
        }
    }
}

pub(crate) fn new_in_flight_locks() -> UpdownInFlightLocks {
    Arc::new(Mutex::new(HashMap::new()))
}

pub(crate) fn parse_level_tenths(value: f64) -> eyre::Result<isize> {
    eyre::ensure!(value.is_finite(), "Internal level must be a number.");

    let scaled = value * 10.0;
    let rounded = scaled.round();
    eyre::ensure!(
        (scaled - rounded).abs() < 1e-6,
        "Internal level must use 0.1 increments, for example `13.0`."
    );

    let tenths = rounded as isize;
    eyre::ensure!(
        (MIN_INTERNAL_LEVEL_STEP..=MAX_INTERNAL_LEVEL_STEP).contains(&tenths),
        "Internal level must be between 1.0 and 15.0."
    );

    Ok(tenths)
}

pub(crate) fn parse_user_tier_step(value: f64) -> eyre::Result<isize> {
    eyre::ensure!(value.is_finite(), "User tier must be a number.");

    let scaled = value * 100.0;
    let rounded = scaled.round();
    eyre::ensure!(
        (scaled - rounded).abs() < 1e-6 && (rounded as isize) % 5 == 0,
        "User tier must use 0.05 increments, for example `13.45`."
    );

    let step = rounded as isize;
    eyre::ensure!(
        (MIN_USER_TIER_STEP..=MAX_USER_TIER_STEP).contains(&step),
        "User tier must be between 13.00 and 14.50."
    );

    Ok(step)
}

pub(crate) async fn start_session(
    ctx: PoiseContext<'_>,
    record_collector_client: Option<RecordCollectorClient>,
    criterion: db::UpdownCriterion,
    start_step: isize,
    maishift_filter: Option<db::MaishiftSessionFilter>,
) -> Result<(), Error> {
    ensure_start_channel_supported(ctx).await?;

    let pools = build_candidate_pools(
        &ctx.data().song_database_client,
        record_collector_client.as_ref(),
        criterion,
        maishift_filter.as_ref(),
    )
    .await?;

    let Some(candidate) = choose_candidate_at_step(&pools, start_step) else {
        return Err(eyre::eyre!(
            "No eligible charts found at {} **{}** with the current filters.",
            criterion.subject_label(),
            criterion.format_step(start_step)
        )
        .into());
    };

    let root_message = ctx
        .channel_id()
        .send_message(
            ctx.serenity_context(),
            CreateMessage::new().embed(build_session_intro_embed(
                ctx.author().id,
                criterion,
                start_step,
                maishift_filter.as_ref(),
            )),
        )
        .await
        .inspect_err(|err| tracing::error!("{err:?}"))
        .wrap_err("send mai-updown root message")?;

    let thread_name = build_thread_name(criterion, start_step, maishift_filter.as_ref());
    let thread = ctx
        .channel_id()
        .create_thread_from_message(
            ctx.serenity_context(),
            root_message.id,
            CreateThread::new(thread_name)
                .auto_archive_duration(serenity::AutoArchiveDuration::OneHour),
        )
        .await
        .inspect_err(|err| tracing::error!("{err:?}"))
        .wrap_err("create mai-updown thread")?;

    let pick_message = send_pick_message(
        ctx.serenity_context(),
        ctx.data(),
        thread.id,
        &candidate,
        None,
    )
    .await?;

    let previous = db::get_updown_session(&ctx.data().db_pool, ctx.author().id)
        .await
        .wrap_err("load previous mai-updown session")?;

    {
        let mut guard = lock_in_flight(&ctx.data().updown_in_flight);
        guard.remove(&ctx.author().id);
    }

    db::upsert_updown_session(
        &ctx.data().db_pool,
        ctx.author().id,
        db::UpdownSessionUpsert {
            thread_channel_id: thread.id,
            pick_message_id: pick_message.id,
            criterion,
            current_step: start_step,
            maishift_filter: maishift_filter.as_ref(),
            now_unix: OffsetDateTime::now_utc().unix_timestamp(),
        },
    )
    .await
    .wrap_err("persist mai-updown session")?;

    if let Some(prev) = previous
        && prev.thread_channel_id != thread.id
    {
        archive_session_thread(ctx.serenity_context(), prev.thread_channel_id).await;
    }

    Ok(())
}

pub(crate) async fn handle_event(
    ctx: &serenity::Context,
    event: &serenity::FullEvent,
    data: &BotData,
) -> Result<(), Error> {
    match event {
        serenity::FullEvent::ReactionAdd { add_reaction } => {
            handle_reaction_add(ctx, data, add_reaction).await?;
        }
        serenity::FullEvent::ThreadUpdate { new, .. }
            if new
                .thread_metadata
                .as_ref()
                .is_some_and(|metadata| metadata.archived) =>
        {
            cleanup_session_for_thread(data, new.id).await;
        }
        serenity::FullEvent::ThreadDelete { thread, .. } => {
            cleanup_session_for_thread(data, thread.id).await;
        }
        _ => {}
    }

    Ok(())
}

async fn cleanup_session_for_thread(data: &BotData, thread_channel_id: serenity::ChannelId) {
    if let Err(err) = db::delete_updown_session_by_thread(&data.db_pool, thread_channel_id).await {
        tracing::warn!("delete mai-updown session row failed: {err:?}");
    }
}

async fn handle_reaction_add(
    ctx: &serenity::Context,
    data: &BotData,
    reaction: &serenity::Reaction,
) -> Result<(), Error> {
    let Some(user_id) = reaction.user_id else {
        return Ok(());
    };
    if user_id == ctx.cache.current_user().id {
        return Ok(());
    }
    if reaction
        .member
        .as_ref()
        .is_some_and(|member| member.user.bot)
        || ctx.cache.user(user_id).is_some_and(|user| user.bot)
    {
        return Ok(());
    }

    let Some(delta) = reaction_delta(&reaction.emoji) else {
        return Ok(());
    };

    let Some(session) = db::get_updown_session(&data.db_pool, user_id)
        .await
        .wrap_err("load mai-updown session")?
    else {
        return Ok(());
    };
    if session.pick_message_id != reaction.message_id {
        return Ok(());
    }

    if !try_acquire_in_flight(&data.updown_in_flight, user_id, session.pick_message_id) {
        return Ok(());
    }

    let result = process_reaction(ctx, data, &session, delta).await;
    release_in_flight(&data.updown_in_flight, user_id, session.pick_message_id);
    result
}

async fn process_reaction(
    ctx: &serenity::Context,
    data: &BotData,
    session: &db::PersistedUpdownSession,
    delta: isize,
) -> Result<(), Error> {
    let registration = db::get_registration(&data.db_pool, session.discord_user_id)
        .await
        .wrap_err("load user registration")?;
    let record_collector_client = registration.and_then(|registration| {
        match RecordCollectorClient::new(registration.record_collector_server_url) {
            Ok(client) => Some(client),
            Err(err) => {
                tracing::warn!("ignore invalid record collector during mai-updown: {err:#}");
                None
            }
        }
    });

    let criterion = session.criterion;
    let pools = build_candidate_pools(
        &data.song_database_client,
        record_collector_client.as_ref(),
        criterion,
        session.maishift_filter.as_ref(),
    )
    .await?;

    if !session_is_current(&data.db_pool, session).await? {
        tracing::info!(
            "mai-updown session for user {} was replaced during reaction processing; discarding pick for thread {}",
            session.discord_user_id,
            session.thread_channel_id
        );
        return Ok(());
    }

    let step_delta = criterion.step_size() * delta;
    let (new_step, candidate, note) =
        match pick_next_candidate(&pools, criterion, session.current_step, step_delta) {
            Ok(result) => result,
            Err(notice_msg) => {
                announce_session_notice(ctx, session.thread_channel_id, &notice_msg).await?;
                return Ok(());
            }
        };

    let pick_message =
        send_pick_message(ctx, data, session.thread_channel_id, &candidate, note).await?;

    let affected = db::update_updown_session_progress(
        &data.db_pool,
        session.discord_user_id,
        session.thread_channel_id,
        pick_message.id,
        new_step,
        OffsetDateTime::now_utc().unix_timestamp(),
    )
    .await
    .wrap_err("persist mai-updown session progress")?;

    if affected == 0 {
        tracing::info!(
            "mai-updown session row for user {} was removed during reaction processing; not resurrecting",
            session.discord_user_id
        );
    }

    Ok(())
}

async fn build_candidate_pools(
    song_database_client: &maimai_client::SongDatabaseClient,
    record_collector_client: Option<&RecordCollectorClient>,
    criterion: db::UpdownCriterion,
    maishift_filter: Option<&db::MaishiftSessionFilter>,
) -> eyre::Result<HashMap<isize, Vec<UpdownCandidate>>> {
    let scores = match record_collector_client {
        Some(client) => match client.get_all_rated_scores().await {
            Ok(scores) => scores,
            Err(err) => {
                tracing::warn!("omit personal records from mai-updown session: {err:#}");
                Vec::new()
            }
        },
        None => Vec::new(),
    };
    let mut score_map = HashMap::with_capacity(scores.len());
    for score in scores {
        score_map.insert(
            chart_identity_key(
                &score.title,
                &score.genre,
                &score.artist,
                score.chart_type,
                score.diff_category,
            ),
            score,
        );
    }

    let songs = song_database_client
        .list_song_catalog()
        .await
        .wrap_err("load song catalog")?;

    let mut pools: HashMap<isize, Vec<UpdownCandidate>> = HashMap::new();
    match criterion {
        db::UpdownCriterion::InternalLevel => {
            for song in songs {
                append_internal_level_candidates(&mut pools, &song, &score_map);
            }
        }
        db::UpdownCriterion::UserTier => {
            let user_tier_map = build_user_tier_map(
                song_database_client
                    .list_raveille_user_tiers()
                    .await
                    .wrap_err("load Raveille user tiers")?,
            )?;
            for song in songs {
                append_user_tier_candidates(&mut pools, &song, &score_map, &user_tier_map);
            }
        }
        db::UpdownCriterion::Maishift => {
            let filter = maishift_filter
                .ok_or_else(|| eyre::eyre!("maishift session is missing its filters"))?;
            return build_maishift_candidate_pools(
                song_database_client
                    .get_maishift_stats()
                    .await
                    .wrap_err("load maishift statistics")?,
                &songs,
                &score_map,
                filter,
            );
        }
    }

    Ok(pools)
}

async fn ensure_start_channel_supported(ctx: PoiseContext<'_>) -> Result<(), Error> {
    let channel = ctx
        .channel_id()
        .to_channel(ctx.serenity_context())
        .await
        .wrap_err("load mai-updown channel")?;

    let Some(channel) = channel.guild() else {
        return Ok(());
    };

    if channel.thread_metadata.is_some() {
        return Err(eyre::eyre!(
            "mai-updown can only be started from a regular server channel, not inside an existing thread."
        )
        .into());
    }

    Ok(())
}

fn append_internal_level_candidates(
    pools: &mut HashMap<isize, Vec<UpdownCandidate>>,
    song: &SongCatalogSong,
    score_map: &HashMap<String, ScoreApiResponse>,
) {
    for sheet in &song.sheets {
        if !sheet.region.intl {
            continue;
        }

        let Some(internal_level) = sheet.internal_level else {
            continue;
        };
        let level_tenths = internal_level_tenths(internal_level);

        let score_key = chart_identity_key(
            &song.title,
            &song.genre,
            &song.artist,
            sheet.chart_type,
            sheet.diff_category,
        );
        let score = score_map.get(&score_key).cloned();

        pools
            .entry(level_tenths)
            .or_default()
            .push(UpdownCandidate {
                title: song.title.clone(),
                image_name: song.image_name.clone(),
                version: sheet.version.clone(),
                chart_type: sheet.chart_type,
                diff_category: sheet.diff_category,
                level: sheet.level.clone(),
                internal_level,
                user_tier: None,
                maishift_standing: None,
                score,
            });
    }
}

fn append_user_tier_candidates(
    pools: &mut HashMap<isize, Vec<UpdownCandidate>>,
    song: &SongCatalogSong,
    score_map: &HashMap<String, ScoreApiResponse>,
    user_tier_map: &HashMap<String, UserTierAssignment>,
) {
    for sheet in &song.sheets {
        if !sheet.region.intl {
            continue;
        }

        let Some(internal_level) = sheet.internal_level else {
            continue;
        };

        let score_key = chart_identity_key(
            &song.title,
            &song.genre,
            &song.artist,
            sheet.chart_type,
            sheet.diff_category,
        );
        let Some(user_tier) = user_tier_map.get(&score_key) else {
            continue;
        };
        let score = score_map.get(&score_key).cloned();

        pools
            .entry(user_tier.step)
            .or_default()
            .push(UpdownCandidate {
                title: song.title.clone(),
                image_name: song.image_name.clone(),
                version: sheet.version.clone(),
                chart_type: sheet.chart_type,
                diff_category: sheet.diff_category,
                level: sheet.level.clone(),
                internal_level,
                user_tier: Some(user_tier.label.clone()),
                maishift_standing: None,
                score,
            });
    }
}

#[derive(Debug, Clone)]
struct UserTierAssignment {
    step: isize,
    label: String,
}

fn build_user_tier_map(
    entries: Vec<RaveilleUserTierEntry>,
) -> eyre::Result<HashMap<String, UserTierAssignment>> {
    let mut map = HashMap::with_capacity(entries.len());
    for entry in entries {
        let step = parse_user_tier_label(&entry.user_tier)?;
        let key = chart_identity_key(
            &entry.title,
            &entry.genre,
            &entry.artist,
            entry.chart_type,
            entry.difficulty,
        );
        map.insert(
            key,
            UserTierAssignment {
                step,
                label: entry.user_tier,
            },
        );
    }
    Ok(map)
}

fn build_maishift_candidate_pools(
    stats: MaishiftStats,
    songs: &[SongCatalogSong],
    score_map: &HashMap<String, ScoreApiResponse>,
    filter: &db::MaishiftSessionFilter,
) -> eyre::Result<HashMap<isize, Vec<UpdownCandidate>>> {
    let rating_range = find_maishift_rating_range(&stats.rating_ranges, filter.rating)
        .ok_or_else(|| eyre::eyre!("Rating must be between 13000 and 16999."))?;
    let rating_key = rating_range.index.to_string();
    let charts_by_key: HashMap<_, _> = stats
        .charts
        .iter()
        .filter(|chart| chart.display_level == filter.level)
        .map(|chart| (maishift_chart_key(chart), chart))
        .collect();
    let level_chart_count = charts_by_key.len();
    let mut ranked = Vec::new();

    for song in songs {
        for sheet in &song.sheets {
            if !sheet.region.intl || sheet.level != format_maishift_level(&filter.level) {
                continue;
            }
            let key = simple_chart_key(&song.title, sheet.chart_type, sheet.diff_category);
            let Some(maishift_chart) = charts_by_key.get(&key) else {
                continue;
            };
            let Some(chart_stats) = maishift_chart.stats.get(&rating_key) else {
                continue;
            };
            let Some(&achieved) = chart_stats.achieved.get(&filter.rank) else {
                continue;
            };
            if chart_stats.total == 0 {
                continue;
            }
            let Some(internal_level) = sheet.internal_level else {
                continue;
            };
            let score_key = chart_identity_key(
                &song.title,
                &song.genre,
                &song.artist,
                sheet.chart_type,
                sheet.diff_category,
            );
            ranked.push((
                achieved,
                chart_stats.total,
                UpdownCandidate {
                    title: song.title.clone(),
                    image_name: song.image_name.clone(),
                    version: sheet.version.clone(),
                    chart_type: sheet.chart_type,
                    diff_category: sheet.diff_category,
                    level: sheet.level.clone(),
                    internal_level,
                    user_tier: None,
                    maishift_standing: None,
                    score: score_map.get(&score_key).cloned(),
                },
            ));
        }
    }

    ranked.sort_by(|left, right| {
        let left_scaled = u64::from(left.0) * u64::from(right.1);
        let right_scaled = u64::from(right.0) * u64::from(left.1);
        right_scaled
            .cmp(&left_scaled)
            .then_with(|| left.2.title.cmp(&right.2.title))
    });

    let count = ranked.len();
    let mut pools: HashMap<isize, Vec<UpdownCandidate>> = HashMap::new();
    for (index, (achieved, player_count, mut candidate)) in ranked.into_iter().enumerate() {
        let decile = decile_for_ranked_index(index, count);
        candidate.maishift_standing = Some(MaishiftStanding {
            position: index + 1,
            chart_count: level_chart_count,
            rank: filter.rank.clone(),
            achieved,
            player_count,
        });
        pools.entry(decile).or_default().push(candidate);
    }
    Ok(pools)
}

fn find_maishift_rating_range(
    ranges: &[MaishiftRatingRange],
    rating: i32,
) -> Option<&MaishiftRatingRange> {
    ranges
        .iter()
        .find(|range| (range.min..range.max_exclusive).contains(&rating))
}

fn decile_for_ranked_index(index: usize, count: usize) -> isize {
    ((index * 10) / count).min(9) as isize
}

fn maishift_chart_key(chart: &MaishiftChart) -> String {
    simple_chart_key(&chart.song_title, chart.chart_type, chart.difficulty)
}

fn simple_chart_key(
    title: &str,
    chart_type: ChartType,
    diff_category: DifficultyCategory,
) -> String {
    format!(
        "{title}\u{1f}{}\u{1f}{}",
        chart_type.as_str(),
        diff_category.as_str()
    )
}

fn choose_candidate_at_step(
    pools: &HashMap<isize, Vec<UpdownCandidate>>,
    step: isize,
) -> Option<UpdownCandidate> {
    let candidates = pools.get(&step)?;
    let mut rng = rand::thread_rng();
    candidates.choose(&mut rng).cloned()
}

fn pick_next_candidate(
    pools: &HashMap<isize, Vec<UpdownCandidate>>,
    criterion: db::UpdownCriterion,
    current_step: isize,
    step_delta: isize,
) -> Result<(isize, UpdownCandidate, Option<String>), String> {
    if step_delta == 0 {
        return match choose_candidate_at_step(pools, current_step) {
            Some(candidate) => Ok((current_step, candidate, None)),
            None => Err(format!(
                "No eligible charts found at **{}** with the current filters. Keeping the current {}.",
                criterion.format_step(current_step),
                criterion.subject_label()
            )),
        };
    }

    let requested_step = current_step + step_delta;
    match choose_candidate_in_direction(pools, criterion, current_step, step_delta) {
        Some((found_step, candidate)) => {
            let note = (found_step != requested_step).then(|| {
                format!(
                    "No eligible chart at **{}**. Jumped to **{}** instead.",
                    criterion.format_step(requested_step),
                    criterion.format_step(found_step)
                )
            });
            Ok((found_step, candidate, note))
        }
        None => Err(format!(
            "No eligible chart found before leaving the {} range. Keeping **{}**.",
            criterion.range_label(),
            criterion.format_step(current_step)
        )),
    }
}

fn choose_candidate_in_direction(
    pools: &HashMap<isize, Vec<UpdownCandidate>>,
    criterion: db::UpdownCriterion,
    current_step: isize,
    step_delta: isize,
) -> Option<(isize, UpdownCandidate)> {
    let mut next_step = current_step + step_delta;
    while criterion.contains_step(next_step) {
        if let Some(candidate) = choose_candidate_at_step(pools, next_step) {
            return Some((next_step, candidate));
        }
        next_step += step_delta;
    }

    None
}

fn build_session_intro_embed(
    user_id: serenity::UserId,
    criterion: db::UpdownCriterion,
    start_step: isize,
    maishift_filter: Option<&db::MaishiftSessionFilter>,
) -> serenity::CreateEmbed {
    let source_note = match criterion {
        db::UpdownCriterion::InternalLevel => None,
        db::UpdownCriterion::UserTier => {
            Some("Uses Raveille's tier list converted through Lomo's internal-level mapping.")
        }
        db::UpdownCriterion::Maishift => {
            Some("Uses maishift achievement rates and starts within the easiest 10% of charts.")
        }
    };
    let source_line = source_note
        .map(|note| format!("{note}\n"))
        .unwrap_or_default();
    let filter_line = maishift_filter
        .map(|filter| {
            format!(
                "Level: **{}** • Rating: **{}** • Rank: **{}**\n",
                format_maishift_level(&filter.level),
                filter.rating,
                filter.rank
            )
        })
        .unwrap_or_default();
    embed_base(criterion.started_title()).description(format!(
        "Started by <@{}>\n\
         {source_line}\
         {filter_line}\
         Start {}: **{}**\n\
         Controls: {REACTION_DOWN} `{}` • {REACTION_STAY} `{}` • {REACTION_UP} `{}`",
        user_id.get(),
        criterion.subject_label(),
        criterion.format_step(start_step),
        criterion.format_delta(-criterion.step_size()),
        criterion.format_zero_delta(),
        criterion.format_delta(criterion.step_size()),
    ))
}

fn build_pick_embed(data: &BotData, candidate: &UpdownCandidate) -> serenity::CreateEmbed {
    let level = format_level_with_internal(&candidate.level, Some(candidate.internal_level));
    let chart_line = linked_chart_label(
        &candidate.title,
        candidate.chart_type,
        candidate.diff_category,
        &level,
    );
    let version_line = candidate
        .version
        .as_deref()
        .map(|version| format!("Version: {version}"))
        .unwrap_or_else(|| "Version: -".to_string());
    let score = candidate.score.as_ref();
    let achievement = score
        .and_then(|s| s.achievement_x10000)
        .map(format_rate_x10000)
        .unwrap_or_else(|| "Unplayed".to_string());
    let rank = format_rank(&data.status_emojis, score.and_then(|s| s.rank), "-");
    let fc = format_fc(&data.status_emojis, score.and_then(|s| s.fc), "-");
    let sync = format_sync(&data.status_emojis, score.and_then(|s| s.sync), "-");
    let meta = [
        candidate
            .user_tier
            .as_deref()
            .map(|value| format!("User tier: {value}")),
        candidate
            .maishift_standing
            .as_ref()
            .map(format_maishift_standing),
        score
            .and_then(|s| s.last_played_at.as_deref())
            .map(|value| format!("Last: {value}")),
        score
            .and_then(|s| s.play_count)
            .map(|value| format!("Plays: {value}")),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" • ");

    let mut embed = embed_base(&candidate.title).description(format!(
        "**{chart_line}**\n\
         {version_line}\n\
         {achievement} • {rank} • {fc} • {sync}\n\
         {meta}"
    ));
    if let Some(image_name) = candidate.image_name.as_deref() {
        embed = embed.thumbnail(data.song_database_client.cover_url(image_name));
    }
    embed
}

async fn send_pick_message(
    cache_http: impl serenity::CacheHttp,
    data: &BotData,
    thread_channel_id: serenity::ChannelId,
    candidate: &UpdownCandidate,
    note: Option<String>,
) -> Result<serenity::Message, Error> {
    let mut builder = CreateMessage::new().embed(build_pick_embed(data, candidate));
    if let Some(note) = note {
        builder = builder.content(note);
    }

    let message = thread_channel_id
        .send_message(&cache_http, builder)
        .await
        .wrap_err("send mai-updown pick message")?;

    for emoji in [REACTION_DOWN, REACTION_STAY, REACTION_UP] {
        if let Err(err) = message
            .react(
                cache_http.http(),
                serenity::ReactionType::Unicode(emoji.to_string()),
            )
            .await
        {
            tracing::error!("{err:?}");
            if let Err(delete_err) = message.delete(cache_http.http()).await {
                tracing::warn!(
                    "failed to delete incomplete mai-updown pick message: {delete_err:#}"
                );
            }
            return Err(eyre::eyre!("add mai-updown pick reaction: {err}").into());
        }
    }

    Ok(message)
}

async fn announce_session_notice(
    cache_http: impl serenity::CacheHttp,
    thread_channel_id: serenity::ChannelId,
    message: &str,
) -> Result<(), Error> {
    thread_channel_id
        .say(cache_http, message)
        .await
        .wrap_err("send mai-updown session notice")?;

    Ok(())
}

async fn archive_session_thread(
    cache_http: impl serenity::CacheHttp,
    thread_channel_id: serenity::ChannelId,
) {
    if let Err(err) = thread_channel_id
        .edit_thread(cache_http, EditThread::new().archived(true))
        .await
    {
        tracing::warn!(
            "failed to archive previous mai-updown thread {}: {err:#}",
            thread_channel_id
        );
    }
}

async fn session_is_current(
    pool: &db::SqlitePool,
    snapshot: &db::PersistedUpdownSession,
) -> eyre::Result<bool> {
    let current = db::get_updown_session(pool, snapshot.discord_user_id)
        .await
        .wrap_err("reload mai-updown session")?;
    Ok(current.is_some_and(|current| {
        current.thread_channel_id == snapshot.thread_channel_id
            && current.pick_message_id == snapshot.pick_message_id
    }))
}

fn try_acquire_in_flight(
    locks: &UpdownInFlightLocks,
    user_id: serenity::UserId,
    pick_message_id: serenity::MessageId,
) -> bool {
    let mut guard = lock_in_flight(locks);
    match guard.entry(user_id) {
        std::collections::hash_map::Entry::Occupied(_) => false,
        std::collections::hash_map::Entry::Vacant(slot) => {
            slot.insert(pick_message_id);
            true
        }
    }
}

fn release_in_flight(
    locks: &UpdownInFlightLocks,
    user_id: serenity::UserId,
    pick_message_id: serenity::MessageId,
) {
    let mut guard = lock_in_flight(locks);
    if guard.get(&user_id) == Some(&pick_message_id) {
        guard.remove(&user_id);
    }
}

fn lock_in_flight(
    locks: &UpdownInFlightLocks,
) -> MutexGuard<'_, HashMap<serenity::UserId, serenity::MessageId>> {
    locks.lock().expect("mai-updown in-flight lock")
}

fn internal_level_tenths(value: f32) -> isize {
    (value as f64 * 10.0).round() as isize
}

fn parse_user_tier_label(value: &str) -> eyre::Result<isize> {
    value
        .parse::<f64>()
        .wrap_err("parse user tier label")
        .and_then(parse_user_tier_step)
}

impl db::UpdownCriterion {
    pub(crate) fn parse_start_value(self, value: f64) -> eyre::Result<isize> {
        match self {
            Self::InternalLevel => parse_level_tenths(value),
            Self::UserTier => parse_user_tier_step(value),
            Self::Maishift => Err(eyre::eyre!("maishift does not use a starting value")),
        }
    }

    fn started_title(self) -> &'static str {
        match self {
            Self::InternalLevel | Self::UserTier | Self::Maishift => "mai-updown started",
        }
    }

    fn thread_prefix(self) -> &'static str {
        match self {
            Self::InternalLevel | Self::UserTier | Self::Maishift => "mai-updown",
        }
    }

    fn subject_label(self) -> &'static str {
        match self {
            Self::InternalLevel => "internal level",
            Self::UserTier => "user tier",
            Self::Maishift => "difficulty percentile",
        }
    }

    fn range_label(self) -> &'static str {
        match self {
            Self::InternalLevel => "1.0-15.0",
            Self::UserTier => "13.00-14.50",
            Self::Maishift => "0-100% difficulty percentile",
        }
    }

    fn step_size(self) -> isize {
        match self {
            Self::InternalLevel | Self::Maishift => 1,
            Self::UserTier => 5,
        }
    }

    fn contains_step(self, step: isize) -> bool {
        match self {
            Self::InternalLevel => {
                (MIN_INTERNAL_LEVEL_STEP..=MAX_INTERNAL_LEVEL_STEP).contains(&step)
            }
            Self::UserTier => (MIN_USER_TIER_STEP..=MAX_USER_TIER_STEP).contains(&step),
            Self::Maishift => (0..=9).contains(&step),
        }
    }

    fn format_step(self, step: isize) -> String {
        match self {
            Self::InternalLevel => format_level_tenths(step),
            Self::UserTier => format_user_tier_step(step),
            Self::Maishift => format!("{}-{}%", step * 10, (step + 1) * 10),
        }
    }

    fn format_delta(self, delta: isize) -> String {
        match self {
            Self::InternalLevel => format!("{:+.1}", delta as f64 / 10.0),
            Self::UserTier => format!("{:+.2}", delta as f64 / 100.0),
            Self::Maishift if delta < 0 => "easier".to_string(),
            Self::Maishift => "harder".to_string(),
        }
    }

    fn format_zero_delta(self) -> &'static str {
        match self {
            Self::InternalLevel => "±0.0",
            Self::UserTier => "±0.00",
            Self::Maishift => "same",
        }
    }
}

fn build_thread_name(
    criterion: db::UpdownCriterion,
    start_step: isize,
    maishift_filter: Option<&db::MaishiftSessionFilter>,
) -> String {
    if let (db::UpdownCriterion::Maishift, Some(filter)) = (criterion, maishift_filter) {
        return format!(
            "mai-updown maishift Lv.{} {} {}",
            format_maishift_level(&filter.level),
            filter.rating,
            filter.rank
        );
    }

    format!(
        "{} {}",
        criterion.thread_prefix(),
        criterion.format_step(start_step)
    )
}

fn format_maishift_standing(standing: &MaishiftStanding) -> String {
    format!(
        "maishift: {}/{} ({} {:.1}%)",
        standing.position,
        standing.chart_count,
        standing.rank,
        standing.achieved as f64 / standing.player_count as f64 * 100.0
    )
}

fn format_maishift_level(level: &str) -> &str {
    match level {
        "LEVEL_12" => "12",
        "LEVEL_12_PLUS" => "12+",
        "LEVEL_13" => "13",
        "LEVEL_13_PLUS" => "13+",
        "LEVEL_14" => "14",
        "LEVEL_14_PLUS" => "14+",
        _ => level,
    }
}

fn chart_identity_key(
    title: &str,
    genre: &str,
    artist: &str,
    chart_type: ChartType,
    diff_category: DifficultyCategory,
) -> String {
    format!(
        "{title}\u{1f}{genre}\u{1f}{artist}\u{1f}{}\u{1f}{}",
        chart_type.as_str(),
        diff_category.as_str(),
    )
}

fn format_level_tenths(level_tenths: isize) -> String {
    format!("{:.1}", level_tenths as f64 / 10.0)
}

fn format_user_tier_step(step: isize) -> String {
    format!("{:.2}", step as f64 / 100.0)
}

fn format_rate_x10000(value: i64) -> String {
    format!("{:.4}%", value as f64 / 10000.0)
}

fn reaction_delta(emoji: &serenity::ReactionType) -> Option<isize> {
    if emoji.unicode_eq(REACTION_DOWN) {
        Some(-1)
    } else if emoji.unicode_eq(REACTION_STAY) {
        Some(0)
    } else if emoji.unicode_eq(REACTION_UP) {
        Some(1)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{
        MIN_INTERNAL_LEVEL_STEP, MaishiftStanding, build_thread_name, decile_for_ranked_index,
        find_maishift_rating_range, format_maishift_standing, parse_level_tenths,
        parse_user_tier_step, reaction_delta,
    };
    use crate::db::{MaishiftSessionFilter, UpdownCriterion};
    use maimai_client::MaishiftRatingRange;
    use poise::serenity_prelude as serenity;

    #[test]
    fn parse_level_requires_one_decimal_step() {
        assert_eq!(parse_level_tenths(13.0).unwrap(), 130);
        assert_eq!(parse_level_tenths(1.0).unwrap(), MIN_INTERNAL_LEVEL_STEP);
        assert!(parse_level_tenths(13.05).is_err());
        assert!(parse_level_tenths(15.1).is_err());
    }

    #[test]
    fn parse_user_tier_requires_five_hundredths_step() {
        assert_eq!(parse_user_tier_step(13.00).unwrap(), 1300);
        assert_eq!(parse_user_tier_step(13.45).unwrap(), 1345);
        assert_eq!(parse_user_tier_step(14.50).unwrap(), 1450);
        assert!(parse_user_tier_step(12.95).is_err());
        assert!(parse_user_tier_step(13.03).is_err());
        assert!(parse_user_tier_step(14.55).is_err());
    }

    #[test]
    fn criterion_selects_the_matching_start_value_parser() {
        assert_eq!(
            UpdownCriterion::InternalLevel
                .parse_start_value(13.0)
                .unwrap(),
            130
        );
        assert_eq!(
            UpdownCriterion::UserTier.parse_start_value(13.45).unwrap(),
            1345
        );
        assert!(
            UpdownCriterion::InternalLevel
                .parse_start_value(13.05)
                .is_err()
        );
        assert!(UpdownCriterion::UserTier.parse_start_value(13.03).is_err());
    }

    #[test]
    fn reaction_delta_matches_controls() {
        assert_eq!(
            reaction_delta(&serenity::ReactionType::Unicode("⬇️".to_string())),
            Some(-1)
        );
        assert_eq!(
            reaction_delta(&serenity::ReactionType::Unicode("⏺️".to_string())),
            Some(0)
        );
        assert_eq!(
            reaction_delta(&serenity::ReactionType::Unicode("⬆️".to_string())),
            Some(1)
        );
    }

    #[test]
    fn ranked_charts_are_split_into_ten_deciles() {
        let deciles = (0..100)
            .map(|index| decile_for_ranked_index(index, 100))
            .collect::<Vec<_>>();
        for decile in 0..10 {
            assert_eq!(deciles.iter().filter(|&&value| value == decile).count(), 10);
        }
        assert_eq!(decile_for_ranked_index(0, 13), 0);
        assert_eq!(decile_for_ranked_index(12, 13), 9);
    }

    #[test]
    fn maishift_rating_uses_the_containing_half_open_range() {
        let ranges = vec![
            MaishiftRatingRange {
                index: 4,
                min: 14500,
                max_exclusive: 14750,
            },
            MaishiftRatingRange {
                index: 5,
                min: 14750,
                max_exclusive: 15000,
            },
        ];

        assert_eq!(
            find_maishift_rating_range(&ranges, 14749).map(|range| range.index),
            Some(4)
        );
        assert_eq!(
            find_maishift_rating_range(&ranges, 14750).map(|range| range.index),
            Some(5)
        );
        assert!(find_maishift_rating_range(&ranges, 15000).is_none());
    }

    #[test]
    fn maishift_labels_show_chart_rank_and_plain_controls() {
        let filter = MaishiftSessionFilter {
            level: "LEVEL_14_PLUS".to_string(),
            rating: 15000,
            rank: "SSS+".to_string(),
        };
        assert_eq!(
            build_thread_name(UpdownCriterion::Maishift, 0, Some(&filter)),
            "mai-updown maishift Lv.14+ 15000 SSS+"
        );
        assert_eq!(
            format_maishift_standing(&MaishiftStanding {
                position: 10,
                chart_count: 500,
                rank: "SSS+".to_string(),
                achieved: 702,
                player_count: 1000,
            }),
            "maishift: 10/500 (SSS+ 70.2%)"
        );
        assert_eq!(UpdownCriterion::Maishift.format_delta(-1), "easier");
        assert_eq!(UpdownCriterion::Maishift.format_zero_delta(), "same");
        assert_eq!(UpdownCriterion::Maishift.format_delta(1), "harder");
    }
}
