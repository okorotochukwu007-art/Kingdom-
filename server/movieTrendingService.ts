import { store } from './store.ts';
import {
  buildScoredKingdomVideo,
  computeVideoRankingMetrics,
  enrichVideosWithYouTubeApiV3,
  fetchChannelVideosViaOfficialXmlFeed,
  parseIsoDurationToSeconds,
  searchYouTubeStructured,
} from './youtubeService.ts';
import { isSecularQuery } from './intelligentDiscoveryService.ts';
import { KingdomChannel, KingdomVideo } from '../src/types/kingdom.ts';

export interface MovieTrendingAlert {
  id: string;
  badge: 'New Release' | 'Trending Christian Movie';
  caption: string;
  searchKeyword: string;
  studioName: string;
  publishedAt: string;
  viewCount: number;
  viewsPerDay: number;
  source: 'studio_feed' | 'youtube_trending_search' | 'catalog';
  video: KingdomVideo;
}

export interface MovieTrendingCheckResult {
  checkedAt: string;
  alerts: MovieTrendingAlert[];
  newlyIndexedCount: number;
  totalMoviesIndexed: number;
}

const MOVIE_CATEGORY_SLUGS = new Set([
  'real-christian-movies',
  'bible-stories',
  'christian-animations',
  'bible-story-cartoons',
]);

const CHRISTIAN_CINEMA_POSITIVE_REGEX =
  /\b(christian\s+(movie|film|drama|cinema)|gospel\s+(movie|film|drama)|faith[- ]based\s+(movie|film|drama)|biblical\s+(movie|film|epic|story)|mount zion|bamiloye|evom|jaymikee|the winlos|winlos|flaming sword|god'?s not dead|war room|the chosen|angel studios|vision video|superbook|jesus|christ|holy spirit|salvation|redemption|deliverance|spiritual warfare|prayer|pastor|apostle|church drama|christian love story|christian family)\b/i;

const MOVIE_FORMAT_CUES_REGEX =
  /\b(movie|film|drama|cinema|episode|season|part\s*\d+|full\s+movie|story|stories|mount zion|bamiloye|jaymikee|the winlos|superbook|the chosen|angel studios|vision video|animation|cartoon)\b/i;

const NON_MOVIE_OR_TRAILER_REGEX =
  /\b(#shorts|trailer only|official trailer|teaser|reaction video|movie review|explained|ending explained|recap|soundtrack only|lyrics video|vlog|podcast|interview|behind the scenes|prank|nollywood 18\+|explicit|horror movie|slasher|zombie|vampire|english clip|\bclip\b|sneak peek|funtime|promo|channel trailer|subscribe now|ministers conference|female ministers|sunday service|midweek service)\b/i;

const SECULAR_CINEMA_BLOCK_REGEX =
  /\b(bollywood|k-drama|kdrama|korean drama|hollywood action|adult movie|18\+ only|sexy|romance 18\+|occult|juju ritual|ritualist|blood money|afrobeats|hip hop)\b/i;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes for responsive auto-updates
let cachedCheckResult: MovieTrendingCheckResult | null = null;
let lastCheckedMs = 0;
let inFlightCheck: Promise<MovieTrendingCheckResult> | null = null;

/**
 * Strictly validates that a candidate video is an authentic Christian movie/drama/Bible film
 * (never secular films, trailers-only, or short clips).
 */
export function isVerifiedChristianMovie(params: {
  title: string;
  description?: string;
  channelTitle?: string;
  durationSeconds?: number | null;
  isApprovedStudio?: boolean;
}): boolean {
  const title = (params.title || '').trim();
  const description = (params.description || '').trim();
  const channelTitle = (params.channelTitle || '').trim();
  const combined = `${title} ${description} ${channelTitle}`.trim();

  if (!title) return false;
  if (isSecularQuery(combined)) return false;
  if (SECULAR_CINEMA_BLOCK_REGEX.test(combined)) return false;
  if (NON_MOVIE_OR_TRAILER_REGEX.test(title)) return false;

  // Reject short trailers/clips (< 5 minutes) when duration is known
  if (
    typeof params.durationSeconds === 'number' &&
    params.durationSeconds > 0 &&
    params.durationSeconds < 300
  ) {
    return false;
  }

  // Official approved Christian movie/animation studios in KINGDOM+ pass once secular/trailer checks clear
  if (params.isApprovedStudio) {
    if (/\b(channel trailer|subscribe now|how to subscribe|announcement|update video)\b/i.test(title)) {
      return false;
    }
    return true;
  }

  // External YouTube discoveries must carry clear Christian faith signals AND movie/drama cues
  const hasChristianSignal = CHRISTIAN_CINEMA_POSITIVE_REGEX.test(combined);
  const hasMovieCue = MOVIE_FORMAT_CUES_REGEX.test(`${title} ${channelTitle}`);
  return hasChristianSignal && hasMovieCue;
}

/**
 * Extracts a crisp search phrase from a movie title so users can type or search it easily in the app.
 */
export function buildMovieSearchKeyword(title: string): string {
  let cleaned = title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .split(/[|•—–]/)[0]
    .replace(
      /\b(full\s+christian\s+movie|full\s+movie|christian\s+movie|nigerian\s+christian\s+movie|latest\s+christian\s+movie|new\s+christian\s+movie|mount\s+zion\s+film|official\s+movie|2024|2025|2026|hd|4k)\b/gi,
      ' '
    )
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = title
      .replace(/[^\w\s'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const words = cleaned.split(' ').filter(Boolean).slice(0, 5);
  const STOP_TRAILING = new Set(['the', 'a', 'an', 'of', 'in', 'to', 'and', 'for', 'on', 'at', 'by', 'with']);
  while (words.length > 2 && STOP_TRAILING.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(' ') || title.slice(0, 36).trim();
}

function formatCompactViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${Math.round(views / 1_000)}K`;
  return String(views);
}

function isMovieCatalogVideo(v: KingdomVideo): boolean {
  return (
    MOVIE_CATEGORY_SLUGS.has(v.primary_category_slug) ||
    v.secondary_category_slugs.some((s) => MOVIE_CATEGORY_SLUGS.has(s)) ||
    v.channel_type === 'movie_studio' ||
    v.channel_type === 'animation_studio'
  );
}

async function searchYouTubeChristianMoviesLive(query: string, maxResults = 10): Promise<KingdomVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const isKeyConfigured = apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY';
  const movieCategory =
    store.state.categories.find((c) => c.slug === 'real-christian-movies') || store.state.categories[0];

  const convertStructured = async (): Promise<KingdomVideo[]> => {
    const items = await searchYouTubeStructured(query, maxResults);
    const out: KingdomVideo[] = [];
    for (const item of items) {
      if (
        !isVerifiedChristianMovie({
          title: item.title,
          description: item.description,
          channelTitle: item.channelTitle,
          durationSeconds: item.durationSeconds,
          isApprovedStudio: false,
        })
      ) {
        continue;
      }

      const metrics = computeVideoRankingMetrics({
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        publishedAt: item.publishedAt,
        isNigerianChannel: /nigerian|mount zion|bamiloye|jaymikee|winlos|evom|flaming sword/i.test(
          `${item.title} ${item.channelTitle}`
        ),
        isOfficialVerified: true,
        priorityWeight: 1.15,
      });

      out.push({
        id: `vid-${item.youtubeVideoId}`,
        youtube_video_id: item.youtubeVideoId,
        channel_id: `ch-${item.youtubeChannelId || 'discovered-cinema'}`,
        channel_title: item.channelTitle,
        channel_handle: `@${item.channelTitle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'ChristianCinema'}`,
        channel_type: 'movie_studio',
        channel_avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          item.channelTitle
        )}&background=27272a&color=f59e0b`,
        is_nigerian_channel: /nigerian|mount zion|bamiloye|jaymikee|winlos|evom/i.test(
          `${item.title} ${item.channelTitle}`
        ),
        is_official_verified: true,
        primary_category_id: movieCategory?.id || 'cat-movies',
        primary_category_slug: 'real-christian-movies',
        primary_category_name: 'Christian Feature Movies',
        secondary_category_slugs: [],
        subcategory_label: 'New & Trending Release',
        title: item.title,
        description: item.description,
        thumbnail_high_url: item.thumbnailHighUrl,
        thumbnail_maxres_url: item.thumbnailMaxresUrl,
        published_at: item.publishedAt,
        duration_seconds: item.durationSeconds,
        view_count: item.viewCount,
        like_count: item.likeCount,
        likes_verified: Boolean(item.likesVerified),
        comment_count: item.commentCount,
        views_per_day: metrics.viewsPerDay,
        engagement_rate: metrics.engagementRate,
        trending_score: metrics.trendingScore,
        evergreen_score: metrics.evergreenScore,
        quality_score: metrics.qualityScore,
        live_broadcast_content: 'none',
        is_live_now: false,
        is_embeddable: true,
        is_available: true,
        approval_status: 'approved',
        is_featured_hero: false,
        is_trending_pinned: false,
        ai_classification_reason: 'Verified Christian Movie release watcher',
        last_refreshed_at: new Date().toISOString(),
      } as KingdomVideo);
    }
    return out;
  };

  if (!isKeyConfigured) {
    return convertStructured();
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('order', 'relevance');
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('videoDuration', 'long');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('key', apiKey!);

    const searchRes = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(6000) });
    store.logYouTubeQuota('search.list', 100, maxResults, searchRes.status, `Movie watcher: ${query}`);

    if (!searchRes.ok) {
      return convertStructured();
    }

    const searchData = await searchRes.json();
    const items = searchData.items || [];
    const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'snippet,contentDetails,statistics,status');
    videosUrl.searchParams.set('id', videoIds.join(','));
    videosUrl.searchParams.set('key', apiKey!);

    const videosRes = await fetch(videosUrl.toString(), { signal: AbortSignal.timeout(6000) });
    store.logYouTubeQuota('videos.list', 1, videoIds.length, videosRes.status, `Enrich movie watcher: ${videoIds.length}`);
    const videosData = videosRes.ok ? await videosRes.json() : { items: [] };
    const detailsMap = new Map<string, any>();
    for (const v of videosData.items || []) {
      detailsMap.set(v.id, v);
    }

    const out: KingdomVideo[] = [];
    for (const item of items) {
      const vId = item.id?.videoId;
      if (!vId) continue;
      const details = detailsMap.get(vId);
      if (details?.status?.embeddable === false) continue;

      const snippet = details?.snippet || item.snippet || {};
      const title = snippet.title || '';
      const description = snippet.description || '';
      const channelTitle = snippet.channelTitle || 'Christian Cinema Studio';
      const durationSeconds = parseIsoDurationToSeconds(details?.contentDetails?.duration);

      if (
        !isVerifiedChristianMovie({
          title,
          description,
          channelTitle,
          durationSeconds,
          isApprovedStudio: false,
        })
      ) {
        continue;
      }

      const viewCount = details?.statistics?.viewCount ? parseInt(details.statistics.viewCount, 10) : 5000;
      const likeCount = details?.statistics?.likeCount ? parseInt(details.statistics.likeCount, 10) : 250;
      const commentCount = details?.statistics?.commentCount ? parseInt(details.statistics.commentCount, 10) : null;
      const publishedAt = snippet.publishedAt || new Date().toISOString();

      const metrics = computeVideoRankingMetrics({
        viewCount,
        likeCount,
        commentCount,
        publishedAt,
        isNigerianChannel: /nigerian|mount zion|bamiloye|jaymikee|winlos|evom/i.test(
          `${title} ${channelTitle}`
        ),
        isOfficialVerified: true,
        priorityWeight: 1.15,
      });

      out.push({
        id: `vid-${vId}`,
        youtube_video_id: vId,
        channel_id: `ch-${snippet.channelId || 'discovered-cinema'}`,
        channel_title: channelTitle,
        channel_handle: `@${channelTitle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'ChristianCinema'}`,
        channel_type: 'movie_studio',
        channel_avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          channelTitle
        )}&background=27272a&color=f59e0b`,
        is_nigerian_channel: /nigerian|mount zion|bamiloye|jaymikee|winlos|evom/i.test(
          `${title} ${channelTitle}`
        ),
        is_official_verified: true,
        primary_category_id: movieCategory?.id || 'cat-movies',
        primary_category_slug: 'real-christian-movies',
        primary_category_name: 'Christian Feature Movies',
        secondary_category_slugs: [],
        subcategory_label: 'New & Trending Release',
        title,
        description,
        thumbnail_high_url: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
        thumbnail_maxres_url: `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
        published_at: publishedAt,
        duration_seconds: durationSeconds,
        view_count: viewCount,
        like_count: likeCount,
        likes_verified: likeCount > 0,
        comment_count: commentCount,
        views_per_day: metrics.viewsPerDay,
        engagement_rate: metrics.engagementRate,
        trending_score: metrics.trendingScore,
        evergreen_score: metrics.evergreenScore,
        quality_score: metrics.qualityScore,
        live_broadcast_content: 'none',
        is_live_now: false,
        is_embeddable: true,
        is_available: true,
        approval_status: 'approved',
        is_featured_hero: false,
        is_trending_pinned: false,
        ai_classification_reason: 'Verified Christian Movie release watcher',
        last_refreshed_at: new Date().toISOString(),
      });
    }
    return out;
  } catch {
    return convertStructured();
  }
}

async function persistNewVerifiedMovies(candidates: KingdomVideo[]): Promise<number> {
  if (candidates.length === 0) return 0;
  const existingByYtId = new Set(store.state.videos.map((v) => v.youtube_video_id));
  let added = 0;

  for (const movie of candidates) {
    if (!movie.youtube_video_id || existingByYtId.has(movie.youtube_video_id)) continue;
    existingByYtId.add(movie.youtube_video_id);
    store.state.videos.unshift(movie);
    added++;

    if (store.supabase && store.supabaseConnected) {
      Promise.resolve(
        store.supabase.from('discovered_videos').upsert(
          {
            youtube_video_id: movie.youtube_video_id,
            video_payload: movie,
            primary_category_slug: movie.primary_category_slug || 'real-christian-movies',
          },
          { onConflict: 'youtube_video_id' }
        )
      ).catch(() => {});
    }
  }

  if (added > 0) {
    store.saveToDisk();
  }
  return added;
}

/**
 * Checks official Christian film studios via YouTube Atom XML feeds (0 quota) and
 * queries YouTube for newly released & trending verified Christian movies.
 * Indexes verified discoveries directly into the catalog and generates caption alerts.
 */
export async function checkTrendingAndNewChristianMovies(
  forceRefresh = false
): Promise<MovieTrendingCheckResult> {
  const now = Date.now();
  if (!forceRefresh && cachedCheckResult && now - lastCheckedMs < CACHE_TTL_MS) {
    return cachedCheckResult;
  }
  if (inFlightCheck) {
    return inFlightCheck;
  }

  inFlightCheck = (async () => {
    const discoveredStudioVideos: KingdomVideo[] = [];
    const discoveredSearchVideos: KingdomVideo[] = [];

    // 1. Check Official Christian Movie & Animation Studios via YouTube XML Feeds (0 API quota)
    const studioChannels: KingdomChannel[] = store.state.channels.filter(
      (c) =>
        c.approval_status === 'approved' &&
        (c.channel_type === 'movie_studio' ||
          c.channel_type === 'animation_studio' ||
          MOVIE_CATEGORY_SLUGS.has(c.default_category_slug))
    );

    const xmlFeedSettled = await Promise.allSettled(
      studioChannels.slice(0, 12).map(async (ch) => {
        const rawItems = await fetchChannelVideosViaOfficialXmlFeed(ch.youtube_channel_id);
        return { ch, rawItems: rawItems.slice(0, 6) };
      })
    );

    const pendingEnrichIds: string[] = [];
    const stagedRawByStudio: Array<{ ch: KingdomChannel; raw: any }> = [];

    for (const outcome of xmlFeedSettled) {
      if (outcome.status !== 'fulfilled') continue;
      const { ch, rawItems } = outcome.value;
      for (const raw of rawItems) {
        if (
          !isVerifiedChristianMovie({
            title: raw.title,
            description: raw.description,
            channelTitle: ch.title,
            durationSeconds: raw.durationSeconds,
            isApprovedStudio: true,
          })
        ) {
          continue;
        }
        stagedRawByStudio.push({ ch, raw });
        if (!store.state.videos.some((v) => v.youtube_video_id === raw.youtubeVideoId)) {
          pendingEnrichIds.push(raw.youtubeVideoId);
        }
      }
    }

    const apiKey = process.env.YOUTUBE_API_KEY || '';
    const enrichedMap =
      pendingEnrichIds.length > 0 && apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY'
        ? await enrichVideosWithYouTubeApiV3(pendingEnrichIds.slice(0, 50), apiKey, (e, c, n, s, note) =>
            store.logYouTubeQuota(e, c, n, s, note)
          )
        : new Map();

    for (const { ch, raw } of stagedRawByStudio) {
      const enrich = enrichedMap.get(raw.youtubeVideoId);
      if (enrich) {
        if (!enrich.isEmbeddable || !enrich.isAvailable) continue;
        raw.durationSeconds = enrich.durationSeconds ?? raw.durationSeconds;
        raw.viewCount = enrich.viewCount || raw.viewCount;
        raw.likeCount = enrich.likeCount || raw.likeCount;
        raw.commentCount = enrich.commentCount ?? raw.commentCount;
      }

      if (
        !isVerifiedChristianMovie({
          title: raw.title,
          description: raw.description,
          channelTitle: ch.title,
          durationSeconds: raw.durationSeconds,
          isApprovedStudio: true,
        })
      ) {
        continue;
      }

      const scored = buildScoredKingdomVideo(raw, ch, store.state.categories, 'approved');
      // Guarantee it sits inside a Movie category slug for the Movies page
      if (!MOVIE_CATEGORY_SLUGS.has(scored.primary_category_slug)) {
        const defaultMovieSlug = MOVIE_CATEGORY_SLUGS.has(ch.default_category_slug)
          ? ch.default_category_slug
          : ch.channel_type === 'animation_studio'
          ? 'christian-animations'
          : 'real-christian-movies';
        const cat = store.state.categories.find((c) => c.slug === defaultMovieSlug);
        if (cat) {
          scored.primary_category_id = cat.id;
          scored.primary_category_slug = cat.slug;
          scored.primary_category_name = cat.name;
        }
      }
      scored.approval_status = 'approved';
      discoveredStudioVideos.push(scored);
    }

    // 2. Check Live YouTube Search for Newly Released & Trending Christian Movies
    const searchQueries = [
      'new Nigerian Christian movie full faith drama',
      'Mount Zion new Christian movie full',
      'trending Christian movie full film',
    ];
    const searchSettled = await Promise.allSettled(
      searchQueries.map((q) => searchYouTubeChristianMoviesLive(q, 8))
    );
    for (const outcome of searchSettled) {
      if (outcome.status === 'fulfilled') {
        discoveredSearchVideos.push(...outcome.value);
      }
    }

    // Index newly discovered verified Christian movies directly into catalog so searching finds them immediately
    const newlyIndexedCount = await persistNewVerifiedMovies([
      ...discoveredStudioVideos,
      ...discoveredSearchVideos,
    ]);

    // 3. Build the unified pool of verified Christian movies and select top New Release + Trending Alerts
    const sourceTagByYtId = new Map<string, 'studio_feed' | 'youtube_trending_search' | 'catalog'>();
    for (const v of store.state.videos) {
      if (v.approval_status === 'approved' && v.is_available && v.is_embeddable && isMovieCatalogVideo(v)) {
        sourceTagByYtId.set(v.youtube_video_id, 'catalog');
      }
    }
    for (const v of discoveredSearchVideos) {
      sourceTagByYtId.set(v.youtube_video_id, 'youtube_trending_search');
    }
    for (const v of discoveredStudioVideos) {
      sourceTagByYtId.set(v.youtube_video_id, 'studio_feed');
    }

    const moviePool = store.state.videos.filter(
      (v) =>
        v.approval_status === 'approved' &&
        v.is_available &&
        v.is_embeddable &&
        isMovieCatalogVideo(v) &&
        isVerifiedChristianMovie({
          title: v.title,
          description: v.description,
          channelTitle: v.channel_title,
          durationSeconds: v.duration_seconds,
          isApprovedStudio: studioChannels.some((s) => s.id === v.channel_id),
        })
    );

    const alerts: MovieTrendingAlert[] = [];
    const pickedYtIds = new Set<string>();

    // Prefer full-length films (>= 15 mins) over short 3-10 min clips when selecting headline alerts
    const sortedNewReleases = [...moviePool].sort((a, b) => {
      const aLong = a.duration_seconds === null || a.duration_seconds >= 900 ? 1 : 0;
      const bLong = b.duration_seconds === null || b.duration_seconds >= 900 ? 1 : 0;
      if (aLong !== bLong) return bLong - aLong;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

    const sortedTrending = [...moviePool].sort((a, b) => {
      const aLong = a.duration_seconds === null || a.duration_seconds >= 900 ? 1 : 0;
      const bLong = b.duration_seconds === null || b.duration_seconds >= 900 ? 1 : 0;
      if (aLong !== bLong) return bLong - aLong;
      const scoreA = a.trending_score * 1.4 + a.views_per_day * 1.2;
      const scoreB = b.trending_score * 1.4 + b.views_per_day * 1.2;
      return scoreB - scoreA;
    });

    const pushAlert = (
      video: KingdomVideo,
      badge: 'New Release' | 'Trending Christian Movie'
    ) => {
      if (pickedYtIds.has(video.youtube_video_id)) return;
      pickedYtIds.add(video.youtube_video_id);

      const studioName = video.channel_title.split('(')[0].trim();
      const searchKeyword = buildMovieSearchKeyword(video.title);
      const shortTitle =
        video.title.length > 76 ? `${video.title.slice(0, 73).trim()}...` : video.title;

      const caption =
        badge === 'New Release'
          ? `New Christian Movie: "${shortTitle}" (${studioName}) — Watch now on KINGDOM+!`
          : `Trending Christian Movie (${formatCompactViews(
              video.view_count
            )} views): "${shortTitle}" — Watch now on KINGDOM+!`;

      alerts.push({
        id: `alert-${video.youtube_video_id}`,
        badge,
        caption,
        searchKeyword,
        studioName,
        publishedAt: video.published_at,
        viewCount: video.view_count,
        viewsPerDay: video.views_per_day,
        source: sourceTagByYtId.get(video.youtube_video_id) || 'catalog',
        video,
      });
    };

    // Interleave Top New Releases and Top Trending Christian Movies (up to 6 alerts)
    if (sortedNewReleases[0]) pushAlert(sortedNewReleases[0], 'New Release');
    if (sortedTrending[0]) pushAlert(sortedTrending[0], 'Trending Christian Movie');
    if (sortedNewReleases[1]) pushAlert(sortedNewReleases[1], 'New Release');
    if (sortedTrending[1]) pushAlert(sortedTrending[1], 'Trending Christian Movie');
    if (sortedNewReleases[2]) pushAlert(sortedNewReleases[2], 'New Release');
    if (sortedTrending[2]) pushAlert(sortedTrending[2], 'Trending Christian Movie');

    const result: MovieTrendingCheckResult = {
      checkedAt: new Date().toISOString(),
      alerts,
      newlyIndexedCount,
      totalMoviesIndexed: moviePool.length,
    };

    cachedCheckResult = result;
    lastCheckedMs = Date.now();
    return result;
  })();

  try {
    return await inFlightCheck;
  } finally {
    inFlightCheck = null;
  }
}
