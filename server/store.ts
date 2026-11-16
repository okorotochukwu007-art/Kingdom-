import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ContentCategory,
  Conversation,
  DirectMessage,
  DiscoveryHistoryEntry,
  FellowshipPost,
  FellowshipRoomMessage,
  KingdomChannel,
  KingdomVideo,
  MarriageCollectionConfig,
  ModerationReport,
  PrayerEncouragement,
  PrayerRequest,
  SystemConfigStatus,
  UserProfile,
  VideoComment,
  WatchHistoryEntry,
  YouTubeApiLog,
} from '../src/types/kingdom.ts';
import {
  DEFAULT_MARRIAGE_COLLECTIONS,
  enrichChannelWithMinisterDirectoryProfile,
  NIGERIAN_CHRISTIAN_SEARCH_PHRASES,
  SEED_CATEGORIES,
  SEED_CHANNELS,
  VERIFIED_MARRIAGE_TEACHING_DISCOVERY_QUERIES,
} from './seedData.ts';
import { classifyVideoDeterministic, evaluateMarriageAndRelationships } from './geminiService.ts';
import {
  buildScoredKingdomVideo,
  computeVideoRankingMetrics,
  enrichChannelsWithYouTubeApiV3,
  enrichVideosWithYouTubeApiV3,
  fetchChannelVideosViaOfficialXmlFeed,
  searchYouTubeStructured,
} from './youtubeService.ts';
import {
  enforceWorshipPraiseCategoryIntegrity,
  refreshWorshipAndPraiseFromYouTube,
} from './worshipPraiseRefresh.ts';
import {
  checkForNewChristianLivingSuggestions,
  enforceChristianLivingCategoryIntegrity,
  refreshChristianLivingFromYouTube,
} from './christianLivingRefresh.ts';

interface KingdomDataStore {
  categories: ContentCategory[];
  marriageCollections: MarriageCollectionConfig[];
  channels: KingdomChannel[];
  videos: KingdomVideo[];
  users: Array<UserProfile & { password_hash?: string }>;
  sessions: Record<string, string>; // token -> userId
  watchHistory: WatchHistoryEntry[];
  savedVideos: Array<{ id: string; user_id: string; video_id: string; created_at: string }>;
  videoComments: VideoComment[];
  userFollows: Array<{ id: string; follower_id: string; following_id: string; created_at: string }>;
  userBlocks: Array<{ id: string; blocker_id: string; blocked_id: string; created_at: string }>;
  conversations: Conversation[];
  directMessages: DirectMessage[];
  prayerRequests: PrayerRequest[];
  fellowshipPosts: FellowshipPost[];
  fellowshipRoomMessages: FellowshipRoomMessage[];
  moderationReports: ModerationReport[];
  youtubeApiLogs: YouTubeApiLog[];
  discoveryHistory: DiscoveryHistoryEntry[];
  lastChannelSyncAt: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'kingdom_plus_db.json');

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`kingdom_plus_salt_${password}`).digest('hex');
}

function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const MOVIE_CATEGORY_SLUGS = new Set([
  'real-christian-movies',
  'bible-stories',
  'christian-animations',
  'bible-story-cartoons',
]);

class KingdomRepository {
  public state: KingdomDataStore;
  public supabase: SupabaseClient | null = null;
  public supabaseConnected = false;
  private isSyncing = false;

  constructor() {
    this.state = this.loadFromDisk();
    this.reclassifyAndAuditCatalog();
    this.initSupabaseClient();
  }

  private loadFromDisk(): KingdomDataStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as KingdomDataStore;
        if (parsed && Array.isArray(parsed.categories) && Array.isArray(parsed.channels)) {
          if (!Array.isArray(parsed.discoveryHistory)) {
            parsed.discoveryHistory = [];
          }
          if (!Array.isArray(parsed.fellowshipPosts)) {
            parsed.fellowshipPosts = [];
          }
          if (!Array.isArray(parsed.fellowshipRoomMessages)) {
            parsed.fellowshipRoomMessages = [];
          }
          if (!Array.isArray(parsed.marriageCollections) || parsed.marriageCollections.length === 0) {
            parsed.marriageCollections = DEFAULT_MARRIAGE_COLLECTIONS.map((c) => ({ ...c }));
          } else {
            for (const defCol of DEFAULT_MARRIAGE_COLLECTIONS) {
              const existingCol = parsed.marriageCollections.find((c) => c.slug === defCol.slug);
              if (!existingCol) {
                parsed.marriageCollections.push({ ...defCol });
              } else {
                existingCol.name = defCol.name;
                existingCol.subtitle = defCol.subtitle;
              }
            }
            parsed.marriageCollections.sort((a, b) => a.display_order - b.display_order);
          }

          // Remove erroneous American "Mount Zion TV" channel (UC4WMIAB4dauqXZahmaResLg)
          const badChannelIds = new Set(
            parsed.channels
              .filter(
                (c) =>
                  c.youtube_channel_id === 'UC4WMIAB4dauqXZahmaResLg' ||
                  c.id === 'ch-mike-bamiloye-mzfm'
              )
              .map((c) => c.id)
          );
          if (badChannelIds.size > 0) {
            parsed.channels = parsed.channels.filter((c) => !badChannelIds.has(c.id));
            parsed.videos = (parsed.videos || []).filter((v) => !badChannelIds.has(v.channel_id));
          }

          // Merge all categories from SEED_CATEGORIES without deleting any existing category record
          for (const seedCat of SEED_CATEGORIES) {
            const existingCat = parsed.categories.find((c) => c.slug === seedCat.slug);
            if (existingCat) {
              existingCat.section = seedCat.section;
              existingCat.description = seedCat.description;
              existingCat.name = seedCat.name;
              existingCat.display_order = seedCat.display_order;
              existingCat.is_active = seedCat.is_active;
              existingCat.is_legacy_subcategory = seedCat.is_legacy_subcategory;
              existingCat.parent_category_slug = seedCat.parent_category_slug;
            } else {
              parsed.categories.push({ ...seedCat });
            }
          }
          parsed.categories.sort((a, b) => a.display_order - b.display_order);

          // Merge all new & updated channels from SEED_CHANNELS
          for (const seedCh of SEED_CHANNELS) {
            const existingCh = parsed.channels.find(
              (c) => c.youtube_channel_id === seedCh.youtube_channel_id || c.id === seedCh.id
            );
            if (existingCh) {
              existingCh.youtube_channel_id = seedCh.youtube_channel_id;
              existingCh.title = seedCh.title;
              existingCh.handle = seedCh.handle;
              existingCh.channel_type = seedCh.channel_type;
              existingCh.default_category_slug = seedCh.default_category_slug;
              existingCh.supported_categories = seedCh.supported_categories;
              existingCh.priority_weight = seedCh.priority_weight;
              existingCh.is_official_verified = seedCh.is_official_verified;
              if (seedCh.speaker_gender) {
                existingCh.speaker_gender = seedCh.speaker_gender;
              }
              if (typeof seedCh.is_featured_marriage_teacher === 'boolean') {
                existingCh.is_featured_marriage_teacher = seedCh.is_featured_marriage_teacher;
              }
              if (seedCh.speaker_name) existingCh.speaker_name = seedCh.speaker_name;
              if (seedCh.ministry_name) existingCh.ministry_name = seedCh.ministry_name;
              if (seedCh.aliases) existingCh.aliases = seedCh.aliases;
              if (seedCh.bio) existingCh.bio = seedCh.bio;
              if (typeof seedCh.is_featured_minister === 'boolean') {
                existingCh.is_featured_minister = seedCh.is_featured_minister;
              }
            } else {
              parsed.channels.push({ ...seedCh });
            }
          }

          // Enrich all existing channels (including any custom/discovered channels) with verified minister directory metadata
          parsed.channels = parsed.channels.map((ch) => enrichChannelWithMinisterDirectoryProfile(ch));
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read local store, initializing clean store:', err);
    }

    return {
      categories: [...SEED_CATEGORIES],
      marriageCollections: DEFAULT_MARRIAGE_COLLECTIONS.map((c) => ({ ...c })),
      channels: [...SEED_CHANNELS],
      videos: [],
      users: [],
      sessions: {},
      watchHistory: [],
      savedVideos: [],
      videoComments: [],
      userFollows: [],
      userBlocks: [],
      conversations: [],
      directMessages: [],
      prayerRequests: [],
      fellowshipPosts: [],
      fellowshipRoomMessages: [],
      moderationReports: [],
      youtubeApiLogs: [],
      discoveryHistory: [],
      lastChannelSyncAt: null,
    };
  }

  /**
   * Re-evaluates all existing videos into the 8 Approved Main Streaming Categories
   * WITHOUT deleting any video or movie records.
   * Preserves existing movie categories and retains legacy category slugs & subcategory labels.
   */
  public reclassifyAndAuditCatalog(): void {
    // Enforce that only the 36 approved Worship & Praise artists can appear in worship-praise
    enforceWorshipPraiseCategoryIntegrity(
      this.state.channels,
      this.state.videos,
      this.state.categories
    );

    // Enforce that only the 20 approved Christian Living ministers can appear in christian-living
    enforceChristianLivingCategoryIntegrity(
      this.state.channels,
      this.state.videos,
      this.state.categories
    );

    const channelById = new Map<string, KingdomChannel>();
    for (const ch of this.state.channels) {
      channelById.set(ch.id, ch);
    }

    for (const v of this.state.videos) {
      const ch = channelById.get(v.channel_id);
      if (!ch || ch.approval_status === 'blocked') {
        v.approval_status = 'rejected';
        continue;
      }
      if (ch.approval_status === 'pending' && v.approval_status === 'approved') {
        v.approval_status = 'pending_review';
      }

      v.channel_title = ch.title;
      v.channel_handle = ch.handle;
      v.channel_type = ch.channel_type;
      v.is_nigerian_channel = ch.is_nigerian;
      v.is_official_verified = ch.is_official_verified;
      v.speaker_gender = ch.speaker_gender;

      // Preserve the original category slug as legacy_category_slug before remapping
      if (!v.legacy_category_slug && v.primary_category_slug) {
        v.legacy_category_slug = v.primary_category_slug;
      }

      // CRITICAL SECTION 2 RULE: Existing Movies MUST remain untouched in their movie categories!
      if (MOVIE_CATEGORY_SLUGS.has(v.primary_category_slug)) {
        const movieCat = this.state.categories.find((c) => c.slug === v.primary_category_slug);
        if (movieCat) {
          v.primary_category_id = movieCat.id;
          v.primary_category_name = movieCat.name;
          v.subcategory_label = v.subcategory_label || movieCat.name;
        }
        continue;
      }

      // Ensure recorded videos are never falsely marked live
      if (v.live_broadcast_content !== 'live') {
        v.live_broadcast_content = 'none';
        v.is_live_now = false;
      }

      // Preserve curated Worship & Praise songs belonging to the 36 Approved Worship & Praise Artists
      if (v.primary_category_slug === 'worship-praise' && ch.is_approved_worship_artist) {
        const worshipCat = this.state.categories.find((c) => c.slug === 'worship-praise');
        if (worshipCat) {
          v.primary_category_id = worshipCat.id;
          v.primary_category_name = worshipCat.name;
        }
        const metrics = computeVideoRankingMetrics({
          viewCount: v.view_count,
          likeCount: v.likes_verified !== false ? v.like_count : 0,
          commentCount: v.comment_count,
          publishedAt: v.published_at,
          isNigerianChannel: ch.is_nigerian,
          isOfficialVerified: ch.is_official_verified,
          priorityWeight: ch.priority_weight,
        });
        v.views_per_day = metrics.viewsPerDay;
        v.engagement_rate = metrics.engagementRate;
        v.trending_score = metrics.trendingScore;
        v.evergreen_score = metrics.evergreenScore;
        v.quality_score = metrics.qualityScore;
        continue;
      }

      // Preserve curated Christian Living teachings belonging to the 20 Approved Christian Living Ministers
      if (v.primary_category_slug === 'christian-living' && ch.is_approved_christian_living_minister) {
        const clCat = this.state.categories.find((c) => c.slug === 'christian-living');
        if (clCat) {
          v.primary_category_id = clCat.id;
          v.primary_category_name = clCat.name;
        }
        const metrics = computeVideoRankingMetrics({
          viewCount: v.view_count,
          likeCount: v.likes_verified !== false ? v.like_count : 0,
          commentCount: v.comment_count,
          publishedAt: v.published_at,
          isNigerianChannel: ch.is_nigerian,
          isOfficialVerified: ch.is_official_verified,
          priorityWeight: ch.priority_weight,
        });
        v.views_per_day = metrics.viewsPerDay;
        v.engagement_rate = metrics.engagementRate;
        v.trending_score = metrics.trendingScore;
        v.evergreen_score = metrics.evergreenScore;
        v.quality_score = metrics.qualityScore;
        continue;
      }

      const classification = classifyVideoDeterministic(
        v.title,
        v.description,
        ch.title,
        ch.channel_type,
        ch.default_category_slug,
        v.duration_seconds,
        v.live_broadcast_content,
        ch.speaker_gender
      );

      if (!classification.isRelevantChristianContent) {
        v.approval_status = 'rejected';
        continue;
      }

      // If classifier flagged video as ambiguous/unclassifiable promo clip, move to Admin Review Queue
      if (classification.shouldQueueForAdminReview && v.approval_status === 'approved') {
        v.approval_status = 'pending_review';
      }

      // Do NOT allow non-curated videos to auto-enter worship-praise or christian-living
      let resolvedPrimarySlug = classification.primaryCategorySlug;
      if (resolvedPrimarySlug === 'worship-praise') {
        resolvedPrimarySlug = ch.channel_type === 'artist' ? 'gospel-music' : 'sermons-teachings';
      }
      if (resolvedPrimarySlug === 'christian-living') {
        resolvedPrimarySlug = 'sermons-teachings';
      }

      const primaryCat =
        this.state.categories.find((c) => c.slug === resolvedPrimarySlug) ||
        this.state.categories.find((c) => c.slug === 'sermons-teachings') ||
        this.state.categories[0];

      if (primaryCat) {
        v.primary_category_id = primaryCat.id;
        v.primary_category_slug = primaryCat.slug;
        v.primary_category_name = primaryCat.name;
      }
      v.secondary_category_slugs = classification.secondaryCategorySlugs.filter(
        (s) =>
          s !== 'worship-praise' &&
          s !== 'christian-living' &&
          s !== v.primary_category_slug
      );
      v.subcategory_label = classification.subcategoryLabel;
      if (classification.legacyCategorySlug && !v.legacy_category_slug) {
        v.legacy_category_slug = classification.legacyCategorySlug;
      }
      v.marriage_collections = classification.marriageCollections;
      v.ai_classification_reason = classification.reason;

      const metrics = computeVideoRankingMetrics({
        viewCount: v.view_count,
        likeCount: v.likes_verified !== false ? v.like_count : 0,
        commentCount: v.comment_count,
        publishedAt: v.published_at,
        isNigerianChannel: ch.is_nigerian,
        isOfficialVerified: ch.is_official_verified,
        priorityWeight: ch.priority_weight,
      });

      v.views_per_day = metrics.viewsPerDay;
      v.engagement_rate = metrics.engagementRate;
      v.trending_score = metrics.trendingScore;
      v.evergreen_score = metrics.evergreenScore;
      v.quality_score = metrics.qualityScore;
    }

    this.saveToDisk();
  }

  public async refreshWorshipAndPraiseCatalog(maxPerArtist = 8) {
    const result = await refreshWorshipAndPraiseFromYouTube({
      channels: this.state.channels,
      videos: this.state.videos,
      categories: this.state.categories,
      maxPerArtist,
    });
    this.saveToDisk();
    return result;
  }

  public async refreshChristianLivingCatalog(maxPerMinister = 8) {
    const result = await refreshChristianLivingFromYouTube({
      channels: this.state.channels,
      videos: this.state.videos,
      categories: this.state.categories,
      maxPerMinister,
    });
    this.saveToDisk();
    return result;
  }

  public async checkChristianLivingSuggestions() {
    const result = await checkForNewChristianLivingSuggestions({
      channels: this.state.channels,
      videos: this.state.videos,
      categories: this.state.categories,
    });
    if (result.suggestedForApprovalCount > 0) {
      this.recordDiscoveryHistory({
        mode: 'channel_feed_sync',
        query_or_source: `Christian Living Scheduled Refresh: ${result.suggestedForApprovalCount} new candidate teaching(s) queued for Admin Approval`,
        videos_discovered: result.suggestedForApprovalCount,
        videos_approved: 0,
        videos_pending: result.suggestedForApprovalCount,
      });
    }
    this.saveToDisk();
    return result;
  }

  /**
   * Safely merges a duplicate speaker/channel record (`sourceChannelId`) into a primary
   * channel record (`targetChannelId`) without deleting any videos.
   * Reassigns all videos from source to target and merges aliases.
   */
  public mergeDuplicateChannels(
    sourceChannelId: string,
    targetChannelId: string
  ): { reassignedVideosCount: number; targetChannel: KingdomChannel | null } {
    if (sourceChannelId === targetChannelId) {
      return { reassignedVideosCount: 0, targetChannel: null };
    }
    const source = this.state.channels.find((c) => c.id === sourceChannelId);
    const target = this.state.channels.find((c) => c.id === targetChannelId);
    if (!source || !target) {
      return { reassignedVideosCount: 0, targetChannel: null };
    }

    let reassignedVideosCount = 0;
    for (const video of this.state.videos) {
      if (video.channel_id === source.id) {
        video.channel_id = target.id;
        video.channel_title = target.title;
        video.channel_handle = target.handle;
        video.channel_avatar_url = target.avatar_url;
        video.speaker_gender = target.speaker_gender;
        reassignedVideosCount++;
      }
    }

    const mergedAliases = new Set<string>([
      ...(target.aliases || []),
      ...(source.aliases || []),
      source.title,
      source.handle,
    ]);
    if (source.speaker_name) mergedAliases.add(source.speaker_name);
    if (source.ministry_name) mergedAliases.add(source.ministry_name);
    target.aliases = Array.from(mergedAliases).filter(Boolean);

    // Mark the merged source channel as inactive/pending so its videos now live under target without losing history
    this.state.channels = this.state.channels.filter((c) => c.id !== source.id);
    this.saveToDisk();

    return { reassignedVideosCount, targetChannel: target };
  }

  /**
   * Detects and removes duplicate videos (by youtube_video_id or identical normalized title + channel).
   */
  public deduplicateVideos(logToHistory = true): { removedCount: number } {
    const seenVideoIds = new Set<string>();
    const seenChannelTitles = new Set<string>();
    const uniqueVideos: KingdomVideo[] = [];
    let removedCount = 0;

    // Sort by view_count descending so we always keep the highest-view version if duplicates exist
    const sorted = [...this.state.videos].sort((a, b) => b.view_count - a.view_count);

    for (const v of sorted) {
      const normTitleKey = `${v.channel_id}::${normalizeTitleForDedup(v.title)}`;
      if (seenVideoIds.has(v.youtube_video_id) || seenChannelTitles.has(normTitleKey)) {
        removedCount++;
        continue;
      }
      seenVideoIds.add(v.youtube_video_id);
      seenChannelTitles.add(normTitleKey);
      uniqueVideos.push(v);
    }

    this.state.videos = uniqueVideos;
    if (logToHistory && removedCount > 0) {
      this.recordDiscoveryHistory({
        mode: 'deduplication',
        query_or_source: `Automated duplicate scan (removed ${removedCount} duplicate entries)`,
        videos_discovered: 0,
        videos_approved: this.state.videos.filter((v) => v.approval_status === 'approved').length,
        videos_pending: this.state.videos.filter((v) => v.approval_status === 'pending_review').length,
      });
    }
    this.saveToDisk();
    return { removedCount };
  }

  public recordDiscoveryHistory(entry: Omit<DiscoveryHistoryEntry, 'id' | 'created_at'>): void {
    const record: DiscoveryHistoryEntry = {
      ...entry,
      id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    this.state.discoveryHistory.unshift(record);
    if (this.state.discoveryHistory.length > 150) {
      this.state.discoveryHistory = this.state.discoveryHistory.slice(0, 150);
    }
  }

  public saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting store to disk:', err);
    }
  }

  public initSupabaseClient(): void {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (
      url &&
      key &&
      url.startsWith('http') &&
      !url.includes('your-project-id') &&
      key !== 'your-supabase-anon-public-key'
    ) {
      try {
        this.supabase = createClient(url, key, {
          auth: { persistSession: false },
        });
        this.verifySupabaseConnection();
      } catch (err) {
        console.error('Supabase initialization error:', err);
        this.supabase = null;
      }
    } else {
      this.supabase = null;
      this.supabaseConnected = false;
    }
  }

  public async verifySupabaseConnection(): Promise<boolean> {
    if (!this.supabase) {
      this.supabaseConnected = false;
      return false;
    }
    try {
      const { error } = await this.supabase.from('categories').select('id').limit(1);
      if (!error) {
        this.supabaseConnected = true;
        await this.syncCategoriesAndChannelsToSupabase();
        return true;
      }
      this.supabaseConnected = false;
      return false;
    } catch {
      this.supabaseConnected = false;
      return false;
    }
  }

  public async syncCategoriesAndChannelsToSupabase(): Promise<void> {
    if (!this.supabase || !this.supabaseConnected) return;
    try {
      const catPayload = this.state.categories.map((cat) => ({
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        display_order: cat.display_order,
        is_active: cat.is_active,
      }));
      await this.supabase.from('categories').upsert(catPayload, { onConflict: 'slug' });

      const { data: sbCats } = await this.supabase.from('categories').select('id, slug');
      const catMap = new Map<string, string>();
      for (const c of sbCats || []) {
        catMap.set(c.slug, c.id);
      }

      const chPayload = this.state.channels.map((ch) => ({
        youtube_channel_id: ch.youtube_channel_id,
        title: ch.title,
        handle: ch.handle,
        channel_type: ch.channel_type,
        is_nigerian: ch.is_nigerian,
        is_official_verified: ch.is_official_verified,
        default_category_slug: ch.default_category_slug,
        subscriber_count: ch.subscriber_count,
        video_count: ch.video_count,
        view_count: ch.view_count,
        avatar_url: ch.avatar_url,
        approval_status: ch.approval_status,
        priority_weight: ch.priority_weight,
        last_synced_at: ch.last_synced_at,
      }));
      await this.supabase.from('channels').upsert(chPayload, { onConflict: 'youtube_channel_id' });

      const { data: sbChs } = await this.supabase
        .from('channels')
        .select('id, youtube_channel_id');
      const chMap = new Map<string, string>();
      for (const ch of sbChs || []) {
        chMap.set(ch.youtube_channel_id, ch.id);
      }

      const validVideos = this.state.videos
        .map((v) => {
          const localCh = this.state.channels.find((c) => c.id === v.channel_id);
          const sbChannelId = localCh ? chMap.get(localCh.youtube_channel_id) : undefined;
          const sbCategoryId = catMap.get(v.primary_category_slug);
          if (!sbChannelId || !sbCategoryId) return null;
          return {
            youtube_video_id: v.youtube_video_id,
            channel_id: sbChannelId,
            primary_category_id: sbCategoryId,
            secondary_category_slugs: v.secondary_category_slugs,
            title: v.title,
            description: v.description,
            thumbnail_high_url: v.thumbnail_high_url,
            thumbnail_maxres_url: v.thumbnail_maxres_url,
            published_at: v.published_at,
            duration_seconds: v.duration_seconds,
            view_count: v.view_count,
            like_count: v.like_count,
            comment_count: v.comment_count,
            views_per_day: v.views_per_day,
            engagement_rate: v.engagement_rate,
            trending_score: v.trending_score,
            evergreen_score: v.evergreen_score,
            is_embeddable: v.is_embeddable,
            is_available: v.is_available,
            approval_status: v.approval_status,
            is_featured_hero: v.is_featured_hero,
            is_trending_pinned: v.is_trending_pinned,
            ai_classification_reason: v.ai_classification_reason,
            last_refreshed_at: v.last_refreshed_at,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      for (let i = 0; i < validVideos.length; i += 100) {
        await this.supabase
          .from('videos')
          .upsert(validVideos.slice(i, i + 100), { onConflict: 'youtube_video_id' });
      }
    } catch {
      // Non-fatal if RLS or schema not yet applied
    }
  }

  public logYouTubeQuota(
    endpoint: string,
    quotaCost: number,
    videosProcessed: number,
    statusCode: number,
    note: string
  ): void {
    const entry: YouTubeApiLog = {
      id: `ytlog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      endpoint,
      quota_cost: quotaCost,
      videos_processed: videosProcessed,
      status_code: statusCode,
      note,
      created_at: new Date().toISOString(),
    };
    this.state.youtubeApiLogs.unshift(entry);
    if (this.state.youtubeApiLogs.length > 300) {
      this.state.youtubeApiLogs = this.state.youtubeApiLogs.slice(0, 300);
    }
  }

  public getQuotaUsedToday(): number {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();
    return this.state.youtubeApiLogs
      .filter((log) => new Date(log.created_at).getTime() >= startMs)
      .reduce((acc, log) => acc + log.quota_cost, 0);
  }

  public getSystemStatus(): SystemConfigStatus {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseConfigured = Boolean(
      supabaseUrl && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-id')
    );
    let supabaseUrlHost: string | null = null;
    if (supabaseConfigured) {
      try {
        supabaseUrlHost = new URL(supabaseUrl).host;
      } catch {
        supabaseUrlHost = null;
      }
    }

    const ytKey = process.env.YOUTUBE_API_KEY || '';
    const youtubeApiKeyConfigured = Boolean(ytKey && ytKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY');
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const geminiConfigured = Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY');

    return {
      supabaseConfigured,
      supabaseConnected: this.supabaseConnected,
      supabaseUrlHost,
      youtubeApiKeyConfigured,
      geminiConfigured,
      quotaUsedToday: this.getQuotaUsedToday(),
      quotaDailyLimit: 10000,
      lastChannelSyncAt: this.state.lastChannelSyncAt,
      totalApprovedVideos: this.state.videos.filter(
        (v) => v.approval_status === 'approved' && v.is_available && v.is_embeddable
      ).length,
      totalPendingVideos: this.state.videos.filter((v) => v.approval_status === 'pending_review').length,
      totalApprovedChannels: this.state.channels.filter((c) => c.approval_status === 'approved').length,
      duplicateVideosCount: 0,
    };
  }

  /**
   * Syncs live videos from all approved official channels in our registry.
   * Uses official YouTube XML Feeds (0 quota) + enriches via YouTube Data API v3 `videos.list` & `channels.list`
   * when YOUTUBE_API_KEY is present.
   */
  public async syncApprovedChannels(targetChannelId?: string): Promise<{
    channelsSynced: number;
    videosAdded: number;
    videosUpdated: number;
  }> {
    if (this.isSyncing && !targetChannelId) {
      return { channelsSynced: 0, videosAdded: 0, videosUpdated: 0 };
    }
    this.isSyncing = true;

    let channelsSynced = 0;
    let videosAdded = 0;
    let videosUpdated = 0;

    try {
      const approvedChannels = this.state.channels.filter(
        (c) => c.approval_status === 'approved' && (!targetChannelId || c.id === targetChannelId)
      );

      const apiKey = process.env.YOUTUBE_API_KEY || '';

      // 1. If YOUTUBE_API_KEY is configured, enrich channel metadata in batched calls
      if (apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY') {
        await enrichChannelsWithYouTubeApiV3(approvedChannels, apiKey, (ep, cost, cnt, st, note) =>
          this.logYouTubeQuota(ep, cost, cnt, st, note)
        );
      }

      // 2. Fetch live videos in parallel batches of 6 channels
      const batchSize = 6;
      const newlyDiscoveredIds: string[] = [];

      for (let i = 0; i < approvedChannels.length; i += batchSize) {
        const batch = approvedChannels.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (channel) => {
            try {
              const rawItems = await fetchChannelVideosViaOfficialXmlFeed(channel.youtube_channel_id);
              channel.last_synced_at = new Date().toISOString();
              channelsSynced++;

              // Take up to 12 most recent videos per channel to maintain a rich, diverse catalog
              for (const raw of rawItems.slice(0, 12)) {
                const existing = this.state.videos.find(
                  (v) => v.youtube_video_id === raw.youtubeVideoId
                );
                if (existing) {
                  existing.view_count = Math.max(existing.view_count, raw.viewCount);
                  existing.like_count = Math.max(existing.like_count, raw.likeCount);
                  existing.channel_avatar_url = channel.avatar_url;
                  existing.channel_title = channel.title;
                  existing.channel_handle = channel.handle;
                  existing.speaker_gender = channel.speaker_gender;
                  const metrics = computeVideoRankingMetrics({
                    viewCount: existing.view_count,
                    likeCount: existing.like_count,
                    commentCount: existing.comment_count,
                    publishedAt: existing.published_at,
                    isNigerianChannel: channel.is_nigerian,
                    isOfficialVerified: channel.is_official_verified,
                    priorityWeight: channel.priority_weight,
                  });
                  existing.views_per_day = metrics.viewsPerDay;
                  existing.engagement_rate = metrics.engagementRate;
                  existing.trending_score = metrics.trendingScore;
                  existing.evergreen_score = metrics.evergreenScore;
                  existing.quality_score = metrics.qualityScore;
                  existing.last_refreshed_at = new Date().toISOString();
                  videosUpdated++;
                } else {
                  const defaultStatus =
                    channel.approval_status === 'approved' && channel.is_official_verified
                      ? 'approved'
                      : 'pending_review';
                  const scored = buildScoredKingdomVideo(
                    raw,
                    channel,
                    this.state.categories,
                    defaultStatus
                  );
                  if (scored.approval_status !== 'rejected') {
                    this.state.videos.push(scored);
                    newlyDiscoveredIds.push(raw.youtubeVideoId);
                    videosAdded++;
                  }
                }
              }
            } catch (err) {
              console.warn(`Channel sync warning for ${channel.title}:`, (err as Error).message);
            }
          })
        );
      }

      // 3. If YOUTUBE_API_KEY is configured, batch-enrich video statistics, duration, liveBroadcastContent, and embeddable status
      if (apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY') {
        const missingDurationIds = this.state.videos
          .filter((v) => v.duration_seconds === null)
          .map((v) => v.youtube_video_id);
        const idsToEnrich = Array.from(new Set([...newlyDiscoveredIds, ...missingDurationIds]));

        if (idsToEnrich.length > 0) {
          const enrichedMap = await enrichVideosWithYouTubeApiV3(
            idsToEnrich,
            apiKey,
            (ep, cost, cnt, st, note) => this.logYouTubeQuota(ep, cost, cnt, st, note)
          );

          for (const video of this.state.videos) {
            const enriched = enrichedMap.get(video.youtube_video_id);
            if (!enriched) continue;
            const ch = this.state.channels.find((c) => c.id === video.channel_id);
            video.view_count = enriched.viewCount || video.view_count;
            video.like_count = enriched.likeCount || video.like_count;
            video.comment_count = enriched.commentCount;
            video.duration_seconds = enriched.durationSeconds;
            video.live_broadcast_content = enriched.liveBroadcastContent;
            video.is_live_now = enriched.isLiveNow;
            video.is_embeddable = enriched.isEmbeddable;
            video.is_available = enriched.isAvailable;

            // Filter out ultra-short videos (< 90s) if duration is known and not a live stream
            if (
              !video.is_live_now &&
              video.duration_seconds !== null &&
              video.duration_seconds > 0 &&
              video.duration_seconds < 90
            ) {
              video.approval_status = 'rejected';
            }

            if (
              ch &&
              video.primary_category_slug !== 'worship-praise' &&
              video.primary_category_slug !== 'christian-living'
            ) {
              const classification = classifyVideoDeterministic(
                video.title,
                video.description,
                ch.title,
                ch.channel_type,
                ch.default_category_slug,
                video.duration_seconds,
                video.live_broadcast_content,
                ch.speaker_gender
              );
              let resolvedPrimarySlug = classification.primaryCategorySlug;
              if (resolvedPrimarySlug === 'worship-praise') {
                resolvedPrimarySlug =
                  ch.channel_type === 'artist' ? 'gospel-music' : 'sermons-teachings';
              }
              if (resolvedPrimarySlug === 'christian-living') {
                resolvedPrimarySlug = 'sermons-teachings';
              }
              const primaryCat = this.state.categories.find((c) => c.slug === resolvedPrimarySlug);
              if (primaryCat) {
                video.primary_category_id = primaryCat.id;
                video.primary_category_slug = primaryCat.slug;
                video.primary_category_name = primaryCat.name;
              }
              video.secondary_category_slugs = classification.secondaryCategorySlugs.filter(
                (s) =>
                  s !== 'worship-praise' &&
                  s !== 'christian-living' &&
                  s !== video.primary_category_slug
              );
              video.marriage_collections = classification.marriageCollections;
              video.ai_classification_reason = classification.reason;
              if (classification.shouldQueueForAdminReview && video.approval_status === 'approved') {
                video.approval_status = 'pending_review';
              }
            }

            const metrics = computeVideoRankingMetrics({
              viewCount: video.view_count,
              likeCount: video.like_count,
              commentCount: video.comment_count,
              publishedAt: video.published_at,
              isNigerianChannel: video.is_nigerian_channel,
              isOfficialVerified: video.is_official_verified,
              priorityWeight: ch?.priority_weight ?? 1.35,
            });
            video.views_per_day = metrics.viewsPerDay;
            video.engagement_rate = metrics.engagementRate;
            video.trending_score = metrics.trendingScore;
            video.evergreen_score = metrics.evergreenScore;
            video.quality_score = metrics.qualityScore;
          }
        }
      }

      this.deduplicateVideos(false);

      // 4. Ensure top Nigerian videos are marked as Featured Hero if none is currently set
      const hasFeaturedHero = this.state.videos.some(
        (v) => v.is_featured_hero && v.approval_status === 'approved' && v.is_available && v.is_embeddable
      );
      if (!hasFeaturedHero) {
        const topNigerianCandidates = this.state.videos
          .filter(
            (v) =>
              v.approval_status === 'approved' &&
              v.is_available &&
              v.is_embeddable &&
              v.is_nigerian_channel
          )
          .sort((a, b) => b.trending_score - a.trending_score);

        for (const hero of topNigerianCandidates.slice(0, 5)) {
          hero.is_featured_hero = true;
        }
      }

      this.recordDiscoveryHistory({
        mode: 'channel_feed_sync',
        query_or_source: targetChannelId
          ? `Single channel sync (${targetChannelId})`
          : `Synced ${channelsSynced} approved official channels`,
        videos_discovered: videosAdded,
        videos_approved: videosAdded,
        videos_pending: 0,
      });

      this.state.lastChannelSyncAt = new Date().toISOString();
      this.saveToDisk();
      await this.syncCategoriesAndChannelsToSupabase();
    } finally {
      this.isSyncing = false;
    }

    return { channelsSynced, videosAdded, videosUpdated };
  }

  /**
   * Targeted discovery for Priority Male & Female Marriage Speakers.
   * Evaluates each video strictly by its actual title, description, and subject relevance
   * before assigning to Marriage & Relationships and its 13 sub-collections.
   */
  public async discoverVerifiedMarriageTeachings(): Promise<{
    discoveredCount: number;
    approvedMarriageVideosCount: number;
    queuedForReviewCount: number;
  }> {
    let discoveredCount = 0;
    let approvedMarriageVideosCount = 0;
    let queuedForReviewCount = 0;

    const batchSize = 4;
    for (let i = 0; i < VERIFIED_MARRIAGE_TEACHING_DISCOVERY_QUERIES.length; i += batchSize) {
      const batch = VERIFIED_MARRIAGE_TEACHING_DISCOVERY_QUERIES.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (queryText) => {
          try {
            const results = await searchYouTubeStructured(queryText, 8);
            const queryLower = queryText.toLowerCase();
            const targetSpeakerChannel = this.state.channels.find(
              (c) =>
                (c.is_featured_marriage_teacher ||
                  c.supported_categories?.includes('marriage-relationships')) &&
                queryLower.includes(
                  c.title
                    .replace(/^(pastor|apostle|bishop|rev\.|minister|dr\.)\s+/i, '')
                    .split('(')[0]
                    .trim()
                    .toLowerCase()
                )
            );

            for (const raw of results) {
              if (this.state.videos.some((v) => v.youtube_video_id === raw.youtubeVideoId)) {
                continue;
              }

              // Strictly evaluate subject relevance by title and description
              const matchedChannel =
                this.state.channels.find((c) => c.youtube_channel_id === raw.youtubeChannelId) ||
                // Also allow when the video explicitly features the priority speaker in its title
                (targetSpeakerChannel &&
                raw.title
                  .toLowerCase()
                  .includes(
                    targetSpeakerChannel.title
                      .replace(/^(pastor|apostle|bishop|rev\.|minister|dr\.)\s+/i, '')
                      .split('(')[0]
                      .trim()
                      .toLowerCase()
                  )
                  ? targetSpeakerChannel
                  : undefined);

              if (!matchedChannel || matchedChannel.approval_status === 'blocked') {
                continue;
              }

              const marriageEval = evaluateMarriageAndRelationships(
                raw.title,
                raw.description,
                matchedChannel.title,
                matchedChannel.channel_type,
                matchedChannel.speaker_gender
              );

              if (!marriageEval.isMarriageRelevant) {
                continue;
              }

              const scored = buildScoredKingdomVideo(
                raw,
                matchedChannel,
                this.state.categories,
                'approved'
              );

              if (scored.primary_category_slug === 'marriage-relationships' && scored.approval_status === 'approved') {
                this.state.videos.push(scored);
                discoveredCount++;
                approvedMarriageVideosCount++;
              } else if (scored.approval_status === 'pending_review') {
                this.state.videos.push(scored);
                discoveredCount++;
                queuedForReviewCount++;
              }
            }
          } catch (err) {
            console.warn(`Marriage discovery warning for "${queryText}":`, (err as Error).message);
          }
        })
      );
    }

    this.deduplicateVideos(false);
    this.recordDiscoveryHistory({
      mode: 'search_phrase_discovery',
      query_or_source: `Priority Male & Female Marriage Speaker Discovery (${VERIFIED_MARRIAGE_TEACHING_DISCOVERY_QUERIES.length} speaker queries)`,
      videos_discovered: discoveredCount,
      videos_approved: approvedMarriageVideosCount,
      videos_pending: queuedForReviewCount,
    });
    this.saveToDisk();
    await this.syncCategoriesAndChannelsToSupabase();

    return {
      discoveredCount,
      approvedMarriageVideosCount,
      queuedForReviewCount,
    };
  }

  /**
   * Search-Driven Content Discovery using Nigerian Christian search phrases (or custom admin queries)
   * with strict creator verification:
   * - Videos from approved official channels in `this.state.channels` are auto-approved.
   * - Videos from unknown channels are placed in `pending_review` so random/generic creators
   *   NEVER enter the public catalog without explicit administrator approval.
   */
  public async runSearchPhraseDiscovery(params: {
    query?: string;
    defaultCategorySlug?: string;
    publishedWithin?: '24h' | '7d' | '30d' | '90d' | 'any';
  }): Promise<{
    discoveredCount: number;
    approvedFromOfficialCount: number;
    queuedForReviewCount: number;
  }> {
    const apiKey = process.env.YOUTUBE_API_KEY || '';
    const phrasesToRun = params.query
      ? [
          {
            phrase: params.query.trim(),
            defaultCategorySlug: params.defaultCategorySlug || 'sermons-teachings',
          },
        ]
      : NIGERIAN_CHRISTIAN_SEARCH_PHRASES.slice(0, 4);

    let publishedAfterIso: string | undefined;
    const now = Date.now();
    if (params.publishedWithin === '24h') {
      publishedAfterIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    } else if (params.publishedWithin === '7d') {
      publishedAfterIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (params.publishedWithin === '30d') {
      publishedAfterIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (params.publishedWithin === '90d') {
      publishedAfterIso = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    }

    let discoveredCount = 0;
    let approvedFromOfficialCount = 0;
    let queuedForReviewCount = 0;

    for (const entry of phrasesToRun) {
      let usedDataApiV3 = false;

      if (apiKey && apiKey !== 'YOUR_YOUTUBE_DATA_API_V3_KEY') {
        try {
          const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
          searchUrl.searchParams.set('part', 'snippet');
          searchUrl.searchParams.set('q', entry.phrase);
          searchUrl.searchParams.set('type', 'video');
          searchUrl.searchParams.set('videoEmbeddable', 'true');
          searchUrl.searchParams.set('regionCode', 'NG');
          searchUrl.searchParams.set('relevanceLanguage', 'en');
          searchUrl.searchParams.set('maxResults', '12');
          if (publishedAfterIso) {
            searchUrl.searchParams.set('publishedAfter', publishedAfterIso);
          }
          searchUrl.searchParams.set('key', apiKey);

          const searchRes = await fetch(searchUrl.toString());
          this.logYouTubeQuota(
            'search.list',
            100,
            12,
            searchRes.status,
            `Nigerian phrase discovery: "${entry.phrase}" (${params.publishedWithin || 'any'})`
          );

          if (searchRes.ok) {
            usedDataApiV3 = true;
            const searchData = await searchRes.json();
            const items = searchData.items || [];
            const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean);
            const enrichedMap = await enrichVideosWithYouTubeApiV3(
              videoIds,
              apiKey,
              (ep, cost, cnt, st, note) => this.logYouTubeQuota(ep, cost, cnt, st, note)
            );

            for (const item of items) {
              const vidId = item.id?.videoId;
              if (!vidId) continue;
              if (this.state.videos.some((v) => v.youtube_video_id === vidId)) continue;

              const stats = enrichedMap.get(vidId);
              if (!stats || !stats.isEmbeddable || !stats.isAvailable) continue;
              if (!stats.isLiveNow && stats.durationSeconds !== null && stats.durationSeconds < 120) {
                continue;
              }

              const snippet = item.snippet || {};
              const matchedChannel = this.state.channels.find(
                (c) => c.youtube_channel_id === snippet.channelId
              );

              if (matchedChannel && matchedChannel.approval_status === 'blocked') {
                continue;
              }

              const isApprovedCreator = Boolean(
                matchedChannel &&
                  matchedChannel.approval_status === 'approved' &&
                  matchedChannel.is_official_verified
              );

              const tempChannel: KingdomChannel = matchedChannel || {
                id: `ch-ext-${snippet.channelId}`,
                youtube_channel_id: snippet.channelId,
                title: snippet.channelTitle || 'Discovered Channel',
                handle: `@${(snippet.channelTitle || 'channel').replace(/\s+/g, '')}`,
                channel_type: 'ministry',
                is_nigerian: true,
                is_official_verified: false,
                default_category_slug: entry.defaultCategorySlug || 'sermons-teachings',
                subscriber_count: null,
                video_count: null,
                view_count: null,
                avatar_url: `https://unavatar.io/youtube/${encodeURIComponent(snippet.channelTitle || 'youtube')}`,
                approval_status: 'pending',
                priority_weight: 1.0,
                last_synced_at: new Date().toISOString(),
              };

              const approvalStatus = isApprovedCreator ? 'approved' : 'pending_review';
              const scored = buildScoredKingdomVideo(
                {
                  youtubeVideoId: vidId,
                  youtubeChannelId: snippet.channelId,
                  title: snippet.title || 'Untitled',
                  description: snippet.description || '',
                  publishedAt: snippet.publishedAt || new Date().toISOString(),
                  viewCount: stats.viewCount,
                  likeCount: stats.likeCount,
                  commentCount: stats.commentCount,
                  durationSeconds: stats.durationSeconds,
                  liveBroadcastContent: stats.liveBroadcastContent,
                  isLiveNow: stats.isLiveNow,
                  isEmbeddable: stats.isEmbeddable,
                  thumbnailHighUrl: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                  thumbnailMaxresUrl: `https://i.ytimg.com/vi/${vidId}/maxresdefault.jpg`,
                },
                tempChannel,
                this.state.categories,
                approvalStatus
              );

              if (scored.approval_status === 'rejected') continue;

              this.state.videos.unshift(scored);
              discoveredCount++;
              if (scored.approval_status === 'approved') {
                approvedFromOfficialCount++;
              } else {
                queuedForReviewCount++;
              }
            }
          }
        } catch {
          usedDataApiV3 = false;
        }
      }

      // Fallback to structured search (0 quota) when YouTube Data API v3 is unavailable
      if (!usedDataApiV3) {
        const structuredItems = await searchYouTubeStructured(entry.phrase, 12);
        this.logYouTubeQuota(
          'youtube.search.structured',
          0,
          structuredItems.length,
          200,
          `Structured search fallback: "${entry.phrase}"`
        );

        for (const raw of structuredItems) {
          if (this.state.videos.some((v) => v.youtube_video_id === raw.youtubeVideoId)) continue;
          if (!raw.isLiveNow && raw.durationSeconds !== null && raw.durationSeconds < 120) continue;

          const matchedChannel = this.state.channels.find(
            (c) => c.youtube_channel_id === raw.youtubeChannelId
          );
          if (matchedChannel && matchedChannel.approval_status === 'blocked') continue;

          const isApprovedCreator = Boolean(
            matchedChannel &&
              matchedChannel.approval_status === 'approved' &&
              matchedChannel.is_official_verified
          );

          const tempChannel: KingdomChannel = matchedChannel || {
            id: `ch-ext-${raw.youtubeChannelId}`,
            youtube_channel_id: raw.youtubeChannelId,
            title: 'Discovered Channel',
            handle: `@channel_${raw.youtubeChannelId.slice(0, 8)}`,
            channel_type: 'ministry',
            is_nigerian: true,
            is_official_verified: false,
            default_category_slug: entry.defaultCategorySlug || 'sermons-teachings',
            subscriber_count: null,
            video_count: null,
            view_count: null,
            avatar_url: `https://unavatar.io/youtube/${raw.youtubeChannelId}`,
            approval_status: 'pending',
            priority_weight: 1.0,
            last_synced_at: new Date().toISOString(),
          };

          const approvalStatus = isApprovedCreator ? 'approved' : 'pending_review';
          const scored = buildScoredKingdomVideo(
            raw,
            tempChannel,
            this.state.categories,
            approvalStatus
          );

          if (scored.approval_status === 'rejected') continue;

          this.state.videos.unshift(scored);
          discoveredCount++;
          if (scored.approval_status === 'approved') {
            approvedFromOfficialCount++;
          } else {
            queuedForReviewCount++;
          }
        }
      }
    }

    this.deduplicateVideos(false);
    this.recordDiscoveryHistory({
      mode: 'search_phrase_discovery',
      query_or_source: params.query
        ? `"${params.query}" (${params.publishedWithin || 'any'})`
        : `Batch Nigerian search phrases (${phrasesToRun.length} queries)`,
      videos_discovered: discoveredCount,
      videos_approved: approvedFromOfficialCount,
      videos_pending: queuedForReviewCount,
    });

    this.saveToDisk();
    await this.syncCategoriesAndChannelsToSupabase();

    return {
      discoveredCount,
      approvedFromOfficialCount,
      queuedForReviewCount,
    };
  }
}

export const store = new KingdomRepository();
