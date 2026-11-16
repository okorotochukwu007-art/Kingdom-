import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { classifyVideoWithGemini, evaluateMarriageAndRelationships } from './server/geminiService.ts';
import { NIGERIAN_CHRISTIAN_SEARCH_PHRASES } from './server/seedData.ts';
import { hashPassword, store } from './server/store.ts';
import { communityMessagesDb } from './server/communityMessagesDb.ts';
import {
  buildScoredKingdomVideo,
  computeVideoRankingMetrics,
  extractYouTubeVideoIdFromUrl,
  fetchSingleYouTubeVideoById,
  resolveYouTubeChannelIdentifier,
} from './server/youtubeService.ts';
import {
  APPROVED_WORSHIP_PRAISE_ARTISTS,
  classifyWorshipPraiseSubcategories,
  WORSHIP_SUBCATEGORIES,
} from './server/worshipPraiseRefresh.ts';
import {
  APPROVED_CHRISTIAN_LIVING_MINISTERS,
  CHRISTIAN_LIVING_SUBCATEGORIES,
  classifyChristianLivingSubcategories,
  computeChristianLivingSmartScore,
} from './server/christianLivingRefresh.ts';
import {
  discoverRealTimeActiveYouTubeLives,
  RealTimeLiveStreamItem,
  searchRealTimeLiveStreams,
} from './functions/api/live-check.ts';
import { discoverDailyFreshVideos } from './functions/api/daily-sync.ts';
import { searchGlobalChristianVideos } from './functions/api/christian-search.ts';
import {
  executeIntelligentDiscovery,
  searchChristianMoviesBeyondLibrary,
  searchChristianMinisterBeyondCatalogue,
  DiscoverySearchScope,
} from './server/intelligentDiscoveryService.ts';
import { checkTrendingAndNewChristianMovies } from './server/movieTrendingService.ts';
import {
  ContentCategory,
  Conversation,
  DirectMessage,
  EventAttachment,
  FellowshipPost,
  FellowshipPostCategory,
  FellowshipPostReply,
  FellowshipRoomId,
  FellowshipRoomMessage,
  KingdomChannel,
  ModerationReport,
  PrayerEncouragement,
  PrayerRequest,
  UserProfile,
  VideoComment,
  WatchHistoryEntry,
} from './src/types/kingdom.ts';

// Ensure every community message (room + direct chat) is backed up inside backend SQLite tables
communityMessagesDb.backfillFromLegacyStore({
  roomMessages: store.state.fellowshipRoomMessages || [],
  conversations: store.state.conversations || [],
  directMessages: store.state.directMessages || [],
});

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

function getAuthenticatedUser(req: Request): UserProfile | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const userId = store.state.sessions[token];
  if (!userId) return null;
  const user = store.state.users.find((u) => u.id === userId);
  if (!user || user.is_suspended) return null;
  touchUserPresence(user, true);
  return user;
}

const presencePersistThrottle = new Map<string, number>();

function touchUserPresence(user: UserProfile, isOnline: boolean, forceSave = false) {
  const nowIso = new Date().toISOString();
  const wasOnline = user.is_online;
  user.is_online = isOnline;
  user.last_seen_at = nowIso;

  const nowMs = Date.now();
  const lastSaved = presencePersistThrottle.get(user.id) || 0;
  if (forceSave || wasOnline !== isOnline || nowMs - lastSaved > 30_000) {
    presencePersistThrottle.set(user.id, nowMs);
    store.saveToDisk();
    if (store.supabase && store.supabaseConnected) {
      Promise.resolve(
        store.supabase
          .from('profiles')
          .update({ is_online: isOnline, last_seen_at: nowIso })
          .eq('id', user.id)
      ).catch(() => {});
    }
  }
}

async function resolveCommunityMember(req: Request): Promise<UserProfile | null> {
  const direct = getAuthenticatedUser(req);
  if (direct) return direct;

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerUserId = String(req.headers['x-kingdom-user-id'] || '').trim();
  const headerUserEmail = String(req.headers['x-kingdom-user-email'] || '')
    .trim()
    .toLowerCase();

  if (!token || !headerUserId || !headerUserEmail) return null;

  let user = store.state.users.find(
    (u) => u.id === headerUserId && u.email.toLowerCase() === headerUserEmail
  );

  if (!user && store.supabase && store.supabaseConnected) {
    try {
      const { data: sbProfile } = await store.supabase
        .from('profiles')
        .select('*')
        .eq('id', headerUserId)
        .maybeSingle();

      if (
        sbProfile &&
        sbProfile.email &&
        String(sbProfile.email).toLowerCase() === headerUserEmail &&
        !sbProfile.is_suspended
      ) {
        user = {
          id: sbProfile.id,
          auth_user_id: sbProfile.auth_user_id,
          email: sbProfile.email,
          full_name: sbProfile.full_name || 'Believer',
          username: sbProfile.username || 'member',
          avatar_url: sbProfile.avatar_url || '',
          bio: sbProfile.bio || '',
          location: sbProfile.location || 'Nigeria',
          denomination_or_church: sbProfile.denomination_or_church || '',
          role: sbProfile.role || 'member',
          is_suspended: Boolean(sbProfile.is_suspended),
          is_online: true,
          last_seen_at: new Date().toISOString(),
          preferences: sbProfile.preferences || { favoriteCategories: [], favoriteMinisters: [] },
          created_at: sbProfile.created_at || new Date().toISOString(),
        };
        store.state.users.push(user);
        store.saveToDisk();
      }
    } catch {
      // Ignore transient Supabase lookup error
    }
  }

  if (!user || user.is_suspended) return null;
  touchUserPresence(user, true);
  return user;
}

function isAdminUser(user: UserProfile | null): boolean {
  return Boolean(user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'moderator'));
}

// ============================================================================
// 1. PUBLIC CONFIG & SYSTEM STATUS
// ============================================================================
app.get('/api/config/public', async (_req: Request, res: Response) => {
  const status = store.getSystemStatus();
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  res.json({
    status,
    supabase: {
      url:
        supabaseUrl && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project-id')
          ? supabaseUrl
          : null,
      anonKey:
        supabaseAnonKey && supabaseAnonKey !== 'your-supabase-anon-public-key'
          ? supabaseAnonKey
          : null,
    },
  });
});

app.get('/api/admin/sql-schema', (req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    res.json({ sql });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================================
// 2. AUTHENTICATION & USER ACCOUNTS
// ============================================================================
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password, fullName, username, location, denomination } = req.body || {};
  if (!email || !password || !fullName) {
    res.status(400).json({ error: 'Email, full name, and password are required.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const cleanUsername =
    String(username || normalizedEmail.split('@')[0])
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') || `believer_${Date.now().toString(36)}`;

  const existingEmail = store.state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existingEmail) {
    res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    return;
  }

  // Also register in Supabase Auth if connected
  let supabaseAuthUserId: string | undefined;
  if (store.supabase) {
    try {
      const { data } = await store.supabase.auth.signUp({
        email: normalizedEmail,
        password: String(password),
        options: {
          data: { full_name: fullName, username: cleanUsername },
        },
      });
      if (data?.user?.id) {
        supabaseAuthUserId = data.user.id;
      }
    } catch {
      // Fall back cleanly if Supabase Auth requires custom SMTP
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'okorotochukwu007@gmail.com').trim().toLowerCase();
  // First registered user or matching ADMIN_EMAIL gets super_admin role
  const isOwner = normalizedEmail === adminEmail || store.state.users.length === 0;

  const newUser: UserProfile & { password_hash?: string } = {
    id: supabaseAuthUserId || crypto.randomUUID(),
    auth_user_id: supabaseAuthUserId,
    email: normalizedEmail,
    full_name: String(fullName).trim(),
    username: cleanUsername,
    avatar_url: '',
    bio: 'Believer in Christ · Streaming worship & the Word on KINGDOM+',
    location: String(location || 'Lagos, Nigeria').trim(),
    denomination_or_church: String(denomination || '').trim(),
    role: isOwner ? 'super_admin' : 'member',
    is_suspended: false,
    is_online: true,
    last_seen_at: new Date().toISOString(),
    preferences: {
      favoriteCategories: ['worship-praise', 'sermons-teachings', 'prayer-spiritual-warfare'],
      favoriteMinisters: [],
    },
    created_at: new Date().toISOString(),
    password_hash: hashPassword(String(password)),
  };

  store.state.users.push(newUser);
  const token = crypto.randomBytes(24).toString('hex');
  store.state.sessions[token] = newUser.id;
  store.saveToDisk();

  if (store.supabase && store.supabaseConnected) {
    try {
      const { password_hash: _, ...profileData } = newUser;
      await store.supabase.from('profiles').upsert(profileData, { onConflict: 'email' });
    } catch {
      // Ignore
    }
  }

  const { password_hash: _removed, ...safeProfile } = newUser;
  res.json({ token, user: safeProfile });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = store.state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user || user.password_hash !== hashPassword(String(password))) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (user.is_suspended) {
    res.status(403).json({ error: 'This account has been suspended by a community moderator.' });
    return;
  }

  user.is_online = true;
  user.last_seen_at = new Date().toISOString();
  const token = crypto.randomBytes(24).toString('hex');
  store.state.sessions[token] = user.id;
  store.saveToDisk();

  const { password_hash: _removed, ...safeProfile } = user;
  res.json({ token, user: safeProfile });
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (user) {
    touchUserPresence(user, false, true);
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    delete store.state.sessions[token];
  }
  store.saveToDisk();
  res.json({ ok: true });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, newPassword } = req.body || {};
  if (!email || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'Please provide your registered email and a new password (min 6 characters).' });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = store.state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    res.status(404).json({ error: 'No account found with that email address.' });
    return;
  }
  user.password_hash = hashPassword(String(newPassword));
  store.saveToDisk();
  res.json({ ok: true, message: 'Password updated. You may now sign in with your new password.' });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { password_hash: _removed, ...safeProfile } = user as UserProfile & { password_hash?: string };
  res.json({ user: safeProfile });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { full_name, bio, location, denomination_or_church, favoriteCategories } = req.body || {};
  if (full_name !== undefined) user.full_name = String(full_name).trim();
  if (bio !== undefined) user.bio = String(bio).trim();
  if (location !== undefined) user.location = String(location).trim();
  if (denomination_or_church !== undefined) user.denomination_or_church = String(denomination_or_church).trim();
  if (Array.isArray(favoriteCategories)) {
    user.preferences.favoriteCategories = favoriteCategories;
  }
  store.saveToDisk();
  const { password_hash: _removed, ...safeProfile } = user as UserProfile & { password_hash?: string };
  res.json({ user: safeProfile });
});

// ============================================================================
// 3. STREAMING CATALOG, RAILS, WATCH HISTORY & SAVED VIDEOS
// ============================================================================
app.get('/api/catalog', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  const approvedVideos = store.state.videos.filter(
    (v) => v.approval_status === 'approved' && v.is_available && v.is_embeddable
  );
  const approvedChannels = store.state.channels.filter((c) => c.approval_status === 'approved');

  let userWatchHistory: WatchHistoryEntry[] = [];
  let userSavedIds: string[] = [];

  if (user) {
    userWatchHistory = store.state.watchHistory
      .filter((w) => w.user_id === user.id)
      .sort((a, b) => new Date(b.last_watched_at).getTime() - new Date(a.last_watched_at).getTime())
      .map((w) => ({
        ...w,
        video: approvedVideos.find((v) => v.id === w.video_id),
      }))
      .filter((w) => Boolean(w.video));

    userSavedIds = store.state.savedVideos
      .filter((s) => s.user_id === user.id)
      .map((s) => s.video_id);
  }

  res.json({
    categories: store.state.categories,
    marriageCollections: store.state.marriageCollections,
    worshipSubcategories: WORSHIP_SUBCATEGORIES,
    christianLivingSubcategories: CHRISTIAN_LIVING_SUBCATEGORIES,
    channels: approvedChannels,
    videos: approvedVideos,
    watchHistory: userWatchHistory,
    savedVideoIds: userSavedIds,
    systemStatus: store.getSystemStatus(),
  });
});

let cachedLiveStreams: { checkedAt: string; liveStreams: RealTimeLiveStreamItem[] } | null = null;
let lastLiveCheckMs = 0;
const liveSearchCache = new Map<
  string,
  { checkedAt: string; liveStreams: RealTimeLiveStreamItem[]; timestamp: number }
>();

app.get('/api/live-check', async (req: Request, res: Response) => {
  const q = String(req.query.q || req.query.query || '').trim();
  const now = Date.now();

  if (q.length >= 2) {
    const cacheKey = q.toLowerCase();
    const cachedSearch = liveSearchCache.get(cacheKey);
    if (cachedSearch && now - cachedSearch.timestamp < 30_000) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json({
        checkedAt: cachedSearch.checkedAt,
        query: q,
        liveStreams: cachedSearch.liveStreams,
      });
      return;
    }

    const liveStreams = await searchRealTimeLiveStreams(q);
    const checkedAt = new Date().toISOString();
    liveSearchCache.set(cacheKey, { checkedAt, liveStreams, timestamp: now });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ checkedAt, query: q, liveStreams });
    return;
  }

  if (cachedLiveStreams && now - lastLiveCheckMs < 45_000) {
    res.setHeader('Cache-Control', 'public, max-age=45');
    res.json(cachedLiveStreams);
    return;
  }

  const liveStreams = await discoverRealTimeActiveYouTubeLives();
  cachedLiveStreams = {
    checkedAt: new Date().toISOString(),
    liveStreams,
  };
  lastLiveCheckMs = now;

  res.setHeader('Cache-Control', 'public, max-age=45');
  res.json(cachedLiveStreams);
});

let cachedDailySync: { checkedAt: string; count: number; freshVideos: any[] } | null = null;
let lastDailySyncMs = 0;

async function syncDailyFreshVideosIntoStore() {
  try {
    const freshVideos = await discoverDailyFreshVideos();
    let addedCount = 0;
    const existingYoutubeIds = new Set(store.state.videos.map((v) => v.youtube_video_id));

    for (const item of freshVideos) {
      if (!existingYoutubeIds.has(item.youtube_video_id)) {
        existingYoutubeIds.add(item.youtube_video_id);
        store.state.videos.unshift(item);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      store.saveToDisk();
    }

    cachedDailySync = {
      checkedAt: new Date().toISOString(),
      count: freshVideos.length,
      freshVideos,
    };
    lastDailySyncMs = Date.now();
    return cachedDailySync;
  } catch {
    return (
      cachedDailySync || {
        checkedAt: new Date().toISOString(),
        count: 0,
        freshVideos: [],
      }
    );
  }
}

app.get('/api/daily-sync', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cachedDailySync && now - lastDailySyncMs < 10 * 60 * 1000) {
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json(cachedDailySync);
    return;
  }
  const result = await syncDailyFreshVideosIntoStore();
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.json(result);
});

app.get('/api/christian-search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || 'all').trim();
  const result = await searchGlobalChristianVideos(q, category);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(result);
});

// ============================================================================
// INTELLIGENT DISCOVERY ENGINE (AI Intent Understanding + YouTube Data API)
// ============================================================================
app.get('/api/discovery/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const scope = (String(req.query.scope || 'all').toLowerCase()) as DiscoverySearchScope;
  try {
    const result = await executeIntelligentDiscovery(q, scope);
    res.setHeader('Cache-Control', 'public, max-age=180');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/discovery/movies', async (req: Request, res: Response) => {
  const q = String(req.query.q || req.query.query || '').trim();
  const genre = String(req.query.genre || 'all').trim();
  try {
    const result = await searchChristianMoviesBeyondLibrary(q, genre);
    res.setHeader('Cache-Control', 'public, max-age=180');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/movies/trending-alerts', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  try {
    const result = await checkTrendingAndNewChristianMovies(forceRefresh);
    res.setHeader(
      'Cache-Control',
      forceRefresh ? 'no-store' : 'public, max-age=300'
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/discovery/minister', async (req: Request, res: Response) => {
  const name = String(req.query.name || req.query.q || '').trim();
  try {
    const minister = await searchChristianMinisterBeyondCatalogue(name);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ minister });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/catalog/import-discovered', async (req: Request, res: Response) => {
  const video = req.body?.video;
  if (!video || !video.youtube_video_id || !video.title) {
    res.status(400).json({ error: 'Valid video object required' });
    return;
  }
  const exists = store.state.videos.some(
    (v) => v.youtube_video_id === video.youtube_video_id || v.id === video.id
  );
  if (!exists) {
    store.state.videos.unshift(video);
    store.saveToDisk();
  }
  if (store.supabase && store.supabaseConnected) {
    try {
      await store.supabase.from('discovered_videos').upsert(
        {
          youtube_video_id: video.youtube_video_id,
          video_payload: video,
          primary_category_slug: video.primary_category_slug || 'sermons-teachings',
        },
        { onConflict: 'youtube_video_id' }
      );
    } catch {
      // Ignore if table not yet migrated
    }
  }
  res.json({ ok: true, added: !exists });
});

app.post('/api/reminders/subscribe', async (req: Request, res: Response) => {
  const body = req.body || {};
  const user = getAuthenticatedUser(req);
  const subscription = {
    subscriber_key: String(body.subscriberKey || user?.id || 'anonymous'),
    user_id: user?.id || body.userId || null,
    email: String(body.email || user?.email || '').trim(),
    whatsapp_phone: String(body.whatsappPhone || '').trim(),
    web_push_enabled: Boolean(body.webPushEnabled ?? true),
    email_enabled: Boolean(body.emailEnabled),
    whatsapp_enabled: Boolean(body.whatsappEnabled),
    advance_minutes: Number(body.advanceMinutes) || 10,
    program_ids: Array.isArray(body.programIds) ? body.programIds : [],
    updated_at: new Date().toISOString(),
  };

  if (store.supabase && store.supabaseConnected) {
    try {
      await store.supabase
        .from('broadcast_reminders')
        .upsert(subscription, { onConflict: 'subscriber_key' });
    } catch {
      // Ignore if table not yet migrated
    }
  }

  res.json({ ok: true, subscription });
});

app.post('/api/videos/:videoId/unavailable', (req: Request, res: Response) => {
  const video = store.state.videos.find(
    (v) => v.id === req.params.videoId || v.youtube_video_id === req.params.videoId
  );
  if (video) {
    video.is_embeddable = false;
    video.is_available = false;
    store.saveToDisk();
  }
  res.json({ ok: true });
});

app.post('/api/user/watch-progress', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { videoId, progressSeconds, durationSeconds } = req.body || {};
  if (!videoId) {
    res.status(400).json({ error: 'videoId required' });
    return;
  }
  const progress = Math.max(0, Math.floor(Number(progressSeconds) || 0));
  const duration = Math.max(0, Math.floor(Number(durationSeconds) || 0));
  const completed = duration > 0 && progress / duration >= 0.92;

  const existing = store.state.watchHistory.find(
    (w) => w.user_id === user.id && w.video_id === videoId
  );
  if (existing) {
    existing.progress_seconds = progress;
    existing.duration_seconds = duration || existing.duration_seconds;
    existing.completed = completed;
    existing.last_watched_at = new Date().toISOString();
  } else {
    store.state.watchHistory.unshift({
      id: crypto.randomUUID(),
      user_id: user.id,
      video_id: videoId,
      progress_seconds: progress,
      duration_seconds: duration,
      completed,
      last_watched_at: new Date().toISOString(),
    });
  }
  store.saveToDisk();
  res.json({ ok: true });
});

app.post('/api/user/saved-videos/toggle', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const { videoId } = req.body || {};
  const idx = store.state.savedVideos.findIndex(
    (s) => s.user_id === user.id && s.video_id === videoId
  );
  let saved = false;
  if (idx >= 0) {
    store.state.savedVideos.splice(idx, 1);
  } else {
    store.state.savedVideos.unshift({
      id: crypto.randomUUID(),
      user_id: user.id,
      video_id: videoId,
      created_at: new Date().toISOString(),
    });
    saved = true;
  }
  store.saveToDisk();
  res.json({
    saved,
    savedVideoIds: store.state.savedVideos.filter((s) => s.user_id === user.id).map((s) => s.video_id),
  });
});

// ============================================================================
// 4. VIDEO DISCUSSIONS & COMMENTS
// ============================================================================
app.get('/api/videos/:videoId/comments', (req: Request, res: Response) => {
  const comments = store.state.videoComments
    .filter((c) => c.video_id === req.params.videoId && !c.is_hidden)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ comments });
});

app.post('/api/videos/:videoId/comments', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to join the video discussion.' });
    return;
  }
  const { content, parentCommentId } = req.body || {};
  if (!content || !String(content).trim()) {
    res.status(400).json({ error: 'Comment cannot be empty.' });
    return;
  }

  const comment: VideoComment = {
    id: crypto.randomUUID(),
    video_id: req.params.videoId,
    user_id: user.id,
    user_full_name: user.full_name,
    user_username: user.username,
    user_avatar_url: user.avatar_url,
    user_role: user.role,
    parent_comment_id: parentCommentId || null,
    content: String(content).trim(),
    likes_count: 0,
    liked_by_user_ids: [],
    is_flagged: false,
    is_hidden: false,
    created_at: new Date().toISOString(),
  };

  store.state.videoComments.unshift(comment);
  store.saveToDisk();
  res.json({ comment });
});

app.post('/api/comments/:commentId/like', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  const comment = store.state.videoComments.find((c) => c.id === req.params.commentId);
  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }
  const idx = comment.liked_by_user_ids.indexOf(user.id);
  if (idx >= 0) {
    comment.liked_by_user_ids.splice(idx, 1);
  } else {
    comment.liked_by_user_ids.push(user.id);
  }
  comment.likes_count = comment.liked_by_user_ids.length;
  store.saveToDisk();
  res.json({ comment });
});

// ============================================================================
// 5. PRAYER COMMUNITY WALL
// ============================================================================
app.get('/api/prayers', (_req: Request, res: Response) => {
  const prayers = store.state.prayerRequests
    .filter((p) => p.status !== 'hidden')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ prayers });
});

function sanitizeServerAttachment(raw: any): EventAttachment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const eventTitle = String(raw.event_title || '').trim().slice(0, 140);
  const eventDate = String(raw.event_date || '').trim().slice(0, 100);
  const eventLocation = String(raw.event_location || '').trim().slice(0, 140);
  const rawLink = String(raw.event_link || '').trim().slice(0, 400);
  let eventLink = '';
  if (rawLink) {
    const withProtocol = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        eventLink = parsed.toString();
      }
    } catch {
      eventLink = '';
    }
  }

  let fileDataUrl = '';
  let fileName = String(raw.file_name || '').trim().slice(0, 120);
  let fileMime = String(raw.file_mime || '').trim().slice(0, 80);
  const rawData = typeof raw.file_data_url === 'string' ? raw.file_data_url : '';
  if (
    rawData &&
    rawData.length <= 2_800_000 &&
    /^data:(image\/(jpeg|jpg|png|webp|gif)|application\/pdf);base64,/i.test(rawData)
  ) {
    fileDataUrl = rawData;
  } else {
    fileName = '';
    fileMime = '';
  }

  if (!eventTitle && !eventDate && !eventLocation && !eventLink && !fileDataUrl) {
    return undefined;
  }

  return {
    type: eventTitle || eventDate || eventLocation || eventLink ? 'event' : 'flyer',
    event_title: eventTitle || undefined,
    event_date: eventDate || undefined,
    event_location: eventLocation || undefined,
    event_link: eventLink || undefined,
    file_name: fileName || undefined,
    file_mime: fileMime || undefined,
    file_data_url: fileDataUrl || undefined,
  };
}

app.post('/api/prayers', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to submit a prayer request.' });
    return;
  }
  const { title, content, categoryTag, isAnonymous, attachment } = req.body || {};
  if (!title || !content) {
    res.status(400).json({ error: 'Title and prayer request details are required.' });
    return;
  }

  const sanitizedAttachment = sanitizeServerAttachment(attachment);

  const prayer: PrayerRequest = {
    id: crypto.randomUUID(),
    user_id: user.id,
    user_full_name: isAnonymous ? 'Anonymous Believer' : user.full_name,
    user_username: isAnonymous ? 'anonymous' : user.username,
    user_location: user.location || 'Nigeria',
    title: String(title).trim(),
    content: String(content).trim(),
    category_tag: String(categoryTag || 'Healing & Family'),
    is_anonymous: Boolean(isAnonymous),
    pray_count: 0,
    prayed_by_user_ids: [],
    encouragement_count: 0,
    encouragements: [],
    ...(sanitizedAttachment ? { attachment: sanitizedAttachment } : {}),
    status: 'active',
    created_at: new Date().toISOString(),
  };

  store.state.prayerRequests.unshift(prayer);
  store.saveToDisk();
  res.json({ prayer });
});

app.post('/api/prayers/:prayerId/pray', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to support this prayer request.' });
    return;
  }
  const prayer = store.state.prayerRequests.find((p) => p.id === req.params.prayerId);
  if (!prayer) {
    res.status(404).json({ error: 'Prayer request not found.' });
    return;
  }
  const idx = prayer.prayed_by_user_ids.indexOf(user.id);
  if (idx >= 0) {
    prayer.prayed_by_user_ids.splice(idx, 1);
  } else {
    prayer.prayed_by_user_ids.push(user.id);
  }
  prayer.pray_count = prayer.prayed_by_user_ids.length;
  store.saveToDisk();
  res.json({ prayer });
});

app.post('/api/prayers/:prayerId/encourage', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to post an encouragement.' });
    return;
  }
  const { content } = req.body || {};
  if (!content || !String(content).trim()) {
    res.status(400).json({ error: 'Encouragement message is required.' });
    return;
  }
  const prayer = store.state.prayerRequests.find((p) => p.id === req.params.prayerId);
  if (!prayer) {
    res.status(404).json({ error: 'Prayer request not found.' });
    return;
  }
  const encouragement: PrayerEncouragement = {
    id: crypto.randomUUID(),
    prayer_request_id: prayer.id,
    user_id: user.id,
    user_full_name: user.full_name,
    user_username: user.username,
    content: String(content).trim(),
    created_at: new Date().toISOString(),
  };
  prayer.encouragements.push(encouragement);
  prayer.encouragement_count = prayer.encouragements.length;
  store.saveToDisk();
  res.json({ prayer });
});

// ============================================================================
// 6. COMMUNITY FEED, FELLOWSHIP ROOMS, MEMBERS & PRIVATE MESSAGING
// ============================================================================
const VALID_FELLOWSHIP_CATEGORIES = new Set<FellowshipPostCategory>([
  'testimony',
  'praise_report',
  'sermon_note',
  'event',
  'fellowship',
]);

const VALID_ROOM_IDS = new Set<FellowshipRoomId>([
  'morning-altar',
  'singles-marriage',
  'worshippers-choir',
  'bible-study-purpose',
  'intercessors',
]);

app.get('/api/community/feed', (_req: Request, res: Response) => {
  const posts = [...(store.state.fellowshipPosts || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json({ posts });
});

app.post('/api/community/heartbeat', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  touchUserPresence(user, true);
  const nowMs = Date.now();
  const onlineCount = store.state.users.filter(
    (u) => !u.is_suspended && u.is_online && nowMs - new Date(u.last_seen_at).getTime() < 3 * 60 * 1000
  ).length;
  res.json({
    ok: true,
    is_online: true,
    last_seen_at: user.last_seen_at,
    onlineCount,
  });
});

app.post('/api/community/offline', express.text({ type: '*/*' }), async (req: Request, res: Response) => {
  let user = await resolveCommunityMember(req);
  if (!user && req.body) {
    try {
      const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const uid = String(parsed?.userId || '').trim();
      const email = String(parsed?.email || '').trim().toLowerCase();
      if (uid && email) {
        user = store.state.users.find(
          (u) => u.id === uid && u.email.toLowerCase() === email && !u.is_suspended
        ) || null;
      }
    } catch {
      // Ignore malformed beacon body
    }
  }
  if (user) {
    touchUserPresence(user, false, true);
  }
  res.json({ ok: true });
});

app.post('/api/community/feed', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to share with the fellowship.' });
    return;
  }
  const { title, content, category, attachment } = req.body || {};
  const trimmedContent = String(content || '').trim();
  const trimmedTitle = String(title || '').trim();
  const sanitizedAttachment = sanitizeServerAttachment(attachment);

  if (!trimmedContent && !sanitizedAttachment) {
    res.status(400).json({ error: 'Please write a message, testimony, or attach an event.' });
    return;
  }
  const postCategory: FellowshipPostCategory = VALID_FELLOWSHIP_CATEGORIES.has(category)
    ? category
    : sanitizedAttachment
      ? 'event'
      : 'testimony';

  const post: FellowshipPost = {
    id: crypto.randomUUID(),
    user_id: user.id,
    user_full_name: user.full_name,
    user_username: user.username,
    user_location: user.location || 'Nigeria',
    user_church: user.denomination_or_church || '',
    category: postCategory,
    title: trimmedTitle,
    content: trimmedContent,
    ...(sanitizedAttachment ? { attachment: sanitizedAttachment } : {}),
    amen_user_ids: [],
    praise_user_ids: [],
    replies: [],
    created_at: new Date().toISOString(),
  };

  store.state.fellowshipPosts.unshift(post);
  store.saveToDisk();
  res.json({ post });
});

app.post('/api/community/feed/:postId/react', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to react.' });
    return;
  }
  const post = store.state.fellowshipPosts.find((p) => p.id === req.params.postId);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  const reactionType = req.body?.type === 'praise' ? 'praise' : 'amen';
  const targetList = reactionType === 'praise' ? post.praise_user_ids : post.amen_user_ids;
  const idx = targetList.indexOf(user.id);
  if (idx >= 0) {
    targetList.splice(idx, 1);
  } else {
    targetList.push(user.id);
  }
  store.saveToDisk();
  res.json({ post });
});

app.post('/api/community/feed/:postId/reply', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to reply.' });
    return;
  }
  const post = store.state.fellowshipPosts.find((p) => p.id === req.params.postId);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  const content = String(req.body?.content || '').trim();
  if (!content) {
    res.status(400).json({ error: 'Reply message cannot be empty.' });
    return;
  }
  const reply: FellowshipPostReply = {
    id: crypto.randomUUID(),
    post_id: post.id,
    user_id: user.id,
    user_full_name: user.full_name,
    user_username: user.username,
    user_location: user.location || 'Nigeria',
    content,
    created_at: new Date().toISOString(),
  };
  post.replies.push(reply);
  store.saveToDisk();
  res.json({ post });
});

app.get('/api/community/rooms/summary', (_req: Request, res: Response) => {
  const summary = communityMessagesDb.getRoomSummary(VALID_ROOM_IDS);
  res.json({ summary });
});

app.get('/api/community/rooms/:roomId/messages', (req: Request, res: Response) => {
  const roomId = req.params.roomId as FellowshipRoomId;
  if (!VALID_ROOM_IDS.has(roomId)) {
    res.status(400).json({ error: 'Invalid fellowship room.' });
    return;
  }
  const messages = communityMessagesDb.getRoomMessages(roomId, 100);
  res.json({ messages });
});

app.post('/api/community/rooms/:roomId/messages', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to chat in Fellowship Rooms.' });
    return;
  }
  const roomId = req.params.roomId as FellowshipRoomId;
  if (!VALID_ROOM_IDS.has(roomId)) {
    res.status(400).json({ error: 'Invalid fellowship room.' });
    return;
  }
  const content = String(req.body?.content || '').trim();
  const sanitizedAttachment = sanitizeServerAttachment(req.body?.attachment);
  if (!content && !sanitizedAttachment) {
    res.status(400).json({ error: 'Message or event attachment cannot be empty.' });
    return;
  }
  const msg: FellowshipRoomMessage = {
    id: crypto.randomUUID(),
    room_id: roomId,
    user_id: user.id,
    user_full_name: user.full_name,
    user_username: user.username,
    user_location: user.location || 'Nigeria',
    content,
    ...(sanitizedAttachment ? { attachment: sanitizedAttachment } : {}),
    amen_user_ids: [],
    created_at: new Date().toISOString(),
  };

  communityMessagesDb.insertRoomMessage(msg);
  store.state.fellowshipRoomMessages.push(msg);
  store.saveToDisk();

  if (store.supabase && store.supabaseConnected) {
    Promise.resolve(
      store.supabase.from('fellowship_room_messages').upsert({
        id: msg.id,
        room_id: msg.room_id,
        user_id: msg.user_id,
        user_full_name: msg.user_full_name,
        user_username: msg.user_username,
        user_location: msg.user_location,
        content: msg.content,
        attachment: msg.attachment || null,
        amen_user_ids: msg.amen_user_ids,
        created_at: msg.created_at,
      })
    ).catch(() => {});

    Promise.resolve(
      store.supabase.from('community_messages').upsert({
        id: msg.id,
        message_scope: 'room',
        room_id: msg.room_id,
        sender_id: msg.user_id,
        sender_full_name: msg.user_full_name,
        sender_username: msg.user_username,
        sender_location: msg.user_location,
        content: msg.content,
        attachment: msg.attachment || null,
        amen_user_ids: msg.amen_user_ids,
        is_read: true,
        created_at: msg.created_at,
      })
    ).catch(() => {});
  }

  res.json({ message: msg });
});

app.post('/api/community/rooms/:roomId/messages/:msgId/amen', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to react.' });
    return;
  }
  const roomId = req.params.roomId as FellowshipRoomId;
  const updatedMsg = communityMessagesDb.toggleRoomMessageAmen(roomId, req.params.msgId, user.id);
  if (!updatedMsg) {
    res.status(404).json({ error: 'Message not found.' });
    return;
  }

  const legacyMsg = (store.state.fellowshipRoomMessages || []).find(
    (m) => m.id === req.params.msgId && m.room_id === roomId
  );
  if (legacyMsg) {
    legacyMsg.amen_user_ids = [...updatedMsg.amen_user_ids];
    store.saveToDisk();
  }

  if (store.supabase && store.supabaseConnected) {
    Promise.resolve(
      store.supabase
        .from('fellowship_room_messages')
        .update({ amen_user_ids: updatedMsg.amen_user_ids })
        .eq('id', updatedMsg.id)
    ).catch(() => {});
  }

  res.json({ message: updatedMsg });
});

app.get('/api/community/members', async (req: Request, res: Response) => {
  const currentUser = await resolveCommunityMember(req);
  const nowMs = Date.now();
  const ONLINE_WINDOW_MS = 3 * 60 * 1000;

  // Merge members & fresher presence state from Supabase profiles table
  if (store.supabase && store.supabaseConnected) {
    try {
      const { data: sbProfiles } = await store.supabase
        .from('profiles')
        .select('*')
        .eq('is_suspended', false)
        .limit(200);
      if (Array.isArray(sbProfiles)) {
        for (const p of sbProfiles) {
          if (!p?.id || !p?.email) continue;
          const existing = store.state.users.find(
            (u) => u.id === p.id || u.email.toLowerCase() === String(p.email).toLowerCase()
          );
          if (!existing) {
            store.state.users.push({
              id: p.id,
              auth_user_id: p.auth_user_id,
              email: p.email,
              full_name: p.full_name || 'Believer',
              username: p.username || 'member',
              avatar_url: p.avatar_url || '',
              bio: p.bio || '',
              location: p.location || 'Nigeria',
              denomination_or_church: p.denomination_or_church || '',
              role: p.role || 'member',
              is_suspended: Boolean(p.is_suspended),
              is_online: Boolean(p.is_online),
              last_seen_at: p.last_seen_at || new Date().toISOString(),
              preferences: p.preferences || { favoriteCategories: [], favoriteMinisters: [] },
              created_at: p.created_at || new Date().toISOString(),
            });
          } else {
            const sbSeenMs = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
            const localSeenMs = existing.last_seen_at ? new Date(existing.last_seen_at).getTime() : 0;
            if (sbSeenMs > localSeenMs) {
              existing.is_online = Boolean(p.is_online);
              existing.last_seen_at = p.last_seen_at;
            }
            if (p.full_name) existing.full_name = p.full_name;
            if (p.location !== undefined) existing.location = p.location || existing.location;
            if (p.denomination_or_church !== undefined) {
              existing.denomination_or_church = p.denomination_or_church;
            }
            if (p.bio !== undefined) existing.bio = p.bio;
          }
        }
      }

      if (currentUser) {
        const { data: sbFollows } = await store.supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', currentUser.id);
        if (Array.isArray(sbFollows)) {
          for (const row of sbFollows) {
            const targetId = row?.following_id;
            if (!targetId) continue;
            const alreadyLocal = store.state.userFollows.some(
              (f) => f.follower_id === currentUser.id && f.following_id === targetId
            );
            if (!alreadyLocal) {
              store.state.userFollows.push({
                id: crypto.randomUUID(),
                follower_id: currentUser.id,
                following_id: targetId,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {
      // Ignore transient Supabase read failure
    }
  }

  const members = store.state.users
    .filter((u) => !u.is_suspended)
    .map((u) => {
      const isSelf = currentUser && u.id === currentUser.id;
      const isRecentlyActive =
        nowMs - new Date(u.last_seen_at || 0).getTime() < ONLINE_WINDOW_MS;
      const { password_hash: _removed, ...safe } = u;
      return {
        ...safe,
        is_online: Boolean(isSelf || (u.is_online && isRecentlyActive)),
      };
    });

  const followingIds = currentUser
    ? store.state.userFollows
        .filter((f) => f.follower_id === currentUser.id)
        .map((f) => f.following_id)
    : [];

  const blockedIds = currentUser
    ? store.state.userBlocks
        .filter((b) => b.blocker_id === currentUser.id)
        .map((b) => b.blocked_id)
    : [];

  res.json({
    members,
    followingIds,
    blockedIds,
  });
});

app.post('/api/community/follow', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to connect with members.' });
    return;
  }
  const targetUserId = String(req.body?.targetUserId || '').trim();
  if (!targetUserId || targetUserId === user.id) {
    res.status(400).json({ error: 'Invalid member selection.' });
    return;
  }
  const idx = store.state.userFollows.findIndex(
    (f) => f.follower_id === user.id && f.following_id === targetUserId
  );
  let connected = false;
  if (idx >= 0) {
    store.state.userFollows.splice(idx, 1);
    if (store.supabase && store.supabaseConnected) {
      Promise.resolve(
        store.supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
      ).catch(() => {});
    }
  } else {
    connected = true;
    store.state.userFollows.push({
      id: crypto.randomUUID(),
      follower_id: user.id,
      following_id: targetUserId,
      created_at: new Date().toISOString(),
    });
    if (store.supabase && store.supabaseConnected) {
      Promise.resolve(
        store.supabase.from('user_follows').upsert(
          {
            follower_id: user.id,
            following_id: targetUserId,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'follower_id,following_id' }
        )
      ).catch(() => {});
    }
  }
  store.saveToDisk();
  res.json({
    connected,
    followingIds: store.state.userFollows
      .filter((f) => f.follower_id === user.id)
      .map((f) => f.following_id),
  });
});

app.post('/api/community/block', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  const { targetUserId } = req.body || {};
  const idx = store.state.userBlocks.findIndex(
    (b) => b.blocker_id === user.id && b.blocked_id === targetUserId
  );
  if (idx >= 0) {
    store.state.userBlocks.splice(idx, 1);
  } else {
    store.state.userBlocks.push({
      id: crypto.randomUUID(),
      blocker_id: user.id,
      blocked_id: targetUserId,
      created_at: new Date().toISOString(),
    });
  }
  store.saveToDisk();
  res.json({
    blockedIds: store.state.userBlocks
      .filter((b) => b.blocker_id === user.id)
      .map((b) => b.blocked_id),
  });
});

app.get('/api/messages/conversations', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }

  // Merge cloud Supabase conversations if available
  if (store.supabase && store.supabaseConnected) {
    try {
      const { data: sbConvs } = await store.supabase
        .from('conversations')
        .select('*')
        .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (Array.isArray(sbConvs)) {
        for (const row of sbConvs) {
          if (!row?.id || !row?.participant_one_id || !row?.participant_two_id) continue;
          communityMessagesDb.upsertConversation({
            id: row.id,
            participant_one_id: row.participant_one_id,
            participant_two_id: row.participant_two_id,
            last_message_text: row.last_message_text || '',
            last_message_at: row.last_message_at || new Date().toISOString(),
            unread_count: 0,
          });
        }
      }
    } catch {
      // Ignore transient Supabase read error
    }
  }

  const nowMs = Date.now();
  const ONLINE_WINDOW_MS = 3 * 60 * 1000;
  const blockedByMe = new Set(
    store.state.userBlocks.filter((b) => b.blocker_id === user.id).map((b) => b.blocked_id)
  );

  const dbConvs = communityMessagesDb.getUserConversations(user.id);
  const convs = dbConvs
    .map((c) => {
      const otherId = c.participant_one_id === user.id ? c.participant_two_id : c.participant_one_id;
      const otherRaw = store.state.users.find((u) => u.id === otherId);
      const otherParticipant = otherRaw
        ? (() => {
            const { password_hash: _, ...safe } = otherRaw;
            const isRecentlyActive =
              nowMs - new Date(safe.last_seen_at || 0).getTime() < ONLINE_WINDOW_MS;
            return {
              ...safe,
              is_online: Boolean(safe.is_online && isRecentlyActive),
            };
          })()
        : undefined;
      return {
        ...c,
        other_participant: otherParticipant,
      };
    })
    .filter((c) => c.other_participant && !blockedByMe.has(c.other_participant.id))
    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  res.json({ conversations: convs });
});

app.get('/api/messages/:otherUserId', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  const otherId = req.params.otherUserId;
  let conv = communityMessagesDb.findConversationBetween(user.id, otherId);

  if (!conv && store.supabase && store.supabaseConnected) {
    try {
      const { data: sbConv } = await store.supabase
        .from('conversations')
        .select('*')
        .or(
          `and(participant_one_id.eq.${user.id},participant_two_id.eq.${otherId}),and(participant_one_id.eq.${otherId},participant_two_id.eq.${user.id})`
        )
        .maybeSingle();
      if (sbConv?.id) {
        conv = {
          id: sbConv.id,
          participant_one_id: sbConv.participant_one_id,
          participant_two_id: sbConv.participant_two_id,
          last_message_text: sbConv.last_message_text || '',
          last_message_at: sbConv.last_message_at || new Date().toISOString(),
          unread_count: 0,
        };
        communityMessagesDb.upsertConversation(conv);
      }
    } catch {
      // Ignore transient Supabase lookup error
    }
  }

  if (!conv) {
    res.json({ messages: [], conversationId: null });
    return;
  }

  if (store.supabase && store.supabaseConnected) {
    try {
      const { data: sbMsgs } = await store.supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (Array.isArray(sbMsgs)) {
        for (const m of sbMsgs) {
          if (!m?.id) continue;
          const recipientId =
            m.sender_id === conv.participant_one_id
              ? conv.participant_two_id
              : conv.participant_one_id;
          const sender = store.state.users.find((u) => u.id === m.sender_id);
          communityMessagesDb.insertDirectMessage({
            message: {
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              content: m.content || '',
              ...(m.attachment ? { attachment: m.attachment } : {}),
              is_read: Boolean(m.is_read),
              ...(m.read_at ? { read_at: m.read_at } : {}),
              created_at: m.created_at || new Date().toISOString(),
            },
            recipientId,
            senderFullName: sender?.full_name || 'Believer',
            senderUsername: sender?.username || 'member',
            senderLocation: sender?.location || 'Nigeria',
          });
        }
      }
    } catch {
      // Ignore transient Supabase read error
    }
  }

  // Mark messages from other user as read
  const readUpdated = communityMessagesDb.markDirectMessagesRead(conv.id, otherId);
  if (readUpdated) {
    for (const msg of store.state.directMessages) {
      if (msg.conversation_id === conv.id && msg.sender_id === otherId && !msg.is_read) {
        msg.is_read = true;
        msg.read_at = new Date().toISOString();
      }
    }
    store.saveToDisk();
    if (store.supabase && store.supabaseConnected) {
      Promise.resolve(
        store.supabase
          .from('direct_messages')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('conversation_id', conv.id)
          .eq('sender_id', otherId)
          .eq('is_read', false)
      ).catch(() => {});
    }
  }

  const messages = communityMessagesDb.getDirectMessages(conv.id, 200);
  res.json({ messages, conversationId: conv.id });
});

app.post('/api/messages/:otherUserId', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }
  const otherId = req.params.otherUserId;
  if (!otherId || otherId === user.id) {
    res.status(400).json({ error: 'Cannot start a private chat with yourself.' });
    return;
  }
  const trimmedContent = String(req.body?.content || '').trim();
  const sanitizedAttachment = sanitizeServerAttachment(req.body?.attachment);
  if (!trimmedContent && !sanitizedAttachment) {
    res.status(400).json({ error: 'Message content or attachment cannot be empty.' });
    return;
  }

  // Check if blocked
  const isBlocked = store.state.userBlocks.some(
    (b) =>
      (b.blocker_id === user.id && b.blocked_id === otherId) ||
      (b.blocker_id === otherId && b.blocked_id === user.id)
  );
  if (isBlocked) {
    res.status(403).json({ error: 'Cannot send message to this member.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const previewText =
    trimmedContent ||
    (sanitizedAttachment?.event_title
      ? `Event: ${sanitizedAttachment.event_title}`
      : 'Attached an event flyer');

  let conv: Conversation | null = communityMessagesDb.findConversationBetween(user.id, otherId);
  if (!conv) {
    conv = {
      id: crypto.randomUUID(),
      participant_one_id: user.id,
      participant_two_id: otherId,
      last_message_text: previewText,
      last_message_at: nowIso,
      unread_count: 0,
    };
  } else {
    conv.last_message_text = previewText;
    conv.last_message_at = nowIso;
  }
  communityMessagesDb.upsertConversation(conv);

  const legacyConv = store.state.conversations.find((c) => c.id === conv!.id);
  if (!legacyConv) {
    store.state.conversations.unshift({ ...conv });
  } else {
    legacyConv.last_message_text = previewText;
    legacyConv.last_message_at = nowIso;
  }

  const message: DirectMessage = {
    id: crypto.randomUUID(),
    conversation_id: conv.id,
    sender_id: user.id,
    content: trimmedContent,
    ...(sanitizedAttachment ? { attachment: sanitizedAttachment } : {}),
    is_read: false,
    created_at: nowIso,
  };

  communityMessagesDb.insertDirectMessage({
    message,
    recipientId: otherId,
    senderFullName: user.full_name,
    senderUsername: user.username,
    senderLocation: user.location || 'Nigeria',
  });
  store.state.directMessages.push(message);
  store.saveToDisk();

  if (store.supabase && store.supabaseConnected) {
    Promise.resolve(
      store.supabase.from('conversations').upsert({
        id: conv.id,
        participant_one_id: conv.participant_one_id,
        participant_two_id: conv.participant_two_id,
        last_message_text: conv.last_message_text,
        last_message_at: conv.last_message_at,
        created_at: conv.last_message_at,
      })
    ).catch(() => {});

    Promise.resolve(
      store.supabase.from('direct_messages').upsert({
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        is_read: false,
        created_at: message.created_at,
      })
    ).catch(() => {});

    Promise.resolve(
      store.supabase.from('community_messages').upsert({
        id: message.id,
        message_scope: 'direct',
        conversation_id: message.conversation_id,
        sender_id: user.id,
        sender_full_name: user.full_name,
        sender_username: user.username,
        sender_location: user.location || 'Nigeria',
        recipient_id: otherId,
        content: message.content,
        attachment: message.attachment || null,
        is_read: false,
        created_at: message.created_at,
      })
    ).catch(() => {});
  }

  res.json({ message, conversation: conv });
});

// ============================================================================
// 7. MODERATION REPORTS
// ============================================================================
app.post('/api/reports', async (req: Request, res: Response) => {
  const user = await resolveCommunityMember(req);
  if (!user) {
    res.status(401).json({ error: 'Please sign in to submit a report.' });
    return;
  }
  const { targetType, targetId, targetSummary, reason, details } = req.body || {};
  if (!targetType || !targetId || !reason) {
    res.status(400).json({ error: 'Target and reason are required.' });
    return;
  }
  const report: ModerationReport = {
    id: crypto.randomUUID(),
    reporter_id: user.id,
    reporter_name: user.full_name,
    target_type: targetType,
    target_id: targetId,
    target_summary: String(targetSummary || targetId),
    reason: String(reason),
    details: String(details || ''),
    status: 'open',
    created_at: new Date().toISOString(),
  };
  store.state.moderationReports.unshift(report);
  store.saveToDisk();
  res.json({ report });
});

// ============================================================================
// 8. ADMIN COMMAND CENTER ENDPOINTS
// ============================================================================
app.get('/api/admin/overview', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }

  const safeUsers = store.state.users.map(({ password_hash: _, ...u }) => u);
  res.json({
    systemStatus: store.getSystemStatus(),
    categories: store.state.categories,
    marriageCollections: store.state.marriageCollections,
    channels: store.state.channels,
    videos: store.state.videos,
    users: safeUsers,
    comments: store.state.videoComments,
    prayers: store.state.prayerRequests,
    reports: store.state.moderationReports,
    quotaLogs: store.state.youtubeApiLogs.slice(0, 100),
    discoveryHistory: store.state.discoveryHistory.slice(0, 100),
    searchPhrases: NIGERIAN_CHRISTIAN_SEARCH_PHRASES,
  });
});

app.post('/api/admin/sync-channels', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { channelId } = req.body || {};
  const stats = await store.syncApprovedChannels(channelId);
  res.json({
    ...stats,
    systemStatus: store.getSystemStatus(),
  });
});

app.post('/api/admin/deduplicate', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { removedCount } = store.deduplicateVideos(true);
  res.json({
    removedCount,
    systemStatus: store.getSystemStatus(),
  });
});

app.post('/api/admin/channels/add', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { identifier, channelType, isNigerian, defaultCategorySlug } = req.body || {};
  if (!identifier) {
    res.status(400).json({ error: 'Please provide a YouTube handle (e.g. @MercyChinwo), URL, or UC... ID.' });
    return;
  }

  const resolved = await resolveYouTubeChannelIdentifier(String(identifier));
  if (!resolved) {
    res.status(404).json({
      error: 'Could not resolve that YouTube channel. Please verify the handle or UC channel ID.',
    });
    return;
  }

  const existing = store.state.channels.find(
    (c) => c.youtube_channel_id === resolved.youtubeChannelId
  );
  if (existing) {
    existing.approval_status = 'approved';
    existing.is_official_verified = true;
    store.saveToDisk();
    await store.syncApprovedChannels(existing.id);
    res.json({ channel: existing });
    return;
  }

  const newChannel: KingdomChannel = {
    id: `ch-${Date.now().toString(36)}`,
    youtube_channel_id: resolved.youtubeChannelId,
    title: resolved.title,
    handle: resolved.handle,
    channel_type: channelType || 'minister',
    is_nigerian: isNigerian !== false,
    is_official_verified: true,
    default_category_slug: defaultCategorySlug || 'sermons-teachings',
    supported_categories: [defaultCategorySlug || 'sermons-teachings'],
    subscriber_count: null,
    video_count: null,
    view_count: null,
    avatar_url: resolved.avatarUrl,
    approval_status: 'approved',
    priority_weight: isNigerian !== false ? 1.45 : 1.0,
    last_synced_at: null,
  };

  store.state.channels.unshift(newChannel);
  await store.syncApprovedChannels(newChannel.id);
  res.json({ channel: newChannel });
});

app.patch('/api/admin/channels/:channelId', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const ch = store.state.channels.find((c) => c.id === req.params.channelId);
  if (!ch) {
    res.status(404).json({ error: 'Channel not found.' });
    return;
  }
  const {
    approval_status,
    is_nigerian,
    channel_type,
    default_category_slug,
    priority_weight,
    is_featured_marriage_teacher,
    is_featured_minister,
    speaker_gender,
    speaker_name,
    ministry_name,
    title,
    handle,
    aliases,
    bio,
  } = req.body || {};
  if (approval_status) {
    ch.approval_status = approval_status;
    // If channel is blocked or moved to pending, update its videos accordingly
    if (approval_status === 'blocked') {
      for (const v of store.state.videos) {
        if (v.channel_id === ch.id) v.approval_status = 'rejected';
      }
    } else if (approval_status === 'pending') {
      for (const v of store.state.videos) {
        if (v.channel_id === ch.id && v.approval_status === 'approved') {
          v.approval_status = 'pending_review';
        }
      }
    } else if (approval_status === 'approved') {
      ch.is_official_verified = true;
    }
  }
  if (typeof is_nigerian === 'boolean') ch.is_nigerian = is_nigerian;
  if (channel_type) ch.channel_type = channel_type;
  if (default_category_slug) ch.default_category_slug = default_category_slug;
  if (typeof priority_weight === 'number') ch.priority_weight = priority_weight;
  if (typeof is_featured_marriage_teacher === 'boolean') {
    ch.is_featured_marriage_teacher = is_featured_marriage_teacher;
  }
  if (typeof is_featured_minister === 'boolean') {
    ch.is_featured_minister = is_featured_minister;
  }
  if (speaker_name !== undefined) ch.speaker_name = String(speaker_name).trim();
  if (ministry_name !== undefined) ch.ministry_name = String(ministry_name).trim();
  if (title !== undefined && String(title).trim()) {
    ch.title = String(title).trim();
    for (const v of store.state.videos) {
      if (v.channel_id === ch.id) v.channel_title = ch.title;
    }
  }
  if (handle !== undefined && String(handle).trim()) {
    ch.handle = String(handle).trim();
    for (const v of store.state.videos) {
      if (v.channel_id === ch.id) v.channel_handle = ch.handle;
    }
  }
  if (Array.isArray(aliases)) {
    ch.aliases = aliases.map((a) => String(a).trim()).filter(Boolean);
  } else if (typeof aliases === 'string') {
    ch.aliases = aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }
  if (bio !== undefined) ch.bio = String(bio).trim();
  if (
    speaker_gender === 'male' ||
    speaker_gender === 'female' ||
    speaker_gender === 'couple' ||
    speaker_gender === 'ministry'
  ) {
    ch.speaker_gender = speaker_gender;
    for (const v of store.state.videos) {
      if (v.channel_id === ch.id) v.speaker_gender = speaker_gender;
    }
  }
  store.saveToDisk();
  res.json({ channel: ch });
});

app.post('/api/admin/channels/merge', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { sourceChannelId, targetChannelId } = req.body || {};
  if (!sourceChannelId || !targetChannelId || sourceChannelId === targetChannelId) {
    res.status(400).json({ error: 'Please select two distinct speaker/channel records to merge.' });
    return;
  }
  const result = store.mergeDuplicateChannels(String(sourceChannelId), String(targetChannelId));
  if (!result.targetChannel) {
    res.status(404).json({ error: 'Source or target channel not found.' });
    return;
  }
  res.json({
    ok: true,
    reassignedVideosCount: result.reassignedVideosCount,
    targetChannel: result.targetChannel,
  });
});

app.delete('/api/admin/channels/:channelId', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const idx = store.state.channels.findIndex((c) => c.id === req.params.channelId);
  if (idx < 0) {
    res.status(404).json({ error: 'Channel not found.' });
    return;
  }
  const removedChannel = store.state.channels[idx];
  store.state.channels.splice(idx, 1);
  // Remove all videos belonging to this removed channel from public catalog
  store.state.videos = store.state.videos.filter((v) => v.channel_id !== removedChannel.id);
  store.saveToDisk();
  res.json({ ok: true, removedChannelTitle: removedChannel.title });
});

app.post('/api/admin/categories', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { name, description, section } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }
  const slug = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (store.state.categories.some((c) => c.slug === slug)) {
    res.status(409).json({ error: 'A category with this slug already exists.' });
    return;
  }
  const newCat: ContentCategory = {
    id: `cat-${slug}`,
    slug,
    name: String(name).trim(),
    description: String(description || `${name} curated videos on KINGDOM+.`).trim(),
    display_order: store.state.categories.length + 1,
    is_active: true,
    section: section === 'movies' ? 'movies' : 'streaming',
  };
  store.state.categories.push(newCat);
  store.saveToDisk();
  res.json({ category: newCat });
});

app.patch('/api/admin/categories/:categoryId', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const cat = store.state.categories.find((c) => c.id === req.params.categoryId);
  if (!cat) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }
  const { name, description, is_active, section } = req.body || {};
  if (name !== undefined) cat.name = String(name).trim();
  if (description !== undefined) cat.description = String(description).trim();
  if (typeof is_active === 'boolean') cat.is_active = is_active;
  if (section === 'streaming' || section === 'movies') cat.section = section;
  store.saveToDisk();
  res.json({ category: cat });
});

app.post('/api/admin/videos/add-by-url', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const {
    urlOrId,
    primaryCategorySlug,
    subcategoryLabel,
    channelId,
    worshipSubcategories,
    christianLivingSubcategories,
    publishStatus,
    isFeaturedHero,
    isTrendingPinned,
  } = req.body || {};
  if (!urlOrId) {
    res.status(400).json({ error: 'Please provide a valid YouTube video URL or 11-character ID.' });
    return;
  }

  const videoId = extractYouTubeVideoIdFromUrl(String(urlOrId));
  if (!videoId) {
    res.status(400).json({ error: 'Could not extract a valid 11-character YouTube video ID from that URL.' });
    return;
  }

  const resolvedApprovalStatus =
    publishStatus === 'pending_review' ? 'pending_review' : 'approved';

  const existing = store.state.videos.find((v) => v.youtube_video_id === videoId);
  if (existing) {
    existing.approval_status = resolvedApprovalStatus;
    if (channelId) {
      const assignedCh = store.state.channels.find((c) => c.id === channelId);
      if (assignedCh) {
        existing.channel_id = assignedCh.id;
        existing.channel_title = assignedCh.title;
        existing.channel_handle = assignedCh.handle;
        existing.channel_avatar_url = assignedCh.avatar_url;
        existing.artist_name = assignedCh.speaker_name || assignedCh.title;
      }
    }
    if (primaryCategorySlug) {
      const cat = store.state.categories.find((c) => c.slug === primaryCategorySlug);
      if (cat) {
        existing.primary_category_id = cat.id;
        existing.primary_category_slug = cat.slug;
        existing.primary_category_name = cat.name;
      }
    }
    if (subcategoryLabel !== undefined) existing.subcategory_label = String(subcategoryLabel).trim();
    if (Array.isArray(worshipSubcategories)) {
      existing.worship_subcategories = worshipSubcategories;
    }
    if (Array.isArray(christianLivingSubcategories)) {
      existing.christian_living_subcategories = christianLivingSubcategories;
    }
    if (typeof isFeaturedHero === 'boolean') existing.is_featured_hero = isFeaturedHero;
    if (typeof isTrendingPinned === 'boolean') existing.is_trending_pinned = isTrendingPinned;
    existing.last_refreshed_at = new Date().toISOString();
    store.saveToDisk();
    res.json({ video: existing, message: 'Video already existed in catalog; updated.' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY || '';
  const fetched = await fetchSingleYouTubeVideoById(videoId, apiKey, (ep, cost, cnt, st, note) =>
    store.logYouTubeQuota(ep, cost, cnt, st, note)
  );
  if (!fetched) {
    res.status(404).json({
      error: 'Could not retrieve video metadata from YouTube, or video is private/non-embeddable.',
    });
    return;
  }

  let channel = channelId
    ? store.state.channels.find((c) => c.id === channelId)
    : store.state.channels.find((c) => c.youtube_channel_id === fetched.raw.youtubeChannelId);

  if (!channel) {
    channel = {
      id: `ch-manual-${fetched.raw.youtubeChannelId}`,
      youtube_channel_id: fetched.raw.youtubeChannelId,
      title: fetched.channelTitle,
      handle: `@${fetched.channelTitle.replace(/\s+/g, '')}`,
      channel_type: 'minister',
      is_nigerian: true,
      is_official_verified: true,
      default_category_slug: primaryCategorySlug || 'sermons-teachings',
      subscriber_count: null,
      video_count: null,
      view_count: null,
      avatar_url: `https://unavatar.io/youtube/${encodeURIComponent(fetched.channelTitle)}`,
      approval_status: 'approved',
      priority_weight: 1.4,
      last_synced_at: new Date().toISOString(),
    };
    store.state.channels.unshift(channel);
  }

  const scored = buildScoredKingdomVideo(
    fetched.raw,
    channel,
    store.state.categories,
    resolvedApprovalStatus
  );
  scored.artist_name = channel.speaker_name || channel.title;
  if (primaryCategorySlug) {
    const cat = store.state.categories.find((c) => c.slug === primaryCategorySlug);
    if (cat) {
      scored.primary_category_id = cat.id;
      scored.primary_category_slug = cat.slug;
      scored.primary_category_name = cat.name;
    }
  }
  if (scored.primary_category_slug === 'worship-praise') {
    const spec =
      APPROVED_WORSHIP_PRAISE_ARTISTS.find((a) => a.channelId === channel!.id) ||
      APPROVED_WORSHIP_PRAISE_ARTISTS[0];
    const subInfo = classifyWorshipPraiseSubcategories(scored, spec);
    scored.worship_subcategories = Array.isArray(worshipSubcategories) && worshipSubcategories.length > 0
      ? worshipSubcategories
      : subInfo.subcategories;
    scored.subcategory_label = subcategoryLabel
      ? String(subcategoryLabel).trim()
      : subInfo.primarySubcategoryName;
  } else if (scored.primary_category_slug === 'christian-living') {
    const mSpec =
      APPROVED_CHRISTIAN_LIVING_MINISTERS.find((m) => m.channelId === channel!.id) ||
      APPROVED_CHRISTIAN_LIVING_MINISTERS[0];
    const clInfo = classifyChristianLivingSubcategories(
      scored.title,
      scored.description,
      mSpec
    );
    scored.christian_living_subcategories =
      Array.isArray(christianLivingSubcategories) && christianLivingSubcategories.length > 0
        ? christianLivingSubcategories
        : clInfo.subcategories;
    scored.subcategory_label = subcategoryLabel
      ? String(subcategoryLabel).trim()
      : clInfo.primarySubcategoryLabel;
    scored.christian_living_score = computeChristianLivingSmartScore({
      viewCount: scored.view_count,
      likeCount: scored.like_count,
      likesVerified: Boolean(scored.likes_verified),
      commentCount: scored.comment_count,
      publishedAt: scored.published_at,
      isNigerian: scored.is_nigerian_channel,
      relevanceBoost: clInfo.relevanceBoost,
    });
  } else if (subcategoryLabel !== undefined && String(subcategoryLabel).trim()) {
    scored.subcategory_label = String(subcategoryLabel).trim();
  }
  scored.approval_status = resolvedApprovalStatus;
  scored.is_featured_hero = Boolean(isFeaturedHero);
  scored.is_trending_pinned = Boolean(isTrendingPinned);
  scored.last_refreshed_at = new Date().toISOString();

  store.state.videos.unshift(scored);
  store.recordDiscoveryHistory({
    mode: 'manual_url_import',
    query_or_source: `Manual YouTube URL import: ${scored.title} (${videoId})`,
    videos_discovered: 1,
    videos_approved: resolvedApprovalStatus === 'approved' ? 1 : 0,
    videos_pending: resolvedApprovalStatus === 'pending_review' ? 1 : 0,
  });
  store.saveToDisk();
  await store.syncCategoriesAndChannelsToSupabase();

  res.json({ video: scored });
});

app.patch('/api/admin/videos/:videoId', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const video = store.state.videos.find((v) => v.id === req.params.videoId);
  if (!video) {
    res.status(404).json({ error: 'Video not found.' });
    return;
  }
  const {
    approval_status,
    primary_category_slug,
    subcategory_label,
    channel_id,
    worship_subcategories,
    christian_living_subcategories,
    remove_from_worship_praise,
    remove_from_christian_living,
    is_featured_hero,
    is_trending_pinned,
    marriage_collections,
    reclassifyWithGemini,
  } = req.body || {};

  if (approval_status) video.approval_status = approval_status;
  if (typeof is_featured_hero === 'boolean') video.is_featured_hero = is_featured_hero;
  if (typeof is_trending_pinned === 'boolean') video.is_trending_pinned = is_trending_pinned;
  if (subcategory_label !== undefined) {
    video.subcategory_label = String(subcategory_label).trim() || undefined;
  }

  // Assign artist / minister / channel
  if (channel_id) {
    const newCh = store.state.channels.find((c) => c.id === channel_id);
    if (newCh) {
      video.channel_id = newCh.id;
      video.channel_title = newCh.title;
      video.channel_handle = newCh.handle;
      video.channel_type = newCh.channel_type;
      video.channel_avatar_url = newCh.avatar_url;
      video.is_nigerian_channel = newCh.is_nigerian;
      video.artist_name = newCh.speaker_name || newCh.title;
      video.speaker_gender = newCh.speaker_gender;
    }
  }

  // Remove from Worship & Praise without deleting the video
  if (remove_from_worship_praise) {
    const gospelCat = store.state.categories.find((c) => c.slug === 'gospel-music');
    if (gospelCat) {
      video.primary_category_id = gospelCat.id;
      video.primary_category_slug = gospelCat.slug;
      video.primary_category_name = gospelCat.name;
    }
    video.secondary_category_slugs = (video.secondary_category_slugs || []).filter(
      (s) => s !== 'worship-praise'
    );
    video.worship_subcategories = [];
    store.saveToDisk();
    res.json({ video });
    return;
  }

  // Remove from Christian Living without deleting the video
  if (remove_from_christian_living) {
    const sermonsCat = store.state.categories.find((c) => c.slug === 'sermons-teachings');
    if (sermonsCat) {
      video.primary_category_id = sermonsCat.id;
      video.primary_category_slug = sermonsCat.slug;
      video.primary_category_name = sermonsCat.name;
    }
    video.secondary_category_slugs = (video.secondary_category_slugs || []).filter(
      (s) => s !== 'christian-living'
    );
    video.christian_living_subcategories = [];
    video.christian_living_score = undefined;
    store.saveToDisk();
    res.json({ video });
    return;
  }

  if (Array.isArray(worship_subcategories)) {
    video.worship_subcategories = worship_subcategories;
    const firstSub = WORSHIP_SUBCATEGORIES.find((s) => s.slug === worship_subcategories[0]);
    if (firstSub && !subcategory_label) {
      video.subcategory_label = firstSub.name;
    }
  }

  if (Array.isArray(christian_living_subcategories)) {
    video.christian_living_subcategories = christian_living_subcategories;
    const firstClSub = CHRISTIAN_LIVING_SUBCATEGORIES.find(
      (s) => s.slug === christian_living_subcategories[0]
    );
    if (firstClSub && !subcategory_label) {
      video.subcategory_label = firstClSub.name;
    }
  }

  if (primary_category_slug) {
    const cat = store.state.categories.find((c) => c.slug === primary_category_slug);
    if (cat) {
      if (!video.legacy_category_slug && video.primary_category_slug !== cat.slug) {
        video.legacy_category_slug = video.primary_category_slug;
      }
      video.primary_category_id = cat.id;
      video.primary_category_slug = cat.slug;
      video.primary_category_name = cat.name;
      if (cat.slug === 'marriage-relationships') {
        const evalRes = evaluateMarriageAndRelationships(
          video.title,
          video.description,
          video.channel_title,
          video.channel_type,
          video.speaker_gender
        );
        video.marriage_collections =
          evalRes.marriageCollections.length > 0
            ? evalRes.marriageCollections
            : ['trending-marriage-teachings', 'building-a-godly-home'];
      } else {
        video.marriage_collections = [];
      }
    }
  }

  if (Array.isArray(marriage_collections)) {
    video.marriage_collections = marriage_collections;
  }

  if (reclassifyWithGemini) {
    const aiRes = await classifyVideoWithGemini(
      video.title,
      video.description,
      video.channel_title,
      video.channel_type,
      video.primary_category_slug
    );
    const cat = store.state.categories.find((c) => c.slug === aiRes.primaryCategorySlug);
    if (cat) {
      video.primary_category_id = cat.id;
      video.primary_category_slug = cat.slug;
      video.primary_category_name = cat.name;
    }
    video.secondary_category_slugs = aiRes.secondaryCategorySlugs;
    video.subcategory_label = aiRes.subcategoryLabel;
    video.marriage_collections = aiRes.marriageCollections || [];
    video.ai_classification_reason = aiRes.reason;
  }

  store.saveToDisk();
  res.json({ video });
});

app.post('/api/admin/videos/:videoId/refresh', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const video = store.state.videos.find(
    (v) => v.id === req.params.videoId || v.youtube_video_id === req.params.videoId
  );
  if (!video) {
    res.status(404).json({ error: 'Video not found.' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY || '';
  const fetched = await fetchSingleYouTubeVideoById(
    video.youtube_video_id,
    apiKey,
    (ep, cost, cnt, st, note) => store.logYouTubeQuota(ep, cost, cnt, st, note)
  );

  if (!fetched) {
    video.is_available = false;
    video.is_embeddable = false;
    video.last_refreshed_at = new Date().toISOString();
    store.saveToDisk();
    res.json({
      video,
      available: false,
      message: 'Video is no longer available or embeddable on YouTube and has been flagged unavailable.',
    });
    return;
  }

  video.title = fetched.raw.title || video.title;
  if (fetched.raw.description) video.description = fetched.raw.description;
  video.view_count = Math.max(video.view_count, fetched.raw.viewCount);
  if (fetched.raw.likesVerified && fetched.raw.likeCount > 0) {
    video.like_count = fetched.raw.likeCount;
    video.likes_verified = true;
  }
  if (fetched.raw.durationSeconds) {
    video.duration_seconds = fetched.raw.durationSeconds;
  }
  video.is_available = true;
  video.is_embeddable = true;
  video.last_refreshed_at = new Date().toISOString();

  const metrics = computeVideoRankingMetrics({
    viewCount: video.view_count,
    likeCount: video.likes_verified !== false ? video.like_count : 0,
    commentCount: video.comment_count,
    publishedAt: video.published_at,
    isNigerianChannel: video.is_nigerian_channel,
    isOfficialVerified: video.is_official_verified,
    priorityWeight: 1.45,
  });
  video.views_per_day = metrics.viewsPerDay;
  video.engagement_rate = metrics.engagementRate;
  video.trending_score = metrics.trendingScore;
  video.evergreen_score = metrics.evergreenScore;
  video.quality_score = metrics.qualityScore;

  store.saveToDisk();
  res.json({
    video,
    available: true,
    message: `Refreshed "${video.title}" (${video.view_count.toLocaleString()} verified views).`,
  });
});

app.post('/api/admin/worship-praise/refresh', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  try {
    const result = await store.refreshWorshipAndPraiseCatalog(8);
    res.json({
      ok: true,
      ...result,
      message: `Worship & Praise refreshed with ${result.totalCuratedSongs} verified songs across all 36 approved artists.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to refresh Worship & Praise catalog.' });
  }
});

app.post('/api/admin/christian-living/refresh', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  try {
    const result = await store.refreshChristianLivingCatalog(8);
    res.json({
      ok: true,
      ...result,
      message: `Christian Living refreshed with ${result.totalCuratedTeachings} verified teachings across all ${result.ministersCount} approved ministers.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to refresh Christian Living catalog.' });
  }
});

app.post('/api/admin/christian-living/check-suggestions', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  try {
    const result = await store.checkChristianLivingSuggestions();
    res.json({
      ok: true,
      ...result,
      message: `Checked 20 approved Christian Living ministers: ${result.refreshedExistingCount} existing videos updated, +${result.suggestedForApprovalCount} new candidate teaching(s) queued for Admin Approval.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to check Christian Living suggestions.' });
  }
});

app.patch('/api/admin/marriage-collections', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { collections } = req.body || {};
  if (Array.isArray(collections)) {
    for (const incoming of collections) {
      const target = store.state.marriageCollections.find((c) => c.slug === incoming.slug);
      if (target) {
        if (typeof incoming.display_order === 'number') {
          target.display_order = incoming.display_order;
        }
        if (typeof incoming.is_active === 'boolean') {
          target.is_active = incoming.is_active;
        }
      }
    }
    store.state.marriageCollections.sort((a, b) => a.display_order - b.display_order);
    store.saveToDisk();
  }
  res.json({ marriageCollections: store.state.marriageCollections });
});

app.post('/api/admin/discover-marriage-teachings', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  try {
    const stats = await store.discoverVerifiedMarriageTeachings();
    res.json({
      ...stats,
      systemStatus: store.getSystemStatus(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/youtube-discovery-search', async (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const { query, defaultCategorySlug, publishedWithin } = req.body || {};

  try {
    const result = await store.runSearchPhraseDiscovery({
      query: query ? String(query).trim() : undefined,
      defaultCategorySlug,
      publishedWithin: publishedWithin || 'any',
    });
    res.json({
      addedToQueue: result.discoveredCount,
      approvedFromOfficialCount: result.approvedFromOfficialCount,
      queuedForReviewCount: result.queuedForReviewCount,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/admin/users/:userId', (req: Request, res: Response) => {
  const admin = getAuthenticatedUser(req);
  if (!isAdminUser(admin)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const target = store.state.users.find((u) => u.id === req.params.userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const { role, is_suspended } = req.body || {};
  if (role) target.role = role;
  if (typeof is_suspended === 'boolean') target.is_suspended = is_suspended;
  store.saveToDisk();
  const { password_hash: _, ...safe } = target;
  res.json({ user: safe });
});

app.patch('/api/admin/reports/:reportId', (req: Request, res: Response) => {
  const admin = getAuthenticatedUser(req);
  if (!isAdminUser(admin)) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  const report = store.state.moderationReports.find((r) => r.id === req.params.reportId);
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }
  const { status, hideTarget } = req.body || {};
  if (status) report.status = status;
  if (hideTarget) {
    if (report.target_type === 'comment') {
      const c = store.state.videoComments.find((x) => x.id === report.target_id);
      if (c) c.is_hidden = true;
    } else if (report.target_type === 'prayer') {
      const p = store.state.prayerRequests.find((x) => x.id === report.target_id);
      if (p) p.status = 'hidden';
    } else if (report.target_type === 'video') {
      const v = store.state.videos.find((x) => x.id === report.target_id);
      if (v) v.approval_status = 'rejected';
    }
  }
  store.saveToDisk();
  res.json({ report });
});

// ============================================================================
// 9. SERVER BOOTSTRAP & SCHEDULED CONTENT REFRESH
// ============================================================================
async function startServer() {
  const hasUnsyncedChannels = store.state.channels.some(
    (c) => c.approval_status === 'approved' && !c.last_synced_at
  );
  const approvedMarriageVideos = store.state.videos.filter(
    (v) =>
      v.approval_status === 'approved' &&
      (v.primary_category_slug === 'marriage-relationships' ||
        v.secondary_category_slugs.includes('marriage-relationships'))
  );

  if (store.state.videos.length === 0 || hasUnsyncedChannels || approvedMarriageVideos.length < 35) {
    console.log('KINGDOM+ Boot: Syncing live videos & verified marriage teachings from official Christian YouTube channels...');
    store
      .syncApprovedChannels()
      .then(async (stats) => {
        console.log(
          `KINGDOM+ Live Sync Complete: ${stats.channelsSynced} channels synced, +${stats.videosAdded} new videos/movies indexed.`
        );
        const mStats = await store.discoverVerifiedMarriageTeachings();
        console.log(
          `KINGDOM+ Marriage & Relationships Discovery Complete: +${mStats.approvedMarriageVideosCount} verified marriage/relationship teachings added.`
        );
      })
      .catch((err) => console.error('Initial channel sync error:', err));
  }

  // Section 11: Scheduled periodic check (every 6 hours) for new Christian Living teachings from the 20 approved ministers.
  // Newly discovered candidate videos are held in `pending_review` for Admin Approval and never auto-published.
  setInterval(() => {
    store.checkChristianLivingSuggestions().catch(() => {});
  }, 6 * 60 * 60 * 1000);

  // Automatic Daily Fresh Video Sync across all categories (runs on boot + every 30 minutes)
  syncDailyFreshVideosIntoStore().catch(() => {});
  setInterval(() => {
    syncDailyFreshVideosIntoStore().catch(() => {});
  }, 30 * 60 * 1000);

  // Automatic YouTube Christian Movie Release & Trending Watcher (warms up 8s after boot + every 30 minutes)
  setTimeout(() => {
    checkTrendingAndNewChristianMovies(false).catch(() => {});
  }, 8000);
  setInterval(() => {
    checkTrendingAndNewChristianMovies(true).catch(() => {});
  }, 30 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KINGDOM+ Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
