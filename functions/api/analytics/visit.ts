import {
  detectDeviceType,
  insertVisitIntoSupabase,
  isLikelyBotUserAgent,
  normalizeCountryCode,
  resolveCountryName,
  resolveSupabaseCredentials,
  sanitizeReferrerHost,
} from './helpers.ts';

interface CloudflareRequest extends Request {
  cf?: {
    country?: string;
    city?: string;
    region?: string;
  };
}

// Cloudflare Pages Edge Function: POST /api/analytics/visit
// Reads Cloudflare's verified CF-IPCountry header and logs real human browser visits to Supabase.
export const onRequestPost = async (context: {
  request: CloudflareRequest;
  env?: Record<string, string>;
}): Promise<Response> => {
  const { request, env = {} } = context;

  try {
    const ua = request.headers.get('user-agent') || '';
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // Filter out bots, crawlers, and headless webdriver probes
    if (isLikelyBotUserAgent(ua) || body.isWebdriver === true) {
      return new Response(
        JSON.stringify({ ok: true, recorded: false, reason: 'bot_filtered' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const visitorId = String(body.visitorId || '').trim().slice(0, 80);
    const sessionId = String(body.sessionId || '').trim().slice(0, 80);
    if (!visitorId || !sessionId) {
      return new Response(
        JSON.stringify({ ok: false, recorded: false, reason: 'missing_ids' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Read real geolocation from Cloudflare Edge (CF-IPCountry + request.cf)
    const rawCountry =
      request.headers.get('cf-ipcountry') || request.cf?.country || 'XX';
    const countryCode = normalizeCountryCode(rawCountry);
    const countryName = resolveCountryName(countryCode);
    const city = String(request.cf?.city || '').trim().slice(0, 80);
    const region = String(request.cf?.region || '').trim().slice(0, 80);

    const pagePath = String(body.pagePath || '/').trim().slice(0, 200) || '/';
    const pageView = String(body.pageView || 'streaming').trim().slice(0, 60) || 'streaming';
    const ownHost = new URL(request.url).hostname;
    const referrerHost = sanitizeReferrerHost(String(body.referrer || ''), ownHost);
    const deviceType = detectDeviceType(ua);

    const { url, key } = resolveSupabaseCredentials(env);
    if (!url || !key) {
      return new Response(
        JSON.stringify({
          ok: true,
          recorded: false,
          storage: 'unconfigured',
          countryCode,
          countryName,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const insertResult = await insertVisitIntoSupabase(url, key, {
      visitor_id: visitorId,
      session_id: sessionId,
      country_code: countryCode,
      country_name: countryName,
      city,
      region,
      page_path: pagePath,
      page_view: pageView,
      referrer_host: referrerHost,
      device_type: deviceType,
    });

    return new Response(
      JSON.stringify({
        ok: insertResult.ok,
        recorded: insertResult.ok,
        storage: 'supabase',
        tableMissing: insertResult.tableMissing || false,
        countryCode,
        countryName,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, recorded: false, error: (err as Error).message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
