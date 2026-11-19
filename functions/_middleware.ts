interface RouteSeoMeta {
  title: string;
  description: string;
  keywords: string;
  canonicalPath: string;
}

const ROUTE_SEO_MAP: Record<string, RouteSeoMeta> = {
  '/': {
    title: 'KingdomFlix (KINGDOM+) — Free Christian Movies & Gospel Songs',
    description:
      'Watch free Nigerian & global Christian movies, Bible cartoons, stream free gospel songs, worship, sermons, and live prayers on KingdomFlix.',
    keywords:
      'free Christian movies, watch Christian movies free online, free gospel songs, free Christian cartoons, free Christian streaming site, Nigerian gospel music, sermons free, KingdomFlix, KINGDOM+',
    canonicalPath: '/',
  },
  '/movies': {
    title: 'Watch Free Christian Movies & Bible Cartoons — KingdomFlix',
    description:
      'Watch free full-length Nigerian & international Christian movies, Mount Zion dramas, and Bible story cartoons online on KingdomFlix.',
    keywords:
      'free Christian movies, watch Christian movies free online, free Nigerian Christian movies, Mount Zion full movies free, Christian cartoons free, Bible story cartoons, faith films free, KingdomFlix',
    canonicalPath: '/movies',
  },
  '/categories': {
    title: 'Free Christian Content, Gospel Songs & Sermons — KingdomFlix',
    description:
      'Stream free Christian movies, Nigerian gospel songs, worship & praise, sermons, marriage teachings, and live prayer altars on KingdomFlix.',
    keywords:
      'free Christian content, free Christian streaming, gospel songs free, Christian sermons free, worship music free, Christian marriage teachings, KingdomFlix',
    canonicalPath: '/categories',
  },
  '/categories/gospel-music': {
    title: 'Free Gospel Songs & Nigerian Christian Music — KingdomFlix',
    description:
      'Stream free Nigerian & global gospel songs, praise hits, gospel choirs, and spirit-filled Christian music online on KingdomFlix.',
    keywords:
      'free gospel songs, Nigerian gospel songs free, stream gospel music free, Christian songs free online, praise and worship songs, Mercy Chinwo, Moses Bliss, Nathaniel Bassey, KingdomFlix',
    canonicalPath: '/categories/gospel-music',
  },
  '/categories/worship-praise': {
    title: 'Free Christian Worship & Praise Music Sessions — KingdomFlix',
    description:
      'Stream free deep worship with Nathaniel Bassey, Dunsin Oyekan, Mercy Chinwo, Moses Bliss, and global Christian praise sessions on KingdomFlix.',
    keywords:
      'free worship songs, Christian worship music free, praise and worship sessions, spontaneous worship, Nathaniel Bassey, Dunsin Oyekan, Victoria Orenze, KingdomFlix',
    canonicalPath: '/categories/worship-praise',
  },
  '/categories/sermons-teachings': {
    title: 'Watch Free Christian Sermons & Bible Teachings — KingdomFlix',
    description:
      'Watch free sermons and Bible teachings from Apostle Joshua Selman, Pastor Jerry Eze, Bishop David Oyedepo & more on KingdomFlix.',
    keywords:
      'free Christian sermons, watch sermons online free, Bible teachings free, Apostle Joshua Selman sermons, Pastor Jerry Eze, Bishop David Oyedepo, Koinonia messages, KingdomFlix',
    canonicalPath: '/categories/sermons-teachings',
  },
  '/categories/live-special-broadcasts': {
    title: 'Free Live Prayer Altars & Church Broadcasts — KingdomFlix',
    description:
      'Join free live Christian broadcasts including NSPPD, Hallelujah Challenge, Covenant Hour of Prayer, and Sunday church services on KingdomFlix.',
    keywords:
      'live Christian broadcasts free, NSPPD live today, Hallelujah Challenge live, live church service online free, Christian prayer altar live, KingdomFlix',
    canonicalPath: '/categories/live-special-broadcasts',
  },
  '/categories/prayer-spiritual-warfare': {
    title: 'Free Christian Prayers & Spiritual Warfare — KingdomFlix',
    description:
      'Stream free prophetic prayers, midnight prayer altars, deliverance sessions, and spiritual warfare messages on KingdomFlix.',
    keywords:
      'free Christian prayers, midnight prayers online, spiritual warfare prayers, deliverance prayers, prophetic declarations, NSPPD prayers, KingdomFlix',
    canonicalPath: '/categories/prayer-spiritual-warfare',
  },
  '/categories/marriage-relationships': {
    title: 'Free Christian Marriage & Relationship Teachings — KingdomFlix',
    description:
      'Watch free biblical wisdom on Christian marriage, courtship, singles, and godly family building from trusted ministers on KingdomFlix.',
    keywords:
      'Christian marriage teachings free, Christian relationship advice, biblical courtship sermons, godly marriage messages, Pastor Kingsley Okonkwo, KingdomFlix',
    canonicalPath: '/categories/marriage-relationships',
  },
  '/categories/christian-living': {
    title: 'Free Christian Living, Faith & Purpose Teachings — KingdomFlix',
    description:
      'Grow daily in faith, spiritual maturity, godly character, and Christian purpose with free curated teachings on KingdomFlix.',
    keywords:
      'Christian living teachings free, spiritual growth sermons, Christian faith messages, Bible study online free, KingdomFlix',
    canonicalPath: '/categories/christian-living',
  },
  '/categories/conferences-events': {
    title: 'Free Christian Conferences, Crusades & Revivals — KingdomFlix',
    description:
      'Watch free Christian conferences, gospel crusades, youth camps, and special revival gatherings online on KingdomFlix.',
    keywords:
      'Christian conferences free, gospel crusades online, Shiloh messages, RCCG convention, Christian revival videos, KingdomFlix',
    canonicalPath: '/categories/conferences-events',
  },
  '/ministers': {
    title: 'Explore Christian Ministers & Gospel Artists — KingdomFlix',
    description:
      'Discover verified Nigerian & international Christian pastors, apostles, worship leaders, and gospel music artists free on KingdomFlix.',
    keywords:
      'Nigerian pastors online, Christian ministers directory, gospel music artists, Apostle Joshua Selman, Pastor Jerry Eze, Nathaniel Bassey, Dunsin Oyekan, KingdomFlix',
    canonicalPath: '/ministers',
  },
  '/community': {
    title: 'Free Christian Community, Prayer Wall & Fellowship — KingdomFlix',
    description:
      'Connect free with believers worldwide, share testimonies, post prayer requests, and chat live in Christian fellowship rooms on KingdomFlix.',
    keywords:
      'Christian community online free, Christian prayer wall, online Bible fellowship, Christian chat rooms, share testimonies, KingdomFlix',
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
  const safeKeywords = escapeHtmlAttr(meta.keywords);
  const safeCanonical = escapeHtmlAttr(canonicalUrl);

  let html = await response.text();
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="keywords" content="${safeKeywords}" />`
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
