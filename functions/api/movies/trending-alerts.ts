// Cloudflare Pages Edge Function for GET /api/movies/trending-alerts
// Powers the Movie Page Hero Banner auto-updates on Cloudflare Pages static deployments.

import type { KingdomVideo } from '../../../src/types/kingdom.ts';
import { searchGlobalChristianVideos } from '../christian-search.ts';

interface MovieTrendingAlert {
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

const NON_MOVIE_REGEX =
  /\b(#shorts|trailer only|official trailer|teaser|reaction video|movie review|explained|ending explained|recap|soundtrack only|lyrics video|vlog|podcast|interview|behind the scenes|prank|sunday service|midweek service)\b/i;

const CHRISTIAN_CINEMA_REGEX =
  /\b(christian|gospel|faith|biblical|mount zion|bamiloye|jaymikee|the winlos|winlos|evom|flaming sword|god'?s not dead|war room|the chosen|angel studios|vision video|superbook|jesus|christ|holy spirit|salvation|redemption|deliverance|prayer)\b/i;

function buildMovieSearchKeyword(title: string): string {
  const cleaned = title
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

  const words = (cleaned || title).split(' ').filter(Boolean).slice(0, 5);
  return words.join(' ') || title.slice(0, 36).trim();
}

function isVerifiedFeatureMovie(v: KingdomVideo): boolean {
  const title = (v.title || '').trim();
  const hay = `${title} ${v.description || ''} ${v.channel_title || ''}`;
  if (!title || NON_MOVIE_REGEX.test(title)) return false;
  if (typeof v.duration_seconds === 'number' && v.duration_seconds > 0 && v.duration_seconds < 300) {
    return false;
  }
  return CHRISTIAN_CINEMA_REGEX.test(hay);
}

export const onRequestGet = async (): Promise<Response> => {
  const queries = [
    'latest Nigerian Christian full movie Mount Zion 2025 2026',
    'trending Christian full movie faith drama 2025 2026',
  ];

  const batches = await Promise.all(
    queries.map((q) => searchGlobalChristianVideos(q, 'movies').catch(() => null))
  );

  const seen = new Set<string>();
  const verified: KingdomVideo[] = [];

  for (const batch of batches) {
    if (!batch?.results) continue;
    for (const v of batch.results) {
      if (!v?.youtube_video_id || seen.has(v.youtube_video_id)) continue;
      if (!isVerifiedFeatureMovie(v)) continue;
      seen.add(v.youtube_video_id);
      verified.push(v);
    }
  }

  verified.sort((a, b) => b.view_count + b.views_per_day * 10 - (a.view_count + a.views_per_day * 10));

  const alerts: MovieTrendingAlert[] = verified.slice(0, 8).map((video, idx) => {
    const keyword = buildMovieSearchKeyword(video.title);
    const badge: MovieTrendingAlert['badge'] =
      idx % 2 === 0 ? 'Trending Christian Movie' : 'New Release';
    return {
      id: `edge-alert-${video.youtube_video_id}`,
      badge,
      caption: `Now Trending on KINGDOM+: "${keyword}" (${video.channel_title}) — Tap Watch Now to stream in-app!`,
      searchKeyword: keyword,
      studioName: video.channel_title,
      publishedAt: video.published_at,
      viewCount: video.view_count,
      viewsPerDay: video.views_per_day,
      source: 'youtube_trending_search',
      video,
    };
  });

  return new Response(
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      alerts,
      newlyIndexedCount: alerts.length,
      totalMoviesIndexed: alerts.length,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  );
};
