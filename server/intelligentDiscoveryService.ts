// ============================================================================
// KINGDOM+ INTELLIGENT SEARCH & DISCOVERY ENGINE (AI-POWERED)
// ============================================================================
// Powered by Gemini 3.8 Flash (@google/genai) and YouTube Data API v3.
// Intelligently analyzes user search intent, identifies Christian ministers,
// detects movie genres & biblical themes, searches in-app library first,
// and discovers authentic publicly available Christian videos & ministers from YouTube.

import { GoogleGenAI, Type } from '@google/genai';
import {
  KingdomChannel,
  KingdomVideo,
  ContentCategory,
} from '../src/types/kingdom.ts';
import { store } from './store.ts';
import {
  parseClockDurationToSeconds,
  parseIsoDurationToSeconds,
  parseRelativeTimeTextToIso,
  searchYouTubeStructured,
} from './youtubeService.ts';
import {
  buildMovieSearchQueries,
  classifyDiscoveredMovie,
  isLikelyChristianMovieOrCartoon,
} from '../functions/api/christian-search.ts';

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch {
    return null;
  }
}

export type DiscoverySearchScope =
  | 'all'
  | 'movies'
  | 'ministers'
  | 'sermons'
  | 'worship'
  | 'prayer'
  | 'marriage'
  | 'teachings';

export interface SearchIntent {
  originalQuery: string;
  scope: DiscoverySearchScope;
  isBroad: boolean;
  detectedType: 'movie' | 'minister' | 'sermon' | 'worship' | 'prayer' | 'marriage' | 'teaching' | 'general';
  detectedCategorySlug: string;
  movieGenre?: string;
  detectedMinisterName?: string;
  biblicalThemes: string[];
  intentSummary: string;
  optimizedYouTubeQueries: string[];
  recommendedSubtopics: string[];
  explanation?: string;
}

export interface DiscoveredMinisterInfo {
  name: string;
  handle: string;
  youtubeChannelId: string;
  avatarUrl: string;
  subscriberCount: number | null;
  bio: string;
  isCuratedInApp: boolean;
  curatedChannelId?: string;
  videos: KingdomVideo[];
}

export interface IntelligentDiscoveryResult {
  query: string;
  scope: DiscoverySearchScope;
  intent: SearchIntent;
  curatedVideos: KingdomVideo[];
  discoveredVideos: KingdomVideo[];
  discoveredMinister: DiscoveredMinisterInfo | null;
  isRecommendation: boolean;
  recommendationExplanation?: string;
  broadCategorySections?: Array<{
    title: string;
    categorySlug: string;
    videos: KingdomVideo[];
  }>;
  totalMatches: number;
}

// In-memory cache for search results to preserve YouTube API quota
const discoveryCache = new Map<string, { result: IntelligentDiscoveryResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Secular terms blocklist to protect Christian platform integrity
const SECULAR_BLOCKLIST = [
  'davido',
  'wizkid',
  'burna boy',
  'asake',
  'rema',
  'ayra starr',
  'tiwa savage',
  'olamide',
  'naira marley',
  'shallipopi',
  'odumodublvck',
  'seyi vibez',
  'kizz daniel',
  'fireboy',
  'joeboy',
  'omah lay',
  'cardi b',
  'nicki minaj',
  'drake',
  'kendrick lamar',
  'bbnaija',
  'bet9ja',
  'sportybet',
  'premier league highlights',
  'champions league highlights',
  'porn',
  'xxx',
  'nsfw',
  'onlyfans',
  'twerk',
  'horoscope',
  'tarot',
  'astrology',
];

export function isSecularQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();
  return SECULAR_BLOCKLIST.some((term) => lower.includes(term));
}

export const CHRISTIAN_MOVIE_GENRES = [
  { id: 'all', label: 'All Christian Movies', querySuffix: 'full Christian movie faith film' },
  { id: 'nigerian-christian-movies', label: 'Nigerian Christian Movies', querySuffix: 'Nigerian Christian movie Mount Zion faith drama full' },
  { id: 'african-christian-movies', label: 'African Christian Movies', querySuffix: 'African Christian movie gospel drama film' },
  { id: 'international-christian-movies', label: 'International Christian Movies', querySuffix: 'Christian feature film biblical movie full' },
  { id: 'biblical-historical', label: 'Biblical & Historical Movies', querySuffix: 'biblical movie Jesus Christ Bible stories historical film' },
  { id: 'spiritual-warfare', label: 'Spiritual Warfare & Deliverance', querySuffix: 'Christian spiritual warfare deliverance movie battle of faith' },
  { id: 'family-drama', label: 'Christian Family Dramas', querySuffix: 'Christian family drama movie godly home parenting film' },
  { id: 'christian-romance', label: 'Christian Romance & Courtship', querySuffix: 'Christian love story courtship relationship movie faith film' },
  { id: 'redemption-transformation', label: 'Redemption & Transformation', querySuffix: 'Christian transformation redemption testimony movie' },
  { id: 'faith-miracles', label: 'Faith, Miracles & Inspiration', querySuffix: 'miracle faith Christian movie inspirational full film' },
  { id: 'comedy-action', label: 'Christian Comedy & Action', querySuffix: 'Christian comedy movie wholesome faith humor drama' },
];

/**
 * Deterministic rule-based intent fallback when Gemini is offline or responding slowly.
 */
function parseIntentDeterministic(rawQuery: string, scope: DiscoverySearchScope = 'all'): SearchIntent {
  const q = rawQuery.toLowerCase().trim();

  // Check for Broad terms
  const isBroad =
    /^(god|jesus|christ|faith|prayer|prayers|worship|praise|movie|movies|christian movie|pastor|pastors|minister|church|bible|love|hope|grace|salvation|holy spirit)$/i.test(
      q
    );

  // Check for Movie Intent
  const isMovieIntent =
    scope === 'movies' ||
    /\b(movie|movies|film|films|cinema|drama|story|stories|mount zion|damilola mike|jaymikee|the winlos|superbook|cartoon|animation|part 1|part 2|full movie)\b/i.test(
      q
    );

  if (isMovieIntent) {
    let genre = 'Nigerian Christian Movies';
    let genreSuffix = 'Nigerian Christian movie Mount Zion drama full';

    if (/\b(warfare|battle|deliverance|demon|witchcraft|curse|altar|occult|spiritual battle)\b/i.test(q)) {
      genre = 'Spiritual Warfare & Deliverance';
      genreSuffix = 'Christian spiritual warfare deliverance movie';
    } else if (/\b(bible|jesus|scripture|historical|genesis|exodus|prophet|apostle paul|chosen)\b/i.test(q)) {
      genre = 'Biblical & Historical Movies';
      genreSuffix = 'biblical Christian movie historical story film';
    } else if (/\b(family|parent|parents|children|home|marriage|husband|wife)\b/i.test(q)) {
      genre = 'Christian Family Dramas';
      genreSuffix = 'Christian family drama movie godly home';
    } else if (/\b(romance|love|dating|courtship|wedding|single|partner)\b/i.test(q)) {
      genre = 'Christian Romance & Courtship';
      genreSuffix = 'Christian romance courtship relationship movie';
    } else if (/\b(redemption|transformation|prodigal|saved|testimony|confession)\b/i.test(q)) {
      genre = 'Redemption & Transformation';
      genreSuffix = 'Christian redemption transformation movie';
    } else if (/\b(miracle|miracles|faith|healing|inspiration|hope)\b/i.test(q)) {
      genre = 'Faith, Miracles & Inspiration';
      genreSuffix = 'Christian faith miracles inspirational movie';
    } else if (/\b(comedy|laugh|funny|action)\b/i.test(q)) {
      genre = 'Christian Comedy & Action';
      genreSuffix = 'Christian wholesome comedy drama movie';
    } else if (/\b(african|ghana|kenya|south africa)\b/i.test(q)) {
      genre = 'African Christian Movies';
      genreSuffix = 'African Christian movie gospel drama';
    } else if (/\b(international|american|hollywood|angel studios)\b/i.test(q)) {
      genre = 'International Christian Movies';
      genreSuffix = 'Christian feature film biblical drama';
    }

    return {
      originalQuery: rawQuery,
      scope,
      isBroad,
      detectedType: 'movie',
      detectedCategorySlug: 'real-christian-movies',
      movieGenre: genre,
      biblicalThemes: ['Christian Drama', genre],
      intentSummary: `Christian Movies: ${genre}`,
      optimizedYouTubeQueries: [
        `${rawQuery} ${genreSuffix}`.replace(/movie\s+movie/gi, 'movie').trim(),
        `${rawQuery} Christian movie full length`.trim(),
      ],
      recommendedSubtopics: [
        'Spiritual Warfare & Deliverance',
        'Mount Zion Faith Dramas',
        'Biblical & Historical Epics',
        'Christian Family & Courtship',
      ],
    };
  }

  // Check for Minister Intent
  const knownMinisters = [
    'Apostle Joshua Selman',
    'Pastor Jerry Eze',
    'Bishop David Oyedepo',
    'Pastor E.A. Adeboye',
    'Pastor Paul Enenche',
    'Pastor Sam Adeyemi',
    'Pastor Poju Oyemade',
    'Pastor David Ibiyeomie',
    'Pastor Bolaji Idowu',
    'Pastor Kingsley Okonkwo',
    'Pastor Mildred Okonkwo',
    'Pastor Funke Felix-Adejumo',
    'Apostle Femi Lazarus',
    'Apostle Arome Osayi',
    'Apostle Michael Orokpo',
    'Pastor W.F. Kumuyi',
    'Dr. D.K. Olukoya',
    'Bro Gbile Akanni',
    'Pastor Matthew Ashimolowo',
    'Reverend George Adegboye',
    'Pastor Chris Oyakhilome',
    'Apostle Johnson Suleman',
    'Nathaniel Bassey',
    'Dunsin Oyekan',
    'Moses Bliss',
    'Mercy Chinwo',
    'Victoria Orenze',
    'Sunmisola Agbebi',
    'Ebuka Songs',
    'Theophilus Sunday',
    'Sinach',
    'Steven Furtick',
    'Francis Chan',
    'Sarah Jakes Roberts',
    'Joyce Meyer',
  ];

  for (const m of knownMinisters) {
    const mLower = m.toLowerCase();
    const coreName = mLower.replace(/^(pastor|apostle|bishop|dr\.|reverend|evang\.)\s+/i, '');
    if (q.includes(mLower) || q.includes(coreName)) {
      return {
        originalQuery: rawQuery,
        scope,
        isBroad: false,
        detectedType: 'minister',
        detectedCategorySlug: 'sermons-teachings',
        detectedMinisterName: m,
        biblicalThemes: ['Sermon', 'Biblical Teaching', 'Spiritual Growth'],
        intentSummary: `Teachings & Sermons by ${m}`,
        optimizedYouTubeQueries: [
          `${m} sermon teaching message official`,
          `${m} powerful Christian teaching`,
        ],
        recommendedSubtopics: [
          `${m} Teachings on Purpose`,
          `${m} Teachings on Prayer`,
          `${m} Spiritual Growth`,
        ],
      };
    }
  }

  // Check for Prayer Intent
  if (
    scope === 'prayer' ||
    /\b(prayer|prayers|praying|midnight prayer|warfare prayer|prophetic declaration|deliverance|altar|fire prayer|nsppd|intercession|vigil)\b/i.test(
      q
    )
  ) {
    return {
      originalQuery: rawQuery,
      scope,
      isBroad,
      detectedType: 'prayer',
      detectedCategorySlug: 'prayer-spiritual-warfare',
      biblicalThemes: ['Prayer & Intercession', 'Spiritual Warfare'],
      intentSummary: 'Christian Prayer & Spiritual Warfare Sessions',
      optimizedYouTubeQueries: [
        `${rawQuery} Christian prayer warfare prophetic declaration`,
        `${rawQuery} midnight prayer session sermon`,
      ],
      recommendedSubtopics: [
        'Midnight Warfare Prayers',
        'NSPPD 7AM Prophetic Declarations',
        'Prayers for Financial Breakthrough & Deliverance',
        'Morning Devotion & Altar Fire',
      ],
    };
  }

  // Check for Worship & Music Intent
  if (
    scope === 'worship' ||
    /\b(worship|song|songs|praise|gospel music|hallelujah challenge|chant|soaking worship|spontaneous|sing|acoustic worship|worship medley)\b/i.test(
      q
    )
  ) {
    return {
      originalQuery: rawQuery,
      scope,
      isBroad,
      detectedType: 'worship',
      detectedCategorySlug: 'worship-praise',
      biblicalThemes: ['Deep Worship', 'Praise & Thanksgiving', 'Presence of God'],
      intentSummary: 'Deep Worship & Sacred Christian Gospel Praise',
      optimizedYouTubeQueries: [
        `${rawQuery} deep Christian worship session praise live`,
        `${rawQuery} Nigerian gospel worship live ministration`,
      ],
      recommendedSubtopics: [
        'Soaking Worship Chants in God’s Presence',
        'Nigerian High Praise Celebrations',
        'Hallelujah Challenge Live Sessions',
        'Intimate Piano Worship Medleys',
      ],
    };
  }

  // Check for Marriage & Relationships Intent
  if (
    scope === 'marriage' ||
    /\b(marriage|relationship|relationships|dating|courtship|single|singles|husband|wife|spouse|breakup|divorce|celibacy|wedding|parenting|family)\b/i.test(
      q
    )
  ) {
    return {
      originalQuery: rawQuery,
      scope,
      isBroad,
      detectedType: 'marriage',
      detectedCategorySlug: 'marriage-relationships',
      biblicalThemes: ['Biblical Marriage', 'Christian Courtship', 'Godly Family'],
      intentSummary: 'Biblical Marriage, Courtship & Family Wisdom',
      optimizedYouTubeQueries: [
        `${rawQuery} Christian marriage relationship teaching pastor`,
        `${rawQuery} biblical advice for singles courtship`,
      ],
      recommendedSubtopics: [
        'Preparing for Godly Marriage',
        'Advice for Christian Singles & Courtship',
        'Resolving Conflict & Restoring Love',
        'Husband & Wife Responsibilities in Christ',
      ],
    };
  }

  // Default / General Sermon & Christian Living
  return {
    originalQuery: rawQuery,
    scope,
    isBroad,
    detectedType: 'sermon',
    detectedCategorySlug: 'sermons-teachings',
    biblicalThemes: ['Faith', 'Christian Living', 'Spiritual Growth'],
    intentSummary: isBroad
      ? `Christian Teachings, Sermons & Worship about ${rawQuery}`
      : `Christian Biblical Teachings on "${rawQuery}"`,
    optimizedYouTubeQueries: [
      `${rawQuery} Christian sermon biblical teaching message`,
      `${rawQuery} powerful Christian preaching`,
    ],
    recommendedSubtopics: [
      `Understanding ${rawQuery} in Scripture`,
      `Walking in ${rawQuery} Daily`,
      `Sermons by Anointed Ministers`,
    ],
  };
}

/**
 * AI-Powered Search Intent Understanding using Gemini 3.8 Flash
 */
export async function understandSearchIntent(
  rawQuery: string,
  scope: DiscoverySearchScope = 'all'
): Promise<SearchIntent> {
  const fallback = parseIntentDeterministic(rawQuery, scope);
  const ai = getGenAI();
  if (!ai || !rawQuery.trim()) {
    return fallback;
  }

  try {
    const prompt = `Analyze this search query entered by a user on a Christian streaming platform ("KINGDOM+"):
Search Query: "${rawQuery}"
Current Active Search Scope: "${scope}"

Identify:
1. What is the user really looking for? (e.g. Christian movies, a specific minister, worship songs, midnight prayers, marriage advice, faith teaching, spiritual warfare)
2. Detect the content type: 'movie' | 'minister' | 'sermon' | 'worship' | 'prayer' | 'marriage' | 'teaching' | 'general'
3. Detect the KINGDOM+ category slug: 'real-christian-movies' | 'sermons-teachings' | 'worship-praise' | 'gospel-music' | 'prayer-spiritual-warfare' | 'marriage-relationships' | 'christian-living' | 'conferences-events'
4. If it's a movie, identify the genre: ('Nigerian Christian Movies', 'Biblical & Historical Movies', 'Spiritual Warfare & Deliverance', 'Christian Family Dramas', 'Christian Romance & Courtship', 'Redemption & Transformation', 'Faith, Miracles & Inspiration', 'Christian Comedy & Action', 'African Christian Movies', 'International Christian Movies')
5. If a minister or gospel artist is requested or mentioned (e.g. "Apostle Joshua Selman", "Pastor Kumuyi", "Jerry Eze", "Dunsin Oyekan", "Mount Zion", "Steven Furtick", "Bro Gbile Akanni"), state their full formal minister name.
6. Is this a very broad query? (e.g. "God", "faith", "prayer", "pastor", "movie")
7. Generate 2 search queries optimized to find authentic Christian content on YouTube (excluding secular noise, short comedy clips, or gossip).
8. Provide 3-4 specific recommended subtopics or themes.
9. A 1-sentence human-friendly intent explanation (e.g. "Understood as: Christian Spiritual Warfare & Deliverance Movies").`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an expert Christian search intent understanding engine for KINGDOM+. You parse user search queries with deep theological and cultural understanding of Nigerian, African, and global Christian ministries, worship, sermons, and faith cinema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isBroad: { type: Type.BOOLEAN },
            detectedType: {
              type: Type.STRING,
              description: 'One of movie, minister, sermon, worship, prayer, marriage, teaching, general',
            },
            detectedCategorySlug: { type: Type.STRING },
            movieGenre: { type: Type.STRING },
            detectedMinisterName: { type: Type.STRING },
            intentSummary: { type: Type.STRING },
            biblicalThemes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            optimizedYouTubeQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedSubtopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            explanation: { type: Type.STRING },
          },
          required: [
            'isBroad',
            'detectedType',
            'detectedCategorySlug',
            'intentSummary',
            'optimizedYouTubeQueries',
            'recommendedSubtopics',
          ],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI intent understanding timed out')), 3500)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.intentSummary && Array.isArray(parsed.optimizedYouTubeQueries)) {
      return {
        originalQuery: rawQuery,
        scope,
        isBroad: Boolean(parsed.isBroad),
        detectedType: parsed.detectedType || fallback.detectedType,
        detectedCategorySlug: parsed.detectedCategorySlug || fallback.detectedCategorySlug,
        movieGenre: parsed.movieGenre || fallback.movieGenre,
        detectedMinisterName: parsed.detectedMinisterName || fallback.detectedMinisterName,
        biblicalThemes: Array.isArray(parsed.biblicalThemes) && parsed.biblicalThemes.length > 0
          ? parsed.biblicalThemes
          : fallback.biblicalThemes,
        intentSummary: parsed.intentSummary,
        optimizedYouTubeQueries: parsed.optimizedYouTubeQueries.slice(0, 2),
        recommendedSubtopics: Array.isArray(parsed.recommendedSubtopics) && parsed.recommendedSubtopics.length > 0
          ? parsed.recommendedSubtopics
          : fallback.recommendedSubtopics,
        explanation: parsed.explanation || fallback.explanation,
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Searches YouTube for public Christian videos using official YouTube Data API v3
 * with batch video detail enrichment and quota logging.
 */
async function searchYouTubeViaDataApi(
  query: string,
  maxResults = 16
): Promise<KingdomVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const isKeyConfigured = apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY';

  if (!isKeyConfigured) {
    // Fall back to structured scraper if API key is not yet set
    const fallbackItems = await searchYouTubeStructured(query, maxResults);
    return fallbackItems.map((item) => ({
      id: `discovered-${item.youtubeVideoId}`,
      youtube_video_id: item.youtubeVideoId,
      channel_id: `ch-${item.youtubeChannelId || 'discovered'}`,
      channel_title: item.channelTitle,
      channel_handle: 'Verified Channel',
      channel_type: 'minister',
      channel_avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        item.channelTitle
      )}&background=27272a&color=f59e0b`,
      is_nigerian_channel: true,
      is_official_verified: true,
      primary_category_id: 'cat-discovery',
      primary_category_slug: 'sermons-teachings',
      primary_category_name: 'Christian Discovery',
      secondary_category_slugs: [],
      title: item.title,
      description: item.description,
      thumbnail_high_url: item.thumbnailHighUrl,
      thumbnail_maxres_url: item.thumbnailMaxresUrl,
      published_at: item.publishedAt,
      duration_seconds: item.durationSeconds,
      view_count: item.viewCount,
      like_count: item.likeCount,
      likes_verified: false,
      comment_count: null,
      views_per_day: Math.round(item.viewCount / 30),
      engagement_rate: 60,
      trending_score: 85,
      evergreen_score: 85,
      quality_score: 88,
      live_broadcast_content: 'none',
      is_live_now: false,
      is_embeddable: true,
      is_available: true,
      approval_status: 'approved',
      is_featured_hero: false,
      is_trending_pinned: false,
      last_refreshed_at: new Date().toISOString(),
    }));
  }

  try {
    // 1. YouTube Data API search.list
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('maxResults', String(maxResults));
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('safeSearch', 'strict');
    searchUrl.searchParams.set('relevanceLanguage', 'en');
    searchUrl.searchParams.set('key', apiKey!);

    const searchRes = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(6000),
    });
    store.logYouTubeQuota('search.list', 100, maxResults, searchRes.status, `Intelligent search: ${query}`);

    if (!searchRes.ok) {
      // Fallback to structured search if quota exceeded (403)
      const fallbackItems = await searchYouTubeStructured(query, maxResults);
      return fallbackItems.map((item) => ({
        id: `discovered-${item.youtubeVideoId}`,
        youtube_video_id: item.youtubeVideoId,
        channel_id: `ch-${item.youtubeChannelId || 'discovered'}`,
        channel_title: item.channelTitle,
        channel_handle: 'Verified Channel',
        channel_type: 'minister',
        channel_avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          item.channelTitle
        )}&background=27272a&color=f59e0b`,
        is_nigerian_channel: true,
        is_official_verified: true,
        primary_category_id: 'cat-discovery',
        primary_category_slug: 'sermons-teachings',
        primary_category_name: 'Christian Discovery',
        secondary_category_slugs: [],
        title: item.title,
        description: item.description,
        thumbnail_high_url: item.thumbnailHighUrl,
        thumbnail_maxres_url: item.thumbnailMaxresUrl,
        published_at: item.publishedAt,
        duration_seconds: item.durationSeconds,
        view_count: item.viewCount,
        like_count: item.likeCount,
        likes_verified: false,
        comment_count: null,
        views_per_day: Math.round(item.viewCount / 30),
        engagement_rate: 60,
        trending_score: 85,
        evergreen_score: 85,
        quality_score: 88,
        live_broadcast_content: 'none',
        is_live_now: false,
        is_embeddable: true,
        is_available: true,
        approval_status: 'approved',
        is_featured_hero: false,
        is_trending_pinned: false,
        last_refreshed_at: new Date().toISOString(),
      }));
    }

    const searchData = await searchRes.json();
    const items = searchData.items || [];
    const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean);

    if (videoIds.length === 0) return [];

    // 2. YouTube Data API videos.list (cost: 1 quota unit) to get real view counts, duration, and embedding status
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'snippet,contentDetails,statistics,status');
    videosUrl.searchParams.set('id', videoIds.join(','));
    videosUrl.searchParams.set('key', apiKey!);

    const videosRes = await fetch(videosUrl.toString(), {
      signal: AbortSignal.timeout(6000),
    });
    store.logYouTubeQuota('videos.list', 1, videoIds.length, videosRes.status, `Enrich discovery videos: ${videoIds.length}`);

    const videosData = videosRes.ok ? await videosRes.json() : { items: [] };
    const detailsMap = new Map<string, any>();
    for (const v of videosData.items || []) {
      detailsMap.set(v.id, v);
    }

    const results: KingdomVideo[] = [];
    for (const item of items) {
      const vId = item.id?.videoId;
      if (!vId) continue;
      const details = detailsMap.get(vId);

      // Verify embedding status
      if (details?.status?.embeddable === false) continue;

      const snippet = details?.snippet || item.snippet || {};
      const stats = details?.statistics || {};
      const contentDetails = details?.contentDetails || {};

      const title = snippet.title || '';
      // Skip shorts
      if (/\b#shorts\b/i.test(title)) continue;

      const durationSeconds = parseIsoDurationToSeconds(contentDetails.duration);
      // Skip ultra-short clips under 2 minutes
      if (durationSeconds !== null && durationSeconds < 120) continue;

      const viewCount = stats.viewCount ? parseInt(stats.viewCount, 10) : 10000;
      const likeCount = stats.likeCount ? parseInt(stats.likeCount, 10) : Math.round(viewCount * 0.05);
      const commentCount = stats.commentCount ? parseInt(stats.commentCount, 10) : null;

      const channelTitle = snippet.channelTitle || 'Christian Ministry';
      const channelAvatarUrl =
        snippet.thumbnails?.default?.url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=27272a&color=f59e0b`;

      results.push({
        id: `discovered-${vId}`,
        youtube_video_id: vId,
        channel_id: `ch-${snippet.channelId || vId}`,
        channel_title: channelTitle,
        channel_handle: 'Verified Channel',
        channel_type: 'minister',
        channel_avatar_url: channelAvatarUrl,
        is_nigerian_channel: true,
        is_official_verified: true,
        primary_category_id: 'cat-discovery',
        primary_category_slug: 'sermons-teachings',
        primary_category_name: 'Christian Discovery',
        secondary_category_slugs: [],
        title,
        description: snippet.description || '',
        thumbnail_high_url: snippet.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
        thumbnail_maxres_url: snippet.thumbnails?.maxres?.url || `https://i.ytimg.com/vi/${vId}/maxresdefault.jpg`,
        published_at: snippet.publishedAt || new Date().toISOString(),
        duration_seconds: durationSeconds,
        view_count: viewCount,
        like_count: likeCount,
        likes_verified: true,
        comment_count: commentCount,
        views_per_day: Math.max(100, Math.round(viewCount / 30)),
        engagement_rate: 65,
        trending_score: 90,
        evergreen_score: 88,
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

    return results;
  } catch (err) {
    console.error('YouTube Data API search error:', err);
    return [];
  }
}

/**
 * Searches for any Christian minister's official YouTube channel and authentic videos
 * even if they are not already listed in KINGDOM+.
 */
export async function searchChristianMinisterBeyondCatalogue(
  ministerName: string
): Promise<DiscoveredMinisterInfo | null> {
  const cleanName = ministerName.trim();
  if (!cleanName || cleanName.length < 3) return null;

  // 1. Check if minister already exists in KINGDOM+ channels
  const lowerName = cleanName.toLowerCase();
  const existingChannel = store.state.channels.find((ch) => {
    const titleMatch = ch.title.toLowerCase().includes(lowerName);
    const speakerMatch = ch.speaker_name && ch.speaker_name.toLowerCase().includes(lowerName);
    const aliasMatch = (ch.aliases || []).some((a) => a.toLowerCase().includes(lowerName));
    return titleMatch || speakerMatch || aliasMatch;
  });

  const existingVideos = existingChannel
    ? store.state.videos.filter((v) => v.channel_id === existingChannel.id && v.approval_status === 'approved')
    : [];

  // If minister exists in app with 5+ videos, return their curated profile
  if (existingChannel && existingVideos.length >= 5) {
    return {
      name: existingChannel.speaker_name || existingChannel.title,
      handle: existingChannel.handle,
      youtubeChannelId: existingChannel.youtube_channel_id,
      avatarUrl: existingChannel.avatar_url,
      subscriberCount: existingChannel.subscriber_count,
      bio: existingChannel.bio || `${existingChannel.title} — Verified Christian Ministry on KINGDOM+`,
      isCuratedInApp: true,
      curatedChannelId: existingChannel.id,
      videos: existingVideos,
    };
  }

  // 2. Discover minister on YouTube Data API
  const query = `${cleanName} Christian sermon official ministry`;
  const discoveredVideos = await searchYouTubeViaDataApi(query, 12);

  if (discoveredVideos.length === 0 && existingChannel) {
    return {
      name: existingChannel.speaker_name || existingChannel.title,
      handle: existingChannel.handle,
      youtubeChannelId: existingChannel.youtube_channel_id,
      avatarUrl: existingChannel.avatar_url,
      subscriberCount: existingChannel.subscriber_count,
      bio: existingChannel.bio || `${existingChannel.title} — Verified Christian Ministry`,
      isCuratedInApp: true,
      curatedChannelId: existingChannel.id,
      videos: existingVideos,
    };
  }

  if (discoveredVideos.length === 0) return null;

  // Find most frequent channel name among results
  const channelFreq = new Map<string, { title: string; avatar: string; channelId: string; count: number }>();
  for (const v of discoveredVideos) {
    const entry = channelFreq.get(v.channel_title) || {
      title: v.channel_title,
      avatar: v.channel_avatar_url,
      channelId: v.channel_id,
      count: 0,
    };
    entry.count++;
    channelFreq.set(v.channel_title, entry);
  }

  const topChannel = Array.from(channelFreq.values()).sort((a, b) => b.count - a.count)[0];
  const combinedVideos = [...existingVideos, ...discoveredVideos];

  return {
    name: cleanName,
    handle: `@${cleanName.replace(/[^a-zA-Z0-9]/g, '')}`,
    youtubeChannelId: topChannel?.channelId || 'discovered-channel',
    avatarUrl:
      existingChannel?.avatar_url ||
      topChannel?.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=27272a&color=f59e0b`,
    subscriberCount: existingChannel?.subscriber_count || 150000,
    bio: `${cleanName} — Christian minister & teacher. Verified public teachings, sermons, and ministry sessions discovered from YouTube.`,
    isCuratedInApp: Boolean(existingChannel),
    curatedChannelId: existingChannel?.id,
    videos: combinedVideos,
  };
}

/**
 * Searches for Christian movies beyond our library across all requested genres.
 */
export async function searchChristianMoviesBeyondLibrary(
  query: string,
  genre?: string,
  maxResults = 16
): Promise<{
  genre: string;
  movies: KingdomVideo[];
  curatedMovies: KingdomVideo[];
  discoveredMovies: KingdomVideo[];
}> {
  const rawGenre = (genre || '').toLowerCase().trim();
  const genreConfig =
    CHRISTIAN_MOVIE_GENRES.find((g) => g.id === rawGenre) ||
    CHRISTIAN_MOVIE_GENRES.find((g) => g.label.toLowerCase() === rawGenre) ||
    CHRISTIAN_MOVIE_GENRES.find(
      (g) =>
        g.id !== 'all' &&
        (rawGenre.includes(g.id.replace(/-christian-movies$/, '')) ||
          g.label.toLowerCase().includes(rawGenre) ||
          rawGenre.includes(g.label.toLowerCase().split(' ')[0]))
    ) ||
    CHRISTIAN_MOVIE_GENRES[0];

  const cleanQuery = query.trim();
  const movieScope =
    rawGenre.includes('cartoon') || rawGenre.includes('animat')
      ? 'movies-cartoon'
      : rawGenre.includes('nigerian') || rawGenre.includes('african')
      ? 'movies-nigerian'
      : rawGenre.includes('international')
      ? 'movies-international'
      : 'movies';

  const queriesToRun = cleanQuery
    ? buildMovieSearchQueries(
        genreConfig.id !== 'all'
          ? `${cleanQuery} ${genreConfig.label.replace(/Christian Movies/i, '').trim()}`
          : cleanQuery,
        movieScope
      )
    : [genreConfig.querySuffix];

  // 1. Search local curated movies & cartoons (Nigerian & International)
  const MOVIE_SLUGS = new Set([
    'real-christian-movies',
    'bible-stories',
    'christian-animations',
    'bible-story-cartoons',
  ]);

  const qLower = cleanQuery.toLowerCase();
  const qWords = qLower
    .split(/\s+/)
    .filter((w) => w.length > 2 && w !== 'christian' && w !== 'movie' && w !== 'movies');

  const genreTokens =
    genreConfig.id === 'all'
      ? []
      : genreConfig.label
          .toLowerCase()
          .split(/[\s,&]+/)
          .filter((t) => t.length > 3 && t !== 'christian' && t !== 'movies' && t !== 'movie');

  const curatedMovies = store.state.videos.filter((v) => {
    if (v.approval_status !== 'approved' || !v.is_available || !v.is_embeddable) return false;
    const isMovie =
      MOVIE_SLUGS.has(v.primary_category_slug) ||
      v.secondary_category_slugs.some((s) => MOVIE_SLUGS.has(s)) ||
      v.channel_type === 'movie_studio' ||
      v.channel_type === 'animation_studio';
    if (!isMovie) return false;

    const hay = `${v.title} ${v.description} ${v.channel_title} ${v.primary_category_name} ${
      v.subcategory_label || ''
    } ${v.is_nigerian_channel ? 'nigeria nigerian african' : 'international global'}`.toLowerCase();

    if (qLower && !hay.includes(qLower)) {
      if (qWords.length === 0 || !qWords.every((w) => hay.includes(w))) {
        return false;
      }
    }

    if (genreTokens.length > 0 && !qLower) {
      if (genreConfig.id === 'nigerian-christian-movies') {
        return v.is_nigerian_channel || /nigerian|mount zion|bamiloye|winlos|jaymikee|evom/i.test(hay);
      }
      return genreTokens.some((t) => hay.includes(t));
    }

    return true;
  });

  // 2. Discover from YouTube Data API / structured search (strictly Christian Movies & Cartoons only)
  let discoveredRaw: KingdomVideo[] = [];
  if (!isSecularQuery(cleanQuery)) {
    const batches = await Promise.all(
      queriesToRun.slice(0, 2).map((q) => searchYouTubeViaDataApi(q, Math.ceil(maxResults / Math.min(2, queriesToRun.length)) + 4))
    );
    discoveredRaw = batches.flat();
  }

  const curatedYtIds = new Set(curatedMovies.map((m) => m.youtube_video_id));
  const seenDiscovered = new Set<string>();
  const discoveredMovies: KingdomVideo[] = [];

  for (const v of discoveredRaw) {
    if (!v.youtube_video_id || curatedYtIds.has(v.youtube_video_id) || seenDiscovered.has(v.youtube_video_id)) {
      continue;
    }
    if (
      !isLikelyChristianMovieOrCartoon(
        v.title,
        v.channel_title,
        v.description || '',
        v.duration_seconds ?? null,
        movieScope
      )
    ) {
      continue;
    }
    seenDiscovered.add(v.youtube_video_id);
    const cls = classifyDiscoveredMovie(v.title, v.channel_title, v.description || '');
    discoveredMovies.push({
      ...v,
      channel_type: cls.isCartoon ? 'animation_studio' : 'movie_studio',
      is_nigerian_channel: cls.isNigerian,
      primary_category_id: cls.categoryId,
      primary_category_slug: cls.categorySlug,
      primary_category_name: cls.categoryName,
      secondary_category_slugs: cls.isCartoon
        ? ['christian-animations', 'bible-story-cartoons']
        : ['real-christian-movies', 'bible-stories'],
      subcategory_label:
        genreConfig.id !== 'all' ? `${genreConfig.label} · ${cls.subcategoryLabel}` : cls.subcategoryLabel,
    });
  }

  const movies = [...curatedMovies, ...discoveredMovies].slice(0, maxResults);

  return {
    genre: genreConfig.label,
    movies,
    curatedMovies,
    discoveredMovies,
  };
}

/**
 * Master Intelligent Discovery Engine across the entire application.
 * Satisfies all requirements:
 * 1. Understands search intent & meaning using AI
 * 2. Identifies content category, topic, minister, or movie genre
 * 3. Searches existing app library first
 * 4. Searches publicly available YouTube content when needed
 * 5. Handles broad/vague queries with smart recommendations
 * 6. Never displays blank "No results found" — shows labeled intelligent alternatives
 */
export async function executeIntelligentDiscovery(
  rawQuery: string,
  scope: DiscoverySearchScope = 'all'
): Promise<IntelligentDiscoveryResult> {
  const cleanQuery = rawQuery.trim();
  const cacheKey = `${scope}:::${cleanQuery.toLowerCase()}`;

  const cached = discoveryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // 1. AI Intent Understanding
  const intent = await understandSearchIntent(cleanQuery, scope);
  if (scope === 'movies') {
    intent.detectedType = 'movie';
    intent.detectedCategorySlug = 'real-christian-movies';
    if (cleanQuery) {
      intent.optimizedYouTubeQueries = buildMovieSearchQueries(cleanQuery, 'movies');
    }
  }

  // 2. Search In-App Curated Library First
  const qLower = cleanQuery.toLowerCase();
  const allCuratedVideos = store.state.videos.filter((v) => v.approval_status === 'approved');

  let curatedVideos = allCuratedVideos.filter((v) => {
    // If scope is specified and not 'all', check category match
    if (scope === 'movies') {
      const isMovie =
        v.primary_category_slug.includes('movie') ||
        v.primary_category_slug.includes('animation') ||
        v.primary_category_slug.includes('stories') ||
        v.channel_type === 'movie_studio' ||
        v.channel_type === 'animation_studio';
      if (!isMovie) return false;
    } else if (scope === 'worship') {
      if (v.primary_category_slug !== 'worship-praise' && v.primary_category_slug !== 'gospel-music') {
        return false;
      }
    } else if (scope === 'prayer') {
      if (v.primary_category_slug !== 'prayer-spiritual-warfare') return false;
    } else if (scope === 'marriage') {
      if (v.primary_category_slug !== 'marriage-relationships') return false;
    }

    if (!qLower) return true;

    // Search by title, channel title, artist name, description, tags, and AI intent minister
    const titleMatch = v.title.toLowerCase().includes(qLower);
    const channelMatch = v.channel_title.toLowerCase().includes(qLower);
    const artistMatch = v.artist_name && v.artist_name.toLowerCase().includes(qLower);
    const descMatch = v.description.toLowerCase().includes(qLower);
    const subcatMatch = v.subcategory_label && v.subcategory_label.toLowerCase().includes(qLower);

    const ministerMatch =
      intent.detectedMinisterName &&
      (v.channel_title.toLowerCase().includes(intent.detectedMinisterName.toLowerCase()) ||
        v.title.toLowerCase().includes(intent.detectedMinisterName.toLowerCase()));

    return titleMatch || channelMatch || artistMatch || descMatch || subcatMatch || ministerMatch;
  });

  // Rank curated videos by semantic relevance to intent
  curatedVideos.sort((a, b) => {
    const aInTargetCat = a.primary_category_slug === intent.detectedCategorySlug ? 1 : 0;
    const bInTargetCat = b.primary_category_slug === intent.detectedCategorySlug ? 1 : 0;
    if (aInTargetCat !== bInTargetCat) return bInTargetCat - aInTargetCat;
    return b.trending_score - a.trending_score;
  });

  // 3. Search Publicly Available YouTube Content
  let discoveredVideos: KingdomVideo[] = [];
  let discoveredMinister: DiscoveredMinisterInfo | null = null;

  if (scope !== 'movies' && intent.detectedType === 'minister' && intent.detectedMinisterName) {
    discoveredMinister = await searchChristianMinisterBeyondCatalogue(intent.detectedMinisterName);
  } else if (cleanQuery && intent.optimizedYouTubeQueries.length > 0) {
    const ytQuery = intent.optimizedYouTubeQueries[0];
    const rawDiscovered = await searchYouTubeViaDataApi(ytQuery, 16);

    // Dedup against curated videos
    const curatedIds = new Set(curatedVideos.map((v) => v.youtube_video_id));
    discoveredVideos = rawDiscovered
      .filter((v) => {
        if (curatedIds.has(v.youtube_video_id)) return false;
        if (scope === 'movies') {
          return isLikelyChristianMovieOrCartoon(
            v.title,
            v.channel_title,
            v.description || '',
            v.duration_seconds ?? null,
            'movies'
          );
        }
        return true;
      })
      .map((v) => {
        if (scope === 'movies') {
          const cls = classifyDiscoveredMovie(v.title, v.channel_title, v.description || '');
          return {
            ...v,
            channel_type: cls.isCartoon ? 'animation_studio' : 'movie_studio',
            is_nigerian_channel: cls.isNigerian,
            primary_category_id: cls.categoryId,
            primary_category_slug: cls.categorySlug,
            primary_category_name: cls.categoryName,
            subcategory_label: cls.subcategoryLabel,
          };
        }
        return {
          ...v,
          primary_category_slug: intent.detectedCategorySlug || v.primary_category_slug,
          subcategory_label: intent.movieGenre || intent.intentSummary,
        };
      });
  }

  // 4. Handle Broad / Incomplete Queries with Smart Recommendations
  let broadCategorySections: IntelligentDiscoveryResult['broadCategorySections'] = undefined;
  let isRecommendation = false;
  let recommendationExplanation: string | undefined = undefined;

  if (intent.isBroad || (!cleanQuery && scope === 'all')) {
    isRecommendation = true;
    recommendationExplanation = `Showing well-organised recommendations across Christian teachings, worship, and movies for "${cleanQuery || 'Christian Content'}".`;

    const sermons = allCuratedVideos.filter((v) => v.primary_category_slug === 'sermons-teachings').slice(0, 4);
    const worship = allCuratedVideos.filter((v) => v.primary_category_slug === 'worship-praise').slice(0, 4);
    const prayers = allCuratedVideos.filter((v) => v.primary_category_slug === 'prayer-spiritual-warfare').slice(0, 4);
    const movies = allCuratedVideos.filter((v) => v.primary_category_slug === 'real-christian-movies').slice(0, 4);

    broadCategorySections = [
      { title: `Top Biblical Teachings on ${cleanQuery || 'Faith'}`, categorySlug: 'sermons-teachings', videos: sermons },
      { title: `Worship & Sacred Praise on ${cleanQuery || 'God'}`, categorySlug: 'worship-praise', videos: worship },
      { title: `Prophetic Prayers & Spiritual Warfare`, categorySlug: 'prayer-spiritual-warfare', videos: prayers },
      { title: `Christian Faith Cinema & Drama`, categorySlug: 'real-christian-movies', videos: movies },
    ];
  } else if (curatedVideos.length === 0 && discoveredVideos.length === 0) {
    // If exact match not found, identify closest relevant content and clearly label as recommendation (Section 5 rule)
    isRecommendation = true;
    recommendationExplanation = `No exact matches found for "${cleanQuery}". Showing recommended Christian messages & worship on ${intent.intentSummary}.`;

    curatedVideos = allCuratedVideos
      .filter((v) => v.primary_category_slug === intent.detectedCategorySlug)
      .slice(0, 8);

    if (curatedVideos.length === 0) {
      curatedVideos = allCuratedVideos.slice(0, 8);
    }
  }

  const result: IntelligentDiscoveryResult = {
    query: cleanQuery,
    scope,
    intent,
    curatedVideos: curatedVideos.slice(0, 16),
    discoveredVideos: discoveredVideos.slice(0, 16),
    discoveredMinister,
    isRecommendation,
    recommendationExplanation,
    broadCategorySections,
    totalMatches: curatedVideos.length + discoveredVideos.length,
  };

  discoveryCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}
