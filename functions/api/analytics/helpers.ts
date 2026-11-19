export interface VisitorPageviewRow {
  id?: string;
  visitor_id: string;
  session_id: string;
  country_code: string;
  country_name: string;
  city: string;
  region: string;
  page_path: string;
  page_view: string;
  referrer_host: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
  created_at: string;
}

export interface CountryTrafficStat {
  countryCode: string;
  countryName: string;
  flag: string;
  uniqueVisitors: number;
  pageviews: number;
  sharePercent: number;
  topCity: string;
  lastSeenAt: string;
}

export interface DailyTrafficPoint {
  date: string;
  uniqueVisitors: number;
  pageviews: number;
}

export interface TrafficSummaryResponse {
  ok: boolean;
  range: '24h' | '7d' | '30d' | 'all';
  storage: 'supabase' | 'local' | 'unconfigured';
  tableMissing?: boolean;
  error?: string;
  generatedAt: string;
  totals: {
    uniqueVisitors: number;
    uniqueSessions: number;
    totalPageviews: number;
    countriesCount: number;
    activeLast24hVisitors: number;
  };
  countries: CountryTrafficStat[];
  dailyTrend: DailyTrafficPoint[];
  topViews: Array<{ view: string; label: string; pageviews: number; uniqueVisitors: number }>;
  devices: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  topReferrers: Array<{ host: string; visits: number }>;
  recentVisits: Array<{
    countryCode: string;
    countryName: string;
    flag: string;
    city: string;
    pageView: string;
    pagePath: string;
    deviceType: string;
    referrerHost: string;
    createdAt: string;
  }>;
}

const BOT_USER_AGENT_PATTERNS = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'mediapartners',
  'adsbot',
  'googlebot',
  'bingbot',
  'yandex',
  'baiduspider',
  'duckduckbot',
  'facebookexternalhit',
  'twitterbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'linkedinbot',
  'pinterest',
  'ahrefs',
  'semrush',
  'mj12bot',
  'dotbot',
  'petalbot',
  'bytespider',
  'gptbot',
  'chatgpt-user',
  'claudebot',
  'anthropic-ai',
  'applebot',
  'headlesschrome',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'webdriver',
  'lighthouse',
  'pagespeed',
  'gtmetrix',
  'pingdom',
  'uptimerobot',
  'statuscake',
  'curl/',
  'wget/',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'axios/',
  'node-fetch',
  'undici',
  'postmanruntime',
  'insomnia',
  'scrapy',
  'httpclient',
  'java/',
  'libwww-perl',
];

const COUNTRY_NAME_FALLBACKS: Record<string, string> = {
  NG: 'Nigeria',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  GH: 'Ghana',
  ZA: 'South Africa',
  KE: 'Kenya',
  BR: 'Brazil',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  AU: 'Australia',
  IE: 'Ireland',
  AE: 'United Arab Emirates',
  IN: 'India',
  CM: 'Cameroon',
  UG: 'Uganda',
  TZ: 'Tanzania',
  ZW: 'Zimbabwe',
  ZM: 'Zambia',
  LR: 'Liberia',
  SL: 'Sierra Leone',
  BJ: 'Benin',
  TG: 'Togo',
  CI: "Côte d'Ivoire",
  RW: 'Rwanda',
  ET: 'Ethiopia',
  EG: 'Egypt',
  PH: 'Philippines',
  SG: 'Singapore',
  MY: 'Malaysia',
  IT: 'Italy',
  ES: 'Spain',
  PT: 'Portugal',
  CH: 'Switzerland',
  BE: 'Belgium',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  AT: 'Austria',
  PL: 'Poland',
  NZ: 'New Zealand',
  JM: 'Jamaica',
  TT: 'Trinidad and Tobago',
  MX: 'Mexico',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  SA: 'Saudi Arabia',
  QA: 'Qatar',
  IL: 'Israel',
  TR: 'Turkey',
};

const VIEW_LABELS: Record<string, string> = {
  streaming: 'Homepage & Live Stream',
  movies: 'Christian Movies & Cartoons',
  categories: 'Categories Library',
  ministers: 'Ministers Directory',
  channel: 'Ministry Channel Page',
  community: 'Community & Fellowship',
  watchlist: 'Saved Watchlist',
  profile: 'Member Profile',
};

export function isLikelyBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 10) return true;
  const lower = ua.toLowerCase();
  if (BOT_USER_AGENT_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return true;
  }
  // Real human browsers almost always include Mozilla/ or Safari/ or Chrome/ or Firefox/ or Edg/
  if (
    !lower.includes('mozilla/') &&
    !lower.includes('safari/') &&
    !lower.includes('chrome/') &&
    !lower.includes('firefox/') &&
    !lower.includes('opera/')
  ) {
    return true;
  }
  return false;
}

export function detectDeviceType(ua: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  const lower = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(lower)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/i.test(lower)) {
    return 'mobile';
  }
  return 'desktop';
}

export function normalizeCountryCode(raw: string | null | undefined): string {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') {
    return 'XX';
  }
  return code;
}

export function resolveCountryName(code: string): string {
  const normalized = normalizeCountryCode(code);
  if (normalized === 'XX') return 'Unknown / Local';
  if (COUNTRY_NAME_FALLBACKS[normalized]) {
    return COUNTRY_NAME_FALLBACKS[normalized];
  }
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      const display = new Intl.DisplayNames(['en'], { type: 'region' });
      const resolved = display.of(normalized);
      if (resolved && resolved !== normalized) return resolved;
    }
  } catch {
    // Fallback below
  }
  return normalized;
}

export function countryCodeToFlag(code: string): string {
  const normalized = normalizeCountryCode(code);
  if (normalized === 'XX') return '🌍';
  const points = normalized
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...points);
}

export function sanitizeReferrerHost(rawReferrer: string | null | undefined, ownHost?: string): string {
  const trimmed = String(rawReferrer || '').trim();
  if (!trimmed) return 'Direct';
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const cleanOwn = (ownHost || '').replace(/^www\./i, '').toLowerCase();
    if (!host || (cleanOwn && host === cleanOwn) || host === 'kingdomflix.name.ng') {
      return 'Direct';
    }
    return host.slice(0, 80);
  } catch {
    return 'Direct';
  }
}

export function resolveSupabaseCredentials(env: Record<string, string | undefined>): {
  url: string | null;
  key: string | null;
} {
  const rawUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const rawKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    '';

  const validUrl =
    rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('your-project-id')
      ? rawUrl.replace(/\/+$/, '')
      : null;
  const validKey =
    rawKey && rawKey !== 'your-supabase-anon-public-key' && rawKey.length > 15
      ? rawKey
      : null;

  return { url: validUrl, key: validKey };
}

export function getRangeStartIso(range: '24h' | '7d' | '30d' | 'all'): string | null {
  const now = Date.now();
  if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export async function insertVisitIntoSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  row: Omit<VisitorPageviewRow, 'id' | 'created_at'>
): Promise<{ ok: boolean; tableMissing?: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/visitor_pageviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) return { ok: true };
    const errText = await res.text().catch(() => '');
    const tableMissing =
      res.status === 404 ||
      errText.includes('PGRST205') ||
      errText.toLowerCase().includes('visitor_pageviews') && errText.toLowerCase().includes('does not exist');
    return { ok: false, tableMissing, error: errText || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function fetchVisitsFromSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  range: '24h' | '7d' | '30d' | 'all'
): Promise<{
  ok: boolean;
  rows: VisitorPageviewRow[];
  tableMissing?: boolean;
  error?: string;
}> {
  try {
    const sinceIso = getRangeStartIso(range);
    const params = new URLSearchParams({
      select:
        'visitor_id,session_id,country_code,country_name,city,region,page_path,page_view,referrer_host,device_type,created_at',
      order: 'created_at.desc',
      limit: '5000',
    });
    if (sinceIso) {
      params.set('created_at', `gte.${sinceIso}`);
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/visitor_pageviews?${params.toString()}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const tableMissing =
        res.status === 404 ||
        errText.includes('PGRST205') ||
        (errText.toLowerCase().includes('visitor_pageviews') &&
          (errText.toLowerCase().includes('does not exist') ||
            errText.toLowerCase().includes('could not find the table')));
      return {
        ok: false,
        rows: [],
        tableMissing,
        error: errText || `HTTP ${res.status}`,
      };
    }

    const rows = (await res.json()) as VisitorPageviewRow[];
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch (err) {
    return { ok: false, rows: [], error: (err as Error).message };
  }
}

export function buildTrafficSummary(
  rows: VisitorPageviewRow[],
  range: '24h' | '7d' | '30d' | 'all',
  storage: 'supabase' | 'local' | 'unconfigured',
  excludeVisitorId?: string
): TrafficSummaryResponse {
  const filteredRows = excludeVisitorId
    ? rows.filter((r) => r.visitor_id !== excludeVisitorId)
    : rows;

  const uniqueVisitorSet = new Set<string>();
  const uniqueSessionSet = new Set<string>();
  const active24hSet = new Set<string>();
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;

  const countryMap = new Map<
    string,
    {
      countryCode: string;
      countryName: string;
      visitors: Set<string>;
      pageviews: number;
      cityCounts: Map<string, number>;
      lastSeenAt: string;
    }
  >();

  const dailyMap = new Map<string, { visitors: Set<string>; pageviews: number }>();
  const viewMap = new Map<string, { visitors: Set<string>; pageviews: number }>();
  const referrerMap = new Map<string, Set<string>>();
  const deviceVisitors = {
    mobile: new Set<string>(),
    desktop: new Set<string>(),
    tablet: new Set<string>(),
  };

  for (const row of filteredRows) {
    const vid = row.visitor_id || 'anon';
    const sid = row.session_id || vid;
    const code = normalizeCountryCode(row.country_code);
    const name =
      row.country_name && row.country_name !== 'Unknown'
        ? row.country_name
        : resolveCountryName(code);
    const createdAt = row.created_at || new Date().toISOString();
    const ts = Date.parse(createdAt);

    uniqueVisitorSet.add(vid);
    uniqueSessionSet.add(sid);
    if (Number.isFinite(ts) && ts >= cutoff24h) {
      active24hSet.add(vid);
    }

    // Country stats
    let cEntry = countryMap.get(code);
    if (!cEntry) {
      cEntry = {
        countryCode: code,
        countryName: name,
        visitors: new Set<string>(),
        pageviews: 0,
        cityCounts: new Map<string, number>(),
        lastSeenAt: createdAt,
      };
      countryMap.set(code, cEntry);
    }
    cEntry.visitors.add(vid);
    cEntry.pageviews += 1;
    if (createdAt > cEntry.lastSeenAt) {
      cEntry.lastSeenAt = createdAt;
    }
    const cleanCity = (row.city || '').trim();
    if (cleanCity) {
      cEntry.cityCounts.set(cleanCity, (cEntry.cityCounts.get(cleanCity) || 0) + 1);
    }

    // Daily trend
    const dayKey = createdAt.slice(0, 10);
    let dEntry = dailyMap.get(dayKey);
    if (!dEntry) {
      dEntry = { visitors: new Set<string>(), pageviews: 0 };
      dailyMap.set(dayKey, dEntry);
    }
    dEntry.visitors.add(vid);
    dEntry.pageviews += 1;

    // App section / page_view breakdown
    const viewKey = (row.page_view || 'streaming').trim() || 'streaming';
    let vEntry = viewMap.get(viewKey);
    if (!vEntry) {
      vEntry = { visitors: new Set<string>(), pageviews: 0 };
      viewMap.set(viewKey, vEntry);
    }
    vEntry.visitors.add(vid);
    vEntry.pageviews += 1;

    // Devices
    if (row.device_type === 'mobile') deviceVisitors.mobile.add(vid);
    else if (row.device_type === 'tablet') deviceVisitors.tablet.add(vid);
    else deviceVisitors.desktop.add(vid);

    // Referrer by session
    const refHost = (row.referrer_host || 'Direct').trim() || 'Direct';
    let refSet = referrerMap.get(refHost);
    if (!refSet) {
      refSet = new Set<string>();
      referrerMap.set(refHost, refSet);
    }
    refSet.add(sid);
  }

  const totalUniqueVisitors = uniqueVisitorSet.size;
  const countries: CountryTrafficStat[] = Array.from(countryMap.values())
    .map((entry) => {
      let topCity = '';
      let topCityCount = 0;
      for (const [city, cnt] of entry.cityCounts.entries()) {
        if (cnt > topCityCount) {
          topCityCount = cnt;
          topCity = city;
        }
      }
      return {
        countryCode: entry.countryCode,
        countryName: entry.countryName,
        flag: countryCodeToFlag(entry.countryCode),
        uniqueVisitors: entry.visitors.size,
        pageviews: entry.pageviews,
        sharePercent:
          totalUniqueVisitors > 0
            ? Math.round((entry.visitors.size / totalUniqueVisitors) * 1000) / 10
            : 0,
        topCity,
        lastSeenAt: entry.lastSeenAt,
      };
    })
    .sort((a, b) => {
      if (b.uniqueVisitors !== a.uniqueVisitors) return b.uniqueVisitors - a.uniqueVisitors;
      return b.pageviews - a.pageviews;
    });

  const dailyTrend: DailyTrafficPoint[] = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      uniqueVisitors: stats.visitors.size,
      pageviews: stats.pageviews,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const topViews = Array.from(viewMap.entries())
    .map(([view, stats]) => ({
      view,
      label: VIEW_LABELS[view] || view,
      pageviews: stats.pageviews,
      uniqueVisitors: stats.visitors.size,
    }))
    .sort((a, b) => b.pageviews - a.pageviews);

  const topReferrers = Array.from(referrerMap.entries())
    .map(([host, sessions]) => ({ host, visits: sessions.size }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8);

  const recentVisits = filteredRows.slice(0, 15).map((row) => {
    const code = normalizeCountryCode(row.country_code);
    return {
      countryCode: code,
      countryName:
        row.country_name && row.country_name !== 'Unknown'
          ? row.country_name
          : resolveCountryName(code),
      flag: countryCodeToFlag(code),
      city: row.city || '',
      pageView: VIEW_LABELS[row.page_view] || row.page_view || 'Homepage',
      pagePath: row.page_path || '/',
      deviceType: row.device_type || 'desktop',
      referrerHost: row.referrer_host || 'Direct',
      createdAt: row.created_at,
    };
  });

  const realCountryCount = countries.filter((c) => c.countryCode !== 'XX').length;

  return {
    ok: true,
    range,
    storage,
    generatedAt: new Date().toISOString(),
    totals: {
      uniqueVisitors: totalUniqueVisitors,
      uniqueSessions: uniqueSessionSet.size,
      totalPageviews: filteredRows.length,
      countriesCount: realCountryCount > 0 ? realCountryCount : countries.length,
      activeLast24hVisitors: active24hSet.size,
    },
    countries,
    dailyTrend,
    topViews,
    devices: {
      mobile: deviceVisitors.mobile.size,
      desktop: deviceVisitors.desktop.size,
      tablet: deviceVisitors.tablet.size,
    },
    topReferrers,
    recentVisits,
  };
}
