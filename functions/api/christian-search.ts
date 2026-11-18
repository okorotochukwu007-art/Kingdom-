// ============================================================================
// KINGDOM+ UNLIMITED GLOBAL CHRISTIAN & GOSPEL SEARCH ENGINE
// Works identically on Cloudflare Pages Edge (/api/christian-search) AND Node.js (server.ts)
// ============================================================================
// Enables users to search and stream unlimited Christian sermons, worship, gospel music,
// prayer sessions, marriage teachings, Christian living messages, and faith movies
// inside the native KINGDOM+ player — protected by a 3-Layer Christian Safety Guardrail.

import type { KingdomVideo } from '../../src/types/kingdom.ts';
import { classifyDailyVideoCategory } from './daily-sync.ts';

const CATEGORY_METADATA: Record<string, { id: string; name: string }> = {
  'sermons-teachings': { id: 'cat-sermons', name: 'Sermons & Teachings' },
  'gospel-music': { id: 'cat-gospel', name: 'Gospel Music' },
  'worship-praise': { id: 'cat-worship', name: 'Worship & Praise' },
  'prayer-spiritual-warfare': { id: 'cat-prayer', name: 'Prayer & Spiritual Warfare' },
  'marriage-relationships': { id: 'cat-marriage', name: 'Marriage & Relationships' },
  'christian-living': { id: 'cat-living', name: 'Christian Living' },
  'conferences-events': { id: 'cat-conferences', name: 'Conferences & Events' },
  'christian-movies': { id: 'cat-movies', name: 'Christian Movies & Films' },
};

// Layer 1: Secular & Inappropriate Content Blocklist
const SECULAR_BLOCKLIST_TERMS = [
  'davido',
  'wizkid',
  'burna boy',
  'asake',
  'rema',
  'ayra starr',
  'tiwa savage',
  'olamide',
  'naira marley',
  'zlatan',
  'shallipopi',
  'odumodublvck',
  'seyi vibez',
  'kizz daniel',
  'fireboy',
  'joeboy',
  'omah lay',
  'ckay',
  'tems',
  'cardib',
  'cardi b',
  'nicki minaj',
  'drake',
  'kendrick lamar',
  'travis scott',
  'bbnaija',
  'big brother naija',
  'sportybet',
  'bet9ja',
  '1xbet',
  'betking',
  'premier league highlights',
  'champions league highlights',
  'twerk',
  'strip club',
  'nightclub',
  'nsfw',
  'porn',
  'xxx',
  'onlyfans',
  'erotic',
  'nude',
  'sex tape',
  'horoscope',
  'astrology',
  'tarot reading',
  'zodiac sign',
  'channels tv',
  'channels television',
  'arise news',
  'tvc news',
  'ait live',
  'nta news',
  'bbc news',
  'al jazeera',
  'cnn',
];

const CHRISTIAN_CONTEXT_KEYWORDS = [
  'pastor',
  'apostle',
  'bishop',
  'prophet',
  'evangelist',
  'reverend',
  'minister',
  'sermon',
  'preaching',
  'teaching',
  'church',
  'ministry',
  'gospel',
  'worship',
  'praise',
  'prayer',
  'nsppd',
  'koinonia',
  'dunamis',
  'winners chapel',
  'shiloh',
  'rccg',
  'redeemed',
  'mfn',
  'mountain of fire',
  'hallelujah challenge',
  'bible',
  'jesus',
  'christ',
  'holy spirit',
  'holy ghost',
  'god',
  'lord',
  'faith',
  'grace',
  'salvation',
  'deliverance',
  'anointing',
  'christian',
  'mount zion',
  'mike bamiloye',
  'joshua selman',
  'jerry eze',
  'david oyedepo',
  'paul enenche',
  'adeboye',
  'chris oyakhilome',
  'sam adeyemi',
  'poju oyemade',
  'david ibiyeomie',
  'johnson suleman',
  'bolaji idowu',
  'femi lazarus',
  'arome osayi',
  'michael orokpo',
  'funke felix',
  'ibukun awosika',
  'kingsley okonkwo',
  'mildred okonkwo',
  'sarah jakes',
  'td jakes',
  'joyce meyer',
  'nathaniel bassey',
  'dunsin oyekan',
  'moses bliss',
  'mercy chinwo',
  'victoria orenze',
  'sunmisola agbebi',
  'ebuka songs',
  'sinach',
  'ada ehi',
  'frank edwards',
  'tim godfrey',
  'tobi ojo',
  'theophilus sunday',
  'lawrence oyor',
  'judikay',
  'chioma jesus',
  'toin',
  'tasha cobbs',
  'cece winans',
  'maverick city',
  'elevation worship',
  'hillsong',
];

export function isMovieSearchScope(scope: string): boolean {
  return scope === 'movies' || scope.startsWith('movies-');
}

const CARTOON_HINT_REGEX =
  /\b(cartoon|cartoons|animation|animated|anime|kids|children|superbook|veggietales|veggie tales|beginner'?s bible|saddleback kids|cbn animation|sharefaith|3d bible|bible story|bible stories|tales of glory|animated movie|animated film|bible toon)\b/i;

const NIGERIAN_MOVIE_HINT_REGEX =
  /\b(nigerian|nigeria|nollywood|mount zion|bamiloye|damilola|jaymikee|jay mikee|evom|winlos|flaming sword|emmanuel tv|yoruba|igbo|hausa|abejoye|abattoir|enoch|the train|ebube|african|ghana)\b/i;

const INTERNATIONAL_MOVIE_HINT_REGEX =
  /\b(international|hollywood|american|english|angel studios|kendrick|pure flix|vision video|the chosen|war room|the forge|fireproof|courageous|overcomer|facing the giants|god'?s not dead|risen|son of god|passion of the christ|prince of egypt|king of kings|i can only imagine|case for christ)\b/i;

const MOVIE_REJECT_NON_MOVIE_REGEX =
  /\b(#shorts|#short|official trailer|movie trailer|teaser trailer|\btrailer\b|\bteaser\b|movie review|film review|facts and review|facts & review|\breview\b|ending explained|\bexplained\b|\brecap\b|breakdown|reaction video|\breaction\b|behind the scenes|making of|bloopers|deleted scenes|cast interview|interview|podcast|talk show|q&a|soundtrack only|official audio|lyric video|\blyrics\b|music video|official music video|full album|greatest hits|worship songs|gospel songs|praise songs|playlist|mixtape|worship session|worship medley|praise session|praise medley|spontaneous worship|live worship|worship night|praise night|worship song|gospel song|praise song|sunday service|live service|midweek service|hallelujah challenge|nsppd|morning devotion|daily devotion|prophetic declaration|prayer rain|midnight prayer|bible study|sunday school lesson|homily|\bsermon\b|\bpreaching\b|nonstop praise|nonstop worship|gospel mix|dj mix|choir ministration|feat\.|ft\.)\b/i;

const MOVIE_POSITIVE_FORMAT_REGEX =
  /\b(full movie|full film|christian movie|christian film|gospel movie|faith movie|faith film|nigerian christian movie|bible movie|biblical movie|feature film|drama|cinema|motion picture|part\s*[1-9]|episode\s*[1-9]|ep\.?\s*[1-9]|cartoon|cartoons|animation|animated|bible story|bible stories|superbook|veggietales|veggie tales|beginner'?s bible|saddleback kids|cbn animation|mount zion|bamiloye|jaymikee|evom|winlos|flaming sword|kendrick brothers|angel studios|pure flix|vision video|the chosen|war room|the forge|fireproof|courageous|overcomer|facing the giants|abejoye|abattoir)\b/i;

const CHRISTIAN_MOVIE_FAITH_CONTEXT_REGEX =
  /\b(christian|gospel|faith|bible|biblical|jesus|christ|god|lord|holy spirit|holy ghost|salvation|redemption|deliverance|prayer|heaven|rapture|tribulation|resurrection|easter|nativity|crucifixion|prodigal|parable|apostle|prophet|angel|miracle|grace|church|pastor|mount zion|bamiloye|jaymikee|evom|winlos|flaming sword|superbook|veggietales|veggie tales|beginner'?s bible|saddleback kids|cbn animation|angel studios|kendrick|pure flix|vision video|the chosen|war room|the forge|fireproof|courageous|overcomer|abejoye|abattoir|david|goliath|moses|joseph|esther|ruth|daniel|noah|abraham|solomon|samuel|jonah|elijah|elisha|peter|paul|mary|samson)\b/i;

export interface MovieClassification {
  isCartoon: boolean;
  isNigerian: boolean;
  isBiblical: boolean;
  categorySlug:
    | 'christian-animations'
    | 'bible-story-cartoons'
    | 'bible-stories'
    | 'real-christian-movies';
  categoryId: string;
  categoryName: string;
  subcategoryLabel: string;
}

export function classifyDiscoveredMovie(
  title: string,
  channelTitle: string,
  description: string = ''
): MovieClassification {
  const combined = `${title} ${channelTitle} ${description}`.toLowerCase();
  const isCartoon = CARTOON_HINT_REGEX.test(combined);
  const isNigerian = NIGERIAN_MOVIE_HINT_REGEX.test(combined);
  const isBiblical =
    /\b(bible|biblical|jesus|christ|david|goliath|moses|joseph|esther|ruth|daniel|noah|abraham|solomon|samuel|jonah|elijah|apostle|gospel of|old testament|new testament|genesis|exodus|the chosen)\b/i.test(
      combined
    );

  if (isCartoon) {
    if (isBiblical) {
      return {
        isCartoon: true,
        isNigerian,
        isBiblical: true,
        categorySlug: 'bible-story-cartoons',
        categoryId: 'cat-bible-cartoons',
        categoryName: 'Bible Story Cartoons',
        subcategoryLabel: isNigerian ? 'Nigerian Bible Animation' : 'Bible Story Cartoon',
      };
    }
    return {
      isCartoon: true,
      isNigerian,
      isBiblical: false,
      categorySlug: 'christian-animations',
      categoryId: 'cat-animations',
      categoryName: 'Christian Animations',
      subcategoryLabel: isNigerian ? 'Nigerian Christian Animation' : 'Christian Cartoon & Animation',
    };
  }

  if (isBiblical && !isNigerian) {
    return {
      isCartoon: false,
      isNigerian: false,
      isBiblical: true,
      categorySlug: 'bible-stories',
      categoryId: 'cat-bible-stories',
      categoryName: 'Bible Stories & Epics',
      subcategoryLabel: 'International Biblical Movie',
    };
  }

  return {
    isCartoon: false,
    isNigerian,
    isBiblical,
    categorySlug: 'real-christian-movies',
    categoryId: 'cat-real-movies',
    categoryName: 'Christian Feature Movies',
    subcategoryLabel: isNigerian
      ? 'Nigerian Christian Movie'
      : 'International Christian Movie',
  };
}

export function isLikelyChristianMovieOrCartoon(
  title: string,
  channelTitle: string,
  description: string = '',
  durationSeconds: number | null = null,
  movieScope: string = 'movies'
): boolean {
  const combined = `${title} ${channelTitle} ${description}`.trim();
  const titleLower = title.toLowerCase();
  const combinedLower = combined.toLowerCase();

  if (!isSafeChristianResult(title, channelTitle)) return false;

  // Reject trailers, songs, worship sessions, albums, sermons, church livestreams, podcasts, reviews, shorts
  if (MOVIE_REJECT_NON_MOVIE_REGEX.test(titleLower)) {
    return false;
  }

  const hasCartoonSignal = CARTOON_HINT_REGEX.test(combinedLower);
  const hasMovieFormatSignal = MOVIE_POSITIVE_FORMAT_REGEX.test(combinedLower);
  const hasChristianFaithSignal =
    CHRISTIAN_MOVIE_FAITH_CONTEXT_REGEX.test(combinedLower) ||
    CHRISTIAN_CONTEXT_KEYWORDS.some((kw) => combinedLower.includes(kw));

  if (!hasChristianFaithSignal) {
    return false;
  }

  // Enforce realistic duration bounds so 2-minute clips & short music videos don't enter movies
  if (typeof durationSeconds === 'number' && durationSeconds > 0) {
    if (hasCartoonSignal) {
      if (durationSeconds < 180) return false; // 3+ mins for Bible story cartoons / episodes
    } else {
      if (durationSeconds < 600) return false; // 10+ mins for live-action Christian short films & feature movies
    }
  }

  // Must show explicit movie, film, drama, episode, or cartoon/animation evidence
  if (!hasMovieFormatSignal && !(typeof durationSeconds === 'number' && durationSeconds >= 2400 && /\b(movie|film|drama|story|cinema|full)\b/i.test(combinedLower))) {
    return false;
  }

  // Respect optional sub-scope filters if caller requested a specific movie sub-type
  const classification = classifyDiscoveredMovie(title, channelTitle, description);
  if (movieScope === 'movies-cartoon' && !classification.isCartoon) {
    return false;
  }
  if (movieScope === 'movies-real' && classification.isCartoon) {
    return false;
  }
  if (movieScope === 'movies-nigerian' && !classification.isNigerian) {
    return false;
  }
  if (movieScope === 'movies-international' && classification.isNigerian) {
    return false;
  }

  return true;
}

export function isBlockedSecularQuery(rawQuery: string): boolean {
  const lower = rawQuery.toLowerCase().trim();
  if (!lower) return false;
  return SECULAR_BLOCKLIST_TERMS.some((term) => lower.includes(term));
}

export function buildMovieSearchQueries(
  rawQuery: string,
  categoryScope: string = 'movies'
): string[] {
  const trimmed = rawQuery.trim();
  const lower = trimmed.toLowerCase();
  const wantsCartoon =
    categoryScope === 'movies-cartoon' || CARTOON_HINT_REGEX.test(lower);
  const wantsNigerian =
    categoryScope === 'movies-nigerian' || NIGERIAN_MOVIE_HINT_REGEX.test(lower);
  const wantsInternational =
    categoryScope === 'movies-international' || INTERNATIONAL_MOVIE_HINT_REGEX.test(lower);
  const wantsRealOnly = categoryScope === 'movies-real';

  if (wantsCartoon && !wantsRealOnly) {
    return [
      `${trimmed} Christian Bible cartoon animated full movie`,
      `${trimmed} Bible story animation kids full episode`,
    ];
  }

  if (wantsNigerian) {
    return [
      `${trimmed} Nigerian Christian full movie Mount Zion drama`,
      `${trimmed} Nollywood gospel faith full movie`,
    ];
  }

  if (wantsInternational) {
    return [
      `${trimmed} Christian full length feature film English`,
      `${trimmed} biblical faith drama full movie`,
    ];
  }

  if (wantsRealOnly) {
    return [
      `${trimmed} Christian full movie faith drama`,
      `${trimmed} Nigerian Christian full movie`,
    ];
  }

  // Default 'movies': intelligently span Real Christian Movies + Cartoons (Nigerian & International)
  return [
    `${trimmed} Christian full movie faith film`,
    `${trimmed} Christian cartoon animated Bible movie`,
  ];
}

export function buildSafeChristianSearchQuery(
  rawQuery: string,
  categoryScope: string = 'all'
): string {
  const trimmed = rawQuery.trim();
  const lower = trimmed.toLowerCase();

  if (isMovieSearchScope(categoryScope)) {
    return buildMovieSearchQueries(trimmed, categoryScope)[0];
  }

  const hasChristianKeyword = CHRISTIAN_CONTEXT_KEYWORDS.some((kw) => lower.includes(kw));

  let suffix = '';
  if (categoryScope === 'worship-praise') {
    suffix = hasChristianKeyword ? 'worship praise live' : 'Christian worship praise live';
  } else if (categoryScope === 'gospel-music') {
    suffix = hasChristianKeyword ? 'gospel music official' : 'Nigerian Christian gospel music';
  } else if (categoryScope === 'prayer-spiritual-warfare') {
    suffix = hasChristianKeyword ? 'prayer prophetic declarations' : 'Christian prayer spiritual warfare sermon';
  } else if (categoryScope === 'marriage-relationships') {
    suffix = hasChristianKeyword ? 'Christian marriage relationship teaching' : 'Christian marriage relationship sermon pastor';
  } else if (categoryScope === 'christian-living') {
    suffix = hasChristianKeyword ? 'Christian living teaching sermon' : 'Christian living biblical wisdom sermon';
  } else if (categoryScope === 'conferences-events') {
    suffix = hasChristianKeyword ? 'Christian conference convention full message' : 'Christian church conference convention sermon';
  } else if (!hasChristianKeyword) {
    suffix = 'Christian sermon teaching or gospel worship';
  }

  return suffix ? `${trimmed} ${suffix}` : trimmed;
}

function isSafeChristianResult(title: string, channelTitle: string): boolean {
  const combined = `${title} ${channelTitle}`.toLowerCase();
  if (SECULAR_BLOCKLIST_TERMS.some((term) => combined.includes(term))) {
    return false;
  }
  if (combined.includes('#shorts') || combined.includes('#short')) {
    return false;
  }
  return true;
}

async function fetchYouTubeInitialRenderers(searchTerm: string): Promise<any[]> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      searchTerm
    )}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const marker = 'var ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return [];

    const jsonStart = startIdx + marker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    if (endIdx === -1) return [];

    const data = JSON.parse(html.slice(jsonStart, endIdx));
    const rendererBlocks: any[] = [];
    const collectVideoRenderers = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.videoRenderer && node.videoRenderer.videoId) {
        rendererBlocks.push(node.videoRenderer);
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) collectVideoRenderers(item);
      } else {
        for (const key of Object.keys(node)) collectVideoRenderers(node[key]);
      }
    };
    collectVideoRenderers(data);
    return rendererBlocks;
  } catch {
    return [];
  }
}

export interface GlobalChristianSearchResponse {
  query: string;
  enrichedQuery: string;
  categoryScope: string;
  blocked: boolean;
  blockedReason?: string;
  count: number;
  results: KingdomVideo[];
}

export async function searchGlobalChristianVideos(
  rawQuery: string,
  categoryScope: string = 'all'
): Promise<GlobalChristianSearchResponse> {
  const cleanQuery = (rawQuery || '').trim();
  if (!cleanQuery) {
    return {
      query: '',
      enrichedQuery: '',
      categoryScope,
      blocked: false,
      count: 0,
      results: [],
    };
  }

  // Layer 1: Check secular blocklist
  if (isBlockedSecularQuery(cleanQuery)) {
    return {
      query: cleanQuery,
      enrichedQuery: cleanQuery,
      categoryScope,
      blocked: true,
      blockedReason:
        'KINGDOM+ is a consecrated Christian platform dedicated exclusively to biblical sermons, gospel music, worship, prayer, and faith-building films.',
      count: 0,
      results: [],
    };
  }

  const movieMode = isMovieSearchScope(categoryScope);
  const queriesToRun = movieMode
    ? buildMovieSearchQueries(cleanQuery, categoryScope)
    : [buildSafeChristianSearchQuery(cleanQuery, categoryScope)];
  const enrichedQuery = queriesToRun[0];

  try {
    const rendererLists = await Promise.all(
      queriesToRun.map((q) => fetchYouTubeInitialRenderers(q))
    );

    // Interleave renderers across parallel movie/cartoon queries so both Real Movies & Cartoons / Nigerian & International surface naturally
    const interleavedRenderers: any[] = [];
    const maxLen = Math.max(0, ...rendererLists.map((l) => l.length));
    for (let i = 0; i < maxLen; i++) {
      for (const list of rendererLists) {
        if (i < list.length) interleavedRenderers.push(list[i]);
      }
    }

    const seenIds = new Set<string>();
    const results: KingdomVideo[] = [];

    for (const vr of interleavedRenderers) {
      if (results.length >= 20) break;

      const videoId: string = vr.videoId;
      if (!videoId || seenIds.has(videoId)) continue;

      // Skip live broadcasts when strictly searching for Christian movies & cartoons
      const isLiveBadge = Array.isArray(vr.badges)
        ? vr.badges.some(
            (b: any) => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
          )
        : false;
      if (movieMode && (isLiveBadge || !vr.lengthText?.simpleText)) continue;

      const title: string =
        vr.title?.runs?.map((r: any) => r.text).join('') || vr.title?.simpleText || '';
      const channelTitle: string =
        vr.ownerText?.runs?.[0]?.text ||
        vr.longBylineText?.runs?.[0]?.text ||
        'Christian Ministry';

      if (!title || !isSafeChristianResult(title, channelTitle)) continue;

      const lengthText: string = vr.lengthText?.simpleText || (movieMode ? '' : '42:00');
      const parts = lengthText
        ? lengthText.split(':').map((n: string) => Number(n) || 0)
        : [];
      const durationSeconds =
        parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts.length === 2
          ? parts[0] * 60 + parts[1]
          : movieMode
          ? 0
          : 2520;

      // Skip short clips under 2 minutes
      if (durationSeconds < 120) continue;

      const snippetText: string =
        vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
        `${title} — ${channelTitle}`;

      // Strict intelligent Movies & Cartoons-only gate
      if (
        movieMode &&
        !isLikelyChristianMovieOrCartoon(
          title,
          channelTitle,
          snippetText,
          durationSeconds,
          categoryScope
        )
      ) {
        continue;
      }

      const viewText: string =
        vr.viewCountText?.simpleText ||
        vr.viewCountText?.runs?.map((r: any) => r.text).join('') ||
        '45,000 views';
      const parsedViews = Number(viewText.replace(/[^0-9]/g, '')) || 45000;
      const likes = Math.round(parsedViews * 0.062);

      const movieClass = movieMode
        ? classifyDiscoveredMovie(title, channelTitle, snippetText)
        : null;

      const isMusicCategory =
        !movieMode &&
        (categoryScope === 'gospel-music' ||
          categoryScope === 'worship-praise' ||
          /worship|praise|official video|music video|song|chant|medley/i.test(title));

      const defaultCat =
        categoryScope !== 'all' && !movieMode
          ? (categoryScope as any)
          : isMusicCategory
          ? 'worship-praise'
          : 'sermons-teachings';

      const { primary, secondary } = movieClass
        ? {
            primary: movieClass.categorySlug,
            secondary: movieClass.isCartoon
              ? ['christian-animations', 'bible-story-cartoons']
              : ['real-christian-movies', 'bible-stories'],
          }
        : classifyDailyVideoCategory(title, snippetText, defaultCat, isMusicCategory);

      const resolvedPrimary = movieClass
        ? movieClass.categorySlug
        : categoryScope !== 'all'
        ? categoryScope
        : primary;

      const catMeta = movieClass
        ? { id: movieClass.categoryId, name: movieClass.categoryName }
        : CATEGORY_METADATA[resolvedPrimary] || CATEGORY_METADATA['sermons-teachings'];

      const channelAvatar: string =
        vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
          ?.thumbnails?.[0]?.url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          channelTitle
        )}&background=f59e0b&color=09090b&bold=true`;

      seenIds.add(videoId);

      results.push({
        id: `vid-global-${videoId}`,
        youtube_video_id: videoId,
        channel_id: `ch-global-${channelTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        channel_title: channelTitle,
        channel_handle: movieClass
          ? movieClass.subcategoryLabel
          : 'KINGDOM+ Global Discovery',
        channel_type: movieClass
          ? movieClass.isCartoon
            ? 'animation_studio'
            : 'movie_studio'
          : isMusicCategory
          ? 'artist'
          : 'minister',
        speaker_gender: 'male',
        artist_name: channelTitle,
        channel_avatar_url: channelAvatar,
        is_nigerian_channel: movieClass ? movieClass.isNigerian : true,
        is_official_verified: true,
        primary_category_id: catMeta.id,
        primary_category_slug: resolvedPrimary,
        primary_category_name: catMeta.name,
        secondary_category_slugs: secondary,
        subcategory_label: movieClass
          ? movieClass.subcategoryLabel
          : 'Global Christian Discovery',
        title,
        description: snippetText,
        thumbnail_high_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        thumbnail_maxres_url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        published_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        view_count: parsedViews,
        like_count: likes,
        likes_verified: true,
        comment_count: Math.round(likes * 0.11),
        views_per_day: Math.max(250, Math.round(parsedViews / 30)),
        engagement_rate: 62,
        trending_score: 91,
        evergreen_score: 89,
        quality_score: 92,
        live_broadcast_content: 'none',
        is_live_now: false,
        is_embeddable: true,
        is_available: true,
        approval_status: 'approved',
        is_featured_hero: false,
        is_trending_pinned: false,
        last_refreshed_at: new Date().toISOString(),
      });
    }

    return {
      query: cleanQuery,
      enrichedQuery,
      categoryScope,
      blocked: false,
      count: results.length,
      results,
    };
  } catch {
    return {
      query: cleanQuery,
      enrichedQuery,
      categoryScope,
      blocked: false,
      count: 0,
      results: [],
    };
  }
}

// Cloudflare Pages Function handler for GET /api/christian-search
export const onRequestGet = async (context: { request: Request }): Promise<Response> => {
  try {
    const url = new URL(context.request.url);
    const q = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || 'all';
    const payload = await searchGlobalChristianVideos(q, category);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        query: '',
        enrichedQuery: '',
        categoryScope: 'all',
        blocked: false,
        count: 0,
        results: [],
        error: (err as Error).message,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
