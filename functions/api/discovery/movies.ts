// Cloudflare Pages Edge Function for GET /api/discovery/movies
// Enables genre filtering and beyond-library Christian movie search on Cloudflare Pages.

import type { KingdomVideo } from '../../../src/types/kingdom.ts';
import {
  isLikelyChristianMovieOrCartoon,
  searchGlobalChristianVideos,
} from '../christian-search.ts';

const GENRE_QUERIES: Record<string, { query: string; scope: string }> = {
  all: { query: 'Christian full movie faith drama', scope: 'movies' },
  nigerian: { query: 'Nigerian Christian full movie Mount Zion Bamiloye', scope: 'movies-nigerian' },
  african: { query: 'African Christian full movie gospel drama', scope: 'movies-nigerian' },
  international: { query: 'International Christian full movie English faith film', scope: 'movies-international' },
  cartoon: { query: 'Christian Bible story cartoon animated full movie', scope: 'movies-cartoon' },
  animations: { query: 'Christian Bible story cartoon animated full movie', scope: 'movies-cartoon' },
  biblical: { query: 'Biblical epic movie Bible story full film', scope: 'movies' },
  'spiritual-warfare': { query: 'Christian spiritual warfare deliverance full movie', scope: 'movies' },
  'family-dramas': { query: 'Christian family drama full movie marriage faith', scope: 'movies' },
  romance: { query: 'Christian romance love story full movie', scope: 'movies' },
  redemption: { query: 'Christian redemption salvation testimony full movie', scope: 'movies' },
  'faith-miracles': { query: 'Christian faith miracle inspirational full movie', scope: 'movies' },
  'comedy-action': { query: 'Christian comedy clean gospel drama movie', scope: 'movies' },
};

export const onRequestGet = async (context?: { request?: Request }): Promise<Response> => {
  const url = context?.request ? new URL(context.request.url) : null;
  const genre = (url?.searchParams.get('genre') || 'all').trim().toLowerCase();
  const rawQuery = (url?.searchParams.get('query') || url?.searchParams.get('q') || '').trim();

  const genreConfig = GENRE_QUERIES[genre] || GENRE_QUERIES.all;
  const searchTerm = rawQuery ? rawQuery : genreConfig.query;

  const result = await searchGlobalChristianVideos(searchTerm, genreConfig.scope);
  const filtered: KingdomVideo[] = (result.results || []).filter((v) =>
    isLikelyChristianMovieOrCartoon(
      v.title || '',
      v.channel_title || '',
      v.description || '',
      v.duration_seconds ?? null,
      genreConfig.scope
    )
  );

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
