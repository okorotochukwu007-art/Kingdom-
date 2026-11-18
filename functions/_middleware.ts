interface RouteSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
}

const ROUTE_SEO_MAP: Record<string, RouteSeoMeta> = {
  '/': {
    title: 'KingdomFlix (KINGDOM+) — Free Christian Movies & Gospel Songs',
    description:
      'Watch free Nigerian & global Christian movies, stream gospel songs, worship, live prayer broadcasts, and join fellowship on KingdomFlix (KINGDOM+).',
    canonicalPath: '/',
  },
  '/movies': {
    title: 'Free Christian Movies & Faith Cinema — KingdomFlix',
    description:
      'Stream full-length Nigerian & global Christian movies, Mount Zion faith dramas, deliverance films, and Bible stories free on KingdomFlix.',
    canonicalPath: '/movies',
  },
  '/categories': {
    title: 'Christian Categories, Gospel Music & Sermons — KingdomFlix',
    description:
      'Browse Christian movies, Nigerian gospel songs, worship & praise, sermons, marriage teachings, and live prayer broadcasts on KingdomFlix.',
    canonicalPath: '/categories',
  },
  '/categories/gospel-music': {
    title: 'Stream Nigerian & Global Gospel Songs Free — KingdomFlix',
    description:
      'Listen to inspiring Nigerian & global gospel music, praise hits, gospel choirs, and spirit-filled worship songs free on KingdomFlix.',
    canonicalPath: '/categories/gospel-music',
  },
  '/categories/worship-praise': {
    title: 'Christian Worship & Praise Music Sessions — KingdomFlix',
    description:
      'Enter deep worship with Nathaniel Bassey, Dunsin Oyekan, Mercy Chinwo, Moses Bliss, and global Christian praise sessions on KingdomFlix.',
    canonicalPath: '/categories/worship-praise',
  },
  '/categories/sermons-teachings': {
    title: 'Christian Sermons & Bible Teachings — KingdomFlix',
    description:
      'Watch life-transforming sermons and Bible teachings from Apostle Joshua Selman, Pastor Jerry Eze, Bishop David Oyedepo & more on KingdomFlix.',
    canonicalPath: '/categories/sermons-teachings',
  },
  '/categories/live-special-broadcasts': {
    title: 'Live Prayer Altars & Church Broadcasts — KingdomFlix',
    description:
      'Join NSPPD, Hallelujah Challenge, Covenant Hour of Prayer, and Sunday church live broadcasts with WAT countdown alerts on KingdomFlix.',
    canonicalPath: '/categories/live-special-broadcasts',
  },
  '/categories/prayer-spiritual-warfare': {
    title: 'Christian Prayers & Spiritual Warfare — KingdomFlix',
    description:
      'Watch prophetic prayers, midnight altars, and spiritual warfare sessions from trusted Christian ministries on KingdomFlix.',
    canonicalPath: '/categories/prayer-spiritual-warfare',
  },
  '/categories/marriage-relationships': {
    title: 'Christian Marriage & Relationship Teachings — KingdomFlix',
    description:
      'Learn biblical wisdom on Christian marriage, courtship, singles, and godly family building on KingdomFlix.',
    canonicalPath: '/categories/marriage-relationships',
  },
  '/categories/christian-living': {
    title: 'Christian Living, Faith & Purpose Teachings — KingdomFlix',
    description:
      'Grow daily in faith, spiritual maturity, godly character, and Christian purpose with curated teachings on KingdomFlix.',
    canonicalPath: '/categories/christian-living',
  },
  '/categories/conferences-events': {
    title: 'Christian Conferences, Crusades & Revivals — KingdomFlix',
    description:
      'Watch major Christian conferences, gospel crusades, youth camps, and special revival gatherings on KingdomFlix.',
    canonicalPath: '/categories/conferences-events',
  },
  '/ministers': {
    title: 'Explore Christian Ministers & Gospel Artists — KingdomFlix',
    description:
      'Browse verified Nigerian & international Christian pastors, apostles, worship leaders, and gospel music artists on KingdomFlix.',
    canonicalPath: '/ministers',
  },
  '/community': {
    title: 'Christian Community, Prayer Wall & Fellowship — KingdomFlix',
    description:
      'Connect with believers worldwide, share testimonies, post prayer requests, and chat live in Christian fellowship rooms on KingdomFlix.',
    canonicalPath: '/community',
  },
};

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function onRequestGet(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const url = new URL(context.request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // Skip API routes and static files immediately
  if (pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(pathname)) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const meta = ROUTE_SEO_MAP[pathname] || ROUTE_SEO_MAP['/'];
  const canonicalUrl = `https://www.kingdomflix.name.ng${meta.canonicalPath}`;
  const safeTitle = escapeHtmlAttr(meta.title);
  const safeDesc = escapeHtmlAttr(meta.description);
  const safeCanonical = escapeHtmlAttr(canonicalUrl);

  let html = await response.text();
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${safeCanonical}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${safeCanonical}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${safeDesc}" />`
    );

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
