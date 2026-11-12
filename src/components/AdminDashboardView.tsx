import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Database,
  ExternalLink,
  History,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  ChristianLivingSubcategorySlug,
  ContentCategory,
  DiscoveryHistoryEntry,
  KingdomChannel,
  KingdomVideo,
  MarriageCollectionConfig,
  ModerationReport,
  SystemConfigStatus,
  UserProfile,
  WorshipSubcategorySlug,
  YouTubeApiLog,
} from '../types/kingdom.ts';
import { formatCompactNumber, formatRelativeDate } from '../utils/formatters.ts';

const WORSHIP_SUBCATEGORY_OPTIONS: Array<{ slug: WorshipSubcategorySlug; name: string }> = [
  { slug: 'deep-worship', name: 'Deep Worship' },
  { slug: 'high-praise-celebration', name: 'High Praise and Celebration' },
  { slug: 'prayer-spiritual-warfare-worship', name: 'Prayer and Spiritual Warfare' },
  { slug: 'spontaneous-worship', name: 'Spontaneous Worship' },
  { slug: 'live-worship-sessions', name: 'Live Worship Sessions' },
  { slug: 'thanksgiving-songs', name: 'Thanksgiving Songs' },
  { slug: 'classic-gospel-hits', name: 'Classic Gospel Hits' },
  { slug: 'new-trending-gospel', name: 'New and Trending Gospel Songs' },
  { slug: 'international-worship', name: 'International Worship' },
  { slug: 'nigerian-gospel', name: 'Nigerian Gospel' },
];

const CHRISTIAN_LIVING_SUBCATEGORY_OPTIONS: Array<{
  slug: ChristianLivingSubcategorySlug;
  name: string;
}> = [
  {
    slug: 'personal-growth-spiritual-development',
    name: 'Personal Growth and Spiritual Development',
  },
  { slug: 'family-and-parenting', name: 'Family and Parenting' },
  { slug: 'christian-finances-and-wealth', name: 'Christian Finances and Wealth' },
  { slug: 'purpose-career-and-destiny', name: 'Purpose, Career and Destiny' },
  { slug: 'christian-youth-and-young-adults', name: 'Christian Youth and Young Adults' },
  { slug: 'faith-in-everyday-life', name: 'Faith in Everyday Life' },
  { slug: 'christian-character-and-values', name: 'Christian Character and Values' },
  { slug: 'christian-womanhood', name: 'Christian Womanhood' },
  { slug: 'christian-manhood', name: 'Christian Manhood' },
  { slug: 'friendship-and-social-life', name: 'Friendship and Social Life' },
  { slug: 'christianity-in-modern-society', name: 'Christianity in Modern Society' },
];

interface AdminDashboardViewProps {
  authToken: string;
  categories: ContentCategory[];
  onCatalogChanged: () => void;
  onPreviewVideo: (video: KingdomVideo) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  authToken,
  categories,
  onCatalogChanged,
  onPreviewVideo,
}) => {
  const [activeTab, setActiveTab] = useState<
    'videos' | 'channels' | 'categories' | 'discovery' | 'moderation' | 'users' | 'supabase'
  >('videos');

  const [systemStatus, setSystemStatus] = useState<SystemConfigStatus | null>(null);
  const [marriageCollections, setMarriageCollections] = useState<MarriageCollectionConfig[]>([]);
  const [channels, setChannels] = useState<KingdomChannel[]>([]);
  const [videos, setVideos] = useState<KingdomVideo[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [quotaLogs, setQuotaLogs] = useState<YouTubeApiLog[]>([]);
  const [discoveryHistory, setDiscoveryHistory] = useState<DiscoveryHistoryEntry[]>([]);
  const [searchPhrases, setSearchPhrases] = useState<
    Array<{ phrase: string; defaultCategorySlug: string; label: string }>
  >([]);
  const [sqlSchema, setSqlSchema] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Filters & Actions
  const [videoFilterStatus, setVideoFilterStatus] = useState<string>('all');
  const [videoFilterCategory, setVideoFilterCategory] = useState<string>('all');
  const [videoSearch, setVideoSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [refreshingWorship, setRefreshingWorship] = useState(false);
  const [refreshingChristianLiving, setRefreshingChristianLiving] = useState(false);
  const [checkingClSuggestions, setCheckingClSuggestions] = useState(false);
  const [refreshingVideoId, setRefreshingVideoId] = useState<string | null>(null);
  const [discoveringMarriage, setDiscoveringMarriage] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  // Manual Video Addition by YouTube URL
  const [manualVideoUrl, setManualVideoUrl] = useState('');
  const [manualVideoCategory, setManualVideoCategory] = useState('christian-living');
  const [manualVideoChannelId, setManualVideoChannelId] = useState('');
  const [manualVideoWorshipSubcategory, setManualVideoWorshipSubcategory] =
    useState<WorshipSubcategorySlug>('deep-worship');
  const [manualVideoClSubcategory, setManualVideoClSubcategory] =
    useState<ChristianLivingSubcategorySlug>('personal-growth-spiritual-development');
  const [manualVideoPublishStatus, setManualVideoPublishStatus] = useState<
    'approved' | 'pending_review'
  >('approved');
  const [manualVideoHero, setManualVideoHero] = useState(false);
  const [manualVideoTrending, setManualVideoTrending] = useState(false);
  const [addingManualVideo, setAddingManualVideo] = useState(false);

  // Add Channel Form
  const [newChannelIdentifier, setNewChannelIdentifier] = useState('');
  const [newChannelType, setNewChannelType] = useState<
    'artist' | 'minister' | 'speaker' | 'church' | 'ministry' | 'movie_studio' | 'animation_studio'
  >('minister');
  const [newChannelNigerian, setNewChannelNigerian] = useState(true);
  const [newChannelCategory, setNewChannelCategory] = useState('sermons-teachings');
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');

  // Add Category Form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategorySection, setNewCategorySection] = useState<'streaming' | 'movies'>('streaming');
  const [addingCategory, setAddingCategory] = useState(false);

  // Merge Duplicate Speaker Records State
  const [mergeSourceChannelId, setMergeSourceChannelId] = useState('');
  const [mergeTargetChannelId, setMergeTargetChannelId] = useState('');
  const [mergingChannels, setMergingChannels] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editSpeakerName, setEditSpeakerName] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [editBio, setEditBio] = useState('');

  // Live YouTube Discovery Search
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const [discoveryCategory, setDiscoveryCategory] = useState('sermons-teachings');
  const [discoveryWindow, setDiscoveryWindow] = useState<'24h' | '7d' | '30d' | '90d' | 'any'>('30d');
  const [searchingYouTube, setSearchingYouTube] = useState(false);

  const fetchAdminOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setSystemStatus(data.systemStatus);
      if (Array.isArray(data.marriageCollections)) {
        setMarriageCollections(data.marriageCollections);
      }
      setChannels(data.channels || []);
      setVideos(data.videos || []);
      setUsers(data.users || []);
      setReports(data.reports || []);
      setQuotaLogs(data.quotaLogs || []);
      setDiscoveryHistory(data.discoveryHistory || []);
      if (Array.isArray(data.searchPhrases)) {
        setSearchPhrases(data.searchPhrases);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAdminOverview();
    fetch('/api/admin/sql-schema')
      .then((r) => r.json())
      .then((d) => {
        if (d.sql) setSqlSchema(d.sql);
      })
      .catch(() => {});
  }, [authToken]);

  const showNotice = (msg: string) => {
    setAdminNotice(msg);
    setTimeout(() => setAdminNotice(null), 6000);
  };

  const handleTriggerChannelSync = async (channelId?: string) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/sync-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          `Synced ${data.channelsSynced} channel(s): +${data.videosAdded} new videos discovered, ${data.videosUpdated} existing videos refreshed.`
        );
        await fetchAdminOverview();
        onCatalogChanged();
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRunDeduplication = async () => {
    setDeduplicating(true);
    try {
      const res = await fetch('/api/admin/deduplicate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          data.removedCount > 0
            ? `Duplicate scanner removed ${data.removedCount} duplicate video(s).`
            : 'Duplicate scan complete: 0 duplicate videos found.'
        );
        await fetchAdminOverview();
        onCatalogChanged();
      }
    } finally {
      setDeduplicating(false);
    }
  };

  const handleAddManualVideoByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVideoUrl.trim()) return;
    setAddingManualVideo(true);
    try {
      const worshipSubName = WORSHIP_SUBCATEGORY_OPTIONS.find(
        (s) => s.slug === manualVideoWorshipSubcategory
      )?.name;
      const clSubName = CHRISTIAN_LIVING_SUBCATEGORY_OPTIONS.find(
        (s) => s.slug === manualVideoClSubcategory
      )?.name;
      const res = await fetch('/api/admin/videos/add-by-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          urlOrId: manualVideoUrl.trim(),
          primaryCategorySlug: manualVideoCategory,
          channelId: manualVideoChannelId || undefined,
          worshipSubcategories:
            manualVideoCategory === 'worship-praise'
              ? [manualVideoWorshipSubcategory]
              : undefined,
          christianLivingSubcategories:
            manualVideoCategory === 'christian-living'
              ? [manualVideoClSubcategory]
              : undefined,
          subcategoryLabel:
            manualVideoCategory === 'worship-praise'
              ? worshipSubName
              : manualVideoCategory === 'christian-living'
              ? clSubName
              : undefined,
          publishStatus: manualVideoPublishStatus,
          isFeaturedHero: manualVideoHero,
          isTrendingPinned: manualVideoTrending,
        }),
      });
      const data = await res.json();
      if (res.ok && data.video) {
        setManualVideoUrl('');
        setManualVideoHero(false);
        setManualVideoTrending(false);
        showNotice(
          data.message ||
            (manualVideoPublishStatus === 'pending_review'
              ? `Added "${data.video.title}" to Pending Review for admin approval.`
              : `Added & published video: "${data.video.title}"`)
        );
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Failed to add video from URL.');
      }
    } finally {
      setAddingManualVideo(false);
    }
  };

  const handleRefreshWorshipPraise = async () => {
    setRefreshingWorship(true);
    try {
      const res = await fetch('/api/admin/worship-praise/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          `Worship & Praise Refresh Complete: ${data.totalCuratedSongs} high-engagement songs curated across ${data.artistsCount} approved artists.`
        );
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Failed to refresh Worship & Praise catalog.');
      }
    } finally {
      setRefreshingWorship(false);
    }
  };

  const handleRefreshChristianLiving = async () => {
    setRefreshingChristianLiving(true);
    try {
      const res = await fetch('/api/admin/christian-living/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          `Christian Living Refresh Complete: ${data.totalCuratedTeachings} high-engagement teachings curated across ${data.ministersCount} approved ministers.`
        );
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Failed to refresh Christian Living catalog.');
      }
    } finally {
      setRefreshingChristianLiving(false);
    }
  };

  const handleCheckChristianLivingSuggestions = async () => {
    setCheckingClSuggestions(true);
    try {
      const res = await fetch('/api/admin/christian-living/check-suggestions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          data.message ||
            `Checked 20 approved ministers: ${data.refreshedExistingCount} updated, +${data.suggestedForApprovalCount} queued in Pending Review.`
        );
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Failed to check Christian Living suggestions.');
      }
    } finally {
      setCheckingClSuggestions(false);
    }
  };

  const handleRefreshSingleVideo = async (videoId: string) => {
    setRefreshingVideoId(videoId);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.video) {
        setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
        onCatalogChanged();
        showNotice(data.message || `Refreshed video metadata for "${data.video.title}".`);
      }
    } finally {
      setRefreshingVideoId(null);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelIdentifier.trim()) return;
    setAddingChannel(true);
    try {
      const res = await fetch('/api/admin/channels/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          identifier: newChannelIdentifier.trim(),
          channelType: newChannelType,
          isNigerian: newChannelNigerian,
          defaultCategorySlug: newChannelCategory,
        }),
      });
      const data = await res.json();
      if (res.ok && data.channel) {
        setNewChannelIdentifier('');
        showNotice(`Added and synced official channel: ${data.channel.title}`);
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Could not resolve channel.');
      }
    } finally {
      setAddingChannel(false);
    }
  };

  const handleRemoveChannel = async (channelId: string, channelTitle: string) => {
    const res = await fetch(`/api/admin/channels/${channelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      showNotice(`Removed "${channelTitle}" and its videos from the approved discovery list.`);
      await fetchAdminOverview();
      onCatalogChanged();
    }
  };

  const handleUpdateChannel = async (
    channelId: string,
    patch: {
      approval_status?: 'approved' | 'pending' | 'blocked';
      default_category_slug?: string;
      priority_weight?: number;
      is_nigerian?: boolean;
      is_featured_marriage_teacher?: boolean;
      is_featured_minister?: boolean;
      speaker_gender?: 'male' | 'female' | 'couple' | 'ministry';
      speaker_name?: string;
      ministry_name?: string;
      aliases?: string[] | string;
      bio?: string;
    }
  ) => {
    const res = await fetch(`/api/admin/channels/${channelId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      await fetchAdminOverview();
      onCatalogChanged();
    }
  };

  const handleMergeDuplicateChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceChannelId || !mergeTargetChannelId || mergeSourceChannelId === mergeTargetChannelId) {
      showNotice('Please select two different speaker/channel records to merge.');
      return;
    }
    setMergingChannels(true);
    try {
      const res = await fetch('/api/admin/channels/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sourceChannelId: mergeSourceChannelId,
          targetChannelId: mergeTargetChannelId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.targetChannel) {
        showNotice(
          `Merged duplicate speaker record into "${data.targetChannel.title}" and safely reassigned ${data.reassignedVideosCount} video(s) without deleting any content.`
        );
        setMergeSourceChannelId('');
        setMergeTargetChannelId('');
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Could not merge channels.');
      }
    } finally {
      setMergingChannels(false);
    }
  };

  const handleDiscoverMarriageTeachings = async () => {
    setDiscoveringMarriage(true);
    try {
      const res = await fetch('/api/admin/discover-marriage-teachings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          `Priority Male & Female Marriage Speaker Discovery complete: +${data.approvedMarriageVideosCount} verified marriage/relationship teachings added.`
        );
        await fetchAdminOverview();
        onCatalogChanged();
      }
    } finally {
      setDiscoveringMarriage(false);
    }
  };

  const handleReorderMarriageCollection = async (index: number, direction: 'up' | 'down') => {
    const sorted = [...marriageCollections].sort((a, b) => a.display_order - b.display_order);
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const temp = sorted[index];
    sorted[index] = sorted[targetIdx];
    sorted[targetIdx] = temp;
    const reordered = sorted.map((col, idx) => ({
      ...col,
      display_order: idx + 1,
    }));
    setMarriageCollections(reordered);
    await fetch('/api/admin/marriage-collections', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ collections: reordered }),
    });
    onCatalogChanged();
  };

  const handleToggleMarriageCollectionActive = async (slug: string, currentActive: boolean) => {
    const updated = marriageCollections.map((c) =>
      c.slug === slug ? { ...c, is_active: !currentActive } : c
    );
    setMarriageCollections(updated);
    await fetch('/api/admin/marriage-collections', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        collections: [{ slug, is_active: !currentActive }],
      }),
    });
    onCatalogChanged();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim(),
          section: newCategorySection,
        }),
      });
      const data = await res.json();
      if (res.ok && data.category) {
        setNewCategoryName('');
        setNewCategoryDescription('');
        showNotice(`Created category: ${data.category.name}`);
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'Could not create category.');
      }
    } finally {
      setAddingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (category: ContentCategory) => {
    const res = await fetch(`/api/admin/categories/${category.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ is_active: !category.is_active }),
    });
    if (res.ok) {
      await fetchAdminOverview();
      onCatalogChanged();
    }
  };

  const handleUpdateVideo = async (
    videoId: string,
    patch: {
      approval_status?: 'approved' | 'pending_review' | 'rejected';
      primary_category_slug?: string;
      subcategory_label?: string;
      channel_id?: string;
      artist_name?: string;
      worship_subcategories?: WorshipSubcategorySlug[];
      christian_living_subcategories?: ChristianLivingSubcategorySlug[];
      remove_from_worship_praise?: boolean;
      remove_from_christian_living?: boolean;
      is_featured_hero?: boolean;
      is_trending_pinned?: boolean;
      reclassifyWithGemini?: boolean;
    }
  ) => {
    const res = await fetch(`/api/admin/videos/${videoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok && data.video) {
      setVideos((prev) => prev.map((v) => (v.id === videoId ? data.video : v)));
      onCatalogChanged();
      if (patch.remove_from_worship_praise) {
        showNotice(`Removed "${data.video.title}" from Worship & Praise without deleting the video.`);
      } else if (patch.remove_from_christian_living) {
        showNotice(`Removed "${data.video.title}" from Christian Living without deleting the video.`);
      } else if (patch.reclassifyWithGemini) {
        showNotice(`Gemini classified "${data.video.title}" -> ${data.video.primary_category_name}`);
      }
    }
  };

  const handleDiscoverySearch = async (
    e?: React.FormEvent,
    customPhrase?: string,
    customCategorySlug?: string
  ) => {
    if (e) e.preventDefault();
    const q = customPhrase !== undefined ? customPhrase : discoveryQuery.trim();
    const cat = customCategorySlug || discoveryCategory;
    setSearchingYouTube(true);
    try {
      const res = await fetch('/api/admin/youtube-discovery-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: q || undefined,
          defaultCategorySlug: cat,
          publishedWithin: discoveryWindow,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(
          `Discovery complete: ${data.addedToQueue} new videos found (${data.approvedFromOfficialCount} auto-approved from official creators, ${data.queuedForReviewCount} held in pending review).`
        );
        await fetchAdminOverview();
        onCatalogChanged();
      } else {
        showNotice(data.error || 'YouTube API search failed.');
      }
    } finally {
      setSearchingYouTube(false);
    }
  };

  const handleUpdateUser = async (userId: string, patch: { role?: string; is_suspended?: boolean }) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      await fetchAdminOverview();
    }
  };

  const handleResolveReport = async (
    reportId: string,
    status: 'resolved' | 'dismissed',
    hideTarget: boolean
  ) => {
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status, hideTarget }),
    });
    if (res.ok) {
      await fetchAdminOverview();
      onCatalogChanged();
    }
  };

  const filteredVideos = videos.filter((v) => {
    if (videoFilterStatus === 'unavailable') {
      if (v.is_available && v.is_embeddable) return false;
    } else if (videoFilterStatus !== 'all' && v.approval_status !== videoFilterStatus) {
      return false;
    }
    if (
      videoFilterCategory !== 'all' &&
      v.primary_category_slug !== videoFilterCategory &&
      !v.secondary_category_slugs.includes(videoFilterCategory)
    ) {
      return false;
    }
    if (!videoSearch.trim()) return true;
    const q = videoSearch.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      v.channel_title.toLowerCase().includes(q) ||
      (v.artist_name && v.artist_name.toLowerCase().includes(q)) ||
      v.primary_category_name.toLowerCase().includes(q)
    );
  });

  const filteredChannels = channels.filter((ch) => {
    if (!channelSearch.trim()) return true;
    const q = channelSearch.toLowerCase();
    return (
      ch.title.toLowerCase().includes(q) ||
      ch.handle.toLowerCase().includes(q) ||
      ch.youtube_channel_id.toLowerCase().includes(q)
    );
  });

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-medium text-amber-400 mb-2">
            Approved Creator Database, Worship &amp; Praise Curated Engine &amp; Editorial Governance
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-zinc-50">
            Admin Command Center
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Manage the 36 approved Worship &amp; Praise artists, add songs, assign artists and subcategories, refresh video information, and detect unavailable videos.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            disabled={refreshingChristianLiving}
            onClick={handleRefreshChristianLiving}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-500/50 text-amber-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingChristianLiving ? 'animate-spin' : ''}`} />
            <span>
              {refreshingChristianLiving
                ? 'Curating 20 Ministers...'
                : 'Refresh Christian Living (20 Ministers)'}
            </span>
          </button>

          <button
            type="button"
            disabled={checkingClSuggestions}
            onClick={handleCheckChristianLivingSuggestions}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <History className={`w-3.5 h-3.5 ${checkingClSuggestions ? 'animate-spin' : ''}`} />
            <span>
              {checkingClSuggestions
                ? 'Checking New Teachings...'
                : 'Check New Christian Living Suggestions'}
            </span>
          </button>

          <button
            type="button"
            disabled={refreshingWorship}
            onClick={handleRefreshWorshipPraise}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingWorship ? 'animate-spin' : ''}`} />
            <span>
              {refreshingWorship
                ? 'Refreshing 36 Artists...'
                : 'Refresh Worship & Praise (36 Artists)'}
            </span>
          </button>

          <button
            type="button"
            disabled={deduplicating}
            onClick={handleRunDeduplication}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <span>{deduplicating ? 'Scanning Duplicates...' : 'Scan & Remove Duplicates'}</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => handleTriggerChannelSync()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Official Channels...' : 'Sync All Approved Channels'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      {systemStatus && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 font-mono tabular-nums">
          <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
            <div className="text-xs font-sans text-zinc-400">Approved Live Videos</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">
              {systemStatus.totalApprovedVideos}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
            <div className="text-xs font-sans text-zinc-400">Held for Admin Review</div>
            <div className="text-2xl font-semibold text-amber-400 mt-1">
              {systemStatus.totalPendingVideos}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
            <div className="text-xs font-sans text-zinc-400">Approved Creators</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">
              {systemStatus.totalApprovedChannels}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
            <div className="text-xs font-sans text-zinc-400">YouTube Quota Today</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">
              {systemStatus.quotaUsedToday.toLocaleString()}{' '}
              <span className="text-xs text-zinc-500">/ 10,000</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#121215] border border-zinc-800">
            <div className="text-xs font-sans text-zinc-400">Active Integrations</div>
            <div className="text-xs font-sans font-medium text-zinc-200 mt-2 flex flex-col gap-1">
              <span>
                YouTube API v3:{' '}
                <strong
                  className={
                    systemStatus.youtubeApiKeyConfigured ? 'text-emerald-400' : 'text-amber-400'
                  }
                >
                  {systemStatus.youtubeApiKeyConfigured ? 'Connected' : 'Feed Mode'}
                </strong>
              </span>
              <span>
                Supabase:{' '}
                <strong
                  className={systemStatus.supabaseConnected ? 'text-emerald-400' : 'text-amber-400'}
                >
                  {systemStatus.supabaseConnected ? 'Synced Live' : 'Local Store'}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {adminNotice && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs">
          {adminNotice}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-zinc-800 pb-3">
        {[
          { id: 'videos', label: `Videos & Performance (${videos.length})` },
          { id: 'channels', label: `Approved Creators (${channels.length})` },
          { id: 'categories', label: `Categories (${categories.length})` },
          { id: 'discovery', label: `Discovery Engine & API Logs (${discoveryHistory.length})` },
          {
            id: 'moderation',
            label: `Moderation (${reports.filter((r) => r.status === 'open').length})`,
          },
          { id: 'users', label: `Users (${users.length})` },
          { id: 'supabase', label: 'Supabase SQL Schema' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: VIDEOS, MANUAL URL IMPORT & PERFORMANCE MONITORING */}
      {activeTab === 'videos' && (
        <div className="flex flex-col gap-6">
          {/* Manual Video / Christian Living Teaching / Worship Song Addition via URL */}
          <form
            onSubmit={handleAddManualVideoByUrl}
            className="p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <Link2 className="w-4 h-4" />
                <span>
                  Add Video / Teaching Manually (Assign Minister, Subcategory &amp; Review Status)
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                Supports assigning to the 20 Christian Living Ministers (11 Subcategories) or 36 Worship Artists
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-3">
                <input
                  type="text"
                  required
                  value={manualVideoUrl}
                  onChange={(e) => setManualVideoUrl(e.target.value)}
                  placeholder="Paste video URL or 11-char ID..."
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="md:col-span-2">
                <select
                  value={manualVideoCategory}
                  onChange={(e) => setManualVideoCategory(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-2 text-xs text-zinc-200"
                >
                  {categories
                    .filter((c) => !c.is_legacy_subcategory)
                    .map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <select
                  value={manualVideoChannelId}
                  onChange={(e) => setManualVideoChannelId(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-2 text-xs text-zinc-200"
                >
                  <option value="">Auto-detect Minister / Artist</option>
                  {channels
                    .filter((ch) => ch.is_approved_christian_living_minister)
                    .sort(
                      (a, b) =>
                        (a.christian_living_minister_order ?? 99) -
                        (b.christian_living_minister_order ?? 99)
                    )
                    .map((ch) => (
                      <option key={`cl-${ch.id}`} value={ch.id}>
                        Christian Living Minister: {ch.speaker_name || ch.title}
                      </option>
                    ))}
                  {channels
                    .filter((ch) => ch.is_approved_worship_artist)
                    .sort((a, b) => (a.worship_artist_order ?? 99) - (b.worship_artist_order ?? 99))
                    .map((ch) => (
                      <option key={`wp-${ch.id}`} value={ch.id}>
                        Worship Artist: {ch.speaker_name || ch.title}
                      </option>
                    ))}
                </select>
              </div>
              {manualVideoCategory === 'worship-praise' && (
                <div className="md:col-span-2">
                  <select
                    value={manualVideoWorshipSubcategory}
                    onChange={(e) =>
                      setManualVideoWorshipSubcategory(e.target.value as WorshipSubcategorySlug)
                    }
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-2 text-xs text-amber-300"
                  >
                    {WORSHIP_SUBCATEGORY_OPTIONS.map((sub) => (
                      <option key={sub.slug} value={sub.slug}>
                        Sub: {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {manualVideoCategory === 'christian-living' && (
                <div className="md:col-span-2">
                  <select
                    value={manualVideoClSubcategory}
                    onChange={(e) =>
                      setManualVideoClSubcategory(
                        e.target.value as ChristianLivingSubcategorySlug
                      )
                    }
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-2 text-xs text-amber-300"
                  >
                    {CHRISTIAN_LIVING_SUBCATEGORY_OPTIONS.map((sub) => (
                      <option key={sub.slug} value={sub.slug}>
                        Sub: {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <select
                  value={manualVideoPublishStatus}
                  onChange={(e) =>
                    setManualVideoPublishStatus(
                      e.target.value as 'approved' | 'pending_review'
                    )
                  }
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-[11px] text-zinc-200"
                  title="Publish Immediately or Hold for Admin Review"
                >
                  <option value="approved">Publish Now</option>
                  <option value="pending_review">Hold for Review</option>
                </select>
                <button
                  type="submit"
                  disabled={addingManualVideo}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addingManualVideo ? 'Adding...' : 'Add Video'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Filter & Search Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                  placeholder="Search catalog by teaching title, minister, artist, or category..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={videoFilterCategory}
                onChange={(e) => setVideoFilterCategory(e.target.value)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
              >
                <option value="all">All Categories</option>
                {categories
                  .filter((c) => !c.is_legacy_subcategory)
                  .map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['all', 'approved', 'pending_review', 'rejected', 'unavailable'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setVideoFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    videoFilterStatus === st
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {st === 'all'
                    ? 'All Videos'
                    : st === 'pending_review'
                    ? `Pending Approval (${
                        videos.filter((v) => v.approval_status === 'pending_review').length
                      })`
                    : st === 'unavailable'
                    ? `Unavailable / Removed (${
                        videos.filter((v) => !v.is_available || !v.is_embeddable).length
                      })`
                    : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Videos & Performance Monitoring Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] text-zinc-400">
                  <th className="py-3 px-4 font-medium">Video, Minister &amp; Last Updated</th>
                  <th className="py-3 px-3 font-medium">Category &amp; Subcategory</th>
                  <th className="py-3 px-3 font-medium text-right">Views &amp; Verified Likes</th>
                  <th className="py-3 px-3 font-medium text-right">Velocity</th>
                  <th className="py-3 px-3 font-medium text-right">Engagement</th>
                  <th className="py-3 px-3 font-medium text-right">Rank Score</th>
                  <th className="py-3 px-3 font-medium">Status &amp; Feature</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 text-xs">
                {filteredVideos.slice(0, 120).map((video) => (
                  <tr key={video.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        <img
                          src={video.thumbnail_high_url}
                          alt={video.title}
                          referrerPolicy="no-referrer"
                          onClick={() => onPreviewVideo(video)}
                          className="w-20 aspect-video rounded object-cover bg-zinc-900 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onPreviewVideo(video)}
                            className="font-semibold text-zinc-100 hover:text-amber-400 line-clamp-1 text-left"
                          >
                            {video.title}
                          </button>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {video.artist_name || video.channel_title} · Uploaded{' '}
                            {formatRelativeDate(video.published_at)}
                            {(!video.is_available || !video.is_embeddable) && (
                              <span className="ml-1.5 text-red-400 font-semibold">
                                · UNAVAILABLE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                            Updated: {formatRelativeDate(video.last_refreshed_at || video.published_at)}
                          </div>
                          {video.primary_category_slug === 'worship-praise' && (
                            <select
                              value={video.channel_id}
                              onChange={(e) =>
                                handleUpdateVideo(video.id, { channel_id: e.target.value })
                              }
                              className="mt-1 rounded bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 max-w-full"
                              title="Assign Approved Worship Artist"
                            >
                              {channels
                                .filter((ch) => ch.is_approved_worship_artist)
                                .sort(
                                  (a, b) =>
                                    (a.worship_artist_order ?? 99) -
                                    (b.worship_artist_order ?? 99)
                                )
                                .map((ch) => (
                                  <option key={ch.id} value={ch.id}>
                                    Artist: {ch.speaker_name || ch.title}
                                  </option>
                                ))}
                            </select>
                          )}
                          {video.primary_category_slug === 'christian-living' && (
                            <select
                              value={video.channel_id}
                              onChange={(e) =>
                                handleUpdateVideo(video.id, { channel_id: e.target.value })
                              }
                              className="mt-1 rounded bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 max-w-full"
                              title="Assign Approved Christian Living Minister"
                            >
                              {channels
                                .filter((ch) => ch.is_approved_christian_living_minister)
                                .sort(
                                  (a, b) =>
                                    (a.christian_living_minister_order ?? 99) -
                                    (b.christian_living_minister_order ?? 99)
                                )
                                .map((ch) => (
                                  <option key={ch.id} value={ch.id}>
                                    Minister: {ch.speaker_name || ch.title}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        <select
                          value={video.primary_category_slug}
                          onChange={(e) =>
                            handleUpdateVideo(video.id, { primary_category_slug: e.target.value })
                          }
                          className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200"
                        >
                          {categories
                            .filter((c) => !c.is_legacy_subcategory)
                            .map((cat) => (
                              <option key={cat.id} value={cat.slug}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                        {video.primary_category_slug === 'worship-praise' ? (
                          <select
                            value={video.worship_subcategories?.[0] || 'deep-worship'}
                            onChange={(e) => {
                              const newSlug = e.target.value as WorshipSubcategorySlug;
                              const subObj = WORSHIP_SUBCATEGORY_OPTIONS.find(
                                (s) => s.slug === newSlug
                              );
                              const existingRegions = (
                                video.worship_subcategories || []
                              ).filter(
                                (s) =>
                                  s === 'nigerian-gospel' || s === 'international-worship'
                              );
                              handleUpdateVideo(video.id, {
                                worship_subcategories: Array.from(
                                  new Set([newSlug, ...existingRegions])
                                ),
                                subcategory_label: subObj?.name || video.subcategory_label,
                              });
                            }}
                            className="rounded bg-zinc-950 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300"
                            title="Change Worship & Praise Subcategory"
                          >
                            {WORSHIP_SUBCATEGORY_OPTIONS.map((sub) => (
                              <option key={sub.slug} value={sub.slug}>
                                Sub: {sub.name}
                              </option>
                            ))}
                          </select>
                        ) : video.primary_category_slug === 'christian-living' ? (
                          <select
                            value={
                              video.christian_living_subcategories?.[0] ||
                              'personal-growth-spiritual-development'
                            }
                            onChange={(e) => {
                              const newSlug = e.target.value as ChristianLivingSubcategorySlug;
                              const subObj = CHRISTIAN_LIVING_SUBCATEGORY_OPTIONS.find(
                                (s) => s.slug === newSlug
                              );
                              handleUpdateVideo(video.id, {
                                christian_living_subcategories: [newSlug],
                                subcategory_label: subObj?.name || video.subcategory_label,
                              });
                            }}
                            className="rounded bg-zinc-950 border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300"
                            title="Change Christian Living Subcategory"
                          >
                            {CHRISTIAN_LIVING_SUBCATEGORY_OPTIONS.map((sub) => (
                              <option key={sub.slug} value={sub.slug}>
                                Sub: {sub.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          video.subcategory_label && (
                            <span className="text-[10px] font-mono text-amber-400/90 truncate">
                              Sub: {video.subcategory_label}
                            </span>
                          )
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-200">
                      <div>{formatCompactNumber(video.view_count)} views</div>
                      <div className="text-[11px] text-zinc-500">
                        {video.likes_verified !== false && video.like_count > 0
                          ? `${formatCompactNumber(video.like_count)} likes`
                          : '—'}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400">
                      {formatCompactNumber(Math.round(video.views_per_day))}/d
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-300">
                      {video.engagement_rate.toFixed(1)}‰
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-200">
                      <div>
                        {video.christian_living_score !== undefined
                          ? `${video.christian_living_score} CL`
                          : Math.round(video.trending_score).toLocaleString()}
                      </div>
                      {video.quality_score !== undefined && (
                        <div className="text-[11px] text-emerald-400">
                          Q:{video.quality_score}/100
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            !video.is_available || !video.is_embeddable
                              ? 'text-red-400'
                              : video.approval_status === 'approved'
                              ? 'text-emerald-400'
                              : video.approval_status === 'pending_review'
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {!video.is_available || !video.is_embeddable
                            ? 'unavailable'
                            : video.approval_status}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateVideo(video.id, {
                              is_featured_hero: !video.is_featured_hero,
                            })
                          }
                          title="Feature Video / Toggle Hero Spotlight"
                          className={`p-1 rounded border transition-colors ${
                            video.is_featured_hero
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateVideo(video.id, {
                              is_trending_pinned: !video.is_trending_pinned,
                            })
                          }
                          title="Pin to Trending"
                          className={`p-1 rounded border transition-colors ${
                            video.is_trending_pinned
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={refreshingVideoId === video.id}
                          onClick={() => handleRefreshSingleVideo(video.id)}
                          title="Refresh Video Info & Check Availability"
                          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              refreshingVideoId === video.id ? 'animate-spin text-amber-400' : ''
                            }`}
                          />
                        </button>
                        {video.primary_category_slug === 'worship-praise' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateVideo(video.id, { remove_from_worship_praise: true })
                            }
                            title="Remove Song from Worship & Praise (Moves to Gospel Music without deleting)"
                            className="p-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {video.primary_category_slug === 'christian-living' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateVideo(video.id, { remove_from_christian_living: true })
                            }
                            title="Remove Video from Christian Living (Moves to Sermons & Teachings without deleting)"
                            className="p-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateVideo(video.id, { approval_status: 'approved' })
                          }
                          title="Approve & Publish Video"
                          className="p-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateVideo(video.id, { approval_status: 'rejected' })
                          }
                          title="Reject Video"
                          className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateVideo(video.id, { reclassifyWithGemini: true })
                          }
                          title="Reclassify Category with Gemini AI"
                          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: APPROVED CREATORS & OFFICIAL YOUTUBE CHANNEL ID MANAGEMENT */}
      {activeTab === 'channels' && (
        <div className="flex flex-col gap-6">
          {/* Add Official YouTube Channel Form */}
          <form
            onSubmit={handleAddChannel}
            className="p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100">
                Add New Gospel Artist, Minister, or Ministry Channel (Without Code Changes)
              </h2>
              <span className="text-xs text-zinc-400">
                Supports @handle, full YouTube URL, or 24-char UC... Channel ID
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newChannelIdentifier}
                onChange={(e) => setNewChannelIdentifier(e.target.value)}
                placeholder="YouTube Handle (@MercyChinwo), URL, or UC... ID"
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <select
                value={newChannelType}
                onChange={(e) => setNewChannelType(e.target.value as any)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
              >
                <option value="artist">Gospel Artist / Worship Leader</option>
                <option value="minister">Pastor / Apostle / Minister</option>
                <option value="speaker">Christian Speaker / Guest Contributor</option>
                <option value="church">Church</option>
                <option value="ministry">Christian Ministry</option>
                <option value="movie_studio">Christian Movie Studio</option>
                <option value="animation_studio">Bible Animation / Cartoon Studio</option>
              </select>
              <select
                value={newChannelCategory}
                onChange={(e) => setNewChannelCategory(e.target.value)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    Default: {cat.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={newChannelNigerian}
                    onChange={(e) => setNewChannelNigerian(e.target.checked)}
                  />
                  <span>Nigerian Priority</span>
                </label>
                <button
                  type="submit"
                  disabled={addingChannel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addingChannel ? 'Resolving...' : 'Add & Sync'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Safe Merge Duplicate Speaker Records Tool (Section 8) */}
          <form
            onSubmit={handleMergeDuplicateChannels}
            className="p-5 rounded-xl bg-[#121215] border border-amber-500/30 flex flex-col gap-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-amber-400">
                  Safely Merge Duplicate Speaker / Ministry Records (Zero Video Deletion)
                </h3>
                <p className="text-xs text-zinc-400">
                  Reassigns all videos and aliases from a duplicate speaker channel into the primary official channel record.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <select
                value={mergeSourceChannelId}
                onChange={(e) => setMergeSourceChannelId(e.target.value)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
              >
                <option value="">1. Select Duplicate / Secondary Channel...</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title} ({ch.handle})
                  </option>
                ))}
              </select>

              <select
                value={mergeTargetChannelId}
                onChange={(e) => setMergeTargetChannelId(e.target.value)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
              >
                <option value="">2. Select Primary Destination Minister Record...</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title} ({ch.handle})
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={mergingChannels || !mergeSourceChannelId || !mergeTargetChannelId}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold transition-colors"
              >
                {mergingChannels ? 'Merging Safely...' : 'Merge Speaker Records Safely'}
              </button>
            </div>
          </form>

          {/* Search Approved Creators */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Filter approved creators by name, speaker_name, @handle, or UC channel ID..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChannels.map((ch) => (
              <div
                key={ch.id}
                className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={ch.avatar_url}
                    alt={ch.title}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover bg-zinc-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-zinc-100 truncate">{ch.title}</div>
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span>{ch.handle}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{ch.channel_type}</span>
                      {ch.is_nigerian && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400">Nigeria</span>
                        </>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-zinc-500 mt-1 flex items-center gap-2">
                      <span>ID: {ch.youtube_channel_id}</span>
                      {ch.subscriber_count !== null && (
                        <span>· {formatCompactNumber(ch.subscriber_count)} subs</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-400">Primary Category:</span>
                  <select
                    value={ch.default_category_slug}
                    onChange={(e) =>
                      handleUpdateChannel(ch.id, { default_category_slug: e.target.value })
                    }
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={Boolean(ch.is_featured_marriage_teacher)}
                      onChange={(e) =>
                        handleUpdateChannel(ch.id, {
                          is_featured_marriage_teacher: e.target.checked,
                        })
                      }
                    />
                    <span>Featured Marriage Teacher</span>
                  </label>
                  <select
                    value={ch.speaker_gender || 'ministry'}
                    onChange={(e) =>
                      handleUpdateChannel(ch.id, {
                        speaker_gender: e.target.value as any,
                      })
                    }
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300"
                  >
                    <option value="male">Male Speaker</option>
                    <option value="female">Female Speaker</option>
                    <option value="couple">Couple Ministry</option>
                    <option value="ministry">Ministry / General</option>
                  </select>
                </div>

                {/* Minister Name, Bio & Aliases Editor (Section 8) */}
                {editingChannelId === ch.id ? (
                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-700 flex flex-col gap-2 text-xs">
                    <input
                      type="text"
                      value={editSpeakerName}
                      onChange={(e) => setEditSpeakerName(e.target.value)}
                      placeholder="Minister / Artist Display Name (e.g. Apostle Joshua Selman)"
                      className="rounded bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-100"
                    />
                    <input
                      type="text"
                      value={editAliases}
                      onChange={(e) => setEditAliases(e.target.value)}
                      placeholder="Comma-separated search aliases (e.g. Selman, Koinonia)"
                      className="rounded bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-100"
                    />
                    <textarea
                      rows={2}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Short verified biography..."
                      className="rounded bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-zinc-100"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingChannelId(null)}
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleUpdateChannel(ch.id, {
                            speaker_name: editSpeakerName,
                            aliases: editAliases,
                            bio: editBio,
                          });
                          setEditingChannelId(null);
                          showNotice(`Updated minister profile for ${editSpeakerName || ch.title}`);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-500 text-zinc-950 font-semibold"
                      >
                        Save Profile
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-400 flex items-center justify-between gap-2">
                    <span className="truncate">
                      Speaker: <strong className="text-zinc-200">{ch.speaker_name || ch.title}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChannelId(ch.id);
                        setEditSpeakerName(ch.speaker_name || ch.title);
                        setEditAliases((ch.aliases || []).join(', '));
                        setEditBio(ch.bio || '');
                      }}
                      className="text-amber-400 hover:underline shrink-0"
                    >
                      Edit Name / Bio
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTriggerChannelSync(ch.id)}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200"
                    >
                      Sync Feed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveChannel(ch.id, ch.title)}
                      title="Remove creator from approved discovery list"
                      className="p-1.5 rounded bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <select
                    value={ch.approval_status}
                    onChange={(e) =>
                      handleUpdateChannel(ch.id, { approval_status: e.target.value as any })
                    }
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200"
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORY MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleAddCategory}
            className="p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col gap-4"
          >
            <h2 className="text-sm font-semibold text-zinc-100">Create New Content Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category Name (e.g. Youth & Campus Revival)"
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100"
              />
              <input
                type="text"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Editorial description..."
                className="md:col-span-2 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newCategorySection}
                  onChange={(e) => setNewCategorySection(e.target.value as any)}
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="streaming">Streaming Section</option>
                  <option value="movies">Movies Section</option>
                </select>
                <button
                  type="submit"
                  disabled={addingCategory}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  Add Category
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = videos.filter(
                (v) =>
                  v.primary_category_slug === cat.slug ||
                  v.secondary_category_slugs.includes(cat.slug)
              ).length;
              return (
                <div
                  key={cat.id}
                  className="p-4 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-100">{cat.name}</span>
                      <span className="text-[11px] font-mono text-amber-400">
                        {count} videos · {cat.section || 'streaming'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-500">Slug: {cat.slug}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`px-2.5 py-1 rounded font-medium ${
                        cat.is_active
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {cat.is_active ? 'Active' : 'Hidden'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 13 MARRIAGE & RELATIONSHIPS COLLECTIONS ORDERING & GOVERNANCE */}
          <div className="p-6 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <div className="text-xs font-semibold text-amber-400">
                  Marriage & Relationships Category Collections (13 Sub-Collections)
                </div>
                <h3 className="text-base font-semibold text-zinc-100 mt-0.5">
                  Control Collection Display Order & Visibility
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Reorder how the 13 Marriage & Relationships collections appear on the public category sanctuary page, or toggle individual collections.
                </p>
              </div>
              <button
                type="button"
                disabled={discoveringMarriage}
                onClick={handleDiscoverMarriageTeachings}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0"
              >
                {discoveringMarriage
                  ? 'Discovering Speakers...'
                  : 'Discover Priority Male & Female Speakers'}
              </button>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {[...marriageCollections]
                .sort((a, b) => a.display_order - b.display_order)
                .map((col, idx, arr) => {
                  const colVideoCount = videos.filter(
                    (v) =>
                      v.approval_status === 'approved' &&
                      (v.primary_category_slug === 'marriage-relationships' ||
                        v.secondary_category_slugs.includes('marriage-relationships')) &&
                      v.marriage_collections?.includes(col.slug)
                  ).length;

                  return (
                    <div
                      key={col.slug}
                      className="py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center font-mono text-zinc-500">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-100">{col.name}</div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {col.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-amber-400 mr-2">
                          {colVideoCount} videos
                        </span>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleReorderMarriageCollection(idx, 'up')}
                          title="Move Collection Up"
                          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === arr.length - 1}
                          onClick={() => handleReorderMarriageCollection(idx, 'down')}
                          title="Move Collection Down"
                          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleMarriageCollectionActive(col.slug, col.is_active)
                          }
                          className={`px-2.5 py-1 rounded font-medium ${
                            col.is_active
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {col.is_active ? 'Active' : 'Hidden'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SMART YOUTUBE DISCOVERY ENGINE, HISTORY & QUOTA MONITORING */}
      {activeTab === 'discovery' && (
        <div className="flex flex-col gap-6">
          {/* Search-Driven Nigerian Christian Discovery Engine */}
          <div className="p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Smart Search-Driven Content Discovery (Nigerian Christian Search Phrases)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Discovers videos using YouTube relevance and public statistics. Videos from approved official creators are auto-approved; videos from unknown channels are held in <strong className="text-amber-300">Pending Review</strong> until approved.
              </p>
            </div>

            <form
              onSubmit={(e) => handleDiscoverySearch(e)}
              className="grid grid-cols-1 md:grid-cols-12 gap-3"
            >
              <div className="md:col-span-5">
                <input
                  type="text"
                  value={discoveryQuery}
                  onChange={(e) => setDiscoveryQuery(e.target.value)}
                  placeholder="Enter custom search phrase or leave blank to run top Nigerian preset phrases..."
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-zinc-100"
                />
              </div>
              <div className="md:col-span-3">
                <select
                  value={discoveryCategory}
                  onChange={(e) => setDiscoveryCategory(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      Target: {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <select
                  value={discoveryWindow}
                  onChange={(e) => setDiscoveryWindow(e.target.value as any)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="any">All Time Popular</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={searchingYouTube}
                  className="w-full px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {searchingYouTube ? 'Discovering...' : 'Run Discovery'}
                </button>
              </div>
            </form>

            {/* 14 Nigerian Christian Search Phrase Quick Triggers */}
            {searchPhrases.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
                <span className="text-[11px] font-medium text-zinc-400">
                  1-Click Nigerian Christian Search Phrases:
                </span>
                <div className="flex items-center flex-wrap gap-2">
                  {searchPhrases.map((item) => (
                    <button
                      key={item.phrase}
                      type="button"
                      disabled={searchingYouTube}
                      onClick={() => {
                        setDiscoveryQuery(item.phrase);
                        setDiscoveryCategory(item.defaultCategorySlug);
                        handleDiscoverySearch(undefined, item.phrase, item.defaultCategorySlug);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-amber-300 transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Discovery History Table */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <History className="w-4 h-4 text-amber-400" />
              <span>Discovery History Log</span>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] text-zinc-400">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-3">Discovery Mode</th>
                  <th className="py-2.5 px-3">Query or Channel Source</th>
                  <th className="py-2.5 px-3 text-right">Discovered</th>
                  <th className="py-2.5 px-3 text-right">Auto-Approved</th>
                  <th className="py-2.5 px-4 text-right">Pending Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 font-mono tabular-nums">
                {discoveryHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center font-sans text-zinc-500">
                      No discovery runs logged in this session yet.
                    </td>
                  </tr>
                ) : (
                  discoveryHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 text-zinc-400">
                        {formatRelativeDate(item.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-amber-400">{item.mode}</td>
                      <td className="py-2.5 px-3 font-sans text-zinc-200">
                        {item.query_or_source}
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-100">
                        {item.videos_discovered}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {item.videos_approved}
                      </td>
                      <td className="py-2.5 px-4 text-right text-amber-400">
                        {item.videos_pending}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* YouTube API Quota Telemetry */}
          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
            <div className="px-4 py-3 border-b border-zinc-800 text-xs font-semibold text-zinc-200">
              YouTube Data API v3 Usage & Quota Telemetry
            </div>
            <table className="w-full text-left border-collapse font-mono tabular-nums text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] font-sans text-zinc-400">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Endpoint</th>
                  <th className="py-3 px-3 text-right">Quota Cost</th>
                  <th className="py-3 px-3 text-right">Items</th>
                  <th className="py-3 px-3">HTTP</th>
                  <th className="py-3 px-4 font-sans">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {quotaLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 text-zinc-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-amber-400">{log.endpoint}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-100">{log.quota_cost}</td>
                    <td className="py-2.5 px-3 text-right text-zinc-300">
                      {log.videos_processed}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">{log.status_code}</td>
                    <td className="py-2.5 px-4 font-sans text-zinc-300">{log.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MODERATION & REPORTS */}
      {activeTab === 'moderation' && (
        <div className="flex flex-col gap-4">
          {reports.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#121215] border border-zinc-800 text-center text-xs text-zinc-400">
              No community moderation reports are currently open.
            </div>
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                className="p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs text-amber-400 font-medium">
                    Reported {rep.target_type.toUpperCase()} · Status: {rep.status}
                  </div>
                  <div className="text-sm font-semibold text-zinc-100 mt-1">
                    {rep.target_summary}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Reason: {rep.reason} · Reported by {rep.reporter_name} (
                    {formatRelativeDate(rep.created_at)})
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResolveReport(rep.id, 'resolved', true)}
                    className="px-3.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-medium"
                  >
                    Remove Content & Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveReport(rep.id, 'dismissed', false)}
                    className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 6: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#121215]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] text-zinc-400">
                <th className="py-3 px-4 font-medium">Member</th>
                <th className="py-3 px-3 font-medium">Email</th>
                <th className="py-3 px-3 font-medium">Location</th>
                <th className="py-3 px-3 font-medium">Role</th>
                <th className="py-3 px-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 text-xs">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium text-zinc-100">
                    {u.full_name} <span className="text-zinc-500">@{u.username}</span>
                  </td>
                  <td className="py-3 px-3 text-zinc-300">{u.email}</td>
                  <td className="py-3 px-3 text-zinc-400">{u.location}</td>
                  <td className="py-3 px-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                      className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200"
                    >
                      <option value="member">member</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleUpdateUser(u.id, { is_suspended: !u.is_suspended })}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        u.is_suspended
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-red-500/15 text-red-300'
                      }`}
                    >
                      {u.is_suspended ? 'Restore Account' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 7: SUPABASE SQL SCHEMA & CONNECTION */}
      {activeTab === 'supabase' && (
        <div className="flex flex-col gap-5">
          {/* Supabase Verification & Health Banner */}
          <div className="p-5 rounded-2xl bg-[#121215] border border-zinc-800 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>Cloudflare Pages &amp; Supabase Cloud Verification</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono">
                    Connected: {systemStatus?.supabaseUrlHost || 'hswbafspnhgojjuyhnqa.supabase.co'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                  Verification status of your PostgreSQL tables on Supabase. Execute the idempotent migration script below once in your Supabase SQL Editor to enable full multi-user persistent cloud storage on Cloudflare Pages.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(sqlSchema);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0 shadow-lg transition-colors"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copied Full SQL Schema!' : 'Copy Full SQL Schema'}</span>
              </button>
            </div>

            {/* Audit Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-emerald-500/30 flex flex-col justify-between gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Core Tables (15/17 Active)</span>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-zinc-400">
                  Profiles, categories, channels, videos, watch history, saved videos, comments, direct messages, and prayers are provisioned.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-amber-500/30 flex flex-col justify-between gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-300 font-medium">New Feature Tables (2/17 Pending)</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <p className="text-[11px] text-zinc-400">
                  <code className="text-amber-300">broadcast_reminders</code> and <code className="text-amber-300">discovered_videos</code> need the latest SQL update run in your Supabase SQL Editor.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-blue-500/30 flex flex-col justify-between gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-300 font-medium">Row Level Security (RLS)</span>
                  <span className="text-[10px] font-mono text-blue-400">Included in Script</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Section 15 of the script includes idempotent RLS policies enabling public read and user-authenticated writes for Cloudflare Pages.
                </p>
              </div>
            </div>

            {/* Quick 3-Step Guide */}
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px]">
                  i
                </span>
                <span className="text-zinc-300">
                  Quick Steps: 1. Click &ldquo;Copy Full SQL Schema&rdquo; &rarr; 2. Open your Supabase SQL Editor &rarr; 3. Paste and click &ldquo;Run&rdquo;.
                </span>
              </div>
              <a
                href="https://supabase.com/dashboard/project/hswbafspnhgojjuyhnqa/sql"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline flex items-center gap-1 font-medium whitespace-nowrap self-start sm:self-auto"
              >
                <span>Open Supabase SQL Editor &rarr;</span>
              </a>
            </div>
          </div>

          {/* Code Viewer */}
          <pre className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 overflow-x-auto max-h-[500px] leading-relaxed">
            {sqlSchema}
          </pre>
        </div>
      )}
    </section>
  );
};
