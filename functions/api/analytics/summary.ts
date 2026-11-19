import {
  buildTrafficSummary,
  fetchVisitsFromSupabase,
  resolveSupabaseCredentials,
} from './helpers.ts';

// Cloudflare Pages Edge Function: GET /api/analytics/summary?range=24h|7d|30d|all
// Returns aggregated real human visitor traffic by country from Supabase.
export const onRequestGet = async (context: {
  request: Request;
  env?: Record<string, string>;
}): Promise<Response> => {
  const { request, env = {} } = context;
  const reqUrl = new URL(request.url);
  const rawRange = (reqUrl.searchParams.get('range') || '7d').toLowerCase();
  const range: '24h' | '7d' | '30d' | 'all' =
    rawRange === '24h' || rawRange === '7d' || rawRange === '30d' || rawRange === 'all'
      ? rawRange
      : '7d';
  const excludeVisitorId = (reqUrl.searchParams.get('excludeVisitorId') || '').trim() || undefined;

  const { url, key } = resolveSupabaseCredentials(env);
  if (!url || !key) {
    return new Response(
      JSON.stringify(buildTrafficSummary([], range, 'unconfigured')),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const fetched = await fetchVisitsFromSupabase(url, key, range);
  if (!fetched.ok) {
    return new Response(
      JSON.stringify({
        ...buildTrafficSummary([], range, 'supabase'),
        ok: false,
        tableMissing: Boolean(fetched.tableMissing),
        error: fetched.error || 'Could not query visitor analytics.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const summary = buildTrafficSummary(fetched.rows, range, 'supabase', excludeVisitorId);
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
