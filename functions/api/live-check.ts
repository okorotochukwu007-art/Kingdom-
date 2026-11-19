export interface RealTimeLiveStreamItem {
  videoId: string;
  title: string;
  channelTitle: string;
  youtubeChannelId: string;
  matchedKingdomChannelId: string | null;
  watchingText: string;
  watchingCount: number | null;
  avatarUrl: string;
  thumbnailUrl: string;
  isFeaturedPastor?: boolean;
  pastorName?: string;
  ministryName?: string;
  programmeName?: string;
  isNigerian?: boolean;
}

export interface FeaturedPastorChannelConfig {
  id: string;
  pastorName: string;
  ministryName: string;
  programmeName: string;
  youtubeChannelIds: string[];
  matchedKingdomChannelId: string | null;
  isNigerian: boolean;
}

/**
 * Verified official YouTube channels for the 15 Featured Pastors & Ministries.
 * Every channel ID below was directly verified against YouTube's official channel pages.
 */
export const FEATURED_PASTORS_REGISTRY: FeaturedPastorChannelConfig[] = [
  {
    id: 'featured-nathaniel-bassey',
    pastorName: 'Nathaniel Bassey',
    ministryName: 'Nathaniel Bassey Main',
    programmeName: 'Hallelujah Challenge',
    youtubeChannelIds: ['UCRe2Ir9wtPk_YQjElam7n2w'],
    matchedKingdomChannelId: 'ch-nathaniel-bassey',
    isNigerian: true,
  },
  {
    id: 'featured-jerry-eze',
    pastorName: 'Pastor Jerry Eze',
    ministryName: 'Streams of Joy International',
    programmeName: 'NSPPD',
    youtubeChannelIds: ['UCLg4NCAJxhIvD4IRV__LOFg'],
    matchedKingdomChannelId: 'ch-jerry-eze',
    isNigerian: true,
  },
  {
    id: 'featured-frei-gilson',
    pastorName: 'Frei Gilson',
    ministryName: 'Som do Monte',
    programmeName: 'Daily Rosary',
    youtubeChannelIds: ['UCbh6_TmFnAJLI56aAQeD3qw'],
    matchedKingdomChannelId: null,
    isNigerian: false,
  },
  {
    id: 'featured-ebuka-obi',
    pastorName: 'Evangelist Ebuka Obi',
    ministryName: 'Zion Prayer Movement Outreach',
    programmeName: 'Night of Open Heaven',
    youtubeChannelIds: ['UCdokt2U4QvDBxWxuJ-MBGHA'],
    matchedKingdomChannelId: null,
    isNigerian: true,
  },
  {
    id: 'featured-bruno-leonardo',
    pastorName: 'Pastor Bruno Leonardo',
    ministryName: 'Bispo Bruno Leonardo',
    programmeName: 'Prayer Broadcasts',
    youtubeChannelIds: ['UCVNouUw3d3l5JYVCxhAQXKA'],
    matchedKingdomChannelId: null,
    isNigerian: false,
  },
  {
    id: 'featured-joshua-selman',
    pastorName: 'Apostle Joshua Selman',
    ministryName: 'Eternity Network International',
    programmeName: 'Koinonia Global',
    youtubeChannelIds: ['UCq2ueL6wl7slTuInRbFpe7w'],
    matchedKingdomChannelId: 'ch-koinonia-selman',
    isNigerian: true,
  },
  {
    id: 'featured-david-oyedepo',
    pastorName: 'Bishop David Oyedepo',
    ministryName: 'Living Faith Church Worldwide',
    programmeName: 'Winners Chapel',
    youtubeChannelIds: ['UCyUKtrMdDilf74SPkCCKKtw'],
    matchedKingdomChannelId: 'ch-oyedepo-lfc',
    isNigerian: true,
  },
  {
    id: 'featured-chris-oyakhilome',
    pastorName: 'Pastor Chris Oyakhilome',
    ministryName: 'Christ Embassy / LoveWorld',
    programmeName: 'Christ Embassy / Healing Streams',
    youtubeChannelIds: ['UCNRo_Wza_lNTGZSEDjaQ1ng', 'UCOGnLDJABiBR8RDNbXbRqgA'],
    matchedKingdomChannelId: 'ch-pastor-chris',
    isNigerian: true,
  },
  {
    id: 'featured-ea-adeboye',
    pastorName: 'Pastor E.A. Adeboye',
    ministryName: 'The Redeemed Christian Church of God',
    programmeName: 'RCCG',
    youtubeChannelIds: [
      'UCHp4qCAPmz7-5BJ601FDFnA',
      'UCZMSEwiLNbwbs_e25dZQhhg',
      'UCbgM7xAXYYB6eX_CipYlTQw',
    ],
    matchedKingdomChannelId: 'ch-dove-tv-rccg',
    isNigerian: true,
  },
  {
    id: 'featured-steven-furtick',
    pastorName: 'Steven Furtick',
    ministryName: 'Elevation Church',
    programmeName: 'Elevation Church',
    youtubeChannelIds: ['UCIQqvZbHSwX0yKNVK1MyYjQ', 'UCDDSmXjv5vXqXo6OYuu83CA'],
    matchedKingdomChannelId: null,
    isNigerian: false,
  },
  {
    id: 'featured-joel-osteen',
    pastorName: 'Joel Osteen',
    ministryName: 'Lakewood Church',
    programmeName: 'Lakewood Church',
    youtubeChannelIds: ['UCvxWyn4rfcI2H9APhfUIB1Q', 'UCyeFQrxS5HIfWCrL9o0FkuQ'],
    matchedKingdomChannelId: null,
    isNigerian: false,
  },
  {
    id: 'featured-paul-enenche',
    pastorName: 'Pastor Paul Enenche',
    ministryName: 'Dunamis International Gospel Centre',
    programmeName: 'Dunamis International',
    youtubeChannelIds: ['UCtLlKV4vUqcxezKOoeILs5Q'],
    matchedKingdomChannelId: 'ch-dunamis-enenche',
    isNigerian: true,
  },
  {
    id: 'featured-matthew-ashimolowo',
    pastorName: 'Pastor Matthew Ashimolowo',
    ministryName: 'Kingsway International Christian Centre',
    programmeName: 'KICC',
    youtubeChannelIds: ['UCtT69Brp-Rl5FamR_jNBFmg'],
    matchedKingdomChannelId: 'ch-ashimolowo-kicc',
    isNigerian: true,
  },
  {
    id: 'featured-td-jakes',
    pastorName: 'Bishop T.D. Jakes',
    ministryName: "The Potter's House of Dallas",
    programmeName: "The Potter's House",
    youtubeChannelIds: ['UCjQbTcszB-gRhDByY9WhySw'],
    matchedKingdomChannelId: null,
    isNigerian: false,
  },
  {
    id: 'featured-william-mcdowell',
    pastorName: 'Pastor William McDowell',
    ministryName: 'Deeper Fellowship Church',
    programmeName: 'Worship and Prayer',
    youtubeChannelIds: ['UC1T4TME0FxdpZNp3UFxeTqw', 'UC2DG1coLhDhGucGc05JX-0A'],
    matchedKingdomChannelId: null,
    isNigerian: false,
  },
];

const FEATURED_BY_YT_CHANNEL_ID = new Map<string, FeaturedPastorChannelConfig>();
for (const entry of FEATURED_PASTORS_REGISTRY) {
  for (const ytId of entry.youtubeChannelIds) {
    FEATURED_BY_YT_CHANNEL_ID.set(ytId, entry);
  }
}

const KNOWN_CHANNEL_MAP: Record<string, string> = {
  'UCLg4NCAJxhIvD4IRV__LOFg': 'ch-jerry-eze',
  'UCRe2Ir9wtPk_YQjElam7n2w': 'ch-nathaniel-bassey',
  'UCq2ueL6wl7slTuInRbFpe7w': 'ch-koinonia-selman',
  'UCtLlKV4vUqcxezKOoeILs5Q': 'ch-dunamis-enenche',
  'UCyUKtrMdDilf74SPkCCKKtw': 'ch-oyedepo-lfc',
  'UCNRo_Wza_lNTGZSEDjaQ1ng': 'ch-pastor-chris',
  'UCOGnLDJABiBR8RDNbXbRqgA': 'ch-pastor-chris',
  'UCtT69Brp-Rl5FamR_jNBFmg': 'ch-ashimolowo-kicc',
  'UCALuqr8BQi_djTbgEL5yeGA': 'ch-harvesters-bolaji',
  'UCsVBRhKh9spV-YPTub0KcxQ': 'ch-covenant-nation',
  'UCH7KHtVTI91GcN6yuwvaFvQ': 'ch-ibiyeomie-sm',
  'UCbgM7xAXYYB6eX_CipYlTQw': 'ch-dove-tv-rccg',
  'UCHp4qCAPmz7-5BJ601FDFnA': 'ch-dove-tv-rccg',
  'UCZMSEwiLNbwbs_e25dZQhhg': 'ch-dove-tv-rccg',
  'UCMd5fYoenMlMJQ6-Bt6gsRw': 'ch-olukoya-mfm',
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
  'rosary',
  'rosário',
  'terço',
  'oração',
  'frei gilson',
  'bruno leonardo',
  'zion prayer',
  'open heaven',
  'lakewood',
  'potter',
  'kicc',
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

const YT_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function isVerifiedChristianLiveStream(
  youtubeChannelId: string,
  channelTitle: string,
  title: string
): boolean {
  if (FEATURED_BY_YT_CHANNEL_ID.has(youtubeChannelId)) {
    return true;
  }
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

/**
 * Accurately parses YouTube concurrent viewer strings like:
 * "193K watching", "1,929 watching", "1.2M watching", "458 watching now".
 * Returns null if no reliable viewer count is present (never fabricates a number).
 */
export function parseConcurrentViewerCount(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.trim();
  if (!cleaned) return null;

  // Ignore scheduled / waiting / views-on-VOD strings
  const lower = cleaned.toLowerCase();
  if (
    lower.includes('waiting') ||
    lower.includes('scheduled') ||
    lower.includes('streamed') ||
    lower.includes('ago')
  ) {
    return null;
  }

  // Match compact format e.g. 193K, 1.2M, 4.5B or integer with commas e.g. 12,345
  const compactMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*([KMB])\b/i);
  if (compactMatch) {
    const base = parseFloat(compactMatch[1].replace(',', '.'));
    if (!Number.isFinite(base)) return null;
    const suffix = compactMatch[2].toUpperCase();
    const multiplier =
      suffix === 'B' ? 1_000_000_000 : suffix === 'M' ? 1_000_000 : 1_000;
    const count = Math.round(base * multiplier);
    return count > 0 ? count : null;
  }

  const intMatch = cleaned.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
  if (intMatch) {
    const count = Number(intMatch[1].replace(/,/g, ''));
    return Number.isFinite(count) && count > 0 ? count : null;
  }

  return null;
}

function formatWatchingLabel(watchingCount: number | null, rawText?: string): string {
  if (rawText && /(watching|assistindo)/i.test(rawText) && !/waiting/i.test(rawText)) {
    return rawText.trim();
  }
  if (watchingCount !== null && watchingCount > 0) {
    if (watchingCount >= 1_000_000) {
      return `${(watchingCount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M watching`;
    }
    if (watchingCount >= 1_000) {
      return `${(watchingCount / 1_000).toFixed(1).replace(/\.0$/, '')}K watching`;
    }
    return `${watchingCount.toLocaleString()} watching`;
  }
  return 'LIVE NOW';
}

function extractBalancedJsonObject(source: string, marker: string): any | null {
  const markerIdx = source.indexOf(marker);
  if (markerIdx === -1) return null;
  const start = source.indexOf('{', markerIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractTextFromRuns(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (typeof node.content === 'string') return node.content;
  if (Array.isArray(node.runs)) {
    return node.runs.map((r: any) => r?.text || '').join('');
  }
  return '';
}

function collectObjectsByKeys(root: any, targetKeys: string[]): Array<{ key: string; value: any }> {
  const results: Array<{ key: string; value: any }> = [];
  const stack: any[] = [root];

  while (stack.length > 0) {
    const curr = stack.pop();
    if (!curr || typeof curr !== 'object') continue;
    if (Array.isArray(curr)) {
      for (let i = curr.length - 1; i >= 0; i--) {
        stack.push(curr[i]);
      }
      continue;
    }
    for (const k of Object.keys(curr)) {
      if (targetKeys.includes(k) && curr[k] && typeof curr[k] === 'object') {
        results.push({ key: k, value: curr[k] });
      }
      const val = curr[k];
      if (val && typeof val === 'object') {
        stack.push(val);
      }
    }
  }
  return results;
}

function extractStreamsTabChannelAvatar(data: any, html: string): string {
  // 1. Try pageHeaderViewModel / c4TabbedHeaderRenderer avatar in ytInitialData
  const pageHeader =
    data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image?.decoratedAvatarViewModel
      ?.avatar?.avatarViewModel?.image?.sources;
  if (Array.isArray(pageHeader) && pageHeader.length > 0) {
    const best = pageHeader[pageHeader.length - 1]?.url || pageHeader[0]?.url;
    if (best) return best;
  }

  const c4Avatar = data?.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails;
  if (Array.isArray(c4Avatar) && c4Avatar.length > 0) {
    const best = c4Avatar[c4Avatar.length - 1]?.url || c4Avatar[0]?.url;
    if (best) return best;
  }

  // 2. Fallback to og:image meta tag on channel page
  const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  if (ogMatch && ogMatch[1]) {
    return ogMatch[1];
  }
  return '';
}

function extractStreamsTabChannelTitle(data: any, fallback: string): string {
  const pageTitle =
    data?.header?.pageHeaderRenderer?.pageTitle ||
    data?.metadata?.channelMetadataRenderer?.title ||
    data?.header?.c4TabbedHeaderRenderer?.title;
  return typeof pageTitle === 'string' && pageTitle.trim() ? pageTitle.trim() : fallback;
}

/**
 * Inspects a single verified official pastor YouTube channel's `/streams` tab.
 * Strictly detects GENUINE active live broadcasts only — explicitly rejects
 * Upcoming/Scheduled streams and already-ended Streamed VODs.
 */
async function checkOfficialChannelStreamsTab(
  config: FeaturedPastorChannelConfig,
  youtubeChannelId: string
): Promise<RealTimeLiveStreamItem[]> {
  try {
    const url = `https://www.youtube.com/channel/${encodeURIComponent(youtubeChannelId)}/streams`;
    const res = await fetch(url, {
      headers: YT_FETCH_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const data =
      extractBalancedJsonObject(html, 'var ytInitialData = ') ||
      extractBalancedJsonObject(html, 'window["ytInitialData"] = ');
    if (!data) return [];

    const channelTitle = extractStreamsTabChannelTitle(data, config.ministryName);
    const avatarUrl = extractStreamsTabChannelAvatar(data, html);

    const detected: RealTimeLiveStreamItem[] = [];
    const seenVideoIds = new Set<string>();

    // Inspect modern `lockupViewModel` items as well as `videoRenderer` / `gridVideoRenderer`
    const renderers = collectObjectsByKeys(data, [
      'lockupViewModel',
      'videoRenderer',
      'gridVideoRenderer',
    ]);

    for (const { key, value } of renderers) {
      if (key === 'lockupViewModel') {
        const videoId = typeof value.contentId === 'string' ? value.contentId : '';
        if (!videoId || videoId.length !== 11 || seenVideoIds.has(videoId)) continue;

        // Collect all thumbnail overlay badges on this lockup
        const badges = collectObjectsByKeys(value.contentImage, ['thumbnailBadgeViewModel']);
        let hasLiveBadge = false;
        let isUpcomingOrEnded = false;

        for (const { value: badge } of badges) {
          const badgeStyle = String(badge?.badgeStyle || '');
          const badgeText = String(badge?.text || '').trim().toLowerCase();

          if (badgeStyle === 'THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE' || badgeText === 'live') {
            hasLiveBadge = true;
          }
          if (
            badgeText === 'upcoming' ||
            badgeText === 'premiere' ||
            badgeText.includes('scheduled') ||
            /^\d+:\d+/.test(badgeText)
          ) {
            isUpcomingOrEnded = true;
          }
        }

        if (!hasLiveBadge || isUpcomingOrEnded) continue;

        // Inspect metadata rows for concurrent viewers & double-check not upcoming/streamed
        const metadataRows =
          value?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
            ?.metadataRows || [];
        const metaTexts: string[] = [];
        for (const row of metadataRows) {
          for (const part of row?.metadataParts || []) {
            const txt = extractTextFromRuns(part?.text).trim();
            if (txt) metaTexts.push(txt);
          }
        }

        const metaJoined = metaTexts.join(' | ').toLowerCase();
        if (
          metaJoined.includes('scheduled for') ||
          metaJoined.includes('waiting') ||
          metaJoined.includes('streamed ') ||
          metaJoined.includes('premiere')
        ) {
          continue;
        }

        const title =
          extractTextFromRuns(value?.metadata?.lockupMetadataViewModel?.title).trim() ||
          `${config.pastorName} — ${config.programmeName}`;

        const watchingMeta =
          metaTexts.find((t) => /(watching|assistindo)/i.test(t) && !/waiting/i.test(t)) || '';
        const watchingCount = parseConcurrentViewerCount(watchingMeta);

        seenVideoIds.add(videoId);
        detected.push({
          videoId,
          title,
          channelTitle,
          youtubeChannelId,
          matchedKingdomChannelId:
            config.matchedKingdomChannelId || KNOWN_CHANNEL_MAP[youtubeChannelId] || null,
          watchingText: formatWatchingLabel(watchingCount, watchingMeta),
          watchingCount,
          avatarUrl,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          isFeaturedPastor: true,
          pastorName: config.pastorName,
          ministryName: config.ministryName,
          programmeName: config.programmeName,
          isNigerian: config.isNigerian,
        });
      } else {
        // videoRenderer / gridVideoRenderer fallback
        const videoId = typeof value.videoId === 'string' ? value.videoId : '';
        if (!videoId || videoId.length !== 11 || seenVideoIds.has(videoId)) continue;

        if (value.upcomingEventData) continue;

        const hasLiveBadge = (value.badges || []).some(
          (b: any) => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
        );
        const hasLiveOverlay = (value.thumbnailOverlays || []).some(
          (o: any) => o?.thumbnailOverlayTimeStatusRenderer?.style === 'LIVE'
        );
        if (!hasLiveBadge && !hasLiveOverlay) continue;

        const viewText =
          extractTextFromRuns(value.viewCountText) ||
          extractTextFromRuns(value.shortViewCountText);
        const publishedText = extractTextFromRuns(value.publishedTimeText);
        const checkStr = `${viewText} ${publishedText}`.toLowerCase();
        if (
          checkStr.includes('waiting') ||
          checkStr.includes('scheduled') ||
          checkStr.includes('streamed ')
        ) {
          continue;
        }

        const title =
          extractTextFromRuns(value.title).trim() ||
          `${config.pastorName} — ${config.programmeName}`;
        const watchingCount = parseConcurrentViewerCount(viewText);

        seenVideoIds.add(videoId);
        detected.push({
          videoId,
          title,
          channelTitle,
          youtubeChannelId,
          matchedKingdomChannelId:
            config.matchedKingdomChannelId || KNOWN_CHANNEL_MAP[youtubeChannelId] || null,
          watchingText: formatWatchingLabel(watchingCount, viewText),
          watchingCount,
          avatarUrl,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          isFeaturedPastor: true,
          pastorName: config.pastorName,
          ministryName: config.ministryName,
          programmeName: config.programmeName,
          isNigerian: config.isNigerian,
        });
      }
    }

    return detected;
  } catch {
    return [];
  }
}

async function checkAllFeaturedPastorChannels(): Promise<RealTimeLiveStreamItem[]> {
  const channelChecks: Array<Promise<RealTimeLiveStreamItem[]>> = [];

  for (const config of FEATURED_PASTORS_REGISTRY) {
    for (const ytChannelId of config.youtubeChannelIds) {
      channelChecks.push(checkOfficialChannelStreamsTab(config, ytChannelId));
    }
  }

  const settled = await Promise.all(channelChecks);
  const byVideoId = new Map<string, RealTimeLiveStreamItem>();
  for (const list of settled) {
    for (const item of list) {
      if (!byVideoId.has(item.videoId)) {
        byVideoId.set(item.videoId, item);
      }
    }
  }
  return Array.from(byVideoId.values());
}

function sortLiveBroadcasts(items: RealTimeLiveStreamItem[]): RealTimeLiveStreamItem[] {
  return [...items].sort((a, b) => {
    // 1. Featured official pastors always surface first on the homepage stream
    if (Boolean(a.isFeaturedPastor) !== Boolean(b.isFeaturedPastor)) {
      return a.isFeaturedPastor ? -1 : 1;
    }

    // 2. When reliable concurrent viewer counts are available, prioritize highest viewers first
    const aHasCount = typeof a.watchingCount === 'number' && a.watchingCount > 0;
    const bHasCount = typeof b.watchingCount === 'number' && b.watchingCount > 0;
    if (aHasCount && bHasCount && a.watchingCount !== b.watchingCount) {
      return (b.watchingCount as number) - (a.watchingCount as number);
    }
    if (aHasCount !== bHasCount) {
      return aHasCount ? -1 : 1;
    }

    // 3. Secondary tie-breaker: known catalog channels first
    if (Boolean(a.matchedKingdomChannelId) !== Boolean(b.matchedKingdomChannelId)) {
      return a.matchedKingdomChannelId ? -1 : 1;
    }

    return 0;
  });
}

async function verifyEmbeddableLiveStreams(
  candidates: RealTimeLiveStreamItem[],
  limit: number
): Promise<RealTimeLiveStreamItem[]> {
  const topCandidates = candidates.slice(0, limit);
  const verified = await Promise.all(
    topCandidates.map(async (item) => {
      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(
            item.videoId
          )}&format=json`,
          { signal: AbortSignal.timeout(3500) }
        );
        return oembed.ok ? item : null;
      } catch {
        // On transient oEmbed timeout, keep verified featured live streams rather than dropping them
        return item;
      }
    })
  );

  return verified.filter((v): v is RealTimeLiveStreamItem => v !== null);
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
          headers: YT_FETCH_HEADERS,
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return;
        const html = await res.text();
        const data = extractBalancedJsonObject(html, 'var ytInitialData = ');
        if (!data) return;

        const contents =
          data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
            ?.contents || [];

        for (const sec of contents) {
          for (const item of sec?.itemSectionRenderer?.contents || []) {
            const vr = item.videoRenderer;
            if (!vr || !vr.videoId || seen.has(vr.videoId)) continue;
            if (vr.upcomingEventData) continue;

            // STRICT CHECK: Must have real-time LIVE_NOW badge
            const isLiveNowBadge = (vr.badges || []).some(
              (b: any) => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
            );
            if (!isLiveNowBadge) continue;

            const title = extractTextFromRuns(vr.title);
            const channelTitle = vr.ownerText?.runs?.[0]?.text || 'Christian Live Broadcast';
            const youtubeChannelId =
              vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';

            if (!isVerifiedChristianLiveStream(youtubeChannelId, channelTitle, title)) {
              continue;
            }

            const rawWatchingText =
              extractTextFromRuns(vr.viewCountText) ||
              extractTextFromRuns(vr.shortViewCountText);
            if (/waiting|scheduled|streamed /i.test(rawWatchingText)) {
              continue;
            }

            const watchingCount = parseConcurrentViewerCount(rawWatchingText);
            const avatarUrl =
              vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
                ?.thumbnails?.[0]?.url || '';

            const featuredConfig = FEATURED_BY_YT_CHANNEL_ID.get(youtubeChannelId);

            seen.add(vr.videoId);
            rawCandidates.push({
              videoId: vr.videoId,
              title,
              channelTitle,
              youtubeChannelId,
              matchedKingdomChannelId:
                featuredConfig?.matchedKingdomChannelId ||
                KNOWN_CHANNEL_MAP[youtubeChannelId] ||
                null,
              watchingText: formatWatchingLabel(watchingCount, rawWatchingText),
              watchingCount,
              avatarUrl,
              thumbnailUrl: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
              isFeaturedPastor: Boolean(featuredConfig),
              pastorName: featuredConfig?.pastorName,
              ministryName: featuredConfig?.ministryName,
              programmeName: featuredConfig?.programmeName,
              isNigerian: featuredConfig ? featuredConfig.isNigerian : undefined,
            });
          }
        }
      } catch {
        // Ignore individual query error
      }
    })
  );

  const sorted = sortLiveBroadcasts(rawCandidates);
  return verifyEmbeddableLiveStreams(sorted, limit);
}

/**
 * Discovers genuinely active real-time Christian live broadcasts:
 * 1. Monitors all 15 Featured Pastors' verified official YouTube channels directly.
 * 2. Runs Christian live stream discovery queries in parallel.
 * 3. Deduplicates, verifies embeddability, and prioritizes featured pastors by actual concurrent viewers.
 */
export async function discoverRealTimeActiveYouTubeLives(): Promise<RealTimeLiveStreamItem[]> {
  const [featuredLiveItems, queryLiveItems] = await Promise.all([
    checkAllFeaturedPastorChannels(),
    runLiveNowQueries(LIVE_SEARCH_QUERIES, 16),
  ]);

  const mergedByVideoId = new Map<string, RealTimeLiveStreamItem>();

  // Add featured pastor official channel detections first (authoritative metadata)
  for (const item of featuredLiveItems) {
    mergedByVideoId.set(item.videoId, item);
  }

  // Merge additional general Christian live streams (upgrading viewer count if query had fresher count)
  for (const item of queryLiveItems) {
    const existing = mergedByVideoId.get(item.videoId);
    if (!existing) {
      mergedByVideoId.set(item.videoId, item);
    } else if (existing.watchingCount === null && item.watchingCount !== null) {
      mergedByVideoId.set(item.videoId, {
        ...existing,
        watchingCount: item.watchingCount,
        watchingText: item.watchingText,
        avatarUrl: existing.avatarUrl || item.avatarUrl,
      });
    } else if (!existing.avatarUrl && item.avatarUrl) {
      mergedByVideoId.set(item.videoId, {
        ...existing,
        avatarUrl: item.avatarUrl,
      });
    }
  }

  const sortedAll = sortLiveBroadcasts(Array.from(mergedByVideoId.values()));

  // Verify embeddability for featured pastor streams too (queryLiveItems were already oEmbed-verified)
  const alreadyVerifiedIds = new Set(queryLiveItems.map((i) => i.videoId));
  const needsVerification = sortedAll.filter((i) => !alreadyVerifiedIds.has(i.videoId));
  const verifiedFeatured = await verifyEmbeddableLiveStreams(needsVerification, 20);
  const verifiedFeaturedIds = new Set(verifiedFeatured.map((i) => i.videoId));

  const finalList = sortedAll.filter(
    (item) => alreadyVerifiedIds.has(item.videoId) || verifiedFeaturedIds.has(item.videoId)
  );

  return finalList.slice(0, 24);
}

/**
 * Searches real-time active Christian live streams globally by user query
 * (including featured pastors and ministries not yet listed in the local catalog).
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

  // Also directly check any featured pastor matching the search query
  const matchingFeatured = FEATURED_PASTORS_REGISTRY.filter((p) => {
    const hay = `${p.pastorName} ${p.ministryName} ${p.programmeName}`.toLowerCase();
    return hay.includes(lower) || lower.split(/\s+/).some((tok) => tok.length >= 3 && hay.includes(tok));
  });

  const featuredChecks = matchingFeatured.flatMap((cfg) =>
    cfg.youtubeChannelIds.map((id) => checkOfficialChannelStreamsTab(cfg, id))
  );

  const [queryResults, featuredNested] = await Promise.all([
    runLiveNowQueries(queries, 16),
    Promise.all(featuredChecks),
  ]);

  const byVideoId = new Map<string, RealTimeLiveStreamItem>();
  for (const list of featuredNested) {
    for (const item of list) {
      byVideoId.set(item.videoId, item);
    }
  }
  for (const item of queryResults) {
    if (!byVideoId.has(item.videoId)) {
      byVideoId.set(item.videoId, item);
    }
  }

  const results = Array.from(byVideoId.values());

  // Prioritize matches whose title/channel/pastor/programme matches user query tokens closely
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 2);
  results.sort((a, b) => {
    const aHay = `${a.title} ${a.channelTitle} ${a.pastorName || ''} ${a.ministryName || ''} ${a.programmeName || ''}`.toLowerCase();
    const bHay = `${b.title} ${b.channelTitle} ${b.pastorName || ''} ${b.ministryName || ''} ${b.programmeName || ''}`.toLowerCase();
    const aScore = tokens.reduce((acc, t) => acc + (aHay.includes(t) ? 1 : 0), 0);
    const bScore = tokens.reduce((acc, t) => acc + (bHay.includes(t) ? 1 : 0), 0);
    if (aScore !== bScore) return bScore - aScore;

    const aCount = a.watchingCount ?? -1;
    const bCount = b.watchingCount ?? -1;
    return bCount - aCount;
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
      monitoredPastorsCount: FEATURED_PASTORS_REGISTRY.length,
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
