import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronRight,
  Compass,
  Film,
  Flame,
  Heart,
  Loader2,
  Play,
  Search,
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

export const ChristianMoviesView: React.FC<ChristianMoviesViewProps> = ({
  categories,
  channels,
  videos,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onDiscoveredVideoSelected,
}) => {
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string>('all');
  const [sortLens, setSortLens] = useState<MovieSortLens>('high_impression_recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);

  // Beyond-library YouTube movie discovery state
  const [discoveredMovies, setDiscoveredMovies] = useState<KingdomVideo[]>([]);
  const [isSearchingDiscovered, setIsSearchingDiscovered] = useState(false);
  const [discoveredSearchLabel, setDiscoveredSearchLabel] = useState<string | null>(null);

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
    return videos.filter(
      (v) =>
        movieSlugSet.has(v.primary_category_slug) ||
        v.secondary_category_slugs.some((s) => movieSlugSet.has(s)) ||
        studioIds.has(v.channel_id)
    );
  }, [videos, movieStudios]);

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

  const heroMovies = useMemo(() => {
    return sortMoviesByLens(allMovieVideos, 'high_impression_recent').slice(0, 5);
  }, [allMovieVideos]);

  const currentHero = heroMovies[heroIndex] || heroMovies[0] || null;

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
        `/api/discovery/movies?genre=${encodeURIComponent(genreObj.queryTerm)}&query=${encodeURIComponent(
          searchQuery
        )}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.movies)) {
          setDiscoveredMovies(data.movies);
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

  const handleCustomMovieSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingDiscovered(true);
    const activeGenre = CHRISTIAN_MOVIE_GENRES.find((g) => g.id === selectedGenreId);
    const genreTerm = activeGenre && activeGenre.id !== 'all' ? activeGenre.queryTerm : '';
    setDiscoveredSearchLabel(searchQuery.trim());
    try {
      const res = await fetch(
        `/api/discovery/movies?genre=${encodeURIComponent(genreTerm)}&query=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.movies)) {
          setDiscoveredMovies(data.movies);
          return;
        }
      }
      setDiscoveredMovies(filterLocalMovies(genreTerm, searchQuery.trim()));
    } catch {
      setDiscoveredMovies(filterLocalMovies(genreTerm, searchQuery.trim()));
    } finally {
      setIsSearchingDiscovered(false);
    }
  };

  const handleClearDiscovered = () => {
    setDiscoveredMovies([]);
    setDiscoveredSearchLabel(null);
    setSelectedGenreId('all');
  };

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* ====================================================================
          CHRISTIAN MOVIES & BIBLE CINEMA HERO SPOTLIGHT
      ==================================================================== */}
      <section className="relative w-full min-h-[340px] sm:min-h-[440px] lg:min-h-[500px] border-b border-zinc-800/80 flex items-end overflow-hidden bg-zinc-950">
        <img
          src={
            currentHero
              ? currentHero.thumbnail_maxres_url
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
          className="absolute inset-0 w-full h-full object-cover opacity-50 scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/45 to-black/30" />

        <div className="relative z-10 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-7 sm:py-12 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-end">
          <div className="lg:col-span-8 min-w-0 w-full flex flex-col gap-3">
            <div className="flex items-center flex-wrap gap-2 text-[11px] sm:text-xs font-medium text-amber-400">
              <span>Christian Cinema</span>
              {currentHero && (
                <>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="text-zinc-200">{currentHero.primary_category_name}</span>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="text-zinc-300 truncate max-w-[180px] sm:max-w-none">{currentHero.channel_title}</span>
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
              </div>
            )}

            {currentHero && (
              <div className="flex items-center flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onSelectVideo(currentHero)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Watch Movie</span>
                </button>

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
              </div>
            )}
          </div>

          {/* Right 4 Columns: Top High-Impression Movie Lineup (Swipeable on mobile) */}
          {heroMovies.length > 1 && (
            <div className="lg:col-span-4 min-w-0 w-full flex flex-col gap-1.5 bg-black/55 backdrop-blur-md border border-zinc-800/80 rounded-xl p-2.5 sm:p-3.5">
              <div className="text-[11px] font-medium text-zinc-400 px-1 pb-0.5">
                Featured Movies ({heroIndex + 1}/{heroMovies.length})
              </div>
              <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar">
                {heroMovies.map((cand, idx) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setHeroIndex(idx)}
                    className={`min-w-[210px] sm:min-w-[240px] lg:min-w-0 lg:w-full text-left p-2 rounded-lg transition-colors flex items-center gap-2.5 shrink-0 ${
                      idx === heroIndex
                        ? 'bg-amber-500/15 border border-amber-500/40'
                        : 'hover:bg-zinc-900/70 border border-transparent'
                    }`}
                  >
                    <img
                      src={cand.thumbnail_high_url}
                      alt={cand.title}
                      referrerPolicy="no-referrer"
                      className="w-14 aspect-video rounded object-cover bg-zinc-900 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-zinc-100 truncate">{cand.title}</div>
                      <div className="text-[11px] text-zinc-400 truncate font-mono tabular-nums">
                        {formatCompactNumber(cand.view_count)} views
                      </div>
                    </div>
                  </button>
                ))}
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
                    <div className="absolute top-2 left-2 pointer-events-none px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-amber-500/40 text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
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
                    src={studio.avatar_url}
                    alt={studio.title}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredMovies.map((video) => (
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
                        window.scrollTo({ top: 320, behavior: 'smooth' });
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
