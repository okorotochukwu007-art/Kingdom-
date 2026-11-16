// Cloudflare Pages Edge Function for GET /api/discovery/movies
// Enables genre filtering and beyond-library Christian movie search on Cloudflare Pages.

import type { KingdomVideo } from '../../../src/types/kingdom.ts';
import { searchGlobalChristianVideos } from '../christian-search.ts';

const GENRE_QUERIES: Record<string, string> = {
  all: 'Christian full movie faith drama',
  nigerian: 'Nigerian Christian full movie Mount Zion Bamiloye',
  african: 'African Christian full movie gospel drama',
  international: 'International Christian full movie English faith film',
  biblical: 'Biblical epic movie Bible story full film',
  'spiritual-warfare': 'Christian spiritual warfare deliverance full movie',
  'family-dramas': 'Christian family drama full movie marriage faith',
  romance: 'Christian romance love story full movie',
  redemption: 'Christian redemption salvation testimony full movie',
  'faith-miracles': 'Christian faith miracle inspirational full movie',
  'comedy-action': 'Christian comedy clean gospel drama movie',
};

const NON_MOVIE_REGEX =
  /\b(#shorts|trailer only|official trailer|teaser|reaction video|movie review|explained|recap)\b/i;

export const onRequestGet = async (context?: { request?: Request }): Promise<Response> => {
  const url = context?.request ? new URL(context.request.url) : null;
  const genre = (url?.searchParams.get('genre') || 'all').trim().toLowerCase();
  const rawQuery = (url?.searchParams.get('query') || '').trim();

  const genreHint = GENRE_QUERIES[genre] || GENRE_QUERIES.all;
  const searchTerm = rawQuery ? `${rawQuery} ${genre !== 'all' ? genreHint : 'Christian full movie'}` : genreHint;

  const result = await searchGlobalChristianVideos(searchTerm, 'movies');
  const filtered: KingdomVideo[] = (result.results || []).filter((v) => {
    if (!v?.title || NON_MOVIE_REGEX.test(v.title)) return false;
    if (typeof v.duration_seconds === 'number' && v.duration_seconds > 0 && v.duration_seconds < 300) {
      return false;
    }
    return true;
  });

  return new Response(
    JSON.stringify({
      genre,
      query: rawQuery,
      blocked: result.blocked,
      blockedReason: result.blockedReason,
      movies: filtered,
      curatedMovies: [],
      discoveredMovies: filtered,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=180, s-maxage=180',
      },
    }
  );
};
