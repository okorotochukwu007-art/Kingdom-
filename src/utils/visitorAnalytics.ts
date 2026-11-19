const VISITOR_ID_KEY = 'kingdom_plus_anon_vid_v1';
const SESSION_ID_KEY = 'kingdom_plus_anon_sid_v1';
const SESSION_TS_KEY = 'kingdom_plus_anon_sts_v1';
const EXCLUDE_SELF_KEY = 'kingdom_plus_exclude_self_analytics_v1';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute rolling session

let lastTrackedKey = '';
let lastTrackedAt = 0;

function randomId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    }
  } catch {
    // Fallback below
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getAnonymousVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      vid = randomId('v');
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    return vid;
  } catch {
    return randomId('v');
  }
}

function getAnonymousSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const now = Date.now();
    const existingSid = sessionStorage.getItem(SESSION_ID_KEY);
    const lastTs = Number(sessionStorage.getItem(SESSION_TS_KEY) || '0');
    if (existingSid && now - lastTs < SESSION_TIMEOUT_MS) {
      sessionStorage.setItem(SESSION_TS_KEY, String(now));
      return existingSid;
    }
    const nextSid = randomId('s');
    sessionStorage.setItem(SESSION_ID_KEY, nextSid);
    sessionStorage.setItem(SESSION_TS_KEY, String(now));
    return nextSid;
  } catch {
    return randomId('s');
  }
}

export function isSelfAnalyticsExcluded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(EXCLUDE_SELF_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSelfAnalyticsExcluded(excluded: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (excluded) {
      localStorage.setItem(EXCLUDE_SELF_KEY, '1');
    } else {
      localStorage.removeItem(EXCLUDE_SELF_KEY);
    }
  } catch {
    // Ignore storage error
  }
}

/**
 * Records a genuine human browser visit via POST /api/analytics/visit.
 * Cloudflare Edge automatically attaches the visitor's verified CF-IPCountry header.
 * Never blocks UI rendering and silently skips bots, admin views, or excluded owner browsers.
 */
export function trackHumanPageVisit(pageView: string, customPath?: string): void {
  if (typeof window === 'undefined') return;
  if (pageView === 'admin') return;
  if (isSelfAnalyticsExcluded()) return;

  // Skip headless automation / webdriver browsers
  const nav = window.navigator as Navigator & { webdriver?: boolean };
  if (nav?.webdriver) return;

  const pagePath = (customPath || window.location.pathname || '/').slice(0, 200);
  const dedupeKey = `${pageView}|${pagePath}`;
  const now = Date.now();
  if (dedupeKey === lastTrackedKey && now - lastTrackedAt < 5000) {
    return;
  }
  lastTrackedKey = dedupeKey;
  lastTrackedAt = now;

  const visitorId = getAnonymousVisitorId();
  const sessionId = getAnonymousSessionId();
  if (!visitorId || !sessionId) return;

  const payload = JSON.stringify({
    visitorId,
    sessionId,
    pagePath,
    pageView,
    referrer: document.referrer || '',
    isWebdriver: Boolean(nav?.webdriver),
  });

  try {
    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never interrupt app UX on analytics error
  }
}
