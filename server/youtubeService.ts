import { ContentCategory, KingdomChannel, KingdomVideo } from '../src/types/kingdom.ts';
import { classifyVideoDeterministic } from './geminiService.ts';

/**
 * Parses ISO 8601 duration strings from YouTube Data API v3 (e.g. "PT1H24M10S") into seconds.
 */
export function parseIsoDurationToSeconds(isoDuration?: string): number | null {
  if (!isoDuration) return null;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parses human-readable duration strings (e.g. "1:08:42" or "32:05") into seconds.
 */
export function parseClockDurationToSeconds(clock?: string): number | null {
  if (!clock) return null;
  const parts = clock
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

/**
 * Parses human-readable relative time strings (e.g. "5mo ago", "2 weeks ago", "1y ago") into an ISO date string.
 */
export function parseRelativeTimeTextToIso(text?: string): string {
  const now = Date.now();
  if (!text) return new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const lower = text.toLowerCase();
  const numMatch = lower.match(/(\d+)/);
  const n = numMatch ? parseInt(numMatch[1], 10) : 1;

  if (lower.includes('hour') || /\d+\s*h\b/.test(lower)) {
    return new Date(now - n * 3600 * 1000).toISOString();
  }
  if (lower.includes('day') || /\d+\s*d\b/.test(lower)) {
    return new Date(now - n * 24 * 3600 * 1000).toISOString();
  }
  if (lower.includes('week') || /\d+\s*w\b/.test(lower)) {
    return new Date(now - n * 7 * 24 * 3600 * 1000).toISOString();
  }
  if (lower.includes('month') || /\d+\s*mo\b/.test(lower)) {
    return new Date(now - n * 30 * 24 * 3600 * 1000).toISOString();
  }
  if (lower.includes('year') || /\d+\s*y\b/.test(lower)) {
    return new Date(now - n * 365 * 24 * 3600 * 1000).toISOString();
  }
  return new Date(now - 30 * 24 * 3600 * 1000).toISOString();
}

/**
 * Extracts a valid 11-character YouTube video ID from any YouTube URL or raw ID string.
 */
export function extractYouTubeVideoIdFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const vParam = parsed.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }
    const pathMatch = parsed.pathname.match(/\/(?:live|embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (pathMatch) {
      return pathMatch[1];
    }
  } catch {
    const regexMatch = trimmed.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (regexMatch) return regexMatch[1];
  }
  return null;
}

/**
 * Decodes common XML entities from YouTube Atom feeds.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Strict Video Ranking & Quality Scoring Model for KINGDOM+
 */
export function computeVideoRankingMetrics(params: {
  viewCount: number;
  likeCount: number;
  commentCount: number | null;
  publishedAt: string;
  isNigerianChannel: boolean;
  isOfficialVerified?: boolean;
  priorityWeight: number;
}): {
  viewsPerDay: number;
  engagementRate: number;
  trendingScore: number;
  evergreenScore: number;
  qualityScore: number;
} {
  const publishedMs = new Date(params.publishedAt).getTime();
  const nowMs = Date.now();
  const ageDays = Math.max(0.5, (nowMs - publishedMs) / (1000 * 60 * 60 * 24));

  const viewsPerDay = Number((params.viewCount / Math.max(1, ageDays)).toFixed(2));
  const weightedInteractions = params.likeCount + (params.commentCount ?? 0) * 3;
  const engagementRate =
    params.viewCount > 0
      ? Number(((weightedInteractions / params.viewCount) * 1000).toFixed(2))
      : 0;

  const viewConfidenceDamper =
    params.viewCount < 300
      ? 0.15
      : params.viewCount < 1200
      ? Math.max(0.25, params.viewCount / 1200)
      : 1.0;

  const recencyBoost =
    ageDays <= 2
      ? 2.1
      : ageDays <= 7
      ? 1.85
      : ageDays <= 30
      ? 1.4
      : ageDays <= 90
      ? 0.95
      : ageDays <= 180
      ? 0.45
      : 0.25;

  const credibilityMultiplier =
    (params.isNigerianChannel ? params.priorityWeight : 1.0) *
    (params.isOfficialVerified !== false ? 1.15 : 0.75);

  const engagementMomentum = 1 + Math.min(engagementRate, 140) / 180;

  const trendingScore = Number(
    (
      (viewsPerDay *
        engagementMomentum *
        recencyBoost *
        credibilityMultiplier *
        viewConfidenceDamper) /
      Math.pow(ageDays + 2, 0.32)
    ).toFixed(2)
  );

  const evergreenScore = Number(
    (
      Math.log10(Math.max(10, params.viewCount)) *
      1000 *
      (1 + Math.min(engagementRate, 110) / 220) *
      credibilityMultiplier
    ).toFixed(2)
  );

  const rawQuality =
    (params.isOfficialVerified !== false ? 30 : 10) +
    (params.isNigerianChannel ? 15 : 8) +
    Math.min(30, Math.log10(Math.max(1, params.viewCount)) * 5) +
    Math.min(15, engagementRate / 4) +
    Math.min(10, Math.log10(Math.max(1, viewsPerDay)) * 2.5);
  const qualityScore = Math.min(100, Math.round(rawQuality));

  return {
    viewsPerDay,
    engagementRate,
    trendingScore,
    evergreenScore,
    qualityScore,
  };
}

export interface RawFeedVideoItem {
  youtubeVideoId: string;
  youtubeChannelId: string;
  channelTitle?: string;
  title: string;
  description: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  likesVerified?: boolean;
  commentCount: number | null;
  durationSeconds: number | null;
  liveBroadcastContent?: 'live' | 'upcoming' | 'none';
  isLiveNow?: boolean;
  isEmbeddable: boolean;
  thumbnailHighUrl: string;
  thumbnailMaxresUrl: string;
}

/**
 * Fetches real, live videos and statistics from YouTube's official Atom XML feed for a channel.
 */
export async function fetchChannelVideosViaOfficialXmlFeed(
  youtubeChannelId: string
): Promise<RawFeedVideoItem[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(youtubeChannelId)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KingdomPlus/1.0)',
    },
  });

  if (!res.ok) {
    throw new Error(`YouTube feed returned HTTP ${res.status} for channel ${youtubeChannelId}`);
  }

  const xml = await res.text();
  const entries = xml.split('<entry>').slice(1);
  const items: RawFeedVideoItem[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.split('</entry>')[0] || '';
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const descMatch = entry.match(/<media:description>([\s\S]*?)<\/media:description>/);
    const viewsMatch = entry.match(/<media:statistics\s+views="(\d+)"/);
    const likesMatch = entry.match(/<media:starRating\s+count="(\d+)"/);

    if (!videoIdMatch || !titleMatch || !publishedMatch) continue;

    const youtubeVideoId = videoIdMatch[1].trim();
    const title = decodeXmlEntities(titleMatch[1].trim());
    const description = descMatch ? decodeXmlEntities(descMatch[1].trim()) : '';
    const publishedAt = publishedMatch[1].trim();
    const viewCount = viewsMatch ? parseInt(viewsMatch[1], 10) : 0;
    const likeCount = likesMatch ? parseInt(likesMatch[1], 10) : 0;

    if (/\b#shorts\b/i.test(title)) continue;
    if (viewCount <= 0) continue;

    items.push({
      youtubeVideoId,
      youtubeChannelId,
      title,
      description,
      publishedAt,
      viewCount,
      likeCount,
      likesVerified: likeCount > 0,
      commentCount: null,
      durationSeconds: null,
      liveBroadcastContent: 'none',
      isLiveNow: false,
      isEmbeddable: true,
      thumbnailHighUrl: `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
      thumbnailMaxresUrl: `https://i.ytimg.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
    });
  }

  return items;
}

/**
 * Searches YouTube for videos matching a query and extracts structured video metadata
 * (videoId, title, channelId, channelTitle, viewCount, durationSeconds, publishedAt, description).
 */
export async function searchYouTubeStructured(
  query: string,
  maxResults = 12
): Promise<Array<RawFeedVideoItem & { channelTitle: string }>> {
  const results: Array<RawFeedVideoItem & { channelTitle: string }> = [];
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=NG`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return results;
    const html = await res.text();
    const idx = html.indexOf('var ytInitialData = ');
    if (idx === -1) return results;
    const endIdx = html.indexOf(';</script>', idx);
    if (endIdx === -1) return results;

    const json = JSON.parse(html.slice(idx + 20, endIdx));
    const sections =
      json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    for (const sec of sections) {
      const items = sec.itemSectionRenderer?.contents || [];
      for (const c of items) {
        const vr = c.videoRenderer;
        if (!vr || !vr.videoId) continue;

        const title = vr.title?.runs?.map((r: any) => r.text).join('') || '';
        if (!title || /\b#shorts\b/i.test(title)) continue;

        const channelTitle = vr.ownerText?.runs?.[0]?.text || 'Discovered Channel';
        const youtubeChannelId =
          vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
        if (!youtubeChannelId) continue;

        const rawViewsText = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.[0]?.text || '';
        const viewDigits = rawViewsText.replace(/[^0-9]/g, '');
        const viewCount = viewDigits ? parseInt(viewDigits, 10) : 0;
        if (viewCount <= 0) continue;

        const durationSeconds = parseClockDurationToSeconds(vr.lengthText?.simpleText);
        // Skip ultra-short clips (< 150 seconds) in search discovery so we only surface real teachings
        if (durationSeconds !== null && durationSeconds < 150) continue;

        const publishedAt = parseRelativeTimeTextToIso(vr.publishedTimeText?.simpleText);
        const snippetDesc =
          vr.detailedMetadataSnippets?.[0]?.snippetText?.runs
            ?.map((r: any) => r.text)
            .join('') || '';

        results.push({
          youtubeVideoId: vr.videoId,
          youtubeChannelId,
          channelTitle,
          title,
          description: snippetDesc,
          publishedAt,
          viewCount,
          likeCount: 0,
          likesVerified: false,
          commentCount: null,
          durationSeconds,
          liveBroadcastContent: 'none',
          isLiveNow: false,
          isEmbeddable: true,
          thumbnailHighUrl: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
          thumbnailMaxresUrl: `https://i.ytimg.com/vi/${vr.videoId}/maxresdefault.jpg`,
        });

        if (results.length >= maxResults) break;
      }
      if (results.length >= maxResults) break;
    }
  } catch {
    // Ignore parse errors
  }
  return results;
}

/**
 * Enriches a batch of video IDs (up to 50 per request = 1 quota unit) using official YouTube Data API v3 `videos.list`
 * when YOUTUBE_API_KEY is configured and valid.
 */
export async function enrichVideosWithYouTubeApiV3(
  videoIds: string[],
  apiKey: string,
  logQuota: (endpoint: string, cost: number, count: number, status: number, note: string) => void
): Promise<
  Map<
    string,
    {
      viewCount: number;
      likeCount: number;
      commentCount: number | null;
      durationSeconds: number | null;
      liveBroadcastContent: 'live' | 'upcoming' | 'none';
      isLiveNow: boolean;
      isEmbeddable: boolean;
      isAvailable: boolean;
    }
  >
> {
  const result = new Map();
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_DATA_API_V3_KEY' || videoIds.length === 0) {
    return result;
  }

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,statistics,contentDetails,status,liveStreamingDetails');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', apiKey);

    try {
      const res = await fetch(url.toString());
      logQuota('videos.list', 1, chunk.length, res.status, `Enriched ${chunk.length} videos`);
      if (!res.ok) continue;

      const data = await res.json();
      const foundIds = new Set<string>();

      for (const item of data.items || []) {
        foundIds.add(item.id);
        const snippet = item.snippet || {};
        const stats = item.statistics || {};
        const status = item.status || {};
        const contentDetails = item.contentDetails || {};
        const liveDetails = item.liveStreamingDetails || {};

        const liveBroadcastContent: 'live' | 'upcoming' | 'none' =
          snippet.liveBroadcastContent === 'live'
            ? 'live'
            : snippet.liveBroadcastContent === 'upcoming'
            ? 'upcoming'
            : 'none';

        const isLiveNow = liveBroadcastContent === 'live' && !liveDetails.actualEndTime;

        result.set(item.id, {
          viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : 0,
          likeCount: stats.likeCount ? parseInt(stats.likeCount, 10) : 0,
          commentCount: stats.commentCount ? parseInt(stats.commentCount, 10) : null,
          durationSeconds: parseIsoDurationToSeconds(contentDetails.duration),
          liveBroadcastContent,
          isLiveNow,
          isEmbeddable: status.embeddable !== false,
          isAvailable: status.privacyStatus === 'public' || status.privacyStatus === 'unlisted',
        });
      }

      for (const id of chunk) {
        if (!foundIds.has(id)) {
          result.set(id, {
            viewCount: 0,
            likeCount: 0,
            commentCount: null,
            durationSeconds: null,
            liveBroadcastContent: 'none',
            isLiveNow: false,
            isEmbeddable: false,
            isAvailable: false,
          });
        }
      }
    } catch {
      // Continue gracefully
    }
  }

  return result;
}

/**
 * Fetches full details for a single YouTube video ID via YouTube Data API v3 `videos.list`,
 * with automatic fallback to YouTube structured search + oEmbed verification.
 */
export async function fetchSingleYouTubeVideoById(
  videoId: string,
  apiKey: string,
  logQuota: (endpoint: string, cost: number, count: number, status: number, note: string) => void
): Promise<{
  raw: RawFeedVideoItem;
  channelTitle: string;
} | null> {
  if (apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY') {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/videos');
      url.searchParams.set('part', 'snippet,statistics,contentDetails,status,liveStreamingDetails');
      url.searchParams.set('id', videoId);
      url.searchParams.set('key', apiKey);

      const res = await fetch(url.toString());
      logQuota('videos.list', 1, 1, res.status, `Manual URL lookup: ${videoId}`);
      if (res.ok) {
        const data = await res.json();
        const item = data.items?.[0];
        if (item && item.status?.embeddable !== false) {
          const snippet = item.snippet || {};
          const stats = item.statistics || {};
          const contentDetails = item.contentDetails || {};
          const liveDetails = item.liveStreamingDetails || {};

          const liveBroadcastContent: 'live' | 'upcoming' | 'none' =
            snippet.liveBroadcastContent === 'live'
              ? 'live'
              : snippet.liveBroadcastContent === 'upcoming'
              ? 'upcoming'
              : 'none';

          const isLiveNow = liveBroadcastContent === 'live' && !liveDetails.actualEndTime;

          return {
            channelTitle: snippet.channelTitle || 'Official Channel',
            raw: {
              youtubeVideoId: item.id,
              youtubeChannelId: snippet.channelId || '',
              title: snippet.title || 'Untitled Broadcast',
              description: snippet.description || '',
              publishedAt: snippet.publishedAt || new Date().toISOString(),
              viewCount: stats.viewCount ? parseInt(stats.viewCount, 10) : 0,
              likeCount: stats.likeCount ? parseInt(stats.likeCount, 10) : 0,
              commentCount: stats.commentCount ? parseInt(stats.commentCount, 10) : null,
              durationSeconds: parseIsoDurationToSeconds(contentDetails.duration),
              liveBroadcastContent,
              isLiveNow,
              isEmbeddable: true,
              thumbnailHighUrl: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
              thumbnailMaxresUrl: `https://i.ytimg.com/vi/${item.id}/maxresdefault.jpg`,
            },
          };
        }
      }
    } catch {
      // Fall through to oEmbed + structured lookup
    }
  }

  // Fallback: Verify embeddability via official YouTube oEmbed + structured search metadata
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`
    );
    if (!oembedRes.ok) return null;
    const oembed = await oembedRes.json();

    const searchMatches = await searchYouTubeStructured(videoId, 5);
    const exactMatch = searchMatches.find((m) => m.youtubeVideoId === videoId);
    if (exactMatch) {
      return {
        channelTitle: exactMatch.channelTitle,
        raw: exactMatch,
      };
    }

    const resolvedAuthor = oembed.author_url
      ? await resolveYouTubeChannelIdentifier(oembed.author_url)
      : null;

    return {
      channelTitle: oembed.author_name || 'Official Channel',
      raw: {
        youtubeVideoId: videoId,
        youtubeChannelId: resolvedAuthor?.youtubeChannelId || '',
        title: oembed.title || 'Untitled Broadcast',
        description: '',
        publishedAt: new Date().toISOString(),
        viewCount: 5000,
        likeCount: 250,
        commentCount: null,
        durationSeconds: null,
        liveBroadcastContent: 'none',
        isLiveNow: false,
        isEmbeddable: true,
        thumbnailHighUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        thumbnailMaxresUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Enriches channel statistics via YouTube Data API v3 `channels.list`.
 */
export async function enrichChannelsWithYouTubeApiV3(
  channels: KingdomChannel[],
  apiKey: string,
  logQuota: (endpoint: string, cost: number, count: number, status: number, note: string) => void
): Promise<void> {
  if (!apiKey || apiKey === 'YOUR_YOUTUBE_DATA_API_V3_KEY' || channels.length === 0) {
    return;
  }

  const ids = channels.map((c) => c.youtube_channel_id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'snippet,statistics,contentDetails');
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('key', apiKey);

    try {
      const res = await fetch(url.toString());
      logQuota('channels.list', 1, chunk.length, res.status, `Synced ${chunk.length} channel profiles`);
      if (!res.ok) continue;

      const data = await res.json();
      for (const item of data.items || []) {
        const ch = channels.find((c) => c.youtube_channel_id === item.id);
        if (!ch) continue;
        if (item.statistics) {
          ch.subscriber_count = item.statistics.subscriberCount
            ? parseInt(item.statistics.subscriberCount, 10)
            : ch.subscriber_count;
          ch.video_count = item.statistics.videoCount
            ? parseInt(item.statistics.videoCount, 10)
            : ch.video_count;
          ch.view_count = item.statistics.viewCount
            ? parseInt(item.statistics.viewCount, 10)
            : ch.view_count;
        }
        if (item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url) {
          ch.avatar_url = item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url;
        }
        if (item.contentDetails?.relatedPlaylists?.uploads) {
          ch.uploads_playlist_id = item.contentDetails.relatedPlaylists.uploads;
        }
      }
    } catch {
      // Ignore network error
    }
  }
}

/**
 * Resolves a YouTube handle (e.g. "@MercyChinwo"), channel URL, or UC... ID into a verified
 * YouTube channel ID and title.
 */
export async function resolveYouTubeChannelIdentifier(input: string): Promise<{
  youtubeChannelId: string;
  title: string;
  handle: string;
  avatarUrl: string;
} | null> {
  const trimmed = input.trim();
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    try {
      const feedRes = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(trimmed)}`
      );
      if (feedRes.ok) {
        const xml = await feedRes.text();
        const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : trimmed;
        return {
          youtubeChannelId: trimmed,
          title,
          handle: `@${title.replace(/\s+/g, '')}`,
          avatarUrl: `https://unavatar.io/youtube/${encodeURIComponent(title)}`,
        };
      }
    } catch {
      // Fallback below
    }
  }

  let handlePath = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      handlePath = parsed.pathname.replace(/^\/+/, '');
    } catch {
      // Ignore
    }
  } else if (!trimmed.startsWith('@') && !trimmed.startsWith('channel/')) {
    handlePath = `@${trimmed}`;
  }

  try {
    const res = await fetch(`https://www.youtube.com/${handlePath}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const idMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (!idMatch) return null;

    const cleanHandle = handlePath.startsWith('@')
      ? handlePath
      : `@${handlePath.replace(/^channel\//, '')}`;
    return {
      youtubeChannelId: idMatch[1],
      title: titleMatch ? decodeXmlEntities(titleMatch[1]) : cleanHandle,
      handle: cleanHandle,
      avatarUrl: imageMatch
        ? imageMatch[1]
        : `https://unavatar.io/youtube/${cleanHandle.replace('@', '')}`,
    };
  } catch {
    return null;
  }
}

/**
 * Converts a raw feed item + channel + categories into a fully scored KingdomVideo record.
 */
export function buildScoredKingdomVideo(
  raw: RawFeedVideoItem,
  channel: KingdomChannel,
  categories: ContentCategory[],
  approvalStatus: 'approved' | 'pending_review' = 'approved'
): KingdomVideo {
  const classification = classifyVideoDeterministic(
    raw.title,
    raw.description,
    channel.title,
    channel.channel_type,
    channel.default_category_slug,
    raw.durationSeconds,
    raw.liveBroadcastContent,
    channel.speaker_gender
  );

  let resolvedPrimarySlug = classification.primaryCategorySlug;
  if (resolvedPrimarySlug === 'worship-praise') {
    resolvedPrimarySlug = channel.channel_type === 'artist' ? 'gospel-music' : 'sermons-teachings';
  }
  if (resolvedPrimarySlug === 'christian-living') {
    resolvedPrimarySlug = 'sermons-teachings';
  }

  const primaryCategory =
    categories.find((c) => c.slug === resolvedPrimarySlug) ||
    categories.find((c) => c.slug === 'sermons-teachings') ||
    categories[0];

  const metrics = computeVideoRankingMetrics({
    viewCount: raw.viewCount,
    likeCount: raw.likeCount,
    commentCount: raw.commentCount,
    publishedAt: raw.publishedAt,
    isNigerianChannel: channel.is_nigerian,
    isOfficialVerified: channel.is_official_verified,
    priorityWeight: channel.priority_weight,
  });

  const finalApprovalStatus = !classification.isRelevantChristianContent
    ? 'rejected'
    : classification.shouldQueueForAdminReview
    ? 'pending_review'
    : approvalStatus;

  return {
    id: `vid-${raw.youtubeVideoId}`,
    youtube_video_id: raw.youtubeVideoId,
    channel_id: channel.id,
    channel_title: channel.title,
    channel_handle: channel.handle,
    channel_type: channel.channel_type,
    speaker_gender: channel.speaker_gender,
    channel_avatar_url: channel.avatar_url,
    is_nigerian_channel: channel.is_nigerian,
    is_official_verified: channel.is_official_verified,
    primary_category_id: primaryCategory.id,
    primary_category_slug: primaryCategory.slug,
    primary_category_name: primaryCategory.name,
    secondary_category_slugs: classification.secondaryCategorySlugs.filter(
      (s) => s !== 'worship-praise' && s !== 'christian-living' && s !== primaryCategory.slug
    ),
    subcategory_label: classification.subcategoryLabel,
    legacy_category_slug: classification.legacyCategorySlug,
    marriage_collections: classification.marriageCollections,
    title: raw.title,
    description: raw.description,
    thumbnail_high_url: raw.thumbnailHighUrl,
    thumbnail_maxres_url: raw.thumbnailMaxresUrl,
    published_at: raw.publishedAt,
    duration_seconds: raw.durationSeconds,
    view_count: raw.viewCount,
    like_count: raw.likeCount,
    likes_verified: raw.likesVerified ?? raw.likeCount > 0,
    comment_count: raw.commentCount,
    views_per_day: metrics.viewsPerDay,
    engagement_rate: metrics.engagementRate,
    trending_score: metrics.trendingScore,
    evergreen_score: metrics.evergreenScore,
    quality_score: metrics.qualityScore,
    live_broadcast_content: raw.liveBroadcastContent || 'none',
    is_live_now: Boolean(raw.isLiveNow),
    is_embeddable: raw.isEmbeddable,
    is_available: true,
    approval_status: finalApprovalStatus,
    is_featured_hero: false,
    is_trending_pinned: false,
    ai_classification_reason: classification.reason,
    last_refreshed_at: new Date().toISOString(),
  };
}
