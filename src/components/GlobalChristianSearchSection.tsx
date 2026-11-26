import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Film,
  Flame,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { KingdomVideo } from '../types/kingdom.ts';
import { VideoCard } from './VideoCard.tsx';

interface GlobalChristianSearchSectionProps {
  localVideos: KingdomVideo[];
  savedVideoIds: string[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onSelectChannel: (channelId: string) => void;
  onDiscoveredVideoSelected?: (video: KingdomVideo) => void;
  initialCategoryScope?: string;
  compact?: boolean;
  moviesOnly?: boolean;
  externalSearchRequest?: { query: string; nonce: number } | null;
}

const MOVIE_CATEGORY_SLUGS = new Set([
  'real-christian-movies',
  'bible-stories',
  'christian-animations',
  'bible-story-cartoons',
]);

const CARTOON_CATEGORY_SLUGS = new Set([
  'christian-animations',
  'bible-story-cartoons',
]);

const MOVIE_CARTOON_TEXT_REGEX =
  /\b(cartoon|cartoons|animation|animated|superbook|veggietales|veggie tales|beginner'?s bible|saddleback kids|cbn animation|bible story|bible stories)\b/i;

const NON_MOVIE_CLIENT_REJECT_REGEX =
  /\b(#shorts|#short|official trailer|movie trailer|teaser|facts and review|facts & review|\breview\b|\brecap\b|ending explained|reaction video|behind the scenes|making of|official audio|lyric video|music video|full album|greatest hits|worship songs|gospel songs|praise songs|playlist|mixtape|worship session|worship medley|praise session|praise medley|spontaneous worship|live worship|worship song|gospel song|sunday service|live service|hallelujah challenge|nsppd|sermon|preaching|podcast|interview)\b/i;

const QUICK_CHRISTIAN_SEARCH_TOPICS = [
  { label: 'Apostle Joshua Selman Spiritual Growth', category: 'sermons-teachings' },
  { label: 'Pastor Jerry Eze NSPPD Prayers', category: 'prayer-spiritual-warfare' },
  { label: 'Nathaniel Bassey Worship Sessions', category: 'worship-praise' },
  { label: 'Dunsin Oyekan Spontaneous Worship', category: 'worship-praise' },
  { label: 'Bishop David Oyedepo Faith & Wisdom', category: 'christian-living' },
  { label: 'Pastor Kingsley Okonkwo Marriage & Courtship', category: 'marriage-relationships' },
  { label: 'Mercy Chinwo & Moses Bliss Gospel Praise', category: 'gospel-music' },
  { label: 'Apostle Femi Lazarus Christian Living', category: 'christian-living' },
  { label: 'Mount Zion Full Christian Movies', category: 'movies' },
];

const QUICK_MOVIE_SEARCH_TOPICS = [
  { label: 'Mount Zion Full Movies', category: 'movies-nigerian' },
  { label: 'Bible Story Cartoons', category: 'movies-cartoon' },
  { label: 'Nigerian Christian Movies', category: 'movies-nigerian' },
  { label: 'International Christian Films', category: 'movies-international' },
  { label: 'Superbook Bible Animation', category: 'movies-cartoon' },
  { label: 'Joseph & Esther Bible Movies', category: 'movies' },
];

const CATEGORY_SCOPES = [
  { id: 'all', label: 'All Christian Content' },
  { id: 'music', label: 'Music' },
  { id: 'sermons', label: 'Sermons & Teachings' },
  { id: 'marriage-relationships', label: 'Marriage & Relationships' },
];

const MOVIE_CATEGORY_SCOPES = [
  { id: 'movies', label: 'All Movies & Cartoons' },
  { id: 'movies-real', label: 'Real Christian Movies' },
  { id: 'movies-cartoon', label: 'Cartoons & Animations' },
  { id: 'movies-nigerian', label: 'Nigerian & African' },
  { id: 'movies-international', label: 'International & Biblical' },
];

function isLocalVideoMovieOrCartoon(v: KingdomVideo): boolean {
  return (
    MOVIE_CATEGORY_SLUGS.has(v.primary_category_slug) ||
    v.secondary_category_slugs.some((s) => MOVIE_CATEGORY_SLUGS.has(s)) ||
    v.channel_type === 'movie_studio' ||
    v.channel_type === 'animation_studio'
  );
}

function isLocalVideoCartoon(v: KingdomVideo): boolean {
  return (
    CARTOON_CATEGORY_SLUGS.has(v.primary_category_slug) ||
    v.secondary_category_slugs.some((s) => CARTOON_CATEGORY_SLUGS.has(s)) ||
    v.channel_type === 'animation_studio' ||
    MOVIE_CARTOON_TEXT_REGEX.test(`${v.title} ${v.channel_title} ${v.subcategory_label || ''}`)
  );
}

function matchesMovieSubScope(v: KingdomVideo, scope: string): boolean {
  if (!isLocalVideoMovieOrCartoon(v)) return false;
  const cartoon = isLocalVideoCartoon(v);
  if (scope === 'movies-cartoon') return cartoon;
  if (scope === 'movies-real') return !cartoon;
  if (scope === 'movies-nigerian') {
    return (
      v.is_nigerian_channel ||
      /\b(nigerian|nigeria|mount zion|bamiloye|winlos|jaymikee|evom|flaming sword|african)\b/i.test(
        `${v.title} ${v.channel_title} ${v.subcategory_label || ''}`
      )
    );
  }
  if (scope === 'movies-international') {
    return !v.is_nigerian_channel;
  }
  return true;
}

export const GlobalChristianSearchSection: React.FC<GlobalChristianSearchSectionProps> = ({
  localVideos,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onSelectChannel,
  onDiscoveredVideoSelected,
  initialCategoryScope = 'all',
  moviesOnly = false,
  externalSearchRequest = null,
}) => {
  const isMoviesMode = moviesOnly || initialCategoryScope.startsWith('movies');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [categoryScope, setCategoryScope] = useState(
    isMoviesMode ? 'movies' : initialCategoryScope
  );
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState<KingdomVideo[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isMoviesMode) {
      setCategoryScope((prev) => (prev.startsWith('movies') ? prev : 'movies'));
      return;
    }
    if (initialCategoryScope && initialCategoryScope !== 'live-special-broadcasts') {
      setCategoryScope(initialCategoryScope);
    }
  }, [initialCategoryScope, isMoviesMode]);

  useEffect(() => {
    if (externalSearchRequest && externalSearchRequest.query.trim()) {
      const nextQ = externalSearchRequest.query.trim();
      setQuery(nextQ);
      const nextScope = isMoviesMode ? 'movies' : categoryScope;
      executeGlobalSearch(nextQ, nextScope);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSearchRequest?.nonce]);

  // Instant matches from the in-app curated catalog (strictly movies/cartoons when in moviesOnly mode)
  const localMatches = useMemo(() => {
    const q = (submittedQuery || query).trim().toLowerCase();
    if (!q || q.length < 2) return [];

    if (isMoviesMode) {
      const activeScope = categoryScope.startsWith('movies') ? categoryScope : 'movies';
      const fillerWords = new Set(['movie', 'movies', 'film', 'films', 'christian', 'full', 'watch']);
      const meaningfulTokens = q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !fillerWords.has(t));

      return localVideos
        .filter((v) => {
          if (!matchesMovieSubScope(v, activeScope)) return false;

          const cartoonFlag = isLocalVideoCartoon(v);
          const originTags = v.is_nigerian_channel
            ? 'nigerian nigeria african nollywood mount zion'
            : 'international global english hollywood';
          const formatTags = cartoonFlag
            ? 'cartoon cartoons animation animated kids children bible story'
            : 'real live action feature film drama cinema';

          const hay = `${v.title} ${v.channel_title} ${v.artist_name || ''} ${
            v.description
          } ${v.primary_category_name} ${v.subcategory_label || ''} ${originTags} ${formatTags}`.toLowerCase();

          if (hay.includes(q)) return true;
          if (meaningfulTokens.length === 0) return true;
          return meaningfulTokens.every((tok) => {
            if (tok === 'cartoon' || tok === 'cartoons' || tok === 'animated' || tok === 'animation') {
              return cartoonFlag || hay.includes(tok);
            }
            return hay.includes(tok);
          });
        })
        .slice(0, 12);
    }

    return localVideos
      .filter((v) => {
        const matchesScope =
          categoryScope === 'all' ||
          (categoryScope === 'music' &&
            (v.primary_category_slug === 'gospel-music' ||
              v.primary_category_slug === 'worship-praise' ||
              v.secondary_category_slugs.includes('gospel-music') ||
              v.secondary_category_slugs.includes('worship-praise'))) ||
          (categoryScope === 'sermons' &&
            (v.primary_category_slug === 'sermons-teachings' ||
              v.primary_category_slug === 'prayer-spiritual-warfare' ||
              v.primary_category_slug === 'christian-living' ||
              v.primary_category_slug === 'conferences-events' ||
              v.primary_category_slug === 'live-special-broadcasts' ||
              v.secondary_category_slugs.some((s) =>
                ['sermons-teachings', 'prayer-spiritual-warfare', 'christian-living', 'conferences-events', 'live-special-broadcasts'].includes(s)
              ))) ||
          v.primary_category_slug === categoryScope ||
          v.secondary_category_slugs.includes(categoryScope);
        if (!matchesScope) return false;

        return (
          v.title.toLowerCase().includes(q) ||
          v.channel_title.toLowerCase().includes(q) ||
          (v.artist_name && v.artist_name.toLowerCase().includes(q)) ||
          v.description.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [localVideos, query, submittedQuery, categoryScope, isMoviesMode]);

  const executeGlobalSearch = async (searchPhrase: string, scopeOverride?: string) => {
    const clean = searchPhrase.trim();
    const rawScope = scopeOverride ?? categoryScope;
    const activeScope = isMoviesMode
      ? rawScope.startsWith('movies')
        ? rawScope
        : 'movies'
      : rawScope;

    setSubmittedQuery(clean);
    if (!clean) {
      setGlobalResults([]);
      setBlockedMessage(null);
      return;
    }

    setLoadingGlobal(true);
    setBlockedMessage(null);
    try {
      const res = await fetch(
        `/api/christian-search?q=${encodeURIComponent(clean)}&category=${encodeURIComponent(
          activeScope
        )}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setGlobalResults([]);
        return;
      }
      const data = await res.json();
      if (data.blocked) {
        setBlockedMessage(
          data.blockedReason ||
            'KINGDOM+ is dedicated exclusively to Christian sermons, gospel music, worship, prayer, and faith-building films.'
        );
        setGlobalResults([]);
      } else if (Array.isArray(data.results)) {
        const incoming: KingdomVideo[] = data.results;
        const sanitized = isMoviesMode
          ? incoming.filter((v) => {
              if (!v?.title || NON_MOVIE_CLIENT_REJECT_REGEX.test(v.title)) return false;
              const cartoon = isLocalVideoCartoon(v);
              const minDur = cartoon ? 180 : 600;
              if (
                typeof v.duration_seconds === 'number' &&
                v.duration_seconds > 0 &&
                v.duration_seconds < minDur
              ) {
                return false;
              }
              return matchesMovieSubScope(v, activeScope);
            })
          : incoming;
        setGlobalResults(sanitized);
      }
    } catch {
      setGlobalResults([]);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeGlobalSearch(query);
  };

  const handleSelectDiscoveredVideo = (video: KingdomVideo) => {
    if (onDiscoveredVideoSelected) {
      onDiscoveredVideoSelected(video);
    }
    onSelectVideo(video);
  };

  // Deduplicate global results against local matches
  const uniqueGlobalResults = useMemo(() => {
    const localYtIds = new Set(localMatches.map((v) => v.youtube_video_id));
    return globalResults.filter((v) => !localYtIds.has(v.youtube_video_id));
  }, [globalResults, localMatches]);

  const activeScopesList = isMoviesMode ? MOVIE_CATEGORY_SCOPES : CATEGORY_SCOPES;
  const activeQuickTopics = isMoviesMode
    ? QUICK_MOVIE_SEARCH_TOPICS
    : QUICK_CHRISTIAN_SEARCH_TOPICS;

  return (
    <section className="w-full flex flex-col gap-4 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold uppercase tracking-wider">
            {isMoviesMode ? <Film className="w-3.5 h-3.5" /> : <Compass className="w-3.5 h-3.5" />}
            <span>
              {isMoviesMode
                ? 'Christian Movies & Cartoons Search'
                : 'Unlimited Christian & Gospel Discovery'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {isMoviesMode
                ? 'Movies & Animations Only (Nigerian & International)'
                : '100% Christian-Safe Filter Active'}
            </span>
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          {isMoviesMode
            ? 'Explores real Christian films & Bible cartoons inside KINGDOM+ and worldwide'
            : 'Search any sermon, minister, gospel song, worship session, or Christian movie — streams natively in KINGDOM+'}
        </span>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-amber-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isMoviesMode
                ? 'Search any Christian movie or cartoon (Nigerian, International, Mount Zion, Bible stories)...'
                : 'Search any Christian sermon, pastor, gospel artist, worship song, or Bible topic...'
            }
            className="w-full pl-12 pr-10 py-4 rounded-2xl bg-zinc-900 border-2 border-amber-500/60 text-sm sm:text-base text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSubmittedQuery('');
                setGlobalResults([]);
                setBlockedMessage(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loadingGlobal || !query.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {loadingGlobal ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isMoviesMode ? 'Finding Movies...' : 'Searching...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{isMoviesMode ? 'Search Christian Movies' : 'Explore Unlimited Library'}</span>
            </>
          )}
        </button>
      </form>

      {/* Category Scope Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {activeScopesList.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => {
              setCategoryScope(sc.id);
              if (submittedQuery || query.trim()) {
                executeGlobalSearch(query.trim() || submittedQuery, sc.id);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              categoryScope === sc.id
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {sc.label}
          </button>
        ))}
      </div>

      {/* Christian Safety Guardrail Block Notice */}
      {blockedMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs sm:text-sm text-amber-200 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{blockedMessage}</span>
        </div>
      )}

      {/* Search Results */}
      {(submittedQuery || loadingGlobal || (isMoviesMode && query.trim().length >= 2 && localMatches.length > 0)) && !blockedMessage && (
        <div className="flex flex-col gap-6 pt-2 border-t border-zinc-800/80">
          {/* Tier 1: In-App Curated Matches */}
          {localMatches.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                  {isMoviesMode
                    ? `In-App Christian Movies & Cartoons (${localMatches.length})`
                    : `In-App Curated Library Matches (${localMatches.length})`}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {localMatches.map((video) => (
                  <div key={video.id} className="relative">
                    <VideoCard
                      video={video}
                      onSelect={onSelectVideo}
                      isSaved={savedVideoIds.includes(video.id)}
                      onToggleSave={onToggleSave}
                      onSelectChannel={onSelectChannel}
                    />
                    {isMoviesMode && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-amber-300/90">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                          {isLocalVideoCartoon(video)
                            ? 'Christian Cartoon / Animation'
                            : video.is_nigerian_channel
                            ? 'Nigerian Christian Movie'
                            : 'International Christian Movie'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier 2: Unlimited Global Discovery */}
          {(submittedQuery || loadingGlobal) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-amber-300">
                    {isMoviesMode
                      ? 'External Christian Movies & Cartoons Discovered'
                      : 'Expanded Global Christian Discovery'}
                  </h3>
                  {!loadingGlobal && (
                    <span className="text-xs font-mono text-zinc-400">
                      ({uniqueGlobalResults.length} movies)
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400">
                  Plays directly inside the native KINGDOM+ Player &amp; Mini-Player
                </span>
              </div>

              {loadingGlobal ? (
                <div className="p-8 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-center gap-3 text-xs sm:text-sm text-zinc-300">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>
                    {isMoviesMode
                      ? 'Searching Nigerian & International Christian movies and Bible cartoons...'
                      : 'Searching global Christian ministries, worship altars & gospel libraries...'}
                  </span>
                </div>
              ) : uniqueGlobalResults.length === 0 ? (
                <div className="p-6 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center text-xs sm:text-sm text-zinc-400">
                  {isMoviesMode
                    ? `No external Christian movies or cartoons matched “${submittedQuery}”. Try another film title, Mount Zion movie, or Bible story cartoon.`
                    : `No additional global Christian broadcasts matched “${submittedQuery}”. Try another minister, song title, or biblical topic.`}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {uniqueGlobalResults.map((video) => (
                    <div key={video.id} className="relative">
                      <VideoCard
                        video={video}
                        onSelect={handleSelectDiscoveredVideo}
                        isSaved={savedVideoIds.includes(video.id)}
                        onToggleSave={(id, e) => {
                          if (onDiscoveredVideoSelected) {
                            onDiscoveredVideoSelected(video);
                          }
                          onToggleSave(id, e);
                        }}
                        onSelectChannel={onSelectChannel}
                      />
                      {isMoviesMode && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-amber-300/90">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                            {isLocalVideoCartoon(video)
                              ? 'Christian Cartoon / Animation'
                              : video.is_nigerian_channel
                              ? 'Nigerian Christian Movie'
                              : 'International Christian Movie'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
