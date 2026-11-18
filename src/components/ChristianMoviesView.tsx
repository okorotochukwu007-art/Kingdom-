import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Film,
  Flame,
  Heart,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import {
  ContentCategory,
  KingdomChannel,
  KingdomVideo,
} from '../types/kingdom.ts';
import {
  formatCompactNumber,
  formatRelativeDate,
} from '../utils/formatters.ts';
import { VideoCard } from './VideoCard.tsx';
import { GlobalChristianSearchSection } from './GlobalChristianSearchSection.tsx';
import { useDataSaver } from '../hooks/useDataSaver.ts';
import {
  getOptimizedAvatarUrl,
  getOptimizedThumbnailUrl,
} from '../utils/dataSaver.ts';
import { shareKingdomVideo } from '../utils/shareVideo.ts';

interface ChristianMoviesViewProps {
  categories: ContentCategory[];
  channels: KingdomChannel[];
  videos: KingdomVideo[];
  savedVideoIds: string[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onDiscoveredVideoSelected?: (video: KingdomVideo) => void;
}

const MOVIE_CATEGORY_SLUGS = [
  'real-christian-movies',
  'bible-stories',
  'christian-animations',
  'bible-story-cartoons',
];

export const CHRISTIAN_MOVIE_GENRES = [
  { id: 'all', label: 'All Christian Movies', icon: Film, queryTerm: '' },
  { id: 'nigerian', label: 'Nigerian Christian Movies', icon: Film, queryTerm: 'Nigerian Christian movies' },
  { id: 'african', label: 'African Christian Movies', icon: Compass, queryTerm: 'African Christian movies' },
  { id: 'international', label: 'International Christian Movies', icon: Tv, queryTerm: 'International Christian movies' },
  { id: 'biblical', label: 'Biblical & Historical', icon: Sparkles, queryTerm: 'Biblical and historical movies' },
  { id: 'spiritual-warfare', label: 'Spiritual Warfare & Deliverance', icon: Flame, queryTerm: 'Spiritual warfare and deliverance movies' },
  { id: 'family-dramas', label: 'Christian Family Dramas', icon: Tv, queryTerm: 'Christian family dramas' },
  { id: 'romance', label: 'Christian Romance', icon: Heart, queryTerm: 'Christian romance movies' },
  { id: 'redemption', label: 'Redemption & Transformation', icon: Sparkles, queryTerm: 'Redemption and transformation movies' },
  { id: 'faith-miracles', label: 'Faith, Miracles & Inspiration', icon: Sparkles, queryTerm: 'Faith miracles and inspirational movies' },
  { id: 'comedy-action', label: 'Christian Comedy & Action', icon: Film, queryTerm: 'Christian comedy and action movies' },
] as const;

type MovieSortLens = 'high_impression_recent' | 'most_viewed' | 'highest_engagement' | 'newest';

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

export const ChristianMoviesView: React.FC<ChristianMoviesViewProps> = ({
  categories,
  channels,
  videos,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onDiscoveredVideoSelected,
}) => {
  const { isDataSaverActive } = useDataSaver();
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string>('all');
  const [sortLens, setSortLens] = useState<MovieSortLens>('high_impression_recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [visibleMovieCount, setVisibleMovieCount] = useState<number>(() =>
    isDataSaverActive ? 12 : 24
  );

  // Live YouTube Christian movie release & trending caption alerts
  const [trendingAlerts, setTrendingAlerts] = useState<MovieTrendingAlert[]>([]);
  const [alertsCheckedAt, setAlertsCheckedAt] = useState<string | null>(null);
  const [isCheckingAlerts, setIsCheckingAlerts] = useState(false);
  const [heroPaused, setHeroPaused] = useState(false);
  const lastFetchedMsRef = useRef<number>(0);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);

  // Beyond-library YouTube movie discovery state
  const [discoveredMovies, setDiscoveredMovies] = useState<KingdomVideo[]>([]);
  const [isSearchingDiscovered, setIsSearchingDiscovered] = useState(false);
  const [discoveredSearchLabel, setDiscoveredSearchLabel] = useState<string | null>(null);

  const loadTrendingMovieAlerts = async (forceRefresh = false) => {
    setIsCheckingAlerts(true);
    try {
      const res = await fetch(
        `/api/movies/trending-alerts${forceRefresh ? '?refresh=1' : ''}`
      );
      if (res.ok) {
        const data = await res.json();
        lastFetchedMsRef.current = Date.now();
        if (Array.isArray(data.alerts)) {
          setTrendingAlerts(data.alerts);
        }
        if (data.checkedAt) {
          setAlertsCheckedAt(data.checkedAt);
        }
      }
    } catch {
      // Keep existing state gracefully
    } finally {
      setIsCheckingAlerts(false);
    }
  };

  useEffect(() => {
    loadTrendingMovieAlerts(false);

    // Keep the Movie Page banner updated automatically every 10 minutes
    const pollTimer = window.setInterval(() => {
      loadTrendingMovieAlerts(false);
    }, 10 * 60 * 1000);

    // Also refresh automatically when returning to the tab if > 5 minutes stale
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchedMsRef.current > 5 * 60 * 1000) {
        loadTrendingMovieAlerts(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const movieCategories = useMemo(
    () =>
      categories.filter(
        (c) => c.section === 'movies' || MOVIE_CATEGORY_SLUGS.includes(c.slug)
      ),
    [categories]
  );

  const movieStudios = useMemo(
    () =>
      channels.filter(
        (c) =>
          c.channel_type === 'movie_studio' ||
          c.channel_type === 'animation_studio' ||
          MOVIE_CATEGORY_SLUGS.includes(c.default_category_slug)
      ),
    [channels]
  );

  const allMovieVideos = useMemo(() => {
    const movieSlugSet = new Set(MOVIE_CATEGORY_SLUGS);
    const studioIds = new Set(movieStudios.map((s) => s.id));
    const baseMovies = videos.filter(
      (v) =>
        movieSlugSet.has(v.primary_category_slug) ||
        v.secondary_category_slugs.some((s) => movieSlugSet.has(s)) ||
        studioIds.has(v.channel_id)
    );
    // Merge live YouTube trending/newly released movies so they are immediately searchable in-app
    const seenYtIds = new Set(baseMovies.map((v) => v.youtube_video_id));
    const freshAlertVideos = trendingAlerts
      .map((a) => a.video)
      .filter((v) => v && v.youtube_video_id && !seenYtIds.has(v.youtube_video_id));
    return [...freshAlertVideos, ...baseMovies];
  }, [videos, movieStudios, trendingAlerts]);

  // High-impression & recent composite ranker for Christian Movies & Animations
  const sortMoviesByLens = (list: KingdomVideo[], lens: MovieSortLens): KingdomVideo[] => {
    const copy = [...list];
    if (lens === 'high_impression_recent') {
      // Balances high daily view velocity (recent momentum), total impressions, and engagement rate
      return copy.sort((a, b) => {
        const scoreA =
          a.trending_score * 1.4 +
          a.views_per_day * 1.2 +
          a.view_count * 0.08 * (1 + a.engagement_rate / 100);
        const scoreB =
          b.trending_score * 1.4 +
          b.views_per_day * 1.2 +
          b.view_count * 0.08 * (1 + b.engagement_rate / 100);
        return scoreB - scoreA;
      });
    }
    if (lens === 'most_viewed') {
      return copy.sort((a, b) => b.view_count - a.view_count);
    }
    if (lens === 'highest_engagement') {
      return copy.sort((a, b) => b.engagement_rate - a.engagement_rate);
    }
    return copy.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  };

  const heroSlides = useMemo(() => {
    const slides: Array<{ video: KingdomVideo; alert?: MovieTrendingAlert }> = [];
    const seenYtIds = new Set<string>();

    for (const alert of trendingAlerts) {
      if (alert?.video && !seenYtIds.has(alert.video.youtube_video_id)) {
        seenYtIds.add(alert.video.youtube_video_id);
        slides.push({ video: alert.video, alert });
      }
    }

    if (slides.length < 5) {
      for (const fallbackVideo of sortMoviesByLens(allMovieVideos, 'high_impression_recent')) {
        if (slides.length >= 5) break;
        if (!seenYtIds.has(fallbackVideo.youtube_video_id)) {
          seenYtIds.add(fallbackVideo.youtube_video_id);
          slides.push({ video: fallbackVideo });
        }
      }
    }

    return slides.slice(0, 6);
  }, [trendingAlerts, allMovieVideos]);

  useEffect(() => {
    if (heroIndex >= heroSlides.length && heroSlides.length > 0) {
      setHeroIndex(0);
    }
  }, [heroIndex, heroSlides.length]);

  useEffect(() => {
    if (heroPaused || heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [heroPaused, heroSlides.length]);

  const currentSlide = heroSlides[heroIndex] || heroSlides[0] || null;
  const currentHero = currentSlide?.video || null;
  const currentHeroAlert = currentSlide?.alert || null;
  const desktopBannerStart = Math.max(
    0,
    Math.min(heroIndex - 1, Math.max(0, heroSlides.length - 4))
  );

  const filteredMovies = useMemo(() => {
    let list = [...allMovieVideos];
    if (selectedCategorySlug !== 'all') {
      list = list.filter(
        (v) =>
          v.primary_category_slug === selectedCategorySlug ||
          v.secondary_category_slugs.includes(selectedCategorySlug)
      );
    }
    if (selectedStudioId) {
      list = list.filter((v) => v.channel_id === selectedStudioId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channel_title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q)
      );
    }
    return sortMoviesByLens(list, sortLens);
  }, [allMovieVideos, selectedCategorySlug, selectedStudioId, searchQuery, sortLens]);

  const nigerianChristianCinema = useMemo(() => {
    return sortMoviesByLens(
      allMovieVideos.filter((v) => v.is_nigerian_channel),
      'high_impression_recent'
    );
  }, [allMovieVideos]);

  const filterLocalMovies = (genreTerm: string, queryTerm: string) => {
    const terms = `${genreTerm} ${queryTerm}`
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2 && t !== 'christian' && t !== 'movie' && t !== 'movies');
    return allMovieVideos.filter((v) => {
      const hay = `${v.title} ${v.channel_title} ${v.description} ${v.primary_category_name} ${v.subcategory_label || ''}`.toLowerCase();
      return terms.length === 0 || terms.some((t) => hay.includes(t));
    });
  };

  const handleSelectGenre = async (genreId: string) => {
    setSelectedGenreId(genreId);
    const genreObj = CHRISTIAN_MOVIE_GENRES.find((g) => g.id === genreId);
    if (!genreObj || genreId === 'all') {
      setDiscoveredMovies([]);
      setDiscoveredSearchLabel(null);
      return;
    }

    setIsSearchingDiscovered(true);
    setDiscoveredSearchLabel(genreObj.label);
    try {
      const res = await fetch(
        `/api/discovery/movies?genre=${encodeURIComponent(genreObj.id)}&query=${encodeURIComponent(
          searchQuery
        )}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const combined = Array.isArray(data.movies)
          ? data.movies
          : [...(data.curatedMovies || []), ...(data.discoveredMovies || [])];
        if (combined.length > 0) {
          setDiscoveredMovies(combined);
          return;
        }
      }
      setDiscoveredMovies(filterLocalMovies(genreObj.queryTerm, searchQuery));
    } catch {
      setDiscoveredMovies(filterLocalMovies(genreObj.queryTerm, searchQuery));
    } finally {
      setIsSearchingDiscovered(false);
    }
  };

  const runMovieSearchQuery = async (rawTerm: string) => {
    const trimmed = rawTerm.trim();
    if (!trimmed) return;

    setIsSearchingDiscovered(true);
    const activeGenre = CHRISTIAN_MOVIE_GENRES.find((g) => g.id === selectedGenreId);
    const genreTerm = activeGenre && activeGenre.id !== 'all' ? activeGenre.id : '';
    setDiscoveredSearchLabel(trimmed);
    try {
      const res = await fetch(
        `/api/discovery/movies?genre=${encodeURIComponent(genreTerm)}&query=${encodeURIComponent(
          trimmed
        )}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const combined = Array.isArray(data.movies)
          ? data.movies
          : [...(data.curatedMovies || []), ...(data.discoveredMovies || [])];
        if (combined.length > 0) {
          setDiscoveredMovies(combined);
          return;
        }
      }
      setDiscoveredMovies(filterLocalMovies(genreTerm, trimmed));
    } catch {
      setDiscoveredMovies(filterLocalMovies(genreTerm, trimmed));
    } finally {
      setIsSearchingDiscovered(false);
    }
  };

  const handleCustomMovieSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runMovieSearchQuery(searchQuery);
  };

  const handleSearchAnnouncedMovieInApp = async (alert: MovieTrendingAlert) => {
    setSelectedCategorySlug('all');
    setSelectedStudioId(null);
    setSearchQuery(alert.searchKeyword);
    if (onDiscoveredVideoSelected) {
      onDiscoveredVideoSelected(alert.video);
    }
    window.setTimeout(() => {
      resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    await runMovieSearchQuery(alert.searchKeyword);
  };

  const handleClearDiscovered = () => {
    setDiscoveredMovies([]);
    setDiscoveredSearchLabel(null);
    setSelectedGenreId('all');
  };

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* ====================================================================
          CHRISTIAN MOVIES & BIBLE CINEMA HERO SPOTLIGHT (LIVE TRENDING & NEW RELEASES BANNER)
      ==================================================================== */}
      <section
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        className="relative w-full min-h-[410px] sm:min-h-[470px] lg:min-h-[520px] border-b border-zinc-800/80 flex items-end overflow-hidden bg-[#09090B]"
      >
        <img
          src={
            currentHero
              ? getOptimizedThumbnailUrl(currentHero, isDataSaverActive, 'hero')
              : '/src/assets/images/worship_acoustic_hall_1794402597118.jpg'
          }
          alt={currentHero ? currentHero.title : 'KINGDOM+ Christian Movies'}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (currentHero && target.src !== currentHero.thumbnail_high_url) {
              target.src = currentHero.thumbnail_high_url;
            } else {
              target.src = '/src/assets/images/worship_acoustic_hall_1794402597118.jpg';
            }
          }}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-95 sm:opacity-85 transition-opacity duration-500"
        />
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#09090B]/95 via-[#09090B]/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/70 via-45% to-transparent" />

        <div className="relative z-10 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-7 sm:py-11 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-end">
          <div className="lg:col-span-8 min-w-0 w-full flex flex-col gap-3">
            <div className="flex items-center flex-wrap gap-2 text-[11px] sm:text-xs font-medium">
              {currentHeroAlert ? (
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  {currentHeroAlert.badge === 'New Release' ? (
                    <BellRing className="w-3.5 h-3.5" />
                  ) : (
                    <Flame className="w-3.5 h-3.5" />
                  )}
                  <span>{currentHeroAlert.badge}</span>
                </span>
              ) : (
                <span className="text-amber-400">Christian Cinema</span>
              )}
              <span aria-hidden="true" className="text-zinc-600">·</span>
              <span className="text-emerald-400 font-medium">Verified Christian Movie</span>
              {currentHero && (
                <>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="text-zinc-300 truncate max-w-[180px] sm:max-w-none">
                    {currentHero.channel_title}
                  </span>
                </>
              )}
              {alertsCheckedAt && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline text-zinc-600">·</span>
                  <span className="hidden sm:inline text-zinc-400">
                    Updated {formatRelativeDate(alertsCheckedAt)}
                  </span>
                </>
              )}
            </div>

            <h1
              className="font-display text-2xl sm:text-4xl lg:text-5xl font-semibold text-zinc-50 leading-[1.15] tracking-tight max-w-3xl line-clamp-2 sm:line-clamp-3"
              style={{ textWrap: 'balance' }}
            >
              {currentHero
                ? currentHero.title
                : 'Christian Feature Movies & Bible Stories'}
            </h1>

            {currentHero && (
              <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[11px] sm:text-xs font-mono tabular-nums text-zinc-300">
                <span>{formatCompactNumber(currentHero.view_count)} views</span>
                <span aria-hidden="true">·</span>
                <span className="font-sans text-zinc-400">
                  {formatRelativeDate(currentHero.published_at)}
                </span>
                {currentHero.views_per_day > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-300">
                      {formatCompactNumber(Math.round(currentHero.views_per_day))}/day momentum
                    </span>
                  </>
                )}
              </div>
            )}

            {currentHero && (
              <div className="flex items-center flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectVideo(currentHero);
                    if (onDiscoveredVideoSelected) onDiscoveredVideoSelected(currentHero);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Watch Movie</span>
                </button>

                {currentHeroAlert && (
                  <button
                    type="button"
                    onClick={() => handleSearchAnnouncedMovieInApp(currentHeroAlert)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search &ldquo;{currentHeroAlert.searchKeyword}&rdquo;</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => onToggleSave(currentHero.id, e)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-100 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  {savedVideoIds.includes(currentHero.id) ? (
                    <>
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      <span>Save</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => shareKingdomVideo(currentHero)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-100 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                  title="Share this movie via WhatsApp or Messages"
                >
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Share</span>
                </button>
              </div>
            )}
          </div>

          {/* Right 4 Columns: Trending & Newly Released Movies Lineup directly on the Banner */}
          {heroSlides.length > 0 && (
            <div className="lg:col-span-4 min-w-0 w-full flex flex-col gap-1.5 bg-black/85 border border-zinc-800/90 rounded-xl p-2.5 sm:p-3.5">
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-200">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {trendingAlerts.length > 0
                      ? `Trending & New Releases (${heroIndex + 1}/${heroSlides.length})`
                      : `Featured Movies (${heroIndex + 1}/${heroSlides.length})`}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {heroSlides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setHeroPaused(true);
                          setHeroIndex(
                            (prev) => (prev - 1 + heroSlides.length) % heroSlides.length
                          );
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                        title="Previous trending movie"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHeroPaused(true);
                          setHeroIndex((prev) => (prev + 1) % heroSlides.length);
                        }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                        title="Next trending movie"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => loadTrendingMovieAlerts(true)}
                    disabled={isCheckingAlerts}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[10px] font-medium text-amber-300 transition-colors disabled:opacity-60"
                    title="Refresh newly released & trending Christian movies"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isCheckingAlerts ? 'animate-spin text-amber-400' : ''}`}
                    />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar">
                {heroSlides.map((slide, idx) => {
                  const cand = slide.video;
                  const alert = slide.alert;
                  const hiddenOnDesktop =
                    idx < desktopBannerStart || idx >= desktopBannerStart + 4;
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => {
                        setHeroPaused(true);
                        setHeroIndex(idx);
                      }}
                      className={`min-w-[220px] sm:min-w-[250px] lg:min-w-0 lg:w-full text-left p-2 rounded-lg transition-colors flex items-center gap-2.5 shrink-0 ${
                        hiddenOnDesktop ? 'lg:hidden' : ''
                      } ${
                        idx === heroIndex
                          ? 'bg-amber-500/15 border border-amber-500/45'
                          : 'hover:bg-zinc-900/75 border border-transparent'
                      }`}
                    >
                      <img
                        src={getOptimizedThumbnailUrl(cand, isDataSaverActive, 'mini')}
                        alt={cand.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-16 aspect-video rounded object-cover bg-zinc-900 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold mb-0.5">
                          {alert ? (
                            <span
                              className={
                                alert.badge === 'New Release'
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }
                            >
                              {alert.badge === 'New Release' ? 'New Release' : 'Trending'}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Featured</span>
                          )}
                          <span className="text-zinc-600" aria-hidden="true">·</span>
                          <span className="text-zinc-400 font-mono tabular-nums">
                            {formatCompactNumber(cand.view_count)} views
                          </span>
                        </div>
                        <div className="text-xs font-medium text-zinc-100 truncate">
                          {cand.title}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          DEDICATED MOVIE CATEGORIES, STUDIOS & IMPRESSION FILTER BAR
      ==================================================================== */}
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 flex flex-col gap-10">

        {/* Category Cards Strip (The 4 Dedicated Christian Movie Categories - Swipeable on Mobile, Grid on Desktop) */}
        <section className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 overflow-x-auto no-scrollbar gap-3 sm:gap-4 pb-1 sm:pb-0 snap-x snap-mandatory">
          {movieCategories.map((cat) => {
            const count = allMovieVideos.filter(
              (v) =>
                v.primary_category_slug === cat.slug ||
                v.secondary_category_slugs.includes(cat.slug)
            ).length;
            const isSelected = selectedCategorySlug === cat.slug;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setSelectedCategorySlug(isSelected ? 'all' : cat.slug)
                }
                className={`min-w-[220px] sm:min-w-0 shrink-0 snap-start p-4 sm:p-5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500'
                    : 'bg-[#121215] border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono tabular-nums text-amber-400">
                      {count} titles
                    </span>
                    <Film className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <h2 className="font-display text-sm sm:text-lg font-semibold text-zinc-100 mt-1 line-clamp-1">
                    {cat.name}
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-amber-400">
                  {isSelected ? 'Reset' : 'Browse →'}
                </span>
              </button>
            );
          })}
        </section>

        {/* ====================================================================
            10 USER-SPECIFIED CHRISTIAN MOVIE GENRES (Explore Beyond Our Library)
        ==================================================================== */}
        <section className="flex flex-col gap-3.5 p-5 rounded-2xl bg-gradient-to-r from-[#121216] via-[#15141c] to-[#121216] border border-zinc-800/90 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Explore Christian Movies Beyond Our Library
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Discover full-length feature films, dramas, and biblical cinema from the Global Christian Network by genre.
              </p>
            </div>

            {discoveredMovies.length > 0 && (
              <button
                type="button"
                onClick={handleClearDiscovered}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Discovered Movies</span>
              </button>
            )}
          </div>

          {/* 11 Genre Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {CHRISTIAN_MOVIE_GENRES.map((genre) => {
              const Icon = genre.icon;
              const isSelected = selectedGenreId === genre.id;
              return (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => handleSelectGenre(genre.id)}
                  disabled={isSearchingDiscovered}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{genre.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Live Discovered Christian Movies from YouTube */}
        {(isSearchingDiscovered || discoveredMovies.length > 0) && (
          <section className="flex flex-col gap-4 p-5 rounded-2xl bg-[#0f0e13] border border-amber-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="font-display text-lg font-semibold text-zinc-100">
                  Discovered Christian Movies ({discoveredMovies.length})
                </h3>
                {discoveredSearchLabel && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {discoveredSearchLabel}
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-400 font-medium">Global Faith Cinema</span>
            </div>

            {isSearchingDiscovered ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                <p className="text-sm font-medium text-zinc-200">
                  Searching Global Christian Network for authentic movies &amp; dramas...
                </p>
                <p className="text-xs text-zinc-500">
                  Indexing &amp; ranking verified faith films for KINGDOM+ Cinema
                </p>
              </div>
            ) : discoveredMovies.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {discoveredMovies.map((video) => (
                  <div key={video.id} className="relative group">
                    <VideoCard
                      video={video}
                      onSelect={(v) => {
                        onSelectVideo(v);
                        if (onDiscoveredVideoSelected) onDiscoveredVideoSelected(v);
                      }}
                      isSaved={savedVideoIds.includes(video.id)}
                      onToggleSave={onToggleSave}
                    />
                    <div className="absolute top-2 left-2 pointer-events-none px-2 py-0.5 rounded bg-black/85 border border-amber-500/40 text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                      KINGDOM+ Discovery
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 py-4 text-center">
                No external Christian movies found for this filter. Try selecting another genre above.
              </p>
            )}
          </section>
        )}

        {/* Global Christian Search Section */}
        <GlobalChristianSearchSection
          localVideos={allMovieVideos}
          savedVideoIds={savedVideoIds}
          onSelectVideo={onSelectVideo}
          onToggleSave={onToggleSave}
          onSelectChannel={(chId) => setSelectedStudioId(chId)}
          onDiscoveredVideoSelected={onDiscoveredVideoSelected}
          initialCategoryScope="movies"
        />

        {/* Search, Category Filter & High-Impression Sort Controls */}
        <section className="p-4 rounded-xl bg-[#121215] border border-zinc-800/90 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <form onSubmit={handleCustomMovieSearch} className="relative flex-1 max-w-md flex items-center">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Christian movies, Mount Zion films, Bible stories..."
              className="w-full pl-10 pr-24 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="absolute right-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors"
            >
              Explore
            </button>
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 mr-1 shrink-0" />
            {[
              { id: 'high_impression_recent', label: 'Recent & High Impression' },
              { id: 'most_viewed', label: 'Most Viewed Blockbusters' },
              { id: 'highest_engagement', label: 'Highest Engagement' },
              { id: 'newest', label: 'Newest Releases' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSortLens(item.id as MovieSortLens)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sortLens === item.id
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* Official Film & Animation Studios Filter Bar */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Official Christian Movie & Animation Studios
            </span>
            {selectedStudioId && (
              <button
                type="button"
                onClick={() => setSelectedStudioId(null)}
                className="text-xs text-amber-400 hover:underline"
              >
                Clear Studio Filter
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setSelectedStudioId(null)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                selectedStudioId === null
                  ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              All Studios ({allMovieVideos.length})
            </button>
            {movieStudios.map((studio) => {
              const isSelected = selectedStudioId === studio.id;
              return (
                <button
                  key={studio.id}
                  type="button"
                  onClick={() => setSelectedStudioId(isSelected ? null : studio.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <img
                    src={getOptimizedAvatarUrl(studio.avatar_url, isDataSaverActive)}
                    alt={studio.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover bg-zinc-800"
                  />
                  <span>{studio.title.split('(')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filtered View vs Full Dedicated Movie Category Rails */}
        <div ref={resultsSectionRef} />
        {selectedCategorySlug !== 'all' || selectedStudioId !== null || searchQuery.trim() !== '' ? (
          <section className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-400 font-medium">Filtered Cinema Catalog</p>
                <h2 className="font-display text-2xl font-semibold text-zinc-50">
                  {selectedCategorySlug !== 'all'
                    ? movieCategories.find((c) => c.slug === selectedCategorySlug)?.name
                    : 'Selected Movies & Animations'}{' '}
                  ({filteredMovies.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategorySlug('all');
                  setSelectedStudioId(null);
                  setSearchQuery('');
                }}
                className="text-xs text-amber-400 hover:underline"
              >
                Show All Cinema Rails
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredMovies.slice(0, visibleMovieCount).map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onSelect={onSelectVideo}
                  isSaved={savedVideoIds.includes(video.id)}
                  onToggleSave={onToggleSave}
                  onSelectChannel={(chId) => setSelectedStudioId(chId)}
                />
              ))}
            </div>
            {filteredMovies.length > visibleMovieCount && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMovieCount((c) => c + (isDataSaverActive ? 12 : 24))
                  }
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 text-xs font-semibold"
                >
                  Load More Movies ({Math.min(visibleMovieCount, filteredMovies.length)} of {filteredMovies.length})
                </button>
              </div>
            )}
          </section>
        ) : (
          <div className="flex flex-col gap-8 sm:gap-10">
            {/* NIGERIAN CHRISTIAN MOVIES & FAITH DRAMA SPOTLIGHT */}
            {nigerianChristianCinema.length > 0 && (
              <section className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                    Trending Nigerian Christian Movies
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedCategorySlug('real-christian-movies')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400"
                  >
                    <span>See All</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  {nigerianChristianCinema.slice(0, 8).map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onSelect={onSelectVideo}
                      isSaved={savedVideoIds.includes(video.id)}
                      onToggleSave={onToggleSave}
                      onSelectChannel={(chId) => setSelectedStudioId(chId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* DEDICATED RAILS FOR EACH OF THE 4 MOVIE CATEGORIES */}
            {movieCategories.map((cat) => {
              const catVideos = sortMoviesByLens(
                allMovieVideos.filter(
                  (v) =>
                    v.primary_category_slug === cat.slug ||
                    v.secondary_category_slugs.includes(cat.slug)
                ),
                sortLens
              );

              if (catVideos.length === 0) return null;

              return (
                <section key={cat.id} className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                      {cat.name}{' '}
                      <span className="text-sm font-mono text-zinc-400 font-normal">
                        ({catVideos.length})
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategorySlug(cat.slug);
                        setVisibleMovieCount(24);
                        window.scrollTo(0, 320);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 whitespace-nowrap shrink-0"
                    >
                      <span>See All</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {catVideos.slice(0, 8).map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onSelect={onSelectVideo}
                        isSaved={savedVideoIds.includes(video.id)}
                        onToggleSave={onToggleSave}
                        onSelectChannel={(chId) => setSelectedStudioId(chId)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
