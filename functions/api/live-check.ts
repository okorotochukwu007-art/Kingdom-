export interface RealTimeLiveStreamItem {
  videoId: string;
  title: string;
  channelTitle: string;
  youtubeChannelId: string;
  matchedKingdomChannelId: string | null;
  watchingText: string;
  watchingCount: number;
  avatarUrl: string;
  thumbnailUrl: string;
}

const KNOWN_CHANNEL_MAP: Record<string, string> = {
  'UCLg4NCAJxhIvD4IRV__LOFg': 'ch-jerry-eze',
  'UCRe2Ir9wtPk_YQjElam7n2w': 'ch-nathaniel-bassey',
  'UCq2ueL6wl7slTuInRbFpe7w': 'ch-koinonia-selman',
  'UCtLlKV4vUqcxezKOoeILs5Q': 'ch-dunamis-enenche',
  'UCyUKtrMdDilf74SPkCCKKtw': 'ch-oyedepo-lfc',
  'UCALuqr8BQi_djTbgEL5yeGA': 'ch-harvesters-bolaji',
  'UCsVBRhKh9spV-YPTub0KcxQ': 'ch-covenant-nation',
  'UCH7KHtVTI91GcN6yuwvaFvQ': 'ch-ibiyeomie-sm',
  'UCbgM7xAXYYB6eX_CipYlTQw': 'ch-dove-tv-rccg',
  'UCoKmHRnjJu2WBu7A4evciMg': 'ch-olukoya-mfm',
};

const LIVE_SEARCH_QUERIES = [
  'nsppd live OR dunamis live OR rccg live OR koinonia live OR winners chapel live',
  'pastor jerry eze live OR apostle joshua selman live OR nathaniel bassey live OR bishop oyedepo live',
  'christian church service live OR gospel worship live stream OR 24/7 prayer altar live',
];

const BLOCKED_NON_CHRISTIAN_LIVE_TERMS = [
  'channels tv',
  'channels television',
  'channelstv',
  'arise news',
  'arise tv',
  'tvc news',
  'tvc entertainment',
  'ait live',
  'nta news',
  'nta international',
  'silverbird',
  'bbc news',
  'cnn',
  'al jazeera',
  'sky news',
  'fox news',
  'france 24',
  'dw news',
  'africanews',
  'reuters',
  'bloomberg',
  'cnbc',
  'breaking news',
  'news hour',
  'news bulletin',
  'politics today',
  'sunrise daily',
  'tinubu',
  'national assembly',
  'premier league',
  'champions league',
  'bbnaija',
  'sportybet',
  'bet9ja',
];

const CHRISTIAN_LIVE_WHITELIST_KEYWORDS = [
  'church',
  'ministry',
  'ministries',
  'chapel',
  'tabernacle',
  'sanctuary',
  'cathedral',
  'gospel',
  'worship',
  'praise',
  'prayer',
  'nsppd',
  'koinonia',
  'dunamis',
  'rccg',
  'redeemed',
  'living faith',
  'winners',
  'mfm',
  'mountain of fire',
  'christ embassy',
  'loveworld',
  'salvation ministries',
  'streams of joy',
  'harvesters',
  'covenant nation',
  'jesus',
  'christ',
  'bible',
  'sermon',
  'fellowship',
  'revival',
  'crusade',
  'vigil',
  'pastor',
  'apostle',
  'bishop',
  'prophet',
  'evangelist',
  'reverend',
  'hallelujah',
  'christian',
  'dove tv',
  'emmanuel tv',
  'elevation',
  'hillsong',
  'bethel',
  'catholic',
  'mass',
  'parish',
  'baptist',
  'methodist',
  'anglican',
  'pentecostal',
  'evangelical',
  'orthodox',
  'adventist',
  'scripture',
  'devotional',
  'miracle',
  'prophetic',
  'healing',
  'anointing',
  'salvation',
  'holy spirit',
  'hallelujah challenge',
  'midnight prayer',
  'morning devotion',
  'redemption camp',
  'covenant',
  'faith',
  'grace',
];

const EXTRA_SECULAR_LIVE_BLOCK_TERMS = [
  'davido',
  'wizkid',
  'burna boy',
  'afrobeat',
  'hip hop',
  'casino',
  'gambling',
  'horoscope',
  'tarot',
  'astrology',
  'ufc',
  'nba',
  'nfl',
  'f1',
  'formula 1',
  'esports',
  'twitch',
  'minecraft',
  'fortnite',
  'call of duty',
  'gta',
  'crypto signals',
  'forex live',
  'trading live',
];

function isVerifiedChristianLiveStream(
  youtubeChannelId: string,
  channelTitle: string,
  title: string
): boolean {
  const combined = `${channelTitle} ${title}`.toLowerCase();
  if (
    BLOCKED_NON_CHRISTIAN_LIVE_TERMS.some((term) => combined.includes(term)) ||
    EXTRA_SECULAR_LIVE_BLOCK_TERMS.some((term) => combined.includes(term))
  ) {
    return false;
  }
  if (KNOWN_CHANNEL_MAP[youtubeChannelId]) {
    return true;
  }
  return CHRISTIAN_LIVE_WHITELIST_KEYWORDS.some((kw) => combined.includes(kw));
}

function parseWatchingCount(text: string): number {
  const numStr = text.replace(/[^0-9]/g, '');
  return Number(numStr) || 25;
}

async function runLiveNowQueries(
  queries: string[],
  limit = 16
): Promise<RealTimeLiveStreamItem[]> {
  const seen = new Set<string>();
  const rawCandidates: RealTimeLiveStreamItem[] = [];

  await Promise.all(
    queries.map(async (q) => {
      try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
          q
        )}&sp=EgJAAQ%253D%253D`;
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
        if (!match) return;
        const data = JSON.parse(match[1]);
        const contents =
          data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
            ?.contents || [];

        for (const sec of contents) {
          for (const item of sec?.itemSectionRenderer?.contents || []) {
            const vr = item.videoRenderer;
            if (!vr || !vr.videoId || seen.has(vr.videoId)) continue;

            // STRICT CHECK: Must have real-time LIVE_NOW badge
            const isLiveNowBadge = (vr.badges || []).some(
              (b: any) => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
            );
            if (!isLiveNowBadge) continue;

            const title = vr.title?.runs?.map((r: any) => r.text).join('') || '';
            const channelTitle = vr.ownerText?.runs?.[0]?.text || 'Christian Live Broadcast';
            const youtubeChannelId =
              vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';

            if (!isVerifiedChristianLiveStream(youtubeChannelId, channelTitle, title)) {
              continue;
            }

            const watchingText =
              vr.viewCountText?.runs?.map((r: any) => r.text).join('') ||
              vr.shortViewCountText?.runs?.map((r: any) => r.text).join('') ||
              'LIVE NOW';
            const avatarUrl =
              vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
                ?.thumbnails?.[0]?.url || '';

            seen.add(vr.videoId);
            rawCandidates.push({
              videoId: vr.videoId,
              title,
              channelTitle,
              youtubeChannelId,
              matchedKingdomChannelId: KNOWN_CHANNEL_MAP[youtubeChannelId] || null,
              watchingText,
              watchingCount: parseWatchingCount(watchingText),
              avatarUrl,
              thumbnailUrl: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
            });
          }
        }
      } catch {
        // Ignore individual query error
      }
    })
  );

  // Sort so known ministries & highest concurrent live viewers appear first
  rawCandidates.sort((a, b) => {
    if (Boolean(a.matchedKingdomChannelId) !== Boolean(b.matchedKingdomChannelId)) {
      return a.matchedKingdomChannelId ? -1 : 1;
    }
    return b.watchingCount - a.watchingCount;
  });

  // Verify top results via oEmbed so non-embeddable streams are filtered out
  const topCandidates = rawCandidates.slice(0, limit);
  const verified = await Promise.all(
    topCandidates.map(async (item) => {
      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.videoId}&format=json`,
          { signal: AbortSignal.timeout(3500) }
        );
        return oembed.ok ? item : null;
      } catch {
        return item;
      }
    })
  );

  return verified.filter((v): v is RealTimeLiveStreamItem => v !== null);
}

export async function discoverRealTimeActiveYouTubeLives(): Promise<RealTimeLiveStreamItem[]> {
  return runLiveNowQueries(LIVE_SEARCH_QUERIES, 16);
}

/**
 * Searches real-time active Christian live streams globally by user query
 * (including churches & ministries not yet listed in the local catalog).
 */
export async function searchRealTimeLiveStreams(
  rawQuery: string
): Promise<RealTimeLiveStreamItem[]> {
  const clean = rawQuery.trim();
  if (clean.length < 2) return [];

  const lower = clean.toLowerCase();
  if (
    BLOCKED_NON_CHRISTIAN_LIVE_TERMS.some((term) => lower.includes(term)) ||
    EXTRA_SECULAR_LIVE_BLOCK_TERMS.some((term) => lower.includes(term))
  ) {
    return [];
  }

  const hasChristianWord = CHRISTIAN_LIVE_WHITELIST_KEYWORDS.some((kw) => lower.includes(kw));
  const queries = hasChristianWord
    ? [`${clean} live`, `${clean} church live stream`]
    : [`${clean} church live`, `${clean} christian live worship sermon`];

  const results = await runLiveNowQueries(queries, 16);

  // Prioritize matches whose title/channel matches user query tokens closely
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 2);
  results.sort((a, b) => {
    const aHay = `${a.title} ${a.channelTitle}`.toLowerCase();
    const bHay = `${b.title} ${b.channelTitle}`.toLowerCase();
    const aScore = tokens.reduce((acc, t) => acc + (aHay.includes(t) ? 1 : 0), 0);
    const bScore = tokens.reduce((acc, t) => acc + (bHay.includes(t) ? 1 : 0), 0);
    if (aScore !== bScore) return bScore - aScore;
    return b.watchingCount - a.watchingCount;
  });

  return results;
}

export async function onRequestGet(context?: { request?: Request }): Promise<Response> {
  const reqUrl = context?.request ? new URL(context.request.url) : null;
  const q = reqUrl ? (reqUrl.searchParams.get('q') || '').trim() : '';
  const liveStreams = q
    ? await searchRealTimeLiveStreams(q)
    : await discoverRealTimeActiveYouTubeLives();

  return new Response(
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      query: q || undefined,
      liveStreams,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    }
  );
}
