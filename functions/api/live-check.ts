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
  'nigerian church live service OR nsppd live OR dunamis live OR rccg live OR mfm live',
  'apostle joshua selman live OR nathaniel bassey live OR bishop oyedepo live OR african christian prayer live',
  'gospel worship live stream OR 24/7 prayer room live',
];

function parseWatchingCount(text: string): number {
  const numStr = text.replace(/[^0-9]/g, '');
  return Number(numStr) || 25;
}

export async function discoverRealTimeActiveYouTubeLives(): Promise<RealTimeLiveStreamItem[]> {
  const seen = new Set<string>();
  const rawCandidates: RealTimeLiveStreamItem[] = [];

  await Promise.all(
    LIVE_SEARCH_QUERIES.map(async (q) => {
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

            // STRICT CHECK: Must have YouTube's official real-time BADGE_STYLE_TYPE_LIVE_NOW badge
            const isLiveNowBadge = (vr.badges || []).some(
              (b: any) => b?.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_LIVE_NOW'
            );
            if (!isLiveNowBadge) continue;

            const title = vr.title?.runs?.map((r: any) => r.text).join('') || '';
            const channelTitle = vr.ownerText?.runs?.[0]?.text || 'Christian Live Broadcast';
            const youtubeChannelId =
              vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
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

  // Sort so known Nigerian ministries & highest concurrent live viewers appear first
  rawCandidates.sort((a, b) => {
    if (Boolean(a.matchedKingdomChannelId) !== Boolean(b.matchedKingdomChannelId)) {
      return a.matchedKingdomChannelId ? -1 : 1;
    }
    return b.watchingCount - a.watchingCount;
  });

  // Verify top 16 via YouTube oEmbed so non-embeddable streams are filtered out
  const topCandidates = rawCandidates.slice(0, 16);
  const verified = await Promise.all(
    topCandidates.map(async (item) => {
      try {
        const oembed = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.videoId}&format=json`
        );
        return oembed.ok ? item : null;
      } catch {
        return item;
      }
    })
  );

  return verified.filter((v): v is RealTimeLiveStreamItem => v !== null);
}

export async function onRequestGet(): Promise<Response> {
  const liveStreams = await discoverRealTimeActiveYouTubeLives();

  return new Response(
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      liveStreams,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=45, s-maxage=45',
      },
    }
  );
}
