import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Music,
  Play,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  KingdomChannel,
  KingdomVideo,
  WorshipSubcategoryConfig,
  WorshipSubcategorySlug,
} from '../types/kingdom.ts';
import { formatCompactNumber } from '../utils/formatters.ts';
import { VideoCard } from './VideoCard.tsx';

interface WorshipPraiseSanctuaryViewProps {
  videos: KingdomVideo[];
  channels: KingdomChannel[];
  worshipSubcategories: WorshipSubcategoryConfig[];
  savedVideoIds: string[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onSelectChannel?: (channelId: string) => void;
}

type WorshipSortMode =
  | 'most_popular'
  | 'trending_momentum'
  | 'verified_engagement'
  | 'newest_releases';

type ArtistRegionFilter = 'all' | 'nigerian' | 'international';

const DEFAULT_WORSHIP_SUBCATEGORIES: WorshipSubcategoryConfig[] = [
  {
    slug: 'deep-worship',
    name: 'Deep Worship',
    subtitle: 'Intimate altar worship and soaking sessions',
    display_order: 1,
    is_active: true,
  },
  {
    slug: 'high-praise-celebration',
    name: 'High Praise & Celebration',
    subtitle: 'Joyful praise medleys and celebration anthems',
    display_order: 2,
    is_active: true,
  },
  {
    slug: 'prayer-spiritual-warfare-worship',
    name: 'Prayer & Spiritual Warfare',
    subtitle: 'Prophetic chants and warfare worship',
    display_order: 3,
    is_active: true,
  },
  {
    slug: 'spontaneous-worship',
    name: 'Spontaneous Worship',
    subtitle: 'Unscripted prophetic worship moments',
    display_order: 4,
    is_active: true,
  },
  {
    slug: 'live-worship-sessions',
    name: 'Live Worship Sessions',
    subtitle: 'Full live recordings and worship nights',
    display_order: 5,
    is_active: true,
  },
  {
    slug: 'thanksgiving-songs',
    name: 'Thanksgiving Songs',
    subtitle: 'Songs of gratitude and testimony',
    display_order: 6,
    is_active: true,
  },
  {
    slug: 'classic-gospel-hits',
    name: 'Classic Gospel Hits',
    subtitle: 'Timeless evergreen gospel classics',
    display_order: 7,
    is_active: true,
  },
  {
    slug: 'new-trending-gospel',
    name: 'New & Trending Gospel Songs',
    subtitle: 'Recent high-velocity worship releases',
    display_order: 8,
    is_active: true,
  },
  {
    slug: 'international-worship',
    name: 'International Worship',
    subtitle: 'Global worship anthems',
    display_order: 9,
    is_active: true,
  },
  {
    slug: 'nigerian-gospel',
    name: 'Nigerian Gospel',
    subtitle: 'Nigerian gospel worship and praise',
    display_order: 10,
    is_active: true,
  },
];

export const WorshipPraiseSanctuaryView: React.FC<WorshipPraiseSanctuaryViewProps> = ({
  videos,
  channels,
  worshipSubcategories,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onSelectChannel,
}) => {
  const [worshipSearchQuery, setWorshipSearchQuery] = useState('');
  const [selectedArtistChannelId, setSelectedArtistChannelId] = useState<string | null>(null);
  const [artistRegionFilter, setArtistRegionFilter] = useState<ArtistRegionFilter>('all');
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<
    'all' | WorshipSubcategorySlug
  >('all');
  const [sortMode, setSortMode] = useState<WorshipSortMode>('most_popular');
  const [showAllArtistsGrid, setShowAllArtistsGrid] = useState(false);

  const activeSubcategories = useMemo(() => {
    const source =
      worshipSubcategories.length > 0 ? worshipSubcategories : DEFAULT_WORSHIP_SUBCATEGORIES;
    return [...source]
      .filter((s) => s.is_active !== false)
      .sort((a, b) => a.display_order - b.display_order);
  }, [worshipSubcategories]);

  // All 36 Approved Worship & Praise Artists ordered 1..36
  const approvedArtists = useMemo(() => {
    const worshipChannelIdsWithVideos = new Set(
      videos
        .filter((v) => v.primary_category_slug === 'worship-praise')
        .map((v) => v.channel_id)
    );
    return channels
      .filter(
        (ch) =>
          ch.is_approved_worship_artist || worshipChannelIdsWithVideos.has(ch.id)
      )
      .sort((a, b) => (a.worship_artist_order ?? 999) - (b.worship_artist_order ?? 999));
  }, [channels, videos]);

  const approvedArtistChannelIds = useMemo(
    () => new Set(approvedArtists.map((a) => a.id)),
    [approvedArtists]
  );

  // Strictly only Worship & Praise videos from the 36 Approved Artists
  const worshipCatalogVideos = useMemo(() => {
    return videos.filter(
      (v) =>
        v.primary_category_slug === 'worship-praise' &&
        (approvedArtistChannelIds.size === 0 || approvedArtistChannelIds.has(v.channel_id))
    );
  }, [videos, approvedArtistChannelIds]);

  // Per-artist statistics inside Worship & Praise
  const artistStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { songCount: number; totalViews: number; topVideo: KingdomVideo | null }
    >();
    for (const artist of approvedArtists) {
      map.set(artist.id, { songCount: 0, totalViews: 0, topVideo: null });
    }
    for (const v of worshipCatalogVideos) {
      const current = map.get(v.channel_id) || {
        songCount: 0,
        totalViews: 0,
        topVideo: null,
      };
      current.songCount += 1;
      current.totalViews += v.view_count;
      if (!current.topVideo || v.view_count > current.topVideo.view_count) {
        current.topVideo = v;
      }
      map.set(v.channel_id, current);
    }
    return map;
  }, [approvedArtists, worshipCatalogVideos]);

  const filteredArtistsForDirectory = useMemo(() => {
    return approvedArtists.filter((artist) => {
      if (artistRegionFilter === 'nigerian' && !artist.is_nigerian) return false;
      if (artistRegionFilter === 'international' && artist.is_nigerian) return false;
      return true;
    });
  }, [approvedArtists, artistRegionFilter]);

  const selectedArtist = useMemo(
    () => approvedArtists.find((a) => a.id === selectedArtistChannelId) || null,
    [approvedArtists, selectedArtistChannelId]
  );

  // Sort helper
  const sortWorshipVideos = (list: KingdomVideo[]): KingdomVideo[] => {
    const copy = [...list];
    if (sortMode === 'most_popular') {
      return copy.sort((a, b) => b.view_count - a.view_count);
    }
    if (sortMode === 'trending_momentum') {
      return copy.sort((a, b) => b.views_per_day - a.views_per_day);
    }
    if (sortMode === 'verified_engagement') {
      return copy.sort((a, b) => {
        const aVerified = a.likes_verified !== false && a.like_count > 0 ? 1 : 0;
        const bVerified = b.likes_verified !== false && b.like_count > 0 ? 1 : 0;
        if (aVerified !== bVerified) return bVerified - aVerified;
        if (b.like_count !== a.like_count) return b.like_count - a.like_count;
        return b.view_count - a.view_count;
      });
    }
    return copy.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  };

  // Filtered Worship & Praise videos
  const filteredWorshipVideos = useMemo(() => {
    let list = worshipCatalogVideos;

    if (selectedArtistChannelId) {
      list = list.filter((v) => v.channel_id === selectedArtistChannelId);
    } else if (artistRegionFilter === 'nigerian') {
      list = list.filter(
        (v) =>
          v.is_nigerian_channel || v.worship_subcategories?.includes('nigerian-gospel')
      );
    } else if (artistRegionFilter === 'international') {
      list = list.filter(
        (v) =>
          !v.is_nigerian_channel ||
          v.worship_subcategories?.includes('international-worship')
      );
    }

    if (selectedSubcategorySlug !== 'all') {
      list = list.filter((v) =>
        v.worship_subcategories?.includes(selectedSubcategorySlug)
      );
    }

    if (worshipSearchQuery.trim()) {
      const q = worshipSearchQuery.trim().toLowerCase();
      list = list.filter((v) => {
        const artistName = (v.artist_name || v.channel_title || '').toLowerCase();
        const title = v.title.toLowerCase();
        const subLabel = (v.subcategory_label || '').toLowerCase();
        return (
          title.includes(q) ||
          artistName.includes(q) ||
          v.channel_title.toLowerCase().includes(q) ||
          subLabel.includes(q)
        );
      });
    }

    return sortWorshipVideos(list);
  }, [
    worshipCatalogVideos,
    selectedArtistChannelId,
    artistRegionFilter,
    selectedSubcategorySlug,
    worshipSearchQuery,
    sortMode,
  ]);

  const nigerianArtistsCount = approvedArtists.filter((a) => a.is_nigerian).length;
  const internationalArtistsCount = approvedArtists.filter((a) => !a.is_nigerian).length;

  const isFilteringActive =
    Boolean(worshipSearchQuery.trim()) ||
    selectedArtistChannelId !== null ||
    selectedSubcategorySlug !== 'all' ||
    artistRegionFilter !== 'all';

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ====================================================================
          1. COMPACT WORSHIP & PRAISE HEADER, SEARCH & FILTER BAR
      ==================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#121215] border border-zinc-800/90 flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-zinc-800/80 pb-4">
          <div className="flex items-baseline justify-between md:justify-start gap-3">
            <h2 className="font-display text-xl sm:text-3xl font-semibold text-zinc-50 tracking-tight">
              Worship &amp; Praise
            </h2>
            <span className="text-xs font-mono tabular-nums text-amber-400">
              {approvedArtists.length} Artists · {worshipCatalogVideos.length} Songs
            </span>
          </div>

          {/* Dedicated Worship & Praise Search */}
          <div className="w-full md:w-[380px] relative shrink-0">
            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={worshipSearchQuery}
              onChange={(e) => setWorshipSearchQuery(e.target.value)}
              placeholder="Search artist, song title, or worship group..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
            {worshipSearchQuery && (
              <button
                type="button"
                onClick={() => setWorshipSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ==================================================================
            2. ARTIST DISCOVERY (36 APPROVED ARTISTS — MOBILE SWIPEABLE)
        ================================================================== */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs sm:text-sm font-semibold text-zinc-100">
                Worship Artists
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: 'all', label: `All (${approvedArtists.length})` },
                { id: 'nigerian', label: `Nigerian (${nigerianArtistsCount})` },
                { id: 'international', label: `International (${internationalArtistsCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setArtistRegionFilter(tab.id as ArtistRegionFilter);
                    setSelectedArtistChannelId(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    artistRegionFilter === tab.id
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowAllArtistsGrid((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800 transition-colors whitespace-nowrap"
              >
                {showAllArtistsGrid ? 'Strip View' : 'View All 36'}
              </button>
            </div>
          </div>

          <div
            className={
              showAllArtistsGrid
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-0.5'
                : 'flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5'
            }
          >
            <button
              type="button"
              onClick={() => setSelectedArtistChannelId(null)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap shrink-0 flex flex-col justify-center items-start gap-0.5 min-h-[48px] ${
                selectedArtistChannelId === null
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                  : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <span>All 36 Artists</span>
              <span className="text-[10px] font-mono text-zinc-400">
                {worshipCatalogVideos.length} songs
              </span>
            </button>

            {filteredArtistsForDirectory.map((artist) => {
              const stats = artistStatsMap.get(artist.id) || {
                songCount: 0,
                totalViews: 0,
                topVideo: null,
              };
              const isSelected = selectedArtistChannelId === artist.id;
              const displayName = artist.speaker_name || artist.title;
              const avatarSrc =
                artist.avatar_url ||
                stats.topVideo?.thumbnail_high_url ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=240&auto=format&fit=crop&q=80';

              return (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() =>
                    setSelectedArtistChannelId(isSelected ? null : artist.id)
                  }
                  className={`p-2 rounded-xl border transition-all flex items-center gap-2.5 text-left shrink-0 min-h-[48px] ${
                    showAllArtistsGrid ? 'w-full' : 'min-w-[175px] sm:min-w-[200px]'
                  } ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-zinc-50 shadow-md'
                      : 'bg-zinc-900/75 border-zinc-800/90 hover:border-zinc-700 text-zinc-200'
                  }`}
                >
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover bg-zinc-800 shrink-0 border border-zinc-700/70"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-100 truncate">
                      {displayName}
                    </div>
                    <div className="text-[10px] font-mono tabular-nums text-zinc-400 truncate">
                      {stats.songCount} songs · {formatCompactNumber(stats.totalViews)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================================================================
            3. THE 10 WORSHIP SUBCATEGORIES (SWIPEABLE ON MOBILE) + SORT BAR
        ================================================================== */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-zinc-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedSubcategorySlug('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedSubcategorySlug === 'all'
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 hover:text-zinc-100 border border-zinc-800'
              }`}
            >
              All 10 Subcategories ({worshipCatalogVideos.length})
            </button>

            {activeSubcategories.map((sub) => {
              const count = worshipCatalogVideos.filter((v) => {
                if (selectedArtistChannelId && v.channel_id !== selectedArtistChannelId) {
                  return false;
                }
                return v.worship_subcategories?.includes(sub.slug);
              }).length;

              return (
                <button
                  key={sub.slug}
                  type="button"
                  onClick={() =>
                    setSelectedSubcategorySlug(
                      selectedSubcategorySlug === sub.slug ? 'all' : sub.slug
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedSubcategorySlug === sub.slug
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-300 hover:text-zinc-100 border border-zinc-800'
                  }`}
                >
                  {sub.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 mr-1 shrink-0" />
            {[
              { id: 'most_popular', label: 'Most Popular' },
              { id: 'trending_momentum', label: 'Trending' },
              { id: 'verified_engagement', label: 'Most Liked' },
              { id: 'newest_releases', label: 'Newest' },
            ].map((sm) => (
              <button
                key={sm.id}
                type="button"
                onClick={() => setSortMode(sm.id as WorshipSortMode)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  sortMode === sm.id
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {sm.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          SELECTED ARTIST SPOTLIGHT COMPACT BAR
      ==================================================================== */}
      {selectedArtist && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121215] border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={
                selectedArtist.avatar_url ||
                artistStatsMap.get(selectedArtist.id)?.topVideo?.thumbnail_high_url ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=240&auto=format&fit=crop&q=80'
              }
              alt={selectedArtist.speaker_name || selectedArtist.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover bg-zinc-800 border-2 border-amber-400 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50 truncate">
                {selectedArtist.speaker_name || selectedArtist.title}
              </h3>
              <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
                <span className="text-amber-400">
                  {artistStatsMap.get(selectedArtist.id)?.songCount || 0} songs
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatCompactNumber(
                    artistStatsMap.get(selectedArtist.id)?.totalViews || 0
                  )}{' '}
                  views
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto shrink-0">
            {artistStatsMap.get(selectedArtist.id)?.topVideo && (
              <button
                type="button"
                onClick={() => {
                  const top = artistStatsMap.get(selectedArtist.id)?.topVideo;
                  if (top) onSelectVideo(top);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors flex-1 sm:flex-initial"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Top Song</span>
              </button>
            )}

            {onSelectChannel && (
              <button
                type="button"
                onClick={() => onSelectChannel(selectedArtist.id)}
                className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
              >
                Profile
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedArtistChannelId(null)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          4. MAIN CONTENT DISPLAY: FILTERED RESULTS OR 10 SUBCATEGORY RAILS
      ==================================================================== */}
      {isFilteringActive ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50 truncate">
              {selectedArtist
                ? `${selectedArtist.speaker_name || selectedArtist.title}`
                : selectedSubcategorySlug !== 'all'
                ? activeSubcategories.find((s) => s.slug === selectedSubcategorySlug)?.name
                : worshipSearchQuery.trim()
                ? `"${worshipSearchQuery}"`
                : artistRegionFilter === 'nigerian'
                ? 'Nigerian Gospel Artists'
                : 'International Worship'}{' '}
              <span className="text-sm font-mono text-zinc-400 font-normal">
                ({filteredWorshipVideos.length})
              </span>
            </h3>

            <button
              type="button"
              onClick={() => {
                setWorshipSearchQuery('');
                setSelectedArtistChannelId(null);
                setSelectedSubcategorySlug('all');
                setArtistRegionFilter('all');
              }}
              className="text-xs text-amber-400 hover:underline shrink-0"
            >
              Reset Filters
            </button>
          </div>

          {filteredWorshipVideos.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-[#121215] border border-zinc-800 text-center flex flex-col items-center gap-3">
              <Music className="w-7 h-7 text-amber-400" />
              <div className="text-sm font-semibold text-zinc-200">
                No matching songs found
              </div>
              <button
                type="button"
                onClick={() => {
                  setWorshipSearchQuery('');
                  setSelectedArtistChannelId(null);
                  setSelectedSubcategorySlug('all');
                  setArtistRegionFilter('all');
                }}
                className="mt-1 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold"
              >
                Show All Songs
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredWorshipVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onSelect={onSelectVideo}
                  isSaved={savedVideoIds.includes(video.id)}
                  onToggleSave={onToggleSave}
                  onSelectChannel={(chId) => setSelectedArtistChannelId(chId)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8 sm:gap-10">
          {/* 10 CURATED SUBCATEGORY RAILS — CLEAN HEADINGS WITHOUT WORDY SUBTITLES */}
          {activeSubcategories.map((sub) => {
            const subVideos = sortWorshipVideos(
              worshipCatalogVideos.filter((v) =>
                v.worship_subcategories?.includes(sub.slug)
              )
            );
            if (subVideos.length === 0) return null;

            return (
              <section key={sub.slug} className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                    {sub.name}{' '}
                    <span className="text-sm font-mono text-zinc-400 font-normal">
                      ({subVideos.length})
                    </span>
                  </h3>

                  <button
                    type="button"
                    onClick={() => setSelectedSubcategorySlug(sub.slug)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                  >
                    <span>See All</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  {subVideos.slice(0, 8).map((video) => (
                    <VideoCard
                      key={`${sub.slug}-${video.id}`}
                      video={video}
                      onSelect={onSelectVideo}
                      isSaved={savedVideoIds.includes(video.id)}
                      onToggleSave={onToggleSave}
                      onSelectChannel={(chId) => setSelectedArtistChannelId(chId)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
