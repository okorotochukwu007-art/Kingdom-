import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  Compass,
  ExternalLink,
  Film,
  Flame,
  Info,
  Loader2,
  Music,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Tv,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { KingdomVideo } from '../types/kingdom.ts';
import { formatCompactNumber, formatDurationSeconds, formatRelativeDate } from '../utils/formatters.ts';
import { VideoCard } from './VideoCard.tsx';

export type DiscoveryFilterScope =
  | 'all'
  | 'movies'
  | 'ministers'
  | 'sermons'
  | 'worship'
  | 'prayer'
  | 'marriage'
  | 'teachings';

interface DiscoveredMinister {
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

interface IntelligentDiscoveryData {
  query: string;
  scope: DiscoveryFilterScope;
  intent: {
    originalQuery: string;
    isBroad: boolean;
    detectedType: string;
    detectedCategorySlug: string;
    movieGenre?: string;
    detectedMinisterName?: string;
    biblicalThemes: string[];
    intentSummary: string;
    optimizedYouTubeQueries: string[];
    recommendedSubtopics: string[];
    explanation?: string;
  };
  curatedVideos: KingdomVideo[];
  discoveredVideos: KingdomVideo[];
  discoveredMinister: DiscoveredMinister | null;
  isRecommendation: boolean;
  recommendationExplanation?: string;
  broadCategorySections?: Array<{
    title: string;
    categorySlug: string;
    videos: KingdomVideo[];
  }>;
  totalMatches: number;
}

interface IntelligentDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialScope?: DiscoveryFilterScope;
  savedVideoIds: string[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onSelectMinister?: (channelId: string) => void;
  onDiscoveredVideoSelected?: (video: KingdomVideo) => void;
}

const SCOPE_TABS: Array<{ id: DiscoveryFilterScope; label: string; icon: React.ComponentType<any> }> = [
  { id: 'all', label: 'All Content', icon: Compass },
  { id: 'movies', label: 'Christian Movies', icon: Film },
  { id: 'ministers', label: 'Ministers & Teachers', icon: Users },
  { id: 'sermons', label: 'Sermons', icon: Tv },
  { id: 'worship', label: 'Worship & Gospel', icon: Music },
  { id: 'prayer', label: 'Prayer & Warfare', icon: Flame },
  { id: 'marriage', label: 'Marriage & Family', icon: HeartIcon },
  { id: 'teachings', label: 'Christian Living', icon: Sparkles },
];

function HeartIcon(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

const SMART_DISCOVERY_SUGGESTIONS = [
  { text: 'Christian marriage advice', scope: 'marriage' as DiscoveryFilterScope, category: 'Marriage & Courtship' },
  { text: 'Movies about spiritual battles', scope: 'movies' as DiscoveryFilterScope, category: 'Faith Cinema' },
  { text: 'Powerful prayers for midnight', scope: 'prayer' as DiscoveryFilterScope, category: 'Prayer Altars' },
  { text: 'Songs that bring me closer to God', scope: 'worship' as DiscoveryFilterScope, category: 'Deep Worship' },
  { text: 'Apostle Joshua Selman teachings', scope: 'ministers' as DiscoveryFilterScope, category: 'Ministers' },
  { text: 'Mount Zion faith drama movies', scope: 'movies' as DiscoveryFilterScope, category: 'Nigerian Cinema' },
  { text: 'Overcoming fear and anxiety by faith', scope: 'teachings' as DiscoveryFilterScope, category: 'Christian Living' },
  { text: 'Pastor W.F. Kumuyi sermons', scope: 'ministers' as DiscoveryFilterScope, category: 'Ministers' },
];

export const IntelligentDiscoveryModal: React.FC<IntelligentDiscoveryModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  initialScope = 'all',
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onSelectMinister,
  onDiscoveredVideoSelected,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeScope, setActiveScope] = useState<DiscoveryFilterScope>(initialScope);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IntelligentDiscoveryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initial query & scope when opened
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setActiveScope(initialScope);
      setErrorMessage(null);
      if (initialQuery.trim()) {
        performSearch(initialQuery.trim(), initialScope);
      } else {
        // Load broad initial overview
        performSearch('', initialScope);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialQuery, initialScope]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const performSearch = async (searchQuery: string, scope: DiscoveryFilterScope) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const url = `/api/discovery/search?q=${encodeURIComponent(searchQuery)}&scope=${encodeURIComponent(scope)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to retrieve discovery results.');
      }
      const json: IntelligentDiscoveryData = await res.json();
      setData(json);
    } catch (err) {
      setErrorMessage((err as Error).message || 'An error occurred while exploring content.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query.trim(), activeScope);
    } else {
      performSearch('', activeScope);
    }
  };

  const handleScopeChange = (newScope: DiscoveryFilterScope) => {
    setActiveScope(newScope);
    performSearch(query.trim(), newScope);
  };

  const handleSuggestionClick = (sug: typeof SMART_DISCOVERY_SUGGESTIONS[0]) => {
    setQuery(sug.text);
    setActiveScope(sug.scope);
    performSearch(sug.text, sug.scope);
  };

  const handlePlayDiscovered = (video: KingdomVideo) => {
    if (onDiscoveredVideoSelected) {
      onDiscoveredVideoSelected(video);
    }
    onSelectVideo(video);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 sm:pt-10 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl rounded-2xl bg-[#0e0e12] border border-amber-500/40 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ====================================================================
            1. MODAL TOP BAR & INTELLIGENT SEARCH INPUT
        ==================================================================== */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-[#181820] to-[#121217] border-b border-zinc-800">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500 text-zinc-950">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-50 flex items-center gap-2">
                  <span>Intelligent Christian Discovery</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    AI-Powered
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Search across our entire library and discover any Christian movie, minister, sermon, worship or prayer from YouTube
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleFormSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything: 'spiritual battle movies', 'Apostle Selman prayer', 'marriage advice', 'draw me closer worship'..."
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 shadow-inner"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    performSearch('', activeScope);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  title="Clear query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs sm:text-sm transition-colors shrink-0 shadow-lg cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  <span>Discover</span>
                </>
              )}
            </button>
          </form>

          {/* Scope Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 mt-1">
            {SCOPE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleScopeChange(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                      : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            2. RESULTS SCROLL AREA
        ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* AI Search Understanding & Intent Banner */}
          {data?.intent && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-amber-300">
                    {data.intent.intentSummary}
                  </div>
                  {data.intent.explanation && (
                    <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-1">
                      {data.intent.explanation}
                    </p>
                  )}
                </div>
              </div>

              {/* Recommended Subtopic Badges */}
              {data.intent.recommendedSubtopics?.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider hidden md:inline">
                    Themes:
                  </span>
                  {data.intent.recommendedSubtopics.slice(0, 3).map((subtopic) => (
                    <button
                      key={subtopic}
                      type="button"
                      onClick={() => {
                        setQuery(subtopic);
                        performSearch(subtopic, activeScope);
                      }}
                      className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-[11px] text-amber-300/90 border border-amber-500/20 whitespace-nowrap"
                    >
                      {subtopic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Suggestions when query is empty or broad */}
          {(!query.trim() || data?.intent?.isBroad) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Try exploring these intelligent Christian searches:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {SMART_DISCOVERY_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug.text}
                    type="button"
                    onClick={() => handleSuggestionClick(sug)}
                    className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-left transition-all flex flex-col justify-between gap-1 group"
                  >
                    <span className="text-xs font-medium text-zinc-200 group-hover:text-amber-300 line-clamp-1">
                      {sug.text}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                      {sug.category} →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-sm text-zinc-300 font-medium">
                Searching in-app library and scanning public Christian ministries across YouTube...
              </p>
              <p className="text-xs text-zinc-500">
                Understanding search intent and retrieving authentic teachings, worship, and faith cinema
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !loading && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs sm:text-sm text-red-200 flex items-center gap-3">
              <Info className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* DISCOVERED MINISTER CARD (If search specifically targeted or identified a minister) */}
          {data?.discoveredMinister && !loading && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1b1a24] via-[#14141a] to-[#0c0c10] border border-amber-500/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={data.discoveredMinister.avatarUrl}
                    alt={data.discoveredMinister.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        data.discoveredMinister!.name
                      )}&background=27272a&color=f59e0b`;
                    }}
                    className="w-14 h-14 rounded-full object-cover bg-zinc-800 border-2 border-amber-500/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                        {data.discoveredMinister.isCuratedInApp
                          ? 'Featured Ministry'
                          : 'Discovered Ministry from YouTube'}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-50 truncate mt-0.5">
                      {data.discoveredMinister.name}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">
                      {data.discoveredMinister.handle}
                      {data.discoveredMinister.subscriberCount && (
                        <span> · {formatCompactNumber(data.discoveredMinister.subscriberCount)} subscribers</span>
                      )}
                    </p>
                  </div>
                </div>

                {data.discoveredMinister.isCuratedInApp && data.discoveredMinister.curatedChannelId && onSelectMinister && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMinister(data.discoveredMinister!.curatedChannelId!);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors shrink-0"
                  >
                    <span>View Minister Sanctuary</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed max-w-3xl">
                {data.discoveredMinister.bio}
              </p>

              {/* Minister's top videos carousel / grid */}
              {data.discoveredMinister.videos?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  <div className="text-xs font-semibold text-zinc-300">
                    Top Teachings &amp; Messages by {data.discoveredMinister.name} ({data.discoveredMinister.videos.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.discoveredMinister.videos.slice(0, 4).map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onSelect={handlePlayDiscovered}
                        isSaved={savedVideoIds.includes(video.id)}
                        onToggleSave={onToggleSave}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Broad Query Categorized Sections (e.g. for "God", "faith", "pastor", "movie") */}
          {data?.broadCategorySections && !loading && (
            <div className="space-y-6">
              {data.broadCategorySections.map((sec) => (
                <div key={sec.title} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>{sec.title}</span>
                    </h3>
                    <span className="text-xs font-mono text-zinc-500">
                      {sec.videos.length} videos
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sec.videos.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onSelect={handlePlayDiscovered}
                        isSaved={savedVideoIds.includes(video.id)}
                        onToggleSave={onToggleSave}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation explanation banner when showing closest alternatives */}
          {data?.isRecommendation && data.recommendationExplanation && !data.broadCategorySections && (
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center gap-2.5 text-xs text-zinc-300">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{data.recommendationExplanation}</span>
            </div>
          )}

          {/* SECTION 1: Curated In-App Library Matches */}
          {!loading && data && data.curatedVideos.length > 0 && !data.broadCategorySections && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-zinc-950">
                    KINGDOM+ Curated Library
                  </span>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                    Direct Library Matches ({data.curatedVideos.length})
                  </h3>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  Verified in App
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.curatedVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onSelect={handlePlayDiscovered}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: Discovered Public YouTube Content */}
          {!loading && data && data.discoveredVideos.length > 0 && !data.broadCategorySections && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-amber-400" />
                    <span>Public YouTube Discovery</span>
                  </span>
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-100">
                    Expanded Christian Matches ({data.discoveredVideos.length})
                  </h3>
                </div>
                <span className="text-xs text-zinc-400 hidden sm:inline">
                  Streams natively inside KINGDOM+ Player
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.discoveredVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onSelect={handlePlayDiscovered}
                    isSaved={savedVideoIds.includes(video.id)}
                    onToggleSave={onToggleSave}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state when zero results found */}
          {!loading && data && data.curatedVideos.length === 0 && data.discoveredVideos.length === 0 && !data.discoveredMinister && !data.broadCategorySections && (
            <div className="p-10 text-center space-y-3 bg-zinc-950/60 rounded-2xl border border-zinc-800">
              <Compass className="w-10 h-10 text-zinc-500 mx-auto" />
              <h3 className="text-base font-semibold text-zinc-200">
                No matching Christian broadcasts found for &ldquo;{query}&rdquo;
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Try searching for a biblical topic (like faith, prayer, marriage, deliverance), a specific minister (like Apostle Joshua Selman or Pastor Jerry Eze), or Christian movies.
              </p>
            </div>
          )}
        </div>

        {/* ====================================================================
            3. MODAL FOOTER BAR
        ==================================================================== */}
        <div className="p-3.5 px-6 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Strict Christian safety guardrails active — all secular &amp; inappropriate content excluded</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500">Press ESC to exit</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
