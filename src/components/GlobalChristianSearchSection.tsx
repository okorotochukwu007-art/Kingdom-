import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
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
}

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

const CATEGORY_SCOPES = [
  { id: 'all', label: 'All Christian Content' },
  { id: 'sermons-teachings', label: 'Sermons & Teachings' },
  { id: 'worship-praise', label: 'Worship & Praise' },
  { id: 'gospel-music', label: 'Gospel Music' },
  { id: 'prayer-spiritual-warfare', label: 'Prayer & Warfare' },
  { id: 'christian-living', label: 'Christian Living' },
  { id: 'marriage-relationships', label: 'Marriage & Family' },
  { id: 'conferences-events', label: 'Conferences' },
  { id: 'movies', label: 'Christian Movies' },
];

export const GlobalChristianSearchSection: React.FC<GlobalChristianSearchSectionProps> = ({
  localVideos,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onSelectChannel,
  onDiscoveredVideoSelected,
  initialCategoryScope = 'all',
}) => {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [categoryScope, setCategoryScope] = useState(initialCategoryScope);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [globalResults, setGlobalResults] = useState<KingdomVideo[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialCategoryScope && initialCategoryScope !== 'live-special-broadcasts') {
      setCategoryScope(initialCategoryScope);
    }
  }, [initialCategoryScope]);

  // Instant matches from the in-app curated catalog
  const localMatches = useMemo(() => {
    const q = (submittedQuery || query).trim().toLowerCase();
    if (!q || q.length < 2) return [];

    return localVideos
      .filter((v) => {
        const matchesScope =
          categoryScope === 'all' ||
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
  }, [localVideos, query, submittedQuery, categoryScope]);

  const executeGlobalSearch = async (searchPhrase: string, scopeOverride?: string) => {
    const clean = searchPhrase.trim();
    const activeScope = scopeOverride ?? categoryScope;
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
        setGlobalResults(data.results);
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

  return (
    <section className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#16151C] via-[#121215] to-[#09090B] border border-amber-500/30 flex flex-col gap-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>Unlimited Christian &amp; Gospel Discovery</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>100% Christian-Safe Filter Active</span>
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          Search any sermon, minister, gospel song, worship session, or Christian movie — streams natively in KINGDOM+
        </span>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any Christian sermon, pastor, gospel artist, worship song, or Bible topic..."
            className="w-full pl-10 pr-9 py-3 rounded-xl bg-zinc-950/90 border border-zinc-700/90 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
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
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Explore Unlimited Library</span>
            </>
          )}
        </button>
      </form>

      {/* Category Scope Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {CATEGORY_SCOPES.map((sc) => (
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

      {/* Quick Discovery Suggestion Chips */}
      {!submittedQuery && !loadingGlobal && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[11px] font-medium text-zinc-500 shrink-0 flex items-center gap-1">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>Try searching:</span>
          </span>
          {QUICK_CHRISTIAN_SEARCH_TOPICS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setQuery(item.label);
                setCategoryScope(item.category);
                executeGlobalSearch(item.label, item.category);
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/90 text-[11px] text-zinc-300 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Christian Safety Guardrail Block Notice */}
      {blockedMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs sm:text-sm text-amber-200 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{blockedMessage}</span>
        </div>
      )}

      {/* Search Results */}
      {(submittedQuery || loadingGlobal) && !blockedMessage && (
        <div className="flex flex-col gap-6 pt-2 border-t border-zinc-800/80">
          {/* Tier 1: In-App Curated Matches */}
          {localMatches.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                  In-App Curated Library Matches ({localMatches.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {localMatches.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onSelect={onSelectVideo}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                    onSelectChannel={onSelectChannel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tier 2: Unlimited Global Christian Discovery */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-amber-300">
                  Expanded Global Christian Discovery
                </h3>
                {!loadingGlobal && (
                  <span className="text-xs font-mono text-zinc-400">
                    ({uniqueGlobalResults.length} results)
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
                <span>Searching global Christian ministries, worship altars &amp; gospel libraries...</span>
              </div>
            ) : uniqueGlobalResults.length === 0 ? (
              <div className="p-6 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center text-xs sm:text-sm text-zinc-400">
                No additional global Christian broadcasts matched &ldquo;{submittedQuery}&rdquo;. Try another minister, song title, or biblical topic.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {uniqueGlobalResults.map((video) => (
                  <VideoCard
                    key={video.id}
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
