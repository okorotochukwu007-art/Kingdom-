export type UserRole = 'member' | 'moderator' | 'admin' | 'super_admin';

export interface UserProfile {
  id: string;
  auth_user_id?: string;
  email: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  bio: string;
  location: string;
  denomination_or_church: string;
  role: UserRole;
  is_suspended: boolean;
  is_online: boolean;
  last_seen_at: string;
  preferences: {
    favoriteCategories: string[];
    favoriteMinisters: string[];
  };
  created_at: string;
}

export type MainStreamingCategorySlug =
  | 'sermons-teachings'
  | 'gospel-music'
  | 'worship-praise'
  | 'prayer-spiritual-warfare'
  | 'marriage-relationships'
  | 'christian-living'
  | 'conferences-events'
  | 'live-special-broadcasts';

export interface ContentCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
  section?: 'streaming' | 'movies';
  is_legacy_subcategory?: boolean;
  parent_category_slug?: string;
}

export type ChannelType =
  | 'artist'
  | 'minister'
  | 'speaker'
  | 'church'
  | 'ministry'
  | 'movie_studio'
  | 'animation_studio';

export type SpeakerGender = 'male' | 'female' | 'couple' | 'ministry';

export type ApprovalStatus = 'approved' | 'pending' | 'blocked';

export type MarriageCollectionSlug =
  | 'trending-marriage-teachings'
  | 'christian-dating-courtship'
  | 'advice-for-singles'
  | 'preparing-for-marriage'
  | 'marriage-counselling'
  | 'marriage-restoration'
  | 'women-and-relationships'
  | 'men-and-relationships'
  | 'husband-and-wife-teachings'
  | 'parenting-and-family'
  | 'relationship-qa'
  | 'marriage-conferences'
  | 'building-a-godly-home';

export interface MarriageCollectionConfig {
  slug: MarriageCollectionSlug;
  name: string;
  subtitle: string;
  display_order: number;
  is_active: boolean;
}

export type WorshipSubcategorySlug =
  | 'deep-worship'
  | 'high-praise-celebration'
  | 'prayer-spiritual-warfare-worship'
  | 'spontaneous-worship'
  | 'live-worship-sessions'
  | 'thanksgiving-songs'
  | 'classic-gospel-hits'
  | 'new-trending-gospel'
  | 'international-worship'
  | 'nigerian-gospel';

export interface WorshipSubcategoryConfig {
  slug: WorshipSubcategorySlug;
  name: string;
  subtitle: string;
  display_order: number;
  is_active?: boolean;
}

export type ChristianLivingSubcategorySlug =
  | 'personal-growth-spiritual-development'
  | 'family-and-parenting'
  | 'christian-finances-and-wealth'
  | 'purpose-career-and-destiny'
  | 'christian-youth-and-young-adults'
  | 'faith-in-everyday-life'
  | 'christian-character-and-values'
  | 'christian-womanhood'
  | 'christian-manhood'
  | 'friendship-and-social-life'
  | 'christianity-in-modern-society';

export interface ChristianLivingSubcategoryConfig {
  slug: ChristianLivingSubcategorySlug;
  name: string;
  subtitle: string;
  display_order: number;
  is_active?: boolean;
}

export interface KingdomChannel {
  id: string;
  youtube_channel_id: string;
  title: string;
  speaker_name?: string;
  ministry_name?: string;
  aliases?: string[];
  bio?: string;
  handle: string;
  channel_type: ChannelType;
  speaker_gender?: SpeakerGender;
  is_featured_minister?: boolean;
  is_featured_marriage_teacher?: boolean;
  is_approved_worship_artist?: boolean;
  worship_artist_order?: number;
  is_approved_christian_living_minister?: boolean;
  christian_living_minister_order?: number;
  is_nigerian: boolean;
  is_official_verified: boolean;
  default_category_slug: string;
  supported_categories?: string[];
  subscriber_count: number | null;
  video_count: number | null;
  view_count: number | null;
  avatar_url: string;
  banner_url?: string;
  uploads_playlist_id?: string;
  approval_status: ApprovalStatus;
  priority_weight: number;
  last_synced_at: string | null;
}

export type VideoApprovalStatus = 'approved' | 'pending_review' | 'rejected';

export interface KingdomVideo {
  id: string;
  youtube_video_id: string;
  channel_id: string;
  channel_title: string;
  channel_handle: string;
  channel_type: ChannelType;
  speaker_gender?: SpeakerGender;
  artist_name?: string;
  channel_avatar_url: string;
  is_nigerian_channel: boolean;
  is_official_verified: boolean;
  primary_category_id: string;
  primary_category_slug: string;
  primary_category_name: string;
  secondary_category_slugs: string[];
  subcategory_label?: string;
  legacy_category_slug?: string;
  marriage_collections?: MarriageCollectionSlug[];
  worship_subcategories?: WorshipSubcategorySlug[];
  christian_living_subcategories?: ChristianLivingSubcategorySlug[];
  christian_living_score?: number;
  title: string;
  description: string;
  thumbnail_high_url: string;
  thumbnail_maxres_url: string;
  published_at: string;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  likes_verified?: boolean;
  comment_count: number | null;
  views_per_day: number;
  engagement_rate: number; // per 1,000 views
  trending_score: number;
  evergreen_score: number;
  quality_score?: number;
  live_broadcast_content?: 'live' | 'upcoming' | 'none';
  is_live_now?: boolean;
  is_embeddable: boolean;
  is_available: boolean;
  approval_status: VideoApprovalStatus;
  is_featured_hero: boolean;
  is_trending_pinned: boolean;
  ai_classification_reason?: string;
  last_refreshed_at: string;
}

export interface DiscoveryHistoryEntry {
  id: string;
  mode: 'channel_feed_sync' | 'search_phrase_discovery' | 'manual_url_import' | 'deduplication';
  query_or_source: string;
  videos_discovered: number;
  videos_approved: number;
  videos_pending: number;
  created_at: string;
}

export interface WatchHistoryEntry {
  id: string;
  user_id: string;
  video_id: string;
  progress_seconds: number;
  duration_seconds: number;
  completed: boolean;
  last_watched_at: string;
  video?: KingdomVideo;
}

export interface VideoComment {
  id: string;
  video_id: string;
  user_id: string;
  user_full_name: string;
  user_username: string;
  user_avatar_url?: string;
  user_role: UserRole;
  parent_comment_id: string | null;
  content: string;
  likes_count: number;
  liked_by_user_ids: string[];
  is_flagged: boolean;
  is_hidden: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  other_participant?: UserProfile;
  last_message_text: string;
  last_message_at: string;
  unread_count: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface PrayerEncouragement {
  id: string;
  prayer_request_id: string;
  user_id: string;
  user_full_name: string;
  user_username: string;
  content: string;
  created_at: string;
}

export interface PrayerRequest {
  id: string;
  user_id: string;
  user_full_name: string;
  user_username: string;
  user_location: string;
  title: string;
  content: string;
  category_tag: string;
  is_anonymous: boolean;
  pray_count: number;
  prayed_by_user_ids: string[];
  encouragement_count: number;
  encouragements: PrayerEncouragement[];
  status: 'active' | 'answered' | 'hidden';
  created_at: string;
}

export interface ModerationReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: 'video' | 'comment' | 'prayer' | 'user' | 'message';
  target_id: string;
  target_summary: string;
  reason: string;
  details: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface YouTubeApiLog {
  id: string;
  endpoint: string;
  quota_cost: number;
  videos_processed: number;
  status_code: number;
  note: string;
  created_at: string;
}

export interface SystemConfigStatus {
  supabaseConfigured: boolean;
  supabaseConnected: boolean;
  supabaseUrlHost: string | null;
  youtubeApiKeyConfigured: boolean;
  geminiConfigured: boolean;
  quotaUsedToday: number;
  quotaDailyLimit: number;
  lastChannelSyncAt: string | null;
  totalApprovedVideos: number;
  totalPendingVideos: number;
  totalApprovedChannels: number;
  duplicateVideosCount?: number;
}
