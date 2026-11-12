import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  Loader2,
  Play,
  Search,
  Sparkles,
  Tv,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import {
  ContentCategory,
  KingdomChannel,
  KingdomVideo,
  WatchHistoryEntry,
} from '../types/kingdom.ts';
import { formatCompactNumber, formatDurationSeconds, formatRelativeDate } from '../utils/formatters.ts';
import { VideoCard } from './VideoCard.tsx';

export interface DiscoveredMinisterProfileData {
  name: string;
  handle: string;
  youtubeChannelId: string;
  avatarUrl: string;
  subscriberCount: number | null;
  bio: string;
  isCuratedInApp: boolean;
  curatedChannelId?: string;
  videos: KingdomVideo[];
}

export interface ConsolidatedMinisterProfile {
  primaryChannel: KingdomChannel;
  channelIds: string[];
  displayName: string;
  ministryOrRole: string;
  bio: string;
  avatarUrl: string;
  handle: string;
  isNigerian: boolean;
  isOfficialVerified: boolean;
  channelType: KingdomChannel['channel_type'];
  speakerGender?: KingdomChannel['speaker_gender'];
  isFeaturedMarriageTeacher?: boolean;
  aliases: string[];
  videos: KingdomVideo[];
  categoryBreakdown: Array<{ slug: string; name: string; count: number }>;
}

/**
 * Normalizes a minister's canonical identity key so that if a minister has both a personal
 * channel and a ministry channel (e.g. Pastor Sam Adeyemi + Daystar Christian Centre, or
 * Pastor Sarah Omakwu + Family Worship Centre), their videos are unified cleanly.
 */
function getCanonicalSpeakerKey(channel: KingdomChannel): string {
  const speaker = (channel.speaker_name || channel.title)
    .toLowerCase()
    .replace(/^(pastor|apostle|bishop|rev\.|reverend|dr\.|minister|evang\.|evangelist|prophet)\s+/gi, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  return speaker || channel.id;
}

/**
 * Builds consolidated minister profiles from approved channels and catalogue videos.
 * Only includes ministers, pastors, worship leaders, gospel artists, and Christian ministries
 * (excludes movie/animation studios so Christian Movies remain strictly separate).
 */
export function buildConsolidatedMinisterProfiles(
  channels: KingdomChannel[],
  videos: KingdomVideo[],
  categories: ContentCategory[]
): ConsolidatedMinisterProfile[] {
  const ministerChannels = channels.filter(
    (c) =>
      c.approval_status === 'approved' &&
      c.channel_type !== 'movie_studio' &&
      c.channel_type !== 'animation_studio'
  );

  const groupedByKey = new Map<string, KingdomChannel[]>();
  for (const ch of ministerChannels) {
    const key = getCanonicalSpeakerKey(ch);
    const list = groupedByKey.get(key) || [];
    list.push(ch);
    groupedByKey.set(key, list);
  }

  const categoryNameMap = new Map<string, string>();
  for (const cat of categories) {
    categoryNameMap.set(cat.slug, cat.name);
  }

  const profiles: ConsolidatedMinisterProfile[] = [];

  for (const [, group] of groupedByKey.entries()) {
    // Pick the primary channel with the highest priority_weight or subscriber_count
    const sortedGroup = [...group].sort(
      (a, b) =>
        (b.subscriber_count || 0) - (a.subscriber_count || 0) ||
        b.priority_weight - a.priority_weight
    );
    const primary = sortedGroup[0];
    const channelIds = sortedGroup.map((c) => c.id);
    const channelIdSet = new Set(channelIds);

    const displayName = primary.speaker_name || primary.title;
    const cleanCoreName = displayName
      .replace(/^(pastor|apostle|bishop|rev\.|reverend|dr\.|minister|evang\.)\s+/i, '')
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toLowerCase();

    // Collect all catalogue videos belonging to this minister's channel(s) OR explicitly featuring their name in the title
    const relevantVideos = videos.filter((v) => {
      if (v.channel_type === 'movie_studio' || v.channel_type === 'animation_studio') {
        return false;
      }
      if (channelIdSet.has(v.channel_id)) {
        return true;
      }
      if (cleanCoreName.length >= 5 && v.title.toLowerCase().includes(cleanCoreName)) {
        return true;
      }
      return false;
    });

    // Only include ministers/artists who actually have videos in the catalogue (Section 6 rule)
    if (relevantVideos.length === 0) continue;

    const allAliases = new Set<string>();
    for (const ch of sortedGroup) {
      allAliases.add(ch.title);
      allAliases.add(ch.handle);
      if (ch.speaker_name) allAliases.add(ch.speaker_name);
      if (ch.ministry_name) allAliases.add(ch.ministry_name);
      for (const a of ch.aliases || []) {
        allAliases.add(a);
      }
    }

    const catCounts = new Map<string, number>();
    for (const v of relevantVideos) {
      catCounts.set(v.primary_category_slug, (catCounts.get(v.primary_category_slug) || 0) + 1);
    }

    const categoryBreakdown = Array.from(catCounts.entries())
      .map(([slug, count]) => ({
        slug,
        name: categoryNameMap.get(slug) || slug,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const roleLabel =
      primary.ministry_name ||
      (primary.channel_type === 'artist'
        ? 'Gospel Artist & Worship Leader'
        : primary.channel_type === 'church'
        ? 'Church & Ministry'
        : 'Christian Minister & Speaker');

    const bio =
      sortedGroup.find((c) => c.bio && c.bio.trim().length > 0)?.bio ||
      `${displayName} — verified official ${
        primary.is_nigerian ? 'Nigerian' : 'International'
      } ${roleLabel.toLowerCase()} on KINGDOM+.`;

    profiles.push({
      primaryChannel: primary,
      channelIds,
      displayName,
      ministryOrRole: roleLabel,
      bio,
      avatarUrl: primary.avatar_url,
      handle: primary.handle,
      isNigerian: primary.is_nigerian,
      isOfficialVerified: primary.is_official_verified,
      channelType: primary.channel_type,
      speakerGender: primary.speaker_gender,
      isFeaturedMarriageTeacher: sortedGroup.some((c) => c.is_featured_marriage_teacher),
      aliases: Array.from(allAliases),
      videos: relevantVideos,
      categoryBreakdown,
    });
  }

  return profiles.sort((a, b) => {
    if (a.isNigerian !== b.isNigerian) return a.isNigerian ? -1 : 1;
    if (b.videos.length !== a.videos.length) return b.videos.length - a.videos.length;
    return b.primaryChannel.priority_weight - a.primaryChannel.priority_weight;
  });
}

/**
 * Evaluates whether a ConsolidatedMinisterProfile matches a user's search query
 * using full name, partial name, or alternative spellings/titles.
 */
export function matchMinisterQuery(
  profile: ConsolidatedMinisterProfile,
  rawQuery: string
): { matches: boolean; score: number } {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { matches: true, score: 1 };

  const displayLower = profile.displayName.toLowerCase();
  const ministryLower = profile.ministryOrRole.toLowerCase();
  const handleLower = profile.handle.toLowerCase();
  const aliasLowers = profile.aliases.map((a) => a.toLowerCase());

  // Exact or prefix match on display name
  if (displayLower === q || aliasLowers.some((a) => a === q)) {
    return { matches: true, score: 100 };
  }
  if (displayLower.startsWith(q) || aliasLowers.some((a) => a.startsWith(q))) {
    return { matches: true, score: 90 };
  }
  if (
    displayLower.includes(q) ||
    ministryLower.includes(q) ||
    handleLower.includes(q) ||
    aliasLowers.some((a) => a.includes(q))
  ) {
    return { matches: true, score: 75 };
  }

  // Multi-word partial token matching (e.g. "Pastor Jerry", "Joshua Selman", "Kingsley", "Mercy")
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const searchableCorpus = `${displayLower} ${ministryLower} ${handleLower} ${aliasLowers.join(' ')}`;
    const allTokensMatch = tokens.every((tok) => searchableCorpus.includes(tok));
    if (allTokensMatch) {
      return { matches: true, score: 65 };
    }
  }

  return { matches: false, score: 0 };
}

interface MinisterSearchBarProps {
  profiles: ConsolidatedMinisterProfile[];
  onSelectMinister: (channelId: string) => void;
  onDiscoveredMinister?: (minister: DiscoveredMinisterProfileData) => void;
  variant?: 'homepage' | 'directory';
}

/**
 * Prominent Dedicated Minister Search Bar
 * Supports searching both curated ministers and discovering ANY Christian minister worldwide via YouTube!
 */
export const MinisterSearchBar: React.FC<MinisterSearchBarProps> = ({
  profiles,
  onSelectMinister,
  onDiscoveredMinister,
  variant = 'homepage',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchingWorldwide, setIsSearchingWorldwide] = useState(false);
  const [discoveredResult, setDiscoveredResult] = useState<DiscoveredMinisterProfileData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchedProfiles = useMemo(() => {
    if (!query.trim()) {
      return profiles.slice(0, 8);
    }
    return profiles
      .map((p) => ({ profile: p, match: matchMinisterQuery(p, query) }))
      .filter((item) => item.match.matches)
      .sort((a, b) => b.match.score - a.match.score || b.profile.videos.length - a.profile.videos.length)
      .map((item) => item.profile);
  }, [profiles, query]);

  const quickFeaturedMinisters = useMemo(() => {
    const priorityNames = [
      'Apostle Joshua Selman',
      'Pastor Jerry Eze',
      'Nathaniel Bassey',
      'Mercy Chinwo',
      'Moses Bliss',
      'Dunsin Oyekan',
      'Pastor Kingsley Okonkwo',
      'Pastor Sam Adeyemi',
      'Pastor Mildred Okonkwo',
    ];
    return priorityNames
      .map((name) =>
        profiles.find(
          (p) =>
            p.displayName.toLowerCase().includes(name.toLowerCase()) ||
            p.aliases.some((a) => a.toLowerCase().includes(name.toLowerCase()))
        )
      )
      .filter((p): p is ConsolidatedMinisterProfile => Boolean(p))
      .slice(0, 7);
  }, [profiles]);

  const worldwideDiscoverySuggestions = [
    'Dr. Myles Munroe',
    'Bishop T.D. Jakes',
    'Pastor E.A. Adeboye',
    'Pastor Chris Oyakhilome',
    'Pastor Paul Enenche',
    'Priscilla Shirer',
    'Francis Chan',
    'Steven Furtick',
  ];

  const handleSearchWorldwide = async (ministerName?: string) => {
    const name = (ministerName || query).trim();
    if (!name) return;
    setIsSearchingWorldwide(true);
    setQuery(name);
    try {
      const res = await fetch(`/api/discovery/minister?name=${encodeURIComponent(name)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.minister) {
          setDiscoveredResult(data.minister);
          if (onDiscoveredMinister) {
            onDiscoveredMinister(data.minister);
          }
        }
      }
    } catch (err) {
      console.error('Failed to discover minister:', err);
    } finally {
      setIsSearchingWorldwide(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (matchedProfiles.length > 0) {
      onSelectMinister(matchedProfiles[0].primaryChannel.id);
      setIsOpen(false);
    } else if (query.trim()) {
      await handleSearchWorldwide();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl border border-zinc-800/90 bg-gradient-to-r from-[#131317] via-[#16151B] to-[#131317] ${
        variant === 'homepage' ? 'p-4 sm:p-5 shadow-xl' : 'p-4'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="shrink-0">
          <label
            htmlFor="minister-dedicated-search-input"
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-100"
          >
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>Search Ministers, Artists &amp; Speakers</span>
          </label>
        </div>

        <form onSubmit={handleSubmit} className="relative flex-1 max-w-2xl">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-amber-400 absolute left-3.5 pointer-events-none" />
            <input
              id="minister-dedicated-search-input"
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder="Search any Christian minister, pastor, or gospel artist worldwide..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-zinc-950/95 border border-zinc-700/80 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setDiscoveredResult(null);
                  setIsOpen(false);
                }}
                className="absolute right-20 p-1.5 text-zinc-400 hover:text-zinc-200"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearchingWorldwide}
              className="absolute right-2 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              {isSearchingWorldwide ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Find Videos</span>
              )}
            </button>
          </div>

          {/* Instant Matching Suggestions Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-xl bg-[#141418] border border-zinc-700/90 shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
              {/* Discovered Minister Result Card if present */}
              {discoveredResult && (
                <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={discoveredResult.avatarUrl}
                      alt={discoveredResult.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover bg-zinc-800 border border-amber-500/50 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-100 truncate">
                          {discoveredResult.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                          Discovered on YouTube
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 truncate">
                        {discoveredResult.bio || discoveredResult.handle} · {discoveredResult.videos.length} sermons &amp; teachings
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDiscoveredMinister) onDiscoveredMinister(discoveredResult);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold shrink-0"
                  >
                    View Sermons
                  </button>
                </div>
              )}

              <div className="px-4 py-2 border-b border-zinc-800/80 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                <span>
                  {query.trim()
                    ? `Matching Ministers (${matchedProfiles.length})`
                    : 'Popular Ministers, Pastors & Gospel Artists'}
                </span>
                <span>Catalogue Videos</span>
              </div>

              {matchedProfiles.length > 0 ? (
                <div className="divide-y divide-zinc-800/60">
                  {matchedProfiles.slice(0, 8).map((profile) => (
                    <button
                      key={profile.primaryChannel.id}
                      type="button"
                      onClick={() => {
                        onSelectMinister(profile.primaryChannel.id);
                        setIsOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-900/90 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={profile.avatarUrl}
                          alt={profile.displayName}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              profile.displayName
                            )}&background=27272a&color=f59e0b`;
                          }}
                          className="w-10 h-10 rounded-full object-cover bg-zinc-800 border border-zinc-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-zinc-100 truncate">
                              {profile.displayName}
                            </span>
                            {profile.isOfficialVerified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">
                            {profile.ministryOrRole} ·{' '}
                            {profile.categoryBreakdown
                              .slice(0, 2)
                              .map((c) => c.name)
                              .join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono tabular-nums">
                          <Video className="w-3 h-3" />
                          {profile.videos.length} {profile.videos.length === 1 ? 'video' : 'videos'}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* Option to discover more on YouTube if user is searching */}
                  {query.trim().length >= 2 && (
                    <div className="p-3 bg-zinc-900/50 flex items-center justify-between gap-2 border-t border-zinc-800">
                      <div className="text-xs text-zinc-300 flex items-center gap-1.5 truncate">
                        <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Want more content from &ldquo;{query}&rdquo;?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSearchWorldwide()}
                        disabled={isSearchingWorldwide}
                        className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium whitespace-nowrap shrink-0"
                      >
                        {isSearchingWorldwide ? 'Searching YouTube...' : 'Search Worldwide on YouTube →'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <Globe className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-100 mb-0.5">
                      Discover &ldquo;{query.trim()}&rdquo; on YouTube
                    </p>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                      Search public sermons, teachings, prayers, and conferences for this minister worldwide.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSearchWorldwide()}
                    disabled={isSearchingWorldwide}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors shadow-lg"
                  >
                    {isSearchingWorldwide ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching YouTube...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Explore This Minister on YouTube &rarr;</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Quick Direct Minister Access Chips */}
      <div className="mt-3.5 pt-3 border-t border-zinc-800/70 flex flex-col gap-2">
        {quickFeaturedMinisters.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">
              In-Library:
            </span>
            {quickFeaturedMinisters.map((p) => (
              <button
                key={p.primaryChannel.id}
                type="button"
                onClick={() => onSelectMinister(p.primaryChannel.id)}
                className="px-2.5 py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-xs text-zinc-300 hover:text-amber-300 transition-colors shrink-0 flex items-center gap-1.5"
              >
                <span>{p.displayName}</span>
                <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                  ({p.videos.length})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Worldwide Minister Discovery Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500/90 shrink-0 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>Discover Worldwide:</span>
          </span>
          {worldwideDiscoverySuggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleSearchWorldwide(name)}
              disabled={isSearchingWorldwide}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 hover:text-amber-200 transition-colors shrink-0 flex items-center gap-1"
            >
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface MinisterProfileViewProps {
  profile: ConsolidatedMinisterProfile;
  allProfiles: ConsolidatedMinisterProfile[];
  categories: ContentCategory[];
  savedVideoIds: string[];
  watchHistory: WatchHistoryEntry[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onSelectMinister: (channelId: string) => void;
  onBack: () => void;
}

/**
 * Dedicated Results Page for a Selected Minister, Gospel Artist, or Speaker (Section 5)
 * - Displays all available videos associated with that person
 * - Allows filtering by category (across the 8 Approved Main Categories)
 * - Allows sorting by Recently Added, Popularity (Most Viewed), or Trending Score
 */
export const MinisterProfileView: React.FC<MinisterProfileViewProps> = ({
  profile,
  allProfiles,
  savedVideoIds,
  watchHistory,
  onSelectVideo,
  onToggleSave,
  onSelectMinister,
  onBack,
}) => {
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'trending'>('popular');
  const [searchWithinMinister, setSearchWithinMinister] = useState('');

  // Reset category filter when switching minister
  useEffect(() => {
    setSelectedCategorySlug('all');
    setSearchWithinMinister('');
  }, [profile.primaryChannel.id]);

  const watchMap = useMemo(() => {
    const map = new Map<string, WatchHistoryEntry>();
    for (const w of watchHistory) {
      map.set(w.video_id, w);
    }
    return map;
  }, [watchHistory]);

  const filteredAndSortedVideos = useMemo(() => {
    let list = [...profile.videos];
    if (selectedCategorySlug !== 'all') {
      list = list.filter(
        (v) =>
          v.primary_category_slug === selectedCategorySlug ||
          v.secondary_category_slugs.includes(selectedCategorySlug)
      );
    }
    if (searchWithinMinister.trim()) {
      const q = searchWithinMinister.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          (v.subcategory_label && v.subcategory_label.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'recent') {
      return list.sort(
        (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    }
    if (sortBy === 'trending') {
      return list.sort((a, b) => b.trending_score - a.trending_score);
    }
    // Default: Popularity (view_count descending)
    return list.sort((a, b) => b.view_count - a.view_count);
  }, [profile.videos, selectedCategorySlug, sortBy, searchWithinMinister]);

  const totalViewsAcrossCatalogue = useMemo(
    () => profile.videos.reduce((sum, v) => sum + v.view_count, 0),
    [profile.videos]
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Top Navigation & Minister Search Bar */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Explore Ministers Directory</span>
        </button>

        <MinisterSearchBar
          profiles={allProfiles}
          onSelectMinister={onSelectMinister}
          variant="directory"
        />
      </div>

      {/* Dedicated Minister Profile Header */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#141418] via-[#121215] to-amber-950/20 border border-zinc-800/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                profile.displayName
              )}&background=27272a&color=f59e0b`;
            }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover bg-zinc-800 border-2 border-amber-500/40 shrink-0 shadow-lg"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
                {profile.ministryOrRole}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-xs text-zinc-400">
                {profile.isNigerian ? 'Nigeria' : 'International'}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-xs font-mono text-amber-400/90">KINGDOM+ Verified Ministry</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 flex items-center gap-2">
              <span>{profile.displayName}</span>
              {profile.isOfficialVerified && (
                <CheckCircle2
                  className="w-6 h-6 text-amber-400 shrink-0"
                  aria-label="Verified Official Minister"
                />
              )}
            </h1>

            <p className="text-sm text-zinc-300 max-w-3xl leading-relaxed">{profile.bio}</p>

            {/* Tabular Stats Row */}
            <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-zinc-400">
              <span className="text-amber-300 font-semibold">
                {profile.videos.length} Curated {profile.videos.length === 1 ? 'Video' : 'Videos'} in Catalogue
              </span>
              <span>·</span>
              <span>{formatCompactNumber(totalViewsAcrossCatalogue)} Combined Views</span>
              {profile.primaryChannel.subscriber_count && (
                <>
                  <span>·</span>
                  <span>
                    {formatCompactNumber(profile.primaryChannel.subscriber_count)} Subscribers
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills & Sort Controls (Section 5 requirement) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        {/* Filter by Category */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategorySlug('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
              selectedCategorySlug === 'all'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            All Categories ({profile.videos.length})
          </button>

          {profile.categoryBreakdown.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCategorySlug(cat.slug)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                selectedCategorySlug === cat.slug
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Search within minister & Sort by Recently Added / Popularity */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchWithinMinister}
              onChange={(e) => setSearchWithinMinister(e.target.value)}
              placeholder={`Filter ${profile.displayName}'s videos...`}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 w-52"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setSortBy('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'popular'
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Most Popular
            </button>
            <button
              type="button"
              onClick={() => setSortBy('recent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'recent'
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Recently Added
            </button>
            <button
              type="button"
              onClick={() => setSortBy('trending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'trending'
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Trending
            </button>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      {filteredAndSortedVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredAndSortedVideos.map((v) => {
            const watch = watchMap.get(v.id);
            return (
              <VideoCard
                key={v.id}
                video={v}
                onSelect={onSelectVideo}
                isSaved={savedVideoIds.includes(v.id)}
                onToggleSave={onToggleSave}
                watchProgressSeconds={watch?.progress_seconds}
                watchDurationSeconds={watch?.duration_seconds}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-[#121215] border border-zinc-800/80 text-center space-y-3">
          <p className="text-base font-semibold text-zinc-200">
            No matching videos found for this filter
          </p>
          <p className="text-xs text-zinc-400">
            Try clearing the category or keyword filter to see all {profile.videos.length} videos from{' '}
            {profile.displayName}.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategorySlug('all');
              setSearchWithinMinister('');
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold"
          >
            Show All {profile.videos.length} Videos
          </button>
        </div>
      )}
    </div>
  );
};

interface ExploreMinistersViewProps {
  profiles: ConsolidatedMinisterProfile[];
  onSelectMinister: (channelId: string) => void;
  onSelectVideo?: (video: KingdomVideo) => void;
  onDiscoveredVideoSelected?: (video: KingdomVideo) => void;
  savedVideoIds?: string[];
  onToggleSave?: (videoId: string, e: React.MouseEvent) => void;
}

/**
 * Discovered Minister Full Profile View
 * Displays any Christian minister discovered dynamically from YouTube
 * (whether from Nigeria, Africa, or anywhere around the world).
 */
export const DiscoveredMinisterFullProfileView: React.FC<{
  minister: DiscoveredMinisterProfileData;
  onBack: () => void;
  onSelectVideo: (video: KingdomVideo) => void;
  onDiscoveredVideoSelected?: (video: KingdomVideo) => void;
  savedVideoIds: string[];
  onToggleSave?: (videoId: string, e: React.MouseEvent) => void;
}> = ({
  minister,
  onBack,
  onSelectVideo,
  onDiscoveredVideoSelected,
  savedVideoIds,
  onToggleSave,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<'all' | 'sermons' | 'teachings' | 'prayers' | 'worship'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredVideos = useMemo(() => {
    let list = [...minister.videos];
    if (selectedTopic === 'sermons') {
      list = list.filter((v) =>
        v.title.toLowerCase().includes('sermon') ||
        v.title.toLowerCase().includes('message') ||
        v.primary_category_slug.includes('sermon')
      );
    } else if (selectedTopic === 'teachings') {
      list = list.filter((v) =>
        v.title.toLowerCase().includes('teaching') ||
        v.title.toLowerCase().includes('bible') ||
        v.primary_category_slug.includes('living')
      );
    } else if (selectedTopic === 'prayers') {
      list = list.filter((v) =>
        v.title.toLowerCase().includes('pray') ||
        v.title.toLowerCase().includes('warfare') ||
        v.primary_category_slug.includes('prayer')
      );
    } else if (selectedTopic === 'worship') {
      list = list.filter((v) =>
        v.title.toLowerCase().includes('worship') ||
        v.title.toLowerCase().includes('praise') ||
        v.primary_category_slug.includes('worship')
      );
    }

    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      list = list.filter((v) => v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q));
    }
    return list;
  }, [minister.videos, selectedTopic, searchFilter]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Explore Ministers Directory</span>
      </button>

      {/* Discovered Minister Header Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#141418] via-[#121215] to-amber-950/20 border border-zinc-800/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <img
            src={minister.avatarUrl}
            alt={minister.name}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                minister.name
              )}&background=27272a&color=f59e0b`;
            }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover bg-zinc-800 border-2 border-amber-500/60 shrink-0 shadow-lg"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
                Christian Minister &amp; Speaker
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Discovered via YouTube
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 flex items-center gap-2">
              <span>{minister.name}</span>
              <CheckCircle2 className="w-6 h-6 text-amber-400 shrink-0" />
            </h1>

            <p className="text-sm text-zinc-300 max-w-3xl leading-relaxed">
              {minister.bio || `${minister.name} official Christian teachings, sermons, and conferences available on YouTube.`}
            </p>

            {/* Tabular Stats Row */}
            <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-zinc-400">
              <span className="text-amber-300 font-semibold">
                {minister.videos.length} Available Sermons &amp; Teachings
              </span>
              {minister.subscriberCount && (
                <>
                  <span>·</span>
                  <span>{formatCompactNumber(minister.subscriberCount)} Subscribers</span>
                </>
              )}
              {minister.handle && (
                <>
                  <span>·</span>
                  <span className="text-zinc-300">{minister.handle}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: `All Videos (${minister.videos.length})` },
            { id: 'sermons', label: 'Sermons' },
            { id: 'teachings', label: 'Bible Teachings' },
            { id: 'prayers', label: 'Prayers & Warfare' },
            { id: 'worship', label: 'Worship & Praise' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTopic(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                selectedTopic === tab.id
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Filter ${minister.name}'s videos...`}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Discovered Videos Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredVideos.map((video) => (
            <div key={video.id} className="relative group">
              <VideoCard
                video={video}
                onSelect={(v) => {
                  onSelectVideo(v);
                  if (onDiscoveredVideoSelected) onDiscoveredVideoSelected(v);
                }}
                isSaved={savedVideoIds.includes(video.id)}
                onToggleSave={onToggleSave || (() => {})}
              />
              <div className="absolute top-2 left-2 pointer-events-none px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-amber-500/40 text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                YouTube Stream
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-[#121215] border border-zinc-800/80 text-center space-y-2">
          <p className="text-base font-semibold text-zinc-200">No videos found for this topic filter.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedTopic('all');
              setSearchFilter('');
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-semibold"
          >
            Show All Videos ({minister.videos.length})
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Explore Ministers Directory Page
 * Displays both curated ministers and allows discovering ANY Christian minister,
 * pastor, evangelist, or gospel speaker worldwide.
 */
export const ExploreMinistersView: React.FC<ExploreMinistersViewProps> = ({
  profiles,
  onSelectMinister,
  onSelectVideo,
  onDiscoveredVideoSelected,
  savedVideoIds = [],
  onToggleSave,
}) => {
  const [roleFilter, setRoleFilter] = useState<
    'all' | 'pastors' | 'artists' | 'churches' | 'marriage'
  >('all');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [selectedDiscoveredMinister, setSelectedDiscoveredMinister] =
    useState<DiscoveredMinisterProfileData | null>(null);
  const [isSearchingWorldwide, setIsSearchingWorldwide] = useState(false);

  const filteredProfiles = useMemo(() => {
    let list = profiles;
    if (roleFilter === 'pastors') {
      list = list.filter((p) => p.channelType === 'minister');
    } else if (roleFilter === 'artists') {
      list = list.filter((p) => p.channelType === 'artist');
    } else if (roleFilter === 'churches') {
      list = list.filter((p) => p.channelType === 'church' || p.channelType === 'ministry');
    } else if (roleFilter === 'marriage') {
      list = list.filter(
        (p) =>
          p.isFeaturedMarriageTeacher ||
          p.categoryBreakdown.some((c) => c.slug === 'marriage-relationships')
      );
    }

    if (directoryQuery.trim()) {
      list = list
        .map((p) => ({ p, match: matchMinisterQuery(p, directoryQuery) }))
        .filter((x) => x.match.matches)
        .sort((a, b) => b.match.score - a.match.score)
        .map((x) => x.p);
    }

    return list;
  }, [profiles, roleFilter, directoryQuery]);

  const handleDiscoverMinisterWorldwide = async (nameToSearch: string) => {
    const name = nameToSearch.trim();
    if (!name) return;
    setIsSearchingWorldwide(true);
    try {
      const res = await fetch(`/api/discovery/minister?name=${encodeURIComponent(name)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.minister) {
          setSelectedDiscoveredMinister(data.minister);
        }
      }
    } catch (err) {
      console.error('Failed to discover minister:', err);
    } finally {
      setIsSearchingWorldwide(false);
    }
  };

  // If a discovered minister is currently active, render their full profile view
  if (selectedDiscoveredMinister && onSelectVideo) {
    return (
      <DiscoveredMinisterFullProfileView
        minister={selectedDiscoveredMinister}
        onBack={() => setSelectedDiscoveredMinister(null)}
        onSelectVideo={onSelectVideo}
        onDiscoveredVideoSelected={onDiscoveredVideoSelected}
        savedVideoIds={savedVideoIds}
        onToggleSave={onToggleSave}
      />
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Explore Ministers
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse verified kingdom ministries or search and discover any Christian minister worldwide.
          </p>
        </div>

        <div className="text-xs font-mono tabular-nums text-amber-400">
          {filteredProfiles.length} Featured Ministries
        </div>
      </div>

      {/* Dedicated Minister Search Bar with Worldwide Discovery */}
      <MinisterSearchBar
        profiles={profiles}
        onSelectMinister={onSelectMinister}
        onDiscoveredMinister={(m) => setSelectedDiscoveredMinister(m)}
        variant="directory"
      />

      {/* Role Filter Tabs & Instant Filter Input */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: `All Ministers & Artists (${profiles.length})` },
            {
              id: 'pastors',
              label: `Pastors & Speakers (${profiles.filter((p) => p.channelType === 'minister').length})`,
            },
            {
              id: 'artists',
              label: `Gospel Artists & Worship Leaders (${profiles.filter((p) => p.channelType === 'artist').length})`,
            },
            {
              id: 'churches',
              label: `Churches & Ministries (${
                profiles.filter((p) => p.channelType === 'church' || p.channelType === 'ministry').length
              })`,
            },
            {
              id: 'marriage',
              label: `Marriage & Family Voices (${
                profiles.filter(
                  (p) =>
                    p.isFeaturedMarriageTeacher ||
                    p.categoryBreakdown.some((c) => c.slug === 'marriage-relationships')
                ).length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={directoryQuery}
            onChange={(e) => setDirectoryQuery(e.target.value)}
            placeholder="Filter directory by name..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60"
          />
          {directoryQuery && (
            <button
              type="button"
              onClick={() => setDirectoryQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Directory Grid */}
      {filteredProfiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProfiles.map((profile) => (
            <div
              key={profile.primaryChannel.id}
              onClick={() => onSelectMinister(profile.primaryChannel.id)}
              className="group cursor-pointer p-5 rounded-2xl bg-[#121215] border border-zinc-800/80 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-3.5">
                <div className="flex items-start gap-4">
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        profile.displayName
                      )}&background=27272a&color=f59e0b`;
                    }}
                    className="w-16 h-16 rounded-full object-cover bg-zinc-800 border border-zinc-700 shrink-0 group-hover:border-amber-500/50 transition-colors"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-zinc-100 group-hover:text-amber-400 transition-colors truncate">
                        {profile.displayName}
                      </h3>
                      {profile.isOfficialVerified && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-amber-400/90 font-medium truncate mt-0.5">
                      {profile.ministryOrRole}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-zinc-400 mt-1">
                      <span className="text-zinc-200 font-semibold">
                        {profile.videos.length} {profile.videos.length === 1 ? 'video' : 'videos'}
                      </span>
                      <span>·</span>
                      <span>{profile.isNigerian ? 'Nigeria' : 'International'}</span>
                    </div>
                  </div>
                </div>

                {/* Short Verified Biography */}
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {profile.bio}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-800/70 flex items-center justify-between gap-2">
                <div className="text-[11px] text-zinc-500 truncate">
                  {profile.categoryBreakdown
                    .slice(0, 2)
                    .map((c) => c.name)
                    .join(' · ')}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMinister(profile.primaryChannel.id);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 group-hover:bg-amber-500 text-zinc-200 group-hover:text-zinc-950 text-xs font-semibold border border-zinc-700 group-hover:border-amber-500 transition-colors shrink-0"
                >
                  View Videos ({profile.videos.length})
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 sm:p-12 rounded-2xl bg-[#121215] border border-zinc-800/80 text-center space-y-4">
          <Globe className="w-10 h-10 text-amber-400 mx-auto" />
          <div className="max-w-md mx-auto space-y-1">
            <p className="text-base font-semibold text-zinc-100">
              No in-library minister found for &ldquo;{directoryQuery}&rdquo;
            </p>
            <p className="text-xs text-zinc-400">
              Search YouTube beyond our catalog to discover authentic sermons and teachings from &ldquo;{directoryQuery}&rdquo;.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDiscoverMinisterWorldwide(directoryQuery)}
            disabled={isSearchingWorldwide}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors shadow-lg"
          >
            {isSearchingWorldwide ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching YouTube Worldwide...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Discover &ldquo;{directoryQuery}&rdquo; on YouTube &rarr;</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
