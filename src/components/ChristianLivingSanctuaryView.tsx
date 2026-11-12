import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Play,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  ChristianLivingSubcategoryConfig,
  ChristianLivingSubcategorySlug,
  KingdomChannel,
  KingdomVideo,
} from '../types/kingdom.ts';
import { formatCompactNumber } from '../utils/formatters.ts';
import { VideoCard } from './VideoCard.tsx';

interface ChristianLivingSanctuaryViewProps {
  videos: KingdomVideo[];
  channels: KingdomChannel[];
  christianLivingSubcategories: ChristianLivingSubcategoryConfig[];
  savedVideoIds: string[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onSelectChannel?: (channelId: string) => void;
}

type ChristianLivingSortMode =
  | 'smart_rank'
  | 'most_watched'
  | 'trending_recent'
  | 'timeless_evergreen'
  | 'recently_added';

type MinisterGroupFilter = 'all' | 'nigerian_ministers' | 'female_and_international';

const DEFAULT_CHRISTIAN_LIVING_SUBCATEGORIES: ChristianLivingSubcategoryConfig[] = [
  {
    slug: 'personal-growth-spiritual-development',
    name: 'Personal Growth & Spiritual Development',
    subtitle: 'Spiritual maturity, discipline, and mind renewal',
    display_order: 1,
    is_active: true,
  },
  {
    slug: 'family-and-parenting',
    name: 'Family & Parenting',
    subtitle: 'Raising godly children and family values',
    display_order: 2,
    is_active: true,
  },
  {
    slug: 'christian-finances-and-wealth',
    name: 'Christian Finances & Wealth',
    subtitle: 'Kingdom stewardship and financial wisdom',
    display_order: 3,
    is_active: true,
  },
  {
    slug: 'purpose-career-and-destiny',
    name: 'Purpose, Career & Destiny',
    subtitle: 'Discovering purpose, leadership, and career excellence',
    display_order: 4,
    is_active: true,
  },
  {
    slug: 'christian-youth-and-young-adults',
    name: 'Christian Youth & Young Adults',
    subtitle: 'Purpose, focus, and thriving in youth',
    display_order: 5,
    is_active: true,
  },
  {
    slug: 'faith-in-everyday-life',
    name: 'Faith in Everyday Life',
    subtitle: 'Practical faith for daily life and peace of mind',
    display_order: 6,
    is_active: true,
  },
  {
    slug: 'christian-character-and-values',
    name: 'Christian Character & Values',
    subtitle: 'Integrity, humility, forgiveness, and honour',
    display_order: 7,
    is_active: true,
  },
  {
    slug: 'christian-womanhood',
    name: 'Christian Womanhood',
    subtitle: 'Wisdom, identity, and grace for Christian women',
    display_order: 8,
    is_active: true,
  },
  {
    slug: 'christian-manhood',
    name: 'Christian Manhood',
    subtitle: 'Leadership, vision, and responsibility for men',
    display_order: 9,
    is_active: true,
  },
  {
    slug: 'friendship-and-social-life',
    name: 'Friendship & Social Life',
    subtitle: 'Godly friendships, discernment, and boundaries',
    display_order: 10,
    is_active: true,
  },
  {
    slug: 'christianity-in-modern-society',
    name: 'Christianity in Modern Society',
    subtitle: 'Living out Christian values in modern culture',
    display_order: 11,
    is_active: true,
  },
];

export const ChristianLivingSanctuaryView: React.FC<ChristianLivingSanctuaryViewProps> = ({
  videos,
  channels,
  christianLivingSubcategories,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onSelectChannel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMinisterId, setSelectedMinisterId] = useState<string | null>(null);
  const [ministerGroupFilter, setMinisterGroupFilter] = useState<MinisterGroupFilter>('all');
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<
    'all' | ChristianLivingSubcategorySlug
  >('all');
  const [sortMode, setSortMode] = useState<ChristianLivingSortMode>('smart_rank');
  const [showAllMinistersGrid, setShowAllMinistersGrid] = useState(false);

  const activeSubcategories = useMemo(() => {
    const src =
      christianLivingSubcategories.length > 0
        ? christianLivingSubcategories
        : DEFAULT_CHRISTIAN_LIVING_SUBCATEGORIES;
    return [...src]
      .filter((s) => s.is_active !== false)
      .sort((a, b) => a.display_order - b.display_order);
  }, [christianLivingSubcategories]);

  // All 20 Approved Christian Living Ministers ordered 1..20
  const approvedMinisters = useMemo(() => {
    const clChannelIdsWithVideos = new Set(
      videos
        .filter((v) => v.primary_category_slug === 'christian-living')
        .map((v) => v.channel_id)
    );
    return channels
      .filter(
        (ch) =>
          ch.is_approved_christian_living_minister || clChannelIdsWithVideos.has(ch.id)
      )
      .sort(
        (a, b) =>
          (a.christian_living_minister_order ?? 999) -
          (b.christian_living_minister_order ?? 999)
      );
  }, [channels, videos]);

  const approvedMinisterIds = useMemo(
    () => new Set(approvedMinisters.map((m) => m.id)),
    [approvedMinisters]
  );

  // Strictly only Christian Living teachings from the 20 Approved Ministers
  const christianLivingCatalogVideos = useMemo(() => {
    return videos.filter(
      (v) =>
        v.primary_category_slug === 'christian-living' &&
        (approvedMinisterIds.size === 0 || approvedMinisterIds.has(v.channel_id))
    );
  }, [videos, approvedMinisterIds]);

  // Per-minister stats in Christian Living
  const ministerStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { teachingCount: number; totalViews: number; topVideo: KingdomVideo | null }
    >();
    for (const m of approvedMinisters) {
      map.set(m.id, { teachingCount: 0, totalViews: 0, topVideo: null });
    }
    for (const v of christianLivingCatalogVideos) {
      const cur = map.get(v.channel_id) || {
        teachingCount: 0,
        totalViews: 0,
        topVideo: null,
      };
      cur.teachingCount += 1;
      cur.totalViews += v.view_count;
      if (!cur.topVideo || v.view_count > cur.topVideo.view_count) {
        cur.topVideo = v;
      }
      map.set(v.channel_id, cur);
    }
    return map;
  }, [approvedMinisters, christianLivingCatalogVideos]);

  const filteredMinistersForDirectory = useMemo(() => {
    return approvedMinisters.filter((m) => {
      const order = m.christian_living_minister_order ?? 1;
      if (ministerGroupFilter === 'nigerian_ministers') {
        return order <= 14;
      }
      if (ministerGroupFilter === 'female_and_international') {
        return order >= 15 || m.speaker_gender === 'female' || !m.is_nigerian;
      }
      return true;
    });
  }, [approvedMinisters, ministerGroupFilter]);

  const selectedMinister = useMemo(
    () => approvedMinisters.find((m) => m.id === selectedMinisterId) || null,
    [approvedMinisters, selectedMinisterId]
  );

  // Sort helper
  const sortTeachings = (list: KingdomVideo[]): KingdomVideo[] => {
    const copy = [...list];
    if (sortMode === 'smart_rank') {
      return copy.sort(
        (a, b) =>
          (b.christian_living_score ?? b.trending_score) -
          (a.christian_living_score ?? a.trending_score)
      );
    }
    if (sortMode === 'most_watched') {
      return copy.sort((a, b) => b.view_count - a.view_count);
    }
    if (sortMode === 'trending_recent') {
      return copy.sort((a, b) => {
        const aRecent = new Date(a.published_at).getFullYear() >= 2025 ? 1 : 0;
        const bRecent = new Date(b.published_at).getFullYear() >= 2025 ? 1 : 0;
        if (aRecent !== bRecent) return bRecent - aRecent;
        return b.views_per_day - a.views_per_day;
      });
    }
    if (sortMode === 'timeless_evergreen') {
      return copy.sort((a, b) => {
        const aOld = new Date(a.published_at).getFullYear() <= 2024 ? 1 : 0;
        const bOld = new Date(b.published_at).getFullYear() <= 2024 ? 1 : 0;
        if (aOld !== bOld) return bOld - aOld;
        return b.evergreen_score - a.evergreen_score;
      });
    }
    return copy.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  };

  // Filtered Christian Living teachings
  const filteredTeachings = useMemo(() => {
    let list = christianLivingCatalogVideos;

    if (selectedMinisterId) {
      list = list.filter((v) => v.channel_id === selectedMinisterId);
    } else if (ministerGroupFilter === 'nigerian_ministers') {
      const ids = new Set(
        approvedMinisters
          .filter((m) => (m.christian_living_minister_order ?? 1) <= 14)
          .map((m) => m.id)
      );
      list = list.filter((v) => ids.has(v.channel_id));
    } else if (ministerGroupFilter === 'female_and_international') {
      const ids = new Set(
        approvedMinisters
          .filter(
            (m) =>
              (m.christian_living_minister_order ?? 1) >= 15 ||
              m.speaker_gender === 'female' ||
              !m.is_nigerian
          )
          .map((m) => m.id)
      );
      list = list.filter((v) => ids.has(v.channel_id));
    }

    if (selectedSubcategorySlug !== 'all') {
      list = list.filter((v) =>
        v.christian_living_subcategories?.includes(selectedSubcategorySlug)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((v) => {
        const ministerName = (v.artist_name || v.channel_title || '').toLowerCase();
        const title = v.title.toLowerCase();
        const subLabel = (v.subcategory_label || '').toLowerCase();
        return (
          title.includes(q) ||
          ministerName.includes(q) ||
          v.channel_title.toLowerCase().includes(q) ||
          subLabel.includes(q)
        );
      });
    }

    return sortTeachings(list);
  }, [
    christianLivingCatalogVideos,
    selectedMinisterId,
    ministerGroupFilter,
    selectedSubcategorySlug,
    searchQuery,
    sortMode,
    approvedMinisters,
  ]);

  // 6 Featured Sections
  const featuredSections = useMemo(() => {
    const usedIds = new Set<string>();
    const pickUnique = (
      pool: KingdomVideo[],
      count: number,
      sortFn: (a: KingdomVideo, b: KingdomVideo) => number
    ) => {
      const sorted = [...pool].filter((v) => !usedIds.has(v.id)).sort(sortFn);
      const picked = sorted.slice(0, count);
      for (const item of picked) usedIds.add(item.id);
      return picked;
    };

    const mostWatched = pickUnique(
      christianLivingCatalogVideos,
      4,
      (a, b) => b.view_count - a.view_count
    );

    const trendingTeachings = pickUnique(
      christianLivingCatalogVideos,
      4,
      (a, b) => b.views_per_day - a.views_per_day
    );

    const timelessWisdom = pickUnique(
      christianLivingCatalogVideos.filter(
        (v) => new Date(v.published_at).getFullYear() <= 2024
      ),
      4,
      (a, b) => b.evergreen_score - a.evergreen_score
    );

    const recentlyAdded = pickUnique(
      christianLivingCatalogVideos,
      4,
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    const recommendedForGrowth = pickUnique(
      christianLivingCatalogVideos,
      4,
      (a, b) =>
        (b.christian_living_score ?? b.trending_score) -
        (a.christian_living_score ?? a.trending_score)
    );

    return {
      mostWatched,
      trendingTeachings,
      timelessWisdom,
      recentlyAdded,
      recommendedForGrowth,
    };
  }, [christianLivingCatalogVideos]);

  const isFilteringActive =
    Boolean(searchQuery.trim()) ||
    selectedMinisterId !== null ||
    selectedSubcategorySlug !== 'all' ||
    ministerGroupFilter !== 'all' ||
    sortMode !== 'smart_rank';

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ====================================================================
          1. COMPACT MOBILE-FIRST HEADER, SEARCH, MINISTERS & 11 SUBCATEGORIES
      ==================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#121215] border border-zinc-800/90 flex flex-col gap-4 sm:gap-5">
        {/* Title + Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-zinc-800/80 pb-4">
          <div className="flex items-baseline justify-between md:justify-start gap-3">
            <h2 className="font-display text-xl sm:text-3xl font-semibold text-zinc-50 tracking-tight">
              Christian Living
            </h2>
            <span className="text-xs font-mono tabular-nums text-amber-400">
              {approvedMinisters.length} Ministers · {christianLivingCatalogVideos.length} Teachings
            </span>
          </div>

          {/* Search within Christian Living */}
          <div className="w-full md:w-[380px] relative shrink-0">
            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search minister or topic (purpose, finances, faith)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ==================================================================
            2. POPULAR MINISTERS (20 APPROVED MINISTERS — MOBILE SWIPEABLE)
        ================================================================== */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs sm:text-sm font-semibold text-zinc-100">
                Popular Ministers
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: 'all', label: `All (${approvedMinisters.length})` },
                { id: 'nigerian_ministers', label: 'Nigerian (14)' },
                { id: 'female_and_international', label: "Female & Int'l (6)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMinisterGroupFilter(tab.id as MinisterGroupFilter);
                    setSelectedMinisterId(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    ministerGroupFilter === tab.id
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowAllMinistersGrid((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800 transition-colors whitespace-nowrap"
              >
                {showAllMinistersGrid ? 'Strip View' : 'View All 20'}
              </button>
            </div>
          </div>

          <div
            className={
              showAllMinistersGrid
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-0.5'
                : 'flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5'
            }
          >
            <button
              type="button"
              onClick={() => setSelectedMinisterId(null)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap shrink-0 flex flex-col justify-center items-start gap-0.5 min-h-[48px] ${
                selectedMinisterId === null
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                  : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <span>All 20 Ministers</span>
              <span className="text-[10px] font-mono text-zinc-400">
                {christianLivingCatalogVideos.length} videos
              </span>
            </button>

            {filteredMinistersForDirectory.map((minister) => {
              const stats = ministerStatsMap.get(minister.id) || {
                teachingCount: 0,
                totalViews: 0,
                topVideo: null,
              };
              const isSelected = selectedMinisterId === minister.id;
              const displayName = minister.speaker_name || minister.title;
              const avatarSrc =
                minister.avatar_url ||
                stats.topVideo?.thumbnail_high_url ||
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80';

              return (
                <button
                  key={minister.id}
                  type="button"
                  onClick={() =>
                    setSelectedMinisterId(isSelected ? null : minister.id)
                  }
                  className={`p-2 rounded-xl border transition-all flex items-center gap-2.5 text-left shrink-0 min-h-[48px] ${
                    showAllMinistersGrid ? 'w-full' : 'min-w-[180px] sm:min-w-[205px]'
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
                      {stats.teachingCount} videos · {formatCompactNumber(stats.totalViews)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================================================================
            3. THE 11 SUBCATEGORIES (SWIPEABLE ON MOBILE) + SORT BAR
        ================================================================== */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-zinc-800/80">
          {/* 11 Subcategories Swipeable Strip on iPhone/Android, Wrap on Desktop */}
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
              All Topics ({christianLivingCatalogVideos.length})
            </button>

            {activeSubcategories.map((sub) => {
              const count = christianLivingCatalogVideos.filter((v) => {
                if (selectedMinisterId && v.channel_id !== selectedMinisterId) {
                  return false;
                }
                return v.christian_living_subcategories?.includes(sub.slug);
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

          {/* Compact Sort Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 mr-1 shrink-0" />
            {[
              { id: 'smart_rank', label: 'Smart Rank' },
              { id: 'most_watched', label: 'Most Watched' },
              { id: 'trending_recent', label: 'Trending' },
              { id: 'timeless_evergreen', label: 'Timeless Wisdom' },
              { id: 'recently_added', label: 'Recently Added' },
            ].map((sm) => (
              <button
                key={sm.id}
                type="button"
                onClick={() => setSortMode(sm.id as ChristianLivingSortMode)}
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
          SELECTED MINISTER COMPACT BAR
      ==================================================================== */}
      {selectedMinister && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121215] border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={
                selectedMinister.avatar_url ||
                ministerStatsMap.get(selectedMinister.id)?.topVideo?.thumbnail_high_url ||
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80'
              }
              alt={selectedMinister.speaker_name || selectedMinister.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover bg-zinc-800 border-2 border-amber-400 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50 truncate">
                {selectedMinister.speaker_name || selectedMinister.title}
              </h3>
              <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
                <span className="text-amber-400">
                  {ministerStatsMap.get(selectedMinister.id)?.teachingCount || 0} teachings
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatCompactNumber(
                    ministerStatsMap.get(selectedMinister.id)?.totalViews || 0
                  )}{' '}
                  views
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto shrink-0">
            {ministerStatsMap.get(selectedMinister.id)?.topVideo && (
              <button
                type="button"
                onClick={() => {
                  const top = ministerStatsMap.get(selectedMinister.id)?.topVideo;
                  if (top) onSelectVideo(top);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors flex-1 sm:flex-initial"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Top Teaching</span>
              </button>
            )}

            {onSelectChannel && (
              <button
                type="button"
                onClick={() => onSelectChannel(selectedMinister.id)}
                className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
              >
                Profile
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedMinisterId(null)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          4. MAIN CONTENT DISPLAY: FILTERED RESULTS OR CLEAN FEATURED RAILS
      ==================================================================== */}
      {isFilteringActive ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50 truncate">
              {selectedMinister
                ? `${selectedMinister.speaker_name || selectedMinister.title}`
                : selectedSubcategorySlug !== 'all'
                ? activeSubcategories.find((s) => s.slug === selectedSubcategorySlug)?.name
                : searchQuery.trim()
                ? `"${searchQuery}"`
                : ministerGroupFilter === 'nigerian_ministers'
                ? 'Nigerian Ministers'
                : ministerGroupFilter === 'female_and_international'
                ? 'Female & International Teachers'
                : 'Christian Living'}{' '}
              <span className="text-sm font-mono text-zinc-400 font-normal">
                ({filteredTeachings.length})
              </span>
            </h3>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedMinisterId(null);
                setSelectedSubcategorySlug('all');
                setMinisterGroupFilter('all');
                setSortMode('smart_rank');
              }}
              className="text-xs text-amber-400 hover:underline shrink-0"
            >
              Reset Filters
            </button>
          </div>

          {filteredTeachings.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-[#121215] border border-zinc-800 text-center flex flex-col items-center gap-3">
              <BookOpen className="w-7 h-7 text-amber-400" />
              <div className="text-sm font-semibold text-zinc-200">
                No matching teachings found
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMinisterId(null);
                  setSelectedSubcategorySlug('all');
                  setMinisterGroupFilter('all');
                  setSortMode('smart_rank');
                }}
                className="mt-1 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold"
              >
                Show All Teachings
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredTeachings.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onSelect={onSelectVideo}
                  isSaved={savedVideoIds.includes(video.id)}
                  onToggleSave={onToggleSave}
                  onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8 sm:gap-10">
          {/* ================================================================
              FEATURED SECTION 1: MOST WATCHED CHRISTIAN LIVING TEACHINGS
          ================================================================ */}
          {featuredSections.mostWatched.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                  Most Watched Christian Living Teachings
                </h3>
                <button
                  type="button"
                  onClick={() => setSortMode('most_watched')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                >
                  <span>See All</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {featuredSections.mostWatched.map((video) => (
                  <VideoCard
                    key={`most-watched-${video.id}`}
                    video={video}
                    onSelect={onSelectVideo}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                    onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              FEATURED SECTION 2: TRENDING CHRISTIAN LIVING TEACHINGS
          ================================================================ */}
          {featuredSections.trendingTeachings.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                  Trending Christian Living Teachings
                </h3>
                <button
                  type="button"
                  onClick={() => setSortMode('trending_recent')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                >
                  <span>See All</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {featuredSections.trendingTeachings.map((video) => (
                  <VideoCard
                    key={`trending-cl-${video.id}`}
                    video={video}
                    onSelect={onSelectVideo}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                    onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              FEATURED SECTION 3: TIMELESS CHRISTIAN WISDOM
          ================================================================ */}
          {featuredSections.timelessWisdom.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                  Timeless Christian Wisdom
                </h3>
                <button
                  type="button"
                  onClick={() => setSortMode('timeless_evergreen')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                >
                  <span>See All</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {featuredSections.timelessWisdom.map((video) => (
                  <VideoCard
                    key={`timeless-cl-${video.id}`}
                    video={video}
                    onSelect={onSelectVideo}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                    onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              FEATURED SECTION 5: RECENTLY ADDED TEACHINGS
          ================================================================ */}
          {featuredSections.recentlyAdded.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                  Recently Added Teachings
                </h3>
                <button
                  type="button"
                  onClick={() => setSortMode('recently_added')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
                >
                  <span>See All</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {featuredSections.recentlyAdded.map((video) => (
                  <VideoCard
                    key={`recent-cl-${video.id}`}
                    video={video}
                    onSelect={onSelectVideo}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                    onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              FEATURED SECTION 6: RECOMMENDED FOR YOUR GROWTH
          ================================================================ */}
          {featuredSections.recommendedForGrowth.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                  Recommended for Your Growth
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {featuredSections.recommendedForGrowth.map((video) => (
                  <VideoCard
                    key={`rec-growth-${video.id}`}
                    video={video}
                    onSelect={onSelectVideo}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                    onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ================================================================
              THE 11 CHRISTIAN LIVING SUBCATEGORY RAILS (CLEAN HEADINGS ONLY)
          ================================================================ */}
          <div className="pt-4 border-t border-zinc-800/80 flex flex-col gap-8 sm:gap-10">
            {activeSubcategories.map((sub) => {
              const subVideos = sortTeachings(
                christianLivingCatalogVideos.filter((v) =>
                  v.christian_living_subcategories?.includes(sub.slug)
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
                    {subVideos.slice(0, 4).map((video) => (
                      <VideoCard
                        key={`${sub.slug}-${video.id}`}
                        video={video}
                        onSelect={onSelectVideo}
                        isSaved={savedVideoIds.includes(video.id)}
                        onToggleSave={onToggleSave}
                        onSelectChannel={(chId) => setSelectedMinisterId(chId)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
