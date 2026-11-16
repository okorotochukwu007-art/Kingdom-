import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  Film,
  Gauge,
  LayoutGrid,
  MessageSquare,
  Play,
  Radio,
  RefreshCw,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView.tsx';
import { AuthAndProfileModal } from './components/AuthAndProfileModal.tsx';
import { ChristianLivingSanctuaryView } from './components/ChristianLivingSanctuaryView.tsx';
import { ChristianMoviesView } from './components/ChristianMoviesView.tsx';
import { CommunityAndMessagingView } from './components/CommunityAndMessagingView.tsx';
import { DailyAltarCard } from './components/DailyAltarCard.tsx';
import {
  buildConsolidatedMinisterProfiles,
  ExploreMinistersView,
  MinisterProfileView,
  MinisterSearchBar,
} from './components/MinisterSearchAndDirectory.tsx';
import { LiveSpecialBroadcastsView } from './components/LiveSpecialBroadcastsView.tsx';
import { GlobalChristianSearchSection } from './components/GlobalChristianSearchSection.tsx';
import { VideoCard } from './components/VideoCard.tsx';
import { WorshipPraiseSanctuaryView } from './components/WorshipPraiseSanctuaryView.tsx';
import { YouTubePlayerModal } from './components/YouTubePlayerModal.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { getActiveUserSession, logoutUser } from './utils/authService.ts';
import { APP_TOAST_EVENT, shareKingdomVideo } from './utils/shareVideo.ts';
import {
  DiscoveryFilterScope,
  IntelligentDiscoveryModal,
} from './components/IntelligentDiscoveryModal.tsx';
import {
  ChristianLivingSubcategoryConfig,
  ContentCategory,
  KingdomChannel,
  KingdomVideo,
  MarriageCollectionConfig,
  MarriageCollectionSlug,
  SystemConfigStatus,
  UserProfile,
  WatchHistoryEntry,
  WorshipSubcategoryConfig,
} from './types/kingdom.ts';
import {
  formatCompactNumber,
  formatRelativeDate,
  getBrowserSupabaseClient,
} from './utils/formatters.ts';
import {
  fetchDiscoveredVideosFromSupabase,
  syncDiscoveredVideoToSupabase,
} from './utils/supabaseCloudSync.ts';
import { useDataSaver } from './hooks/useDataSaver.ts';
import {
  getDataSaverStatus,
  getOptimizedAvatarUrl,
  getOptimizedThumbnailUrl,
} from './utils/dataSaver.ts';

type NavView =
  | 'streaming'
  | 'movies'
  | 'categories'
  | 'ministers'
  | 'community'
  | 'admin';

type RankingMode =
  | 'rails'
  | 'trending_now'
  | 'recently_added'
  | 'most_watched_week'
  | 'most_watched_month'
  | 'most_engaging'
  | 'popular_all_time'
  | 'recommended_for_you';

type TimeWindow = 'all' | '24h' | '7d' | '30d' | '90d';

const EIGHT_MAIN_CATEGORY_SLUGS = [
  'sermons-teachings',
  'gospel-music',
  'worship-praise',
  'prayer-spiritual-warfare',
  'marriage-relationships',
  'christian-living',
  'conferences-events',
  'live-special-broadcasts',
] as const;

export default function App() {
  const { isDataSaverActive, deviceSaveData, toggleQuickDataSaver } = useDataSaver();
  const [dataSaverToast, setDataSaverToast] = useState<string | null>(null);
  const dataSaverToastTimerRef = React.useRef<number | null>(null);

  const [activeView, setActiveView] = useState<NavView>('streaming');
  const [rankingMode, setRankingMode] = useState<RankingMode>('rails');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [visibleCategoryCount, setVisibleCategoryCount] = useState<number>(() =>
    getDataSaverStatus().isDataSaverActive ? 12 : 24
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedMarriageCollectionSlug, setSelectedMarriageCollectionSlug] = useState<
    'all' | MarriageCollectionSlug
  >('all');
  const [marriageSpeakerGenderFilter, setMarriageSpeakerGenderFilter] = useState<
    'all' | 'male' | 'female'
  >('all');
  const [selectedMarriageTeacherId, setSelectedMarriageTeacherId] = useState<string | null>(null);

  // Catalog state
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [marriageCollections, setMarriageCollections] = useState<MarriageCollectionConfig[]>([]);
  const [worshipSubcategories, setWorshipSubcategories] = useState<WorshipSubcategoryConfig[]>([]);
  const [christianLivingSubcategories, setChristianLivingSubcategories] = useState<
    ChristianLivingSubcategoryConfig[]
  >([]);
  const [channels, setChannels] = useState<KingdomChannel[]>([]);
  const [videos, setVideos] = useState<KingdomVideo[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [savedVideoIds, setSavedVideoIds] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemConfigStatus | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Hero Spotlight index
  const [heroIndex, setHeroIndex] = useState(0);

  // Active Video Player Modal & Persistent Mini-Player state
  const [activeVideo, setActiveVideo] = useState<KingdomVideo | null>(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [activeLiveStreams, setActiveLiveStreams] = useState<KingdomVideo[]>([]);
  const pendingDeepLinkIdRef = React.useRef<string | null>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('v') : null
  );

  // Auth & Profile Modal
  const [authToken, setAuthToken] = useState<string | null>(() =>
    localStorage.getItem('kingdom_plus_token')
  );
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingVideoToPlay, setPendingVideoToPlay] = useState<KingdomVideo | null>(null);

  // Intelligent Discovery Modal state across the entire app
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [discoveryInitialScope, setDiscoveryInitialScope] = useState<DiscoveryFilterScope>('all');
  const [discoveryInitialQuery, setDiscoveryInitialQuery] = useState('');

  // Global keyboard shortcut to open Intelligent Discovery (/ or Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setDiscoveryInitialScope('all');
        setIsDiscoveryModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchCatalog = async (tokenOverride?: string | null) => {
    const token = tokenOverride !== undefined ? tokenOverride : authToken;
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      let res = await fetch('/api/catalog', { headers });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        res = await fetch('/catalog-snapshot.json');
      }
      const data = await res.json();
      if (Array.isArray(data.categories)) setCategories(data.categories);
      if (Array.isArray(data.marriageCollections)) setMarriageCollections(data.marriageCollections);
      if (Array.isArray(data.worshipSubcategories)) setWorshipSubcategories(data.worshipSubcategories);
      if (Array.isArray(data.christianLivingSubcategories)) {
        setChristianLivingSubcategories(data.christianLivingSubcategories);
      }
      if (Array.isArray(data.channels)) setChannels(data.channels);
      if (Array.isArray(data.videos)) setVideos(data.videos);
      if (Array.isArray(data.watchHistory)) setWatchHistory(data.watchHistory);
      if (Array.isArray(data.savedVideoIds)) setSavedVideoIds(data.savedVideoIds);
      if (data.systemStatus) setSystemStatus(data.systemStatus);
    } catch (err) {
      try {
        const snapRes = await fetch('/catalog-snapshot.json');
        const data = await snapRes.json();
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.marriageCollections)) setMarriageCollections(data.marriageCollections);
        if (Array.isArray(data.worshipSubcategories)) setWorshipSubcategories(data.worshipSubcategories);
        if (Array.isArray(data.christianLivingSubcategories)) {
          setChristianLivingSubcategories(data.christianLivingSubcategories);
        }
        if (Array.isArray(data.channels)) setChannels(data.channels);
        if (Array.isArray(data.videos)) setVideos(data.videos);
      } catch {
        console.error('Failed to load catalog:', err);
      }
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    fetchCatalog();

    getActiveUserSession()
      .then(({ token, user }) => {
        if (token && user) {
          setAuthToken(token);
          setCurrentUser(user);
        } else {
          setAuthToken(null);
          setCurrentUser(null);
        }
      })
      .catch(() => {});

    const initSupabaseInBrowser = async (url: string, anonKey: string) => {
      (window as any).__KINGDOM_SUPABASE_URL__ = url;
      (window as any).__KINGDOM_SUPABASE_KEY__ = anonKey;
      getBrowserSupabaseClient(url, anonKey);
      if (getDataSaverStatus().isDataSaverActive) return;
      const cloudDiscovered = await fetchDiscoveredVideosFromSupabase();
      if (cloudDiscovered.length > 0) {
        setVideos((prev) => {
          const seen = new Set(prev.map((v) => v.youtube_video_id));
          const extra = cloudDiscovered.filter(
            (item) => item.youtube_video_id && !seen.has(item.youtube_video_id)
          );
          return extra.length > 0 ? [...extra, ...prev] : prev;
        });
      }
    };

    fetch('/api/config/public')
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.includes('application/json')) {
          throw new Error('Static config fallback');
        }
        return r.json();
      })
      .then(async (cfg) => {
        const url =
          cfg?.supabase?.url ||
          (import.meta as any).env?.VITE_SUPABASE_URL ||
          'https://hswbafspnhgojjuyhnqa.supabase.co';
        const anonKey =
          cfg?.supabase?.anonKey ||
          (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
          'sb_publishable_mscwd1aUENWUlwyCkm9aFg_CNXyRyfG';
        if (url && anonKey) {
          await initSupabaseInBrowser(url, anonKey);
        }
      })
      .catch(async () => {
        const fallbackUrl =
          (import.meta as any).env?.VITE_SUPABASE_URL ||
          'https://hswbafspnhgojjuyhnqa.supabase.co';
        const fallbackKey =
          (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
          'sb_publishable_mscwd1aUENWUlwyCkm9aFg_CNXyRyfG';
        if (fallbackUrl && fallbackKey) {
          await initSupabaseInBrowser(fallbackUrl, fallbackKey);
        }
      });

    const syncDailyFreshUploads = async () => {
      if (document.hidden || getDataSaverStatus().isDataSaverActive) return;
      try {
        const res = await fetch('/api/daily-sync');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.freshVideos) && data.freshVideos.length > 0) {
          setVideos((prev) => {
            const seen = new Set(prev.map((v) => v.youtube_video_id));
            const newItems = (data.freshVideos as KingdomVideo[]).filter(
              (item) => item.youtube_video_id && !seen.has(item.youtube_video_id)
            );
            return newItems.length > 0 ? [...newItems, ...prev] : prev;
          });
        }
      } catch {
        // Ignore network errors cleanly
      }
    };

    syncDailyFreshUploads();
    const dailySyncTimer = window.setInterval(syncDailyFreshUploads, 15 * 60 * 1000);
    return () => {
      window.clearInterval(dailySyncTimer);
      if (dataSaverToastTimerRef.current) {
        window.clearTimeout(dataSaverToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (videos.length === 0) {
      const timer = window.setInterval(() => {
        fetchCatalog();
      }, 3000);
      return () => window.clearInterval(timer);
    }
  }, [videos.length]);

  const handleRequestPlayVideo = (vid: KingdomVideo | null | undefined) => {
    if (!vid) return;
    if (!currentUser) {
      setPendingVideoToPlay(vid);
      setShowAuthModal(true);
      return;
    }
    setActiveVideo(vid);
  };

  useEffect(() => {
    const handleAppToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      setDataSaverToast(detail);
      if (dataSaverToastTimerRef.current) {
        window.clearTimeout(dataSaverToastTimerRef.current);
      }
      dataSaverToastTimerRef.current = window.setTimeout(() => {
        setDataSaverToast(null);
      }, 2800);
    };
    window.addEventListener(APP_TOAST_EVENT, handleAppToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, handleAppToast);
  }, []);

  useEffect(() => {
    const target = pendingDeepLinkIdRef.current;
    if (!target) return;
    if (videos.length === 0 && activeLiveStreams.length === 0) return;

    const pool = [...activeLiveStreams, ...videos];
    const matched = pool.find(
      (v) => v.youtube_video_id === target || v.id === target
    );
    if (!matched) return;

    pendingDeepLinkIdRef.current = null;
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('v');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    } catch {
      // Ignore URL cleanup error
    }
    handleRequestPlayVideo(matched);
  }, [videos, activeLiveStreams, currentUser]);

  // Real-time online presence heartbeat across tabs and devices
  useEffect(() => {
    if (!currentUser?.id || !authToken) return;

    const sendHeartbeat = async () => {
      if (document.hidden) return;
      const nowIso = new Date().toISOString();
      let serverUpdated = false;
      try {
        const res = await fetch('/api/community/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Kingdom-User-Id': currentUser.id,
            'X-Kingdom-User-Email': currentUser.email,
          },
          body: JSON.stringify({ active: true }),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          serverUpdated = true;
        }
      } catch {
        // Static / offline fallback handled below
      }

      if (!serverUpdated) {
        try {
          const url =
            (window as any).__KINGDOM_SUPABASE_URL__ ||
            (import.meta as any).env?.VITE_SUPABASE_URL ||
            'https://hswbafspnhgojjuyhnqa.supabase.co';
          const key =
            (window as any).__KINGDOM_SUPABASE_KEY__ ||
            (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
            'sb_publishable_mscwd1aUENWUlwyCkm9aFg_CNXyRyfG';
          const sb = getBrowserSupabaseClient(url, key);
          if (sb) {
            await sb
              .from('profiles')
              .update({ is_online: true, last_seen_at: nowIso })
              .eq('id', currentUser.id);
          }
        } catch {
          // Ignore transient Supabase error
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        sendHeartbeat();
      }
    };

    const handleBeforeUnload = () => {
      try {
        if (typeof navigator.sendBeacon === 'function') {
          const blob = new Blob(
            [JSON.stringify({ userId: currentUser.id, email: currentUser.email })],
            { type: 'application/json' }
          );
          navigator.sendBeacon('/api/community/offline', blob);
        }
      } catch {
        // Ignore unload beacon error
      }
    };

    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 25000);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentUser?.id, currentUser?.email, authToken]);

  const handleAuthSuccess = (token: string, user: UserProfile) => {
    localStorage.setItem('kingdom_plus_token', token);
    setAuthToken(token);
    setCurrentUser(user);
    setShowAuthModal(false);
    fetchCatalog(token);

    if (pendingVideoToPlay) {
      setActiveVideo(pendingVideoToPlay);
      setPendingVideoToPlay(null);
    }
  };

  const handleLogout = async () => {
    await logoutUser(authToken);
    setAuthToken(null);
    setCurrentUser(null);
    setWatchHistory([]);
    setSavedVideoIds([]);
    setPendingVideoToPlay(null);
    setShowAuthModal(false);
    if (activeView === 'admin') setActiveView('streaming');
  };

  const handleToggleSaveVideo = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !authToken) {
      setShowAuthModal(true);
      return;
    }
    const nextSaved = savedVideoIds.includes(videoId)
      ? savedVideoIds.filter((id) => id !== videoId)
      : [...savedVideoIds, videoId];
    setSavedVideoIds(nextSaved);
    try {
      localStorage.setItem(`kingdom_plus_saved_${currentUser.id}`, JSON.stringify(nextSaved));
    } catch {
      // Ignore storage error
    }
    try {
      const res = await fetch('/api/user/saved-videos/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Kingdom-User-Id': currentUser.id,
          'X-Kingdom-User-Email': currentUser.email,
        },
        body: JSON.stringify({ videoId }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.savedVideoIds)) {
          setSavedVideoIds(data.savedVideoIds);
        }
      }
    } catch {
      // Optimistic local state retained on Cloudflare static hosting
    }
  };

  const handleDiscoveredVideoSelected = (discoveredVideo: KingdomVideo) => {
    setVideos((prev) => {
      const exists = prev.some(
        (v) =>
          v.youtube_video_id === discoveredVideo.youtube_video_id || v.id === discoveredVideo.id
      );
      return exists ? prev : [discoveredVideo, ...prev];
    });
    fetch('/api/catalog/import-discovered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video: discoveredVideo }),
    }).catch(() => {});
    syncDiscoveredVideoToSupabase(discoveredVideo).catch(() => {});
  };

  const handleProgressUpdate = async (
    videoId: string,
    progressSeconds: number,
    durationSeconds: number
  ) => {
    if (!currentUser || !authToken) return;
    await fetch('/api/user/watch-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'X-Kingdom-User-Id': currentUser.id,
        'X-Kingdom-User-Email': currentUser.email,
      },
      body: JSON.stringify({ videoId, progressSeconds, durationSeconds }),
    }).catch(() => {});
  };

  const handleVideoUnavailable = async (videoId: string) => {
    await fetch(`/api/videos/${videoId}/unavailable`, { method: 'POST' }).catch(() => {});
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
  };

  // Separate Movie categories (Section 2: Movies remain in their existing section!)
  const movieCategorySlugs = useMemo(
    () =>
      new Set(
        categories.filter((c) => c.section === 'movies').map((c) => c.slug)
      ),
    [categories]
  );

  // The 8 Approved Main Streaming Categories
  const eightMainCategories = useMemo(() => {
    const slugOrder = new Map<string, number>(
      EIGHT_MAIN_CATEGORY_SLUGS.map((slug, idx) => [slug, idx])
    );
    return categories
      .filter((c) => slugOrder.has(c.slug))
      .sort((a, b) => (slugOrder.get(a.slug) ?? 99) - (slugOrder.get(b.slug) ?? 99));
  }, [categories]);

  const streamingVideos = useMemo(
    () =>
      videos.filter(
        (v) =>
          v.is_official_verified &&
          !movieCategorySlugs.has(v.primary_category_slug) &&
          v.channel_type !== 'movie_studio' &&
          v.channel_type !== 'animation_studio'
      ),
    [videos, movieCategorySlugs]
  );

  // Precompute video counts for the 8 Main Categories once per catalog change
  const categoryCountsMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cat of eightMainCategories) {
      counts.set(cat.slug, 0);
    }
    for (const v of streamingVideos) {
      if (counts.has(v.primary_category_slug)) {
        counts.set(v.primary_category_slug, (counts.get(v.primary_category_slug) || 0) + 1);
      }
      for (const sec of v.secondary_category_slugs) {
        if (sec !== v.primary_category_slug && counts.has(sec)) {
          counts.set(sec, (counts.get(sec) || 0) + 1);
        }
      }
    }
    return counts;
  }, [eightMainCategories, streamingVideos]);

  // Consolidated Minister Profiles for Dedicated Minister Search & Explore Ministers Page (Sections 5 & 6)
  const ministerProfiles = useMemo(
    () => buildConsolidatedMinisterProfiles(channels, streamingVideos, eightMainCategories),
    [channels, streamingVideos, eightMainCategories]
  );

  const selectedMinisterProfile = useMemo(() => {
    if (!selectedChannelId) return null;
    return (
      ministerProfiles.find(
        (p) =>
          p.primaryChannel.id === selectedChannelId ||
          p.channelIds.includes(selectedChannelId)
      ) || null
    );
  }, [ministerProfiles, selectedChannelId]);

  // Hero Spotlight Candidates (Strictly Real-Time Active Live Broadcasts on Streaming Page)
  const heroCandidates = useMemo(() => {
    if (activeLiveStreams.length > 0) {
      return activeLiveStreams.slice(0, 5);
    }
    return [...streamingVideos]
      .filter((v) => v.is_nigerian_channel)
      .sort((a, b) => b.trending_score - a.trending_score)
      .slice(0, 5);
  }, [activeLiveStreams, streamingVideos]);

  const currentHero = heroCandidates[heroIndex] || heroCandidates[0] || null;

  // ==========================================================================
  // DEDUPLICATED HOMEPAGE COLLECTIONS ALIGNED TO THE 8 APPROVED MAIN CATEGORIES
  // ==========================================================================
  const homepageCollections = useMemo(() => {
    const usedIds = new Set<string>();

    const pickUnique = (
      pool: KingdomVideo[],
      count: number,
      sortFn: (a: KingdomVideo, b: KingdomVideo) => number
    ): KingdomVideo[] => {
      const sorted = [...pool].filter((v) => !usedIds.has(v.id)).sort(sortFn);
      const picked = sorted.slice(0, count);
      for (const item of picked) {
        usedIds.add(item.id);
      }
      return picked;
    };

    const matchesCategory = (v: KingdomVideo, slug: string) =>
      v.primary_category_slug === slug || v.secondary_category_slugs.includes(slug);

    // 0. Trending in Nigeria (High-velocity Nigerian broadcasts)
    const trendingInNigeria = pickUnique(
      streamingVideos.filter((v) => v.is_nigerian_channel || v.is_trending_pinned),
      4,
      (a, b) => {
        if (a.is_trending_pinned !== b.is_trending_pinned) {
          return a.is_trending_pinned ? -1 : 1;
        }
        return b.trending_score - a.trending_score;
      }
    );

    // 1. Sermons & Teachings (Sermons, Bible teachings, prophetic messages, spiritual growth, Bible study)
    const sermonsAndTeachings = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'sermons-teachings')),
      4,
      (a, b) => b.trending_score - a.trending_score
    );

    // 2. Gospel Music (Official Nigerian gospel songs, music videos & releases)
    const gospelMusic = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'gospel-music')),
      4,
      (a, b) => b.view_count - a.view_count
    );

    // 3. Worship & Praise (Deep worship, praise sessions, thanksgiving, live worship)
    const worshipAndPraise = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'worship-praise')),
      4,
      (a, b) => b.trending_score - a.trending_score
    );

    // 4. Prayer & Spiritual Warfare (NSPPD, Hallelujah Challenge, midnight prayers, deliverance)
    const prayerAndSpiritualWarfare = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'prayer-spiritual-warfare')),
      4,
      (a, b) => b.trending_score - a.trending_score
    );

    // 5. Marriage & Relationships (Strictly verified dating, courtship, singles, marriage & family teachings)
    const marriageAndRelationships = pickUnique(
      streamingVideos.filter((v) => v.primary_category_slug === 'marriage-relationships'),
      4,
      (a, b) => b.trending_score - a.trending_score
    );

    // 6. Christian Living (Christian motivation, faith & purpose, personal development, character, testimonies)
    const christianLiving = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'christian-living')),
      4,
      (a, b) => b.trending_score - a.trending_score
    );

    // 7. Conferences & Events (The Experience Lagos, Shiloh, Holy Ghost Congress, WAFBEC, Koinonia)
    const conferencesAndEvents = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'conferences-events')),
      4,
      (a, b) => b.trending_score - a.trending_score
    );

    // 8. Live & Special Broadcasts (Live church services, live prayer broadcasts, special live programmes)
    const liveAndSpecialBroadcasts = pickUnique(
      streamingVideos.filter((v) => matchesCategory(v, 'live-special-broadcasts')),
      4,
      (a, b) => {
        if (Boolean(a.is_live_now) !== Boolean(b.is_live_now)) {
          return a.is_live_now ? -1 : 1;
        }
        return b.trending_score - a.trending_score;
      }
    );

    // 9. Recently Added (Newest verified uploads across all channels)
    const recentlyAdded = pickUnique(
      streamingVideos,
      4,
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    return {
      trendingInNigeria,
      sermonsAndTeachings,
      gospelMusic,
      worshipAndPraise,
      prayerAndSpiritualWarfare,
      marriageAndRelationships,
      christianLiving,
      conferencesAndEvents,
      liveAndSpecialBroadcasts,
      recentlyAdded,
    };
  }, [streamingVideos]);

  const savedVideosList = useMemo(
    () => videos.filter((v) => savedVideoIds.includes(v.id)),
    [videos, savedVideoIds]
  );

  // ==========================================================================
  // 7-MODE VIDEO RANKING SYSTEM + RECENCY WINDOW FILTER
  // ==========================================================================
  const filteredFlatVideos = useMemo(() => {
    const nowMs = Date.now();
    let list = [...streamingVideos];

    // 1. Apply Recency Time Window Filter (24h, 7d, 30d, 90d)
    if (timeWindow !== 'all') {
      const maxAgeDays =
        timeWindow === '24h'
          ? 1
          : timeWindow === '7d'
          ? 7
          : timeWindow === '30d'
          ? 30
          : 90;
      const cutoffMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
      list = list.filter((v) => new Date(v.published_at).getTime() >= cutoffMs);
    }

    // 2. Apply Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channel_title.toLowerCase().includes(q) ||
          v.primary_category_name.toLowerCase().includes(q) ||
          (v.subcategory_label && v.subcategory_label.toLowerCase().includes(q)) ||
          v.description.toLowerCase().includes(q)
      );
    }

    // 3. Apply Ranking Mode
    if (rankingMode === 'trending_now') {
      list.sort((a, b) => b.trending_score - a.trending_score);
    } else if (rankingMode === 'recently_added') {
      list.sort(
        (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    } else if (rankingMode === 'most_watched_week') {
      const weekCutoff = nowMs - 7 * 24 * 60 * 60 * 1000;
      const weekVideos = list.filter((v) => new Date(v.published_at).getTime() >= weekCutoff);
      list = (weekVideos.length > 0 ? weekVideos : list).sort(
        (a, b) => b.views_per_day - a.views_per_day
      );
    } else if (rankingMode === 'most_watched_month') {
      const monthCutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
      const monthVideos = list.filter((v) => new Date(v.published_at).getTime() >= monthCutoff);
      list = (monthVideos.length > 0 ? monthVideos : list).sort(
        (a, b) => b.view_count - a.view_count
      );
    } else if (rankingMode === 'most_engaging') {
      list = list
        .filter((v) => v.view_count >= 1000)
        .sort((a, b) => b.engagement_rate - a.engagement_rate);
    } else if (rankingMode === 'popular_all_time') {
      list.sort((a, b) => b.evergreen_score - a.evergreen_score);
    } else if (rankingMode === 'recommended_for_you') {
      const favSlugs = new Set(
        currentUser?.preferences?.favoriteCategories?.length
          ? currentUser.preferences.favoriteCategories
          : ['sermons-teachings', 'worship-praise', 'prayer-spiritual-warfare', 'gospel-music']
      );
      const watchedChannels = new Set(
        watchHistory.map((w) => w.video?.channel_id).filter(Boolean)
      );
      list.sort((a, b) => {
        const aBoost =
          (favSlugs.has(a.primary_category_slug) ? 1.5 : 1.0) *
          (watchedChannels.has(a.channel_id) ? 1.4 : 1.0);
        const bBoost =
          (favSlugs.has(b.primary_category_slug) ? 1.5 : 1.0) *
          (watchedChannels.has(b.channel_id) ? 1.4 : 1.0);
        return b.trending_score * bBoost - a.trending_score * aBoost;
      });
    }

    return list;
  }, [streamingVideos, searchQuery, rankingMode, timeWindow, currentUser, watchHistory]);

  const isAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'moderator';

  const switchView = (nextView: NavView, resetMinisters = false) => {
    React.startTransition(() => {
      if (resetMinisters) setSelectedChannelId(null);
      setActiveView(nextView);
    });
    window.scrollTo(0, 0);
  };

  const openChannelCatalog = (channelId: string) => {
    React.startTransition(() => {
      setSelectedChannelId(channelId);
      setActiveView('ministers');
    });
    window.scrollTo(0, 0);
  };

  const handleQuickToggleDataSaver = () => {
    const nextActive = toggleQuickDataSaver();
    setVisibleCategoryCount(nextActive ? 12 : 24);
    setDataSaverToast(
      nextActive
        ? 'Data-Saver On · Lighter thumbnails & reduced background data'
        : 'Standard Quality · Full HD artwork & live updates'
    );
    if (dataSaverToastTimerRef.current) {
      window.clearTimeout(dataSaverToastTimerRef.current);
    }
    dataSaverToastTimerRef.current = window.setTimeout(() => {
      setDataSaverToast(null);
    }, 2600);
  };

  const openCategoryExplorer = (slug: string) => {
    React.startTransition(() => {
      setSelectedCategorySlug(slug);
      setVisibleCategoryCount(isDataSaverActive ? 12 : 24);
      setActiveView('categories');
    });
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#09090B] text-[#FAFAFA] flex flex-col">
      {/* ====================================================================
          TOP BAR CONTRACT (3 Zones separated by gap-8)
      ==================================================================== */}
      <header className="sticky top-0 z-40 w-full bg-[#09090B]/95 md:backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-[1440px] w-full mx-auto flex items-center justify-between gap-2 sm:gap-8 px-3.5 sm:px-8 py-3 sm:py-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setRankingMode('rails');
              setTimeWindow('all');
              setSearchQuery('');
              switchView('streaming');
            }}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-amber-400 whitespace-nowrap shrink-0"
          >
            KINGDOM+
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
            <a
              href="#streaming"
              onClick={(e) => {
                e.preventDefault();
                switchView('streaming');
              }}
              className={`hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'streaming'
                  ? 'text-zinc-50 underline underline-offset-8 decoration-amber-400 decoration-2'
                  : ''
              }`}
            >
              Streaming
            </a>
            <a
              href="#categories"
              onClick={(e) => {
                e.preventDefault();
                switchView('categories');
              }}
              className={`hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'categories'
                  ? 'text-zinc-50 underline underline-offset-8 decoration-amber-400 decoration-2'
                  : ''
              }`}
            >
              Categories
            </a>
            <a
              href="#ministers"
              onClick={(e) => {
                e.preventDefault();
                switchView('ministers', true);
              }}
              className={`hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'ministers'
                  ? 'text-zinc-50 underline underline-offset-8 decoration-amber-400 decoration-2'
                  : ''
              }`}
            >
              Explore Ministers
            </a>
            <a
              href="#movies"
              onClick={(e) => {
                e.preventDefault();
                switchView('movies');
              }}
              className={`hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'movies'
                  ? 'text-zinc-50 underline underline-offset-8 decoration-amber-400 decoration-2'
                  : ''
              }`}
            >
              Movies
            </a>
            <a
              href="#community"
              onClick={(e) => {
                e.preventDefault();
                switchView('community');
              }}
              className={`hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'community'
                  ? 'text-zinc-50 underline underline-offset-8 decoration-amber-400 decoration-2'
                  : ''
              }`}
            >
              Community
            </a>
          </nav>

          {/* Zone 3: Data Saver, Install, Search & Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleQuickToggleDataSaver}
              aria-pressed={isDataSaverActive}
              title={
                isDataSaverActive
                  ? `Data-Saver Mode is ON${deviceSaveData ? ' (device setting detected)' : ''}. Tap for Standard Quality.`
                  : 'Turn on Data-Saver Mode for lighter thumbnails & lower mobile data usage.'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isDataSaverActive
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Gauge className={`w-3.5 h-3.5 ${isDataSaverActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline">{isDataSaverActive ? 'Data Saver' : 'Saver'}</span>
              {isDataSaverActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 sm:hidden" />
              )}
            </button>
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => {
                setDiscoveryInitialScope('all');
                setIsDiscoveryModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors shadow-sm"
              title="Intelligent Discovery & Search across KINGDOM+ Christian Library & Global Network (Shortcut: /)"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Intelligent Discovery</span>
              <kbd className="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-800/80 rounded border border-zinc-700">
                /
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3 sm:px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              {currentUser ? `${currentUser.full_name.split(' ')[0]}'s Sanctuary` : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {dataSaverToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl flex items-center gap-2 max-w-[92vw] whitespace-nowrap">
          {dataSaverToast.toLowerCase().includes('data') ||
          dataSaverToast.toLowerCase().includes('quality') ? (
            <Gauge className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{dataSaverToast}</span>
        </div>
      )}

      {/* Admin Workspace Bar (Visible when signed in as Admin/Moderator) */}
      {isAdmin && (
        <div className="bg-zinc-900/90 border-b border-zinc-800">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-2 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Editorial Mode Active ({currentUser?.role}) · 8 Main Categories ·{' '}
                {channels.length} approved creators · {videos.length} verified broadcasts &amp; movies preserved
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setActiveView(activeView === 'admin' ? 'streaming' : 'admin')
              }
              className="font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              {activeView === 'admin' ? 'Return to Streaming Experience' : 'Open Admin Command Center →'}
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          MAIN VIEWPORT ROUTER
      ==================================================================== */}
      <main className="flex-1 pb-24 md:pb-0">
        {/* 1. STREAMING HOMEPAGE */}
        {activeView === 'streaming' && (
          <div className="flex flex-col gap-6 sm:gap-10 pb-12 sm:pb-16">
            {/* CINEMATIC HERO SPOTLIGHT (CRYSTAL-CLEAR HD BACKDROP ON MOBILE & DESKTOP) */}
            <section className="relative w-full min-h-[410px] sm:min-h-[470px] lg:min-h-[540px] border-b border-zinc-800/80 flex items-end overflow-hidden bg-[#09090B]">
              <img
                src={
                  currentHero
                    ? getOptimizedThumbnailUrl(currentHero, isDataSaverActive, 'hero')
                    : '/src/assets/images/kingdom_hero_sanctuary_backdrop_1794402594694.jpg'
                }
                alt={currentHero ? currentHero.title : 'KINGDOM+ Sanctuary'}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (currentHero && target.src !== currentHero.thumbnail_high_url) {
                    target.src = currentHero.thumbnail_high_url;
                  } else {
                    target.src =
                      '/src/assets/images/kingdom_hero_sanctuary_backdrop_1794402594694.jpg';
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover object-center opacity-95 sm:opacity-85 transition-opacity duration-500"
              />
              {/* Desktop-only subtle left scrim + Clean lower-third readability scrim so upper backdrop stays razor-sharp & vibrant on mobile */}
              <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#09090B]/90 via-[#09090B]/55 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/65 via-40% to-transparent" />

              <div className="relative z-10 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-end">
                <div className="lg:col-span-8 min-w-0 w-full flex flex-col gap-2.5 sm:gap-3.5">
                  {/* Concise 1-Line Kicker */}
                  <div className="inline-flex self-start items-center flex-wrap gap-2 px-2.5 py-1 rounded-full bg-black/70 border border-white/10 text-xs font-medium text-amber-400">
                    {currentHero?.is_live_now && currentHero.live_broadcast_content === 'live' ? (
                      <span className="inline-flex items-center gap-1.5 text-red-400 font-semibold">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span>LIVE NOW</span>
                      </span>
                    ) : (
                      <span>{currentHero?.primary_category_name || 'Featured'}</span>
                    )}
                    {currentHero && (
                      <>
                        <span aria-hidden="true" className="text-zinc-500">·</span>
                        <span className="text-zinc-100">
                          {currentHero.artist_name || currentHero.channel_title}
                        </span>
                      </>
                    )}
                  </div>

                  <h1
                    className="font-display text-2xl sm:text-4xl lg:text-5xl font-semibold text-white leading-[1.15] tracking-tight max-w-3xl line-clamp-2 sm:line-clamp-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
                    style={{ textWrap: 'balance' }}
                  >
                    {currentHero
                      ? currentHero.title
                      : 'Nigerian & Global Christian Worship, Sermons, and Fellowship'}
                  </h1>

                  {currentHero && (
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-zinc-200 drop-shadow">
                      <span>{formatCompactNumber(currentHero.view_count)} views</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans text-zinc-300">
                        {formatRelativeDate(currentHero.published_at)}
                      </span>
                    </div>
                  )}

                  {currentHero && (
                    <div className="flex items-center flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRequestPlayVideo(currentHero)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(245,158,11,0.35)] active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Watch Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggleSaveVideo(currentHero.id, e)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-black/75 hover:bg-zinc-900 border border-white/15 text-zinc-100 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                      >
                        {savedVideoIds.includes(currentHero.id) ? (
                          <>
                            <Check className="w-4 h-4 text-amber-400" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4" />
                            <span>Watchlist</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => shareKingdomVideo(currentHero)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-black/75 hover:bg-zinc-900 border border-white/15 text-zinc-100 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                        title="Share on WhatsApp, Telegram, or Messages"
                      >
                        <Share2 className="w-4 h-4 text-amber-400" />
                        <span>Share</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right 4 Columns: Horizontal Swipeable on Mobile, Vertical Stack on Desktop */}
                {heroCandidates.length > 1 && (
                  <div className="lg:col-span-4 min-w-0 w-full flex lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:bg-black/65 lg:border lg:border-white/10 rounded-xl lg:p-3">
                    {heroCandidates.map((cand, idx) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setHeroIndex(idx)}
                        className={`min-w-[220px] lg:min-w-0 lg:w-full text-left p-2 rounded-xl transition-colors flex items-center gap-2.5 shrink-0 ${
                          idx === heroIndex
                            ? 'bg-amber-500/25 border border-amber-400/60 shadow-lg'
                            : 'bg-black/75 lg:bg-transparent hover:bg-zinc-900/70 border border-white/10 lg:border-transparent'
                        }`}
                      >
                        <img
                          src={getOptimizedThumbnailUrl(cand, isDataSaverActive, 'mini')}
                          alt={cand.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-12 sm:w-14 aspect-video rounded-md object-cover bg-zinc-900 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-100 truncate">
                            {cand.title}
                          </div>
                          <div className="text-[10px] text-zinc-300 truncate font-mono tabular-nums">
                            {cand.channel_title}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ================================================================
                STREAMING PAGE: ONLY LIVE BROADCASTS, COUNTDOWN & CATEGORY PORTAL
                (All other videos live strictly inside their fitting Categories)
            ================================================================ */}
            <section className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 flex flex-col gap-6 sm:gap-8">
              {/* 0. DAILY ALTAR STREAK & VERSE OF THE DAY */}
              <DailyAltarCard userId={currentUser?.id} />

              {/* 1. LIVE SERVICE COUNTDOWN, DAILY PRAYER SCHEDULE & LIVE BROADCASTS */}
              <LiveSpecialBroadcastsView
                videos={streamingVideos}
                channels={channels}
                savedVideoIds={savedVideoIds}
                onSelectVideo={handleRequestPlayVideo}
                onToggleSave={handleToggleSaveVideo}
                onSelectChannel={openChannelCatalog}
                onActiveLiveStreamsChange={setActiveLiveStreams}
              />

              {/* 2. CONTINUE WATCHING (If member has active progress) */}
              {watchHistory.length > 0 && (
                <section className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                      Continue Watching
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {watchHistory.slice(0, 4).map(
                      (entry) =>
                        entry.video && (
                          <VideoCard
                            key={entry.id}
                            video={entry.video}
                            onSelect={handleRequestPlayVideo}
                            isSaved={savedVideoIds.includes(entry.video.id)}
                            onToggleSave={handleToggleSaveVideo}
                            watchProgressSeconds={entry.progress_seconds}
                            watchDurationSeconds={entry.duration_seconds}
                            onSelectChannel={openChannelCatalog}
                          />
                        )
                    )}
                  </div>
                </section>
              )}

              {/* 3. BROWSE ALL 8 CATEGORIES (Where Sermons, Worship, Gospel Music, Marriage, Christian Living & Conferences live) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#121215] border border-zinc-800/90 flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                    Browse Videos by Category
                  </h2>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => switchView('ministers', true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>Explore Ministers ({ministerProfiles.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchView('movies')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-amber-400 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Christian Movies →</span>
                    </button>
                  </div>
                </div>

                <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 overflow-x-auto no-scrollbar gap-2.5 pb-1 sm:pb-0 snap-x snap-mandatory">
                  {eightMainCategories.map((cat, index) => {
                    const count =
                      cat.slug === 'live-special-broadcasts'
                        ? activeLiveStreams.length
                        : categoryCountsMap.get(cat.slug) || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => openCategoryExplorer(cat.slug)}
                        className="min-w-[175px] sm:min-w-0 shrink-0 snap-start group p-3.5 sm:p-3 rounded-xl bg-zinc-900/80 hover:bg-amber-500/15 border border-zinc-800/90 hover:border-amber-500/50 text-left transition-all flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-500 group-hover:text-amber-400">
                          <span>0{index + 1}</span>
                          <span>
                            {cat.slug === 'live-special-broadcasts'
                              ? `${count} live now`
                              : `${count} videos`}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-zinc-100 group-hover:text-amber-300 leading-snug line-clamp-2">
                          {cat.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. UNLIMITED GLOBAL CHRISTIAN & GOSPEL DISCOVERY SEARCH */}
              <GlobalChristianSearchSection
                localVideos={videos}
                savedVideoIds={savedVideoIds}
                onSelectVideo={handleRequestPlayVideo}
                onToggleSave={handleToggleSaveVideo}
                onSelectChannel={openChannelCatalog}
                onDiscoveredVideoSelected={handleDiscoveredVideoSelected}
              />

              {/* 5. DEDICATED MINISTER SEARCH BAR */}
              <MinisterSearchBar
                profiles={ministerProfiles}
                onSelectMinister={openChannelCatalog}
                variant="homepage"
              />
            </section>
          </div>
        )}

        {/* 1B. CHRISTIAN MOVIES, BIBLE STORIES, ANIMATIONS & CARTOONS PAGE (Preserved Intact in Movies Section) */}
        {activeView === 'movies' && (
          <ChristianMoviesView
            categories={categories}
            channels={channels}
            videos={videos}
            savedVideoIds={savedVideoIds}
            onSelectVideo={handleRequestPlayVideo}
            onToggleSave={handleToggleSaveVideo}
            onDiscoveredVideoSelected={handleDiscoveredVideoSelected}
          />
        )}

        {/* 2. CATEGORIES EXPLORER VIEW (THE 8 APPROVED MAIN STREAMING CATEGORIES) */}
        {activeView === 'categories' && (
          <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-5 sm:py-8 flex flex-col gap-5 sm:gap-7">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <h1 className="font-display text-xl sm:text-3xl font-semibold text-zinc-50">
                Browse by Category
              </h1>
              <button
                type="button"
                onClick={() => switchView('ministers', true)}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors shrink-0"
              >
                Ministers ({ministerProfiles.length}) →
              </button>
            </div>

            {/* 8 Main Streaming Category Selector Tabs (Swipeable on Mobile, Wrap on Desktop) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  React.startTransition(() => {
                    setSelectedCategorySlug('all');
                    setVisibleCategoryCount(isDataSaverActive ? 12 : 24);
                  });
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategorySlug === 'all'
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                }`}
              >
                All Categories ({streamingVideos.length})
              </button>
              {eightMainCategories.map((cat) => {
                const count =
                  cat.slug === 'live-special-broadcasts'
                    ? activeLiveStreams.length
                    : categoryCountsMap.get(cat.slug) || 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      React.startTransition(() => {
                        setSelectedCategorySlug(cat.slug);
                        setVisibleCategoryCount(isDataSaverActive ? 12 : 24);
                      });
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedCategorySlug === cat.slug
                        ? 'bg-amber-500 text-zinc-950 font-semibold'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>

            {/* UNLIMITED GLOBAL CHRISTIAN & GOSPEL SEARCH (Scoped to Active Category) */}
            <GlobalChristianSearchSection
              localVideos={videos}
              savedVideoIds={savedVideoIds}
              onSelectVideo={handleRequestPlayVideo}
              onToggleSave={handleToggleSaveVideo}
              onSelectChannel={openChannelCatalog}
              onDiscoveredVideoSelected={handleDiscoveredVideoSelected}
              initialCategoryScope={selectedCategorySlug}
            />

            {/* Selected Category Videos Grid, Worship & Praise Sanctuary, Christian Living Sanctuary, or Marriage & Relationships Sanctuary */}
            {(() => {
              if (selectedCategorySlug === 'worship-praise') {
                return (
                  <WorshipPraiseSanctuaryView
                    videos={streamingVideos}
                    channels={channels}
                    worshipSubcategories={worshipSubcategories}
                    savedVideoIds={savedVideoIds}
                    onSelectVideo={handleRequestPlayVideo}
                    onToggleSave={handleToggleSaveVideo}
                    onSelectChannel={openChannelCatalog}
                  />
                );
              }

              if (selectedCategorySlug === 'christian-living') {
                return (
                  <ChristianLivingSanctuaryView
                    videos={streamingVideos}
                    channels={channels}
                    christianLivingSubcategories={christianLivingSubcategories}
                    savedVideoIds={savedVideoIds}
                    onSelectVideo={handleRequestPlayVideo}
                    onToggleSave={handleToggleSaveVideo}
                    onSelectChannel={openChannelCatalog}
                  />
                );
              }

              if (selectedCategorySlug === 'live-special-broadcasts') {
                return (
                  <LiveSpecialBroadcastsView
                    videos={streamingVideos}
                    channels={channels}
                    savedVideoIds={savedVideoIds}
                    onSelectVideo={handleRequestPlayVideo}
                    onToggleSave={handleToggleSaveVideo}
                    onSelectChannel={openChannelCatalog}
                    onActiveLiveStreamsChange={setActiveLiveStreams}
                  />
                );
              }

              const categoryMatches = streamingVideos
                .filter(
                  (v) =>
                    selectedCategorySlug === 'all' ||
                    v.primary_category_slug === selectedCategorySlug ||
                    v.secondary_category_slugs.includes(selectedCategorySlug)
                )
                .sort((a, b) => b.trending_score - a.trending_score);

              if (selectedCategorySlug === 'marriage-relationships') {
                const featuredMarriageTeachers = channels.filter(
                  (ch) =>
                    ch.is_featured_marriage_teacher ||
                    ch.supported_categories?.includes('marriage-relationships')
                );
                const filteredTeachers = featuredMarriageTeachers.filter((ch) => {
                  if (marriageSpeakerGenderFilter === 'male') return ch.speaker_gender === 'male';
                  if (marriageSpeakerGenderFilter === 'female') return ch.speaker_gender === 'female';
                  return true;
                });

                const marriageFilteredVideos = categoryMatches.filter((v) => {
                  if (selectedMarriageTeacherId && v.channel_id !== selectedMarriageTeacherId) {
                    return false;
                  }
                  if (marriageSpeakerGenderFilter === 'male') {
                    return (
                      v.speaker_gender === 'male' ||
                      v.marriage_collections?.includes('men-and-relationships')
                    );
                  }
                  if (marriageSpeakerGenderFilter === 'female') {
                    return (
                      v.speaker_gender === 'female' ||
                      v.marriage_collections?.includes('women-and-relationships')
                    );
                  }
                  return true;
                });

                const activeCollections = marriageCollections
                  .filter((col) => col.is_active)
                  .sort((a, b) => a.display_order - b.display_order);

                return (
                  <div className="flex flex-col gap-6 sm:gap-8">
                    <div className="p-4 sm:p-6 rounded-2xl bg-[#121215] border border-zinc-800/90 flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3.5">
                        <div className="flex items-baseline gap-2.5">
                          <h2 className="font-display text-xl sm:text-2xl font-semibold text-zinc-50">
                            Marriage &amp; Relationships
                          </h2>
                          <span className="text-xs font-mono tabular-nums text-amber-400">
                            {marriageFilteredVideos.length} Teachings
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                          {[
                            { id: 'all', label: 'All Voices' },
                            { id: 'female', label: 'Female Speakers' },
                            { id: 'male', label: 'Male Speakers' },
                          ].map((gf) => (
                            <button
                              key={gf.id}
                              type="button"
                              onClick={() => {
                                setMarriageSpeakerGenderFilter(gf.id as any);
                                setSelectedMarriageTeacherId(null);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                                marriageSpeakerGenderFilter === gf.id
                                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                              }`}
                            >
                              {gf.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                          type="button"
                          onClick={() => setSelectedMarriageTeacherId(null)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                            selectedMarriageTeacherId === null
                              ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                              : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          All Teachers ({filteredTeachers.length})
                        </button>
                        {filteredTeachers.map((teacher) => {
                          const teacherMarriageCount = categoryMatches.filter(
                            (v) => v.channel_id === teacher.id
                          ).length;
                          const isSelected = selectedMarriageTeacherId === teacher.id;
                          return (
                            <button
                              key={teacher.id}
                              type="button"
                              onClick={() =>
                                setSelectedMarriageTeacherId(isSelected ? null : teacher.id)
                              }
                              className={`px-3 py-2 rounded-xl border transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[44px] ${
                                isSelected
                                  ? 'bg-amber-500/15 border-amber-500 text-zinc-50'
                                  : 'bg-zinc-900/70 border-zinc-800/90 hover:border-zinc-700 text-zinc-200'
                              }`}
                            >
                              <img
                                src={getOptimizedAvatarUrl(teacher.avatar_url, isDataSaverActive)}
                                alt={teacher.title}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover bg-zinc-800 shrink-0"
                              />
                              <div className="text-left">
                                <div className="text-xs font-semibold text-zinc-100">
                                  {(teacher.speaker_name || teacher.title).split('(')[0].trim()}
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                  {teacherMarriageCount} videos
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:flex-wrap pt-2 border-t border-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => setSelectedMarriageCollectionSlug('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            selectedMarriageCollectionSlug === 'all'
                              ? 'bg-zinc-100 text-zinc-950 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                          }`}
                        >
                          All Topics ({marriageFilteredVideos.length})
                        </button>
                        {activeCollections.map((col) => {
                          const colCount = marriageFilteredVideos.filter((v) =>
                            v.marriage_collections?.includes(col.slug)
                          ).length;
                          return (
                            <button
                              key={col.slug}
                              type="button"
                              onClick={() => setSelectedMarriageCollectionSlug(col.slug)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                                selectedMarriageCollectionSlug === col.slug
                                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                                  : 'bg-zinc-900 text-zinc-300 hover:text-zinc-100 border border-zinc-800'
                              }`}
                            >
                              {col.name} ({colCount})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedMarriageCollectionSlug !== 'all' ? (
                      (() => {
                        const activeCol = activeCollections.find(
                          (c) => c.slug === selectedMarriageCollectionSlug
                        );
                        const colVideos = marriageFilteredVideos.filter((v) =>
                          v.marriage_collections?.includes(selectedMarriageCollectionSlug)
                        );
                        return (
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                                {activeCol?.name} ({colVideos.length})
                              </h3>
                              <button
                                type="button"
                                onClick={() => setSelectedMarriageCollectionSlug('all')}
                                className="text-xs text-amber-400 hover:underline"
                              >
                                Show All Topics
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                              {colVideos.map((video) => (
                                <VideoCard
                                  key={video.id}
                                  video={video}
                                  onSelect={handleRequestPlayVideo}
                                  isSaved={savedVideoIds.includes(video.id)}
                                  onToggleSave={handleToggleSaveVideo}
                                  onSelectChannel={openChannelCatalog}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex flex-col gap-8 sm:gap-10">
                        {activeCollections.map((col) => {
                          const colVideos = marriageFilteredVideos.filter((v) =>
                            v.marriage_collections?.includes(col.slug)
                          );
                          if (colVideos.length === 0) return null;
                          return (
                            <section key={col.slug} className="flex flex-col gap-3.5">
                              <div className="flex items-center justify-between">
                                <h3 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
                                  {col.name}{' '}
                                  <span className="text-sm font-mono text-zinc-400 font-normal">
                                    ({colVideos.length})
                                  </span>
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMarriageCollectionSlug(col.slug)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors"
                                >
                                  <span>See All</span>
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                                {colVideos.slice(0, 4).map((video) => (
                                  <VideoCard
                                    key={`${col.slug}-${video.id}`}
                                    video={video}
                                    onSelect={handleRequestPlayVideo}
                                    isSaved={savedVideoIds.includes(video.id)}
                                    onToggleSave={handleToggleSaveVideo}
                                    onSelectChannel={openChannelCatalog}
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
              }

              const visibleMatches = categoryMatches.slice(0, visibleCategoryCount);
              const hasMoreCategoryVideos = categoryMatches.length > visibleMatches.length;

              return (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {visibleMatches.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onSelect={handleRequestPlayVideo}
                        isSaved={savedVideoIds.includes(video.id)}
                        onToggleSave={handleToggleSaveVideo}
                        onSelectChannel={openChannelCatalog}
                      />
                    ))}
                  </div>

                  {hasMoreCategoryVideos && (
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleCategoryCount((c) => c + (isDataSaverActive ? 12 : 24))
                        }
                        className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-semibold transition-colors shadow-lg"
                      >
                        Load More Videos ({visibleMatches.length} of {categoryMatches.length})
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* 3. EXPLORE MINISTERS DIRECTORY & DEDICATED MINISTER RESULTS VIEW (Sections 5 & 6) */}
        {activeView === 'ministers' &&
          (selectedMinisterProfile ? (
            <MinisterProfileView
              profile={selectedMinisterProfile}
              allProfiles={ministerProfiles}
              categories={eightMainCategories}
              savedVideoIds={savedVideoIds}
              watchHistory={watchHistory}
              onSelectVideo={handleRequestPlayVideo}
              onToggleSave={handleToggleSaveVideo}
              onSelectMinister={openChannelCatalog}
              onBack={() => setSelectedChannelId(null)}
            />
          ) : (
            <ExploreMinistersView
              profiles={ministerProfiles}
              onSelectMinister={openChannelCatalog}
              onSelectVideo={handleRequestPlayVideo}
              onDiscoveredVideoSelected={handleDiscoveredVideoSelected}
              savedVideoIds={savedVideoIds}
              onToggleSave={handleToggleSaveVideo}
            />
          ))}

        {/* 4 & 5. UNIFIED COMMUNITY HUB (FELLOWSHIP ROOMS, PRIVATE CHAT & MEMBERS) */}
        {activeView === 'community' && (
          <CommunityAndMessagingView
            currentUser={currentUser}
            authToken={authToken}
            onRequireAuth={() => setShowAuthModal(true)}
          />
        )}

        {/* 6. ADMIN COMMAND CENTER VIEW */}
        {activeView === 'admin' && authToken && isAdmin && (
          <AdminDashboardView
            authToken={authToken}
            categories={categories}
            onCatalogChanged={() => fetchCatalog()}
            onPreviewVideo={handleRequestPlayVideo}
          />
        )}
      </main>

      {/* ====================================================================
          QUIET FOOTER
      ==================================================================== */}
      <footer className="border-t border-zinc-800/80 bg-[#09090B] py-8 pb-24 md:pb-8 mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-zinc-200">KINGDOM+</span>
            <span>·</span>
            <span>Christian Streaming &amp; Fellowship</span>
          </div>

          <div className="flex items-center flex-wrap gap-5">
            <button
              type="button"
              onClick={() => setActiveView('streaming')}
              className="hover:text-zinc-300 transition-colors"
            >
              Streaming
            </button>
            <button
              type="button"
              onClick={() => setActiveView('categories')}
              className="hover:text-zinc-300 transition-colors"
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedChannelId(null);
                setActiveView('ministers');
              }}
              className="hover:text-zinc-300 transition-colors"
            >
              Ministers
            </button>
            <button
              type="button"
              onClick={() => setActiveView('movies')}
              className="hover:text-zinc-300 transition-colors"
            >
              Movies
            </button>
            <button
              type="button"
              onClick={() => setActiveView('community')}
              className="hover:text-zinc-300 transition-colors"
            >
              Community
            </button>
          </div>
        </div>
      </footer>

      {/* ====================================================================
          MOBILE BOTTOM THUMB NAVIGATION BAR (iPhone & Android Ergonomics)
      ==================================================================== */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#09090B]/95 border-t border-zinc-800/90 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {[
            { id: 'streaming', label: 'Home', icon: Play },
            { id: 'categories', label: 'Categories', icon: LayoutGrid },
            { id: 'ministers', label: 'Ministers', icon: Users },
            { id: 'movies', label: 'Movies', icon: Film },
            { id: 'community', label: 'Community', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchView(tab.id as NavView, tab.id === 'ministers')}
                className={`flex flex-col items-center justify-center min-h-[48px] py-1.5 transition-colors ${
                  isActive ? 'text-amber-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ====================================================================
          KINGDOM+ STREAM PLAYER THEATER & FLOATING MINI-PLAYER
      ==================================================================== */}
      {activeVideo && (
        <YouTubePlayerModal
          video={activeVideo}
          allVideos={videos}
          currentUser={currentUser}
          authToken={authToken}
          isSaved={savedVideoIds.includes(activeVideo.id)}
          isMinimized={isPlayerMinimized}
          initialProgressSeconds={
            watchHistory.find((w) => w.video_id === activeVideo.id)?.progress_seconds || 0
          }
          onToggleMinimize={(minimized) => setIsPlayerMinimized(minimized)}
          onClose={() => {
            setActiveVideo(null);
            setIsPlayerMinimized(false);
            fetchCatalog();
          }}
          onSelectVideo={(vid) => {
            setActiveVideo(vid);
          }}
          onToggleSave={handleToggleSaveVideo}
          onProgressUpdate={handleProgressUpdate}
          onVideoUnavailable={handleVideoUnavailable}
          onRequireAuth={() => setShowAuthModal(true)}
          onNavigateWhileListening={(dest) => {
            setIsPlayerMinimized(true);
            switchView(dest, dest === 'ministers');
          }}
          onOpenChannelWhileListening={(channelId) => {
            setIsPlayerMinimized(true);
            openChannelCatalog(channelId);
          }}
        />
      )}

      {/* ====================================================================
          MEMBER AUTH, PROFILE, WATCHLIST & HISTORY MODAL
      ==================================================================== */}
      {showAuthModal && (
        <AuthAndProfileModal
          currentUser={currentUser}
          authToken={authToken}
          categories={eightMainCategories}
          savedVideos={savedVideosList}
          watchHistory={watchHistory}
          pendingVideoTitle={pendingVideoToPlay?.title || null}
          onClose={() => {
            setShowAuthModal(false);
            setPendingVideoToPlay(null);
          }}
          onAuthSuccess={handleAuthSuccess}
          onLogout={handleLogout}
          onSelectVideo={handleRequestPlayVideo}
          onToggleSave={handleToggleSaveVideo}
          onOpenAdmin={() => setActiveView('admin')}
        />
      )}

      {/* ====================================================================
          INTELLIGENT AI DISCOVERY MODAL (Global Across Entire App)
      ==================================================================== */}
      <IntelligentDiscoveryModal
        isOpen={isDiscoveryModalOpen}
        onClose={() => setIsDiscoveryModalOpen(false)}
        initialQuery={discoveryInitialQuery}
        initialScope={discoveryInitialScope}
        allVideos={videos}
        savedVideoIds={savedVideoIds}
        onSelectVideo={(vid) => {
          handleRequestPlayVideo(vid);
          handleDiscoveredVideoSelected(vid);
        }}
        onToggleSave={handleToggleSaveVideo}
        onSelectMinister={(chId) => {
          setIsDiscoveryModalOpen(false);
          openChannelCatalog(chId);
        }}
        onDiscoveredVideoSelected={handleDiscoveredVideoSelected}
      />
    </div>
  );
}
