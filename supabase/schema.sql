-- ============================================================================
-- KINGDOM+ — PREMIUM CHRISTIAN STREAMING, MOVIES & COMMUNITY PLATFORM
-- Complete Idempotent Supabase PostgreSQL Schema, Seed Data & Realtime Script
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. PROFILES / USERS
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  full_name text not null,
  username text unique not null,
  avatar_url text,
  bio text default '',
  location text default 'Lagos, Nigeria',
  denomination_or_church text default '',
  role text not null default 'member' check (role in ('member', 'moderator', 'admin', 'super_admin')),
  is_suspended boolean not null default false,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  preferences jsonb not null default '{"favoriteCategories": [], "favoriteMinisters": []}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. CATEGORIES (12 Streaming Categories + 4 Christian Movies & Animation Categories)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  section text not null default 'streaming' check (section in ('streaming', 'movies')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Safe migration if categories table was created prior to adding the `section`, `is_legacy_subcategory`, and `parent_category_slug` columns
alter table public.categories
  add column if not exists section text not null default 'streaming';
alter table public.categories
  add column if not exists is_legacy_subcategory boolean not null default false;
alter table public.categories
  add column if not exists parent_category_slug text;

-- 3. CHANNELS (Official Ministers, Gospel Artists, Churches, Movie Studios & Animation Studios)
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text unique not null,
  title text not null,
  handle text not null,
  channel_type text not null check (channel_type in ('artist', 'minister', 'church', 'ministry', 'movie_studio', 'animation_studio')),
  is_nigerian boolean not null default true,
  is_official_verified boolean not null default true,
  default_category_slug text not null,
  subscriber_count bigint,
  video_count bigint,
  view_count bigint,
  avatar_url text,
  banner_url text,
  uploads_playlist_id text,
  approval_status text not null default 'approved' check (approval_status in ('approved', 'pending', 'blocked')),
  priority_weight numeric(4,2) not null default 1.35,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safe migration to expand channel_type check constraint if table already existed
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'channels_channel_type_check'
  ) then
    alter table public.channels drop constraint channels_channel_type_check;
  end if;
  alter table public.channels
    add constraint channels_channel_type_check
    check (channel_type in ('artist', 'minister', 'church', 'ministry', 'movie_studio', 'animation_studio'));
exception
  when duplicate_object then null;
end $$;

-- 4. VIDEOS (Discovered, Scored & Approved YouTube Broadcasts, Movies & Animations)
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text unique not null,
  channel_id uuid not null references public.channels(id) on delete cascade,
  primary_category_id uuid not null references public.categories(id),
  secondary_category_slugs text[] not null default '{}',
  title text not null,
  description text not null default '',
  thumbnail_high_url text not null,
  thumbnail_maxres_url text not null,
  published_at timestamptz not null,
  duration_seconds integer,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint,
  views_per_day numeric(14,2) not null default 0,
  engagement_rate numeric(10,4) not null default 0,
  trending_score numeric(16,4) not null default 0,
  evergreen_score numeric(16,4) not null default 0,
  is_embeddable boolean not null default true,
  is_available boolean not null default true,
  approval_status text not null default 'approved' check (approval_status in ('approved', 'pending_review', 'rejected')),
  is_featured_hero boolean not null default false,
  is_trending_pinned boolean not null default false,
  subcategory_label text,
  legacy_category_slug text,
  ai_classification_reason text,
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Safe migrations for minister directory & non-destructive subcategory preservation
alter table public.channels
  add column if not exists speaker_name text;
alter table public.channels
  add column if not exists ministry_name text;
alter table public.channels
  add column if not exists aliases text[] not null default '{}';
alter table public.channels
  add column if not exists bio text default '';
alter table public.channels
  add column if not exists is_featured_minister boolean not null default true;

alter table public.videos
  add column if not exists subcategory_label text;
alter table public.videos
  add column if not exists legacy_category_slug text;

create index if not exists idx_videos_category on public.videos(primary_category_id);
create index if not exists idx_videos_trending on public.videos(trending_score desc);
create index if not exists idx_videos_views on public.videos(view_count desc);
create index if not exists idx_videos_published on public.videos(published_at desc);

-- 5. WATCH HISTORY & SAVED VIDEOS
create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  progress_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  unique(user_id, video_id)
);

create table if not exists public.saved_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, video_id)
);

-- 6. VIDEO DISCUSSIONS & COMMENTS
create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.video_comments(id) on delete cascade,
  content text not null,
  likes_count integer not null default 0,
  liked_by_user_ids uuid[] not null default '{}',
  is_flagged boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7. COMMUNITY CONNECTIONS & BLOCKS
create table if not exists public.user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id)
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);

-- 8. REAL-TIME PRIVATE MESSAGING
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one_id uuid not null references public.profiles(id) on delete cascade,
  participant_two_id uuid not null references public.profiles(id) on delete cascade,
  last_message_text text default '',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(participant_one_id, participant_two_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  attachment jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.direct_messages
  add column if not exists attachment jsonb;

-- 8b. COMMUNITY GROUP ROOM MESSAGES & UNIFIED COMMUNITY MESSAGES LOG
create table if not exists public.fellowship_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_full_name text not null,
  user_username text not null,
  user_location text default 'Nigeria',
  content text not null default '',
  attachment jsonb,
  amen_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_fellowship_room_messages_room_created
  on public.fellowship_room_messages(room_id, created_at desc);

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  message_scope text not null check (message_scope in ('room', 'direct')),
  room_id text,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_full_name text not null default '',
  sender_username text not null default '',
  sender_location text default '',
  recipient_id uuid references public.profiles(id) on delete set null,
  content text not null default '',
  attachment jsonb,
  amen_user_ids uuid[] not null default '{}',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_messages_scope_created
  on public.community_messages(message_scope, created_at desc);

-- 9. PRAYER COMMUNITY WALL
create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  category_tag text not null default 'Healing & Family',
  is_anonymous boolean not null default false,
  pray_count integer not null default 0,
  prayed_by_user_ids uuid[] not null default '{}',
  encouragement_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'answered', 'hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_encouragements (
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid not null references public.prayer_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- 10. MODERATION REPORTS & YOUTUBE API QUOTA LOGS
create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('video', 'comment', 'prayer', 'user', 'message')),
  target_id text not null,
  reason text not null,
  details text default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.youtube_api_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  quota_cost integer not null,
  videos_processed integer not null default 0,
  status_code integer not null default 200,
  note text default '',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 11. SEED 8 APPROVED MAIN STREAMING CATEGORIES + 4 CHRISTIAN MOVIE CATEGORIES
--     + PRESERVE ALL 7 LEGACY SUBCATEGORIES WITHOUT DELETING ANY DATA
-- ============================================================================
insert into public.categories (slug, name, description, section, display_order, is_active, is_legacy_subcategory, parent_category_slug)
values
  -- 8 Approved Main Streaming Categories
  ('sermons-teachings', 'Sermons & Teachings', 'Full sermons, Bible teachings, prophetic messages, spiritual growth, biblical explanations, and Christian leadership teachings from recognised Nigerian and global pulpits.', 'streaming', 1, true, false, null),
  ('gospel-music', 'Gospel Music', 'Official Nigerian gospel songs, gospel music videos, artist performances, latest gospel releases, and curated gospel music collections.', 'streaming', 2, true, false, null),
  ('worship-praise', 'Worship & Praise', 'Deep worship sessions, energetic Nigerian praise medleys, thanksgiving celebrations, live worship concerts, and sacred altar ministrations.', 'streaming', 3, true, false, null),
  ('prayer-spiritual-warfare', 'Prayer & Spiritual Warfare', 'NSPPD prayer broadcasts, Hallelujah Challenge, midnight prayers, prophetic prayers, deliverance services, spiritual warfare, and fasting programmes.', 'streaming', 4, true, false, null),
  ('marriage-relationships', 'Marriage & Relationships', 'Christian dating, courtship, advice for singles, marriage counselling, marriage restoration, husband & wife teachings, parenting, family life, and building a godly home.', 'streaming', 5, true, false, null),
  ('christian-living', 'Christian Living', 'Christian motivation, faith and purpose, personal development, spiritual discipline, character development, everyday Christian lifestyle, and documented testimonies.', 'streaming', 6, true, false, null),
  ('conferences-events', 'Conferences & Events', 'Major Christian conferences, church conventions, Shiloh, The Experience Lagos, WAFBEC, Koinonia conferences, and Christian leadership events.', 'streaming', 7, true, false, null),
  ('live-special-broadcasts', 'Live & Special Broadcasts', 'Live church services, live prayer broadcasts, special live ministry programmes, and verified Christian live events.', 'streaming', 8, true, false, null),
  -- 4 Christian Movie & Animation Categories (Preserved untouched in the Movies section)
  ('real-christian-movies', 'Real Christian Movies', 'Feature-length Nigerian and international Christian movies, Mount Zion faith dramas, and family-friendly theatrical releases.', 'movies', 9, true, false, null),
  ('bible-stories', 'Bible Stories', 'Cinematic dramatisations of Old and New Testament accounts, gospel epics, and scriptural history.', 'movies', 10, true, false, null),
  ('christian-animations', 'Christian Animations', 'High-impression 2D and 3D animated biblical narratives, visual theology, and animated faith adventures.', 'movies', 11, true, false, null),
  ('bible-story-cartoons', 'Bible Story Cartoons', 'Engaging animated Bible story cartoons for children, teens, Sunday school, and family devotion.', 'movies', 12, true, false, null),
  -- 7 Preserved Legacy Subcategories (Retained internally so zero category records are deleted)
  ('deep-worship', 'Deep Worship', 'Preserved subcategory under Worship & Praise for soaking worship chants and prophetic altar ministrations.', 'streaming', 101, false, true, 'worship-praise'),
  ('praise-thanksgiving', 'Praise & Thanksgiving', 'Preserved subcategory under Worship & Praise for Nigerian praise medleys and thanksgiving sessions.', 'streaming', 102, false, true, 'worship-praise'),
  ('live-worship', 'Live Worship', 'Preserved subcategory mapped to Worship & Praise and Live & Special Broadcasts.', 'streaming', 103, false, true, 'worship-praise'),
  ('prophetic-messages', 'Prophetic Messages', 'Preserved subcategory under Sermons & Teachings for prophetic words and new-month declarations.', 'streaming', 104, false, true, 'sermons-teachings'),
  ('bible-study', 'Bible Study', 'Preserved subcategory under Sermons & Teachings for verse-by-verse scriptural study and doctrine.', 'streaming', 105, false, true, 'sermons-teachings'),
  ('testimonies', 'Testimonies', 'Preserved subcategory under Christian Living for documented miracles, healings, and breakthroughs.', 'streaming', 106, false, true, 'christian-living'),
  ('christian-motivation', 'Christian Motivation', 'Preserved subcategory under Christian Living for faith, purpose, leadership, and personal development.', 'streaming', 107, false, true, 'christian-living')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  section = excluded.section,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  is_legacy_subcategory = excluded.is_legacy_subcategory,
  parent_category_slug = excluded.parent_category_slug;

-- ============================================================================
-- 12. SEED VERIFIED OFFICIAL MINISTERS, GOSPEL ARTISTS & MOVIE STUDIOS
-- ============================================================================
insert into public.channels (
  youtube_channel_id, title, handle, channel_type, is_nigerian, is_official_verified, default_category_slug, avatar_url, approval_status, priority_weight
)
values
  -- Nigerian Gospel Artists & Worship Leaders
  ('UCRe2Ir9wtPk_YQjElam7n2w', 'Nathaniel Bassey Main', '@NathanielBasseyMain', 'artist', true, true, 'deep-worship', 'https://unavatar.io/youtube/NathanielBasseyMain', 'approved', 1.50),
  ('UC9unpsMUkOGDIMraqBfZtYg', 'Dunsin Oyekan', '@DunsinOyekan', 'artist', true, true, 'deep-worship', 'https://unavatar.io/youtube/DunsinOyekan', 'approved', 1.50),
  ('UCv88VZJUuRoot7GfSO_sm-g', 'Moses Bliss', '@MosesBliss', 'artist', true, true, 'gospel-music', 'https://unavatar.io/youtube/MosesBliss', 'approved', 1.45),
  ('UC6fh2aHqQtqSwPdDtafewNw', 'SINACH', '@SINACH', 'artist', true, true, 'gospel-music', 'https://unavatar.io/youtube/SINACH', 'approved', 1.45),
  ('UCo9_ALYi0IYcMn7K84YFTzw', 'Victoria Orenze', '@VictoriaOrenze', 'artist', true, true, 'deep-worship', 'https://unavatar.io/youtube/VictoriaOrenze', 'approved', 1.45),
  ('UCQmRXe_YwIXaGcODToPXAEg', 'Official Judikay', '@OfficialJudikay', 'artist', true, true, 'gospel-music', 'https://unavatar.io/youtube/OfficialJudikay', 'approved', 1.40),
  ('UCNeLs83EPGjX8Pz7wsiBckw', 'Lawrence Oyor', '@LawrenceOyor', 'artist', true, true, 'deep-worship', 'https://unavatar.io/youtube/LawrenceOyor', 'approved', 1.40),
  ('UCAdAODvRZIWoY2RtdxdGyPA', 'Minister GUC', '@MinisterGUC', 'artist', true, true, 'deep-worship', 'https://unavatar.io/youtube/MinisterGUC', 'approved', 1.40),
  ('UCSso6ynLza_BKtcqMDzK-MQ', 'Tope Alabi Official', '@TopeAlabiOfficial', 'artist', true, true, 'praise-thanksgiving', 'https://unavatar.io/youtube/TopeAlabiOfficial', 'approved', 1.40),
  ('UCUGxX9TxsmjfqDbo4uPMQFg', 'Tim Godfrey World', '@TimGodfreyWorld', 'artist', true, true, 'praise-thanksgiving', 'https://unavatar.io/youtube/TimGodfreyWorld', 'approved', 1.38),
  ('UCuhIZxVdLucf3HUViYc0QZw', 'Official Eben', '@OfficialEben', 'artist', true, true, 'praise-thanksgiving', 'https://unavatar.io/youtube/OfficialEben', 'approved', 1.35),
  -- Nigerian Pastors, Ministers & Churches
  ('UCLg4NCAJxhIvD4IRV__LOFg', 'Pastor Jerry Eze (Streams of Joy / NSPPD)', '@PastorJerryEze', 'minister', true, true, 'prayer-spiritual-warfare', 'https://unavatar.io/youtube/PastorJerryEze', 'approved', 1.50),
  ('UCq2ueL6wl7slTuInRbFpe7w', 'Koinonia Global (Apostle Joshua Selman)', '@KoinoniaGlobal', 'minister', true, true, 'sermons-teachings', 'https://unavatar.io/youtube/KoinoniaGlobal', 'approved', 1.50),
  ('UCtLlKV4vUqcxezKOoeILs5Q', 'Dunamis TV (Dr. Pastor Paul Enenche)', '@DunamisTV', 'church', true, true, 'sermons-teachings', 'https://unavatar.io/youtube/DunamisTV', 'approved', 1.45),
  ('UC9Ofng8vkjfsEz-wM1QZ47Q', 'Pastor Kingsley Okonkwo', '@KingsleyOkonkwo', 'minister', true, true, 'marriage-relationships', 'https://unavatar.io/youtube/KingsleyOkonkwo', 'approved', 1.42),
  ('UCsVBRhKh9spV-YPTub0KcxQ', 'The Covenant Nation (Pastor Poju Oyemade)', '@TheCovenantNation', 'church', true, true, 'bible-study', 'https://unavatar.io/youtube/TheCovenantNation', 'approved', 1.40),
  ('UCALuqr8BQi_djTbgEL5yeGA', 'Harvesters TV (Pastor Bolaji Idowu)', '@HarvestersTV', 'church', true, true, 'sermons-teachings', 'https://unavatar.io/youtube/HarvestersTV', 'approved', 1.40),
  ('UCPhuaM6NfrnbClXi6aP5Npw', 'House On The Rock Church', '@HouseOnTheRockChurch', 'church', true, true, 'conferences-events', 'https://unavatar.io/youtube/HouseOnTheRockChurch', 'approved', 1.38),
  ('UCbgM7xAXYYB6eX_CipYlTQw', 'Dove Television (RCCG / Pastor E.A. Adeboye)', '@DoveTelevision', 'ministry', true, true, 'prophetic-messages', 'https://unavatar.io/youtube/DoveTelevision', 'approved', 1.42),
  -- International Worship
  ('UCSf-NCzjwcnXErUBW_qeFvA', 'Elevation Worship', '@ElevationWorship', 'artist', false, true, 'live-worship', 'https://unavatar.io/youtube/ElevationWorship', 'approved', 1.00),
  ('UCeFWKvh1eNWWOq5pq2Z4rYg', 'Maverick City Music', '@MaverickCityMusic', 'artist', false, true, 'live-worship', 'https://unavatar.io/youtube/MaverickCityMusic', 'approved', 1.00),
  -- Christian Movie, Bible Story, Animation & Cartoon Studios
  ('UCGyPHwlkRV_Ai7aLRXpXJow', 'Damilola Mike-Bamiloye (Mount Zion Movies)', '@DamilolaMike-Bamiloye', 'movie_studio', true, true, 'real-christian-movies', 'https://unavatar.io/youtube/DamilolaMike-Bamiloye', 'approved', 1.50),
  ('UCFV4M8KChgupV-ljIc6PFQA', 'Joshua Mike-Bamiloye (JayMikee / Mount Zion)', '@JayMikee', 'movie_studio', true, true, 'real-christian-movies', 'https://unavatar.io/youtube/JayMikee', 'approved', 1.48),
  ('UCS3HaOm0opcyM9i5RGeyO2A', 'The Winlos (Nigerian Christian Cinema)', '@TheWinlos', 'movie_studio', true, true, 'real-christian-movies', 'https://unavatar.io/youtube/TheWinlos', 'approved', 1.45),
  ('UCAq4l4wxdM-9NfUfJ9b3RiA', 'Vision Video (Christian Feature Films)', '@VisionVideo', 'movie_studio', false, true, 'real-christian-movies', 'https://unavatar.io/youtube/VisionVideo', 'approved', 1.25),
  ('UCQIjTyWmLEdsfqMQay0yGMA', 'Angel Studios', '@AngelStudiosInc', 'movie_studio', false, true, 'real-christian-movies', 'https://unavatar.io/youtube/AngelStudiosInc', 'approved', 1.25),
  ('UCBXOFnNTULFaAnj24PAeblg', 'The Chosen (Biblical Drama Series)', '@TheChosenSeries', 'movie_studio', false, true, 'bible-stories', 'https://unavatar.io/youtube/TheChosenSeries', 'approved', 1.35),
  ('UC1rWz3q1j8w6XLd09V57PLQ', 'Messages of Christ (Biblical History & Stories)', '@MessagesofChrist', 'movie_studio', false, true, 'bible-stories', 'https://unavatar.io/youtube/MessagesofChrist', 'approved', 1.25),
  ('UCVfwlh9XpX2Y_tQfjeln9QA', 'BibleProject (Animated Biblical Narratives)', '@bibleproject', 'animation_studio', false, true, 'christian-animations', 'https://unavatar.io/youtube/bibleproject', 'approved', 1.35),
  ('UCmkgg5el8Fg3IX_baZyfSaQ', 'Superbook Official (3D Bible Animations)', '@SuperbookTV', 'animation_studio', false, true, 'christian-animations', 'https://unavatar.io/youtube/SuperbookTV', 'approved', 1.30),
  ('UCTlThMcv2OFj7KfbOFhLrvg', 'Sharefaith Kids (Bible Story Cartoons)', '@SharefaithKids', 'animation_studio', false, true, 'bible-story-cartoons', 'https://unavatar.io/youtube/SharefaithKids', 'approved', 1.35),
  ('UC_oVYDT613F6viE3JENV-Yg', 'Minno - Bible Stories for Kids', '@MinnoKids', 'animation_studio', false, true, 'bible-story-cartoons', 'https://unavatar.io/youtube/MinnoKids', 'approved', 1.30),
  ('UCEbM1vIWVubIANRR54YuS0g', 'Saddleback Kids (Bible Cartoons)', '@SaddlebackKids', 'animation_studio', false, true, 'bible-story-cartoons', 'https://unavatar.io/youtube/SaddlebackKids', 'approved', 1.25),
  ('UC8P8LsgyUwiBNBFZ4GEUbEw', 'PursueGOD Kids (Bible Story Cartoons)', '@PursueGODKids', 'animation_studio', false, true, 'bible-story-cartoons', 'https://unavatar.io/youtube/PursueGODKids', 'approved', 1.25)
on conflict (youtube_channel_id) do update set
  title = excluded.title,
  handle = excluded.handle,
  channel_type = excluded.channel_type,
  is_nigerian = excluded.is_nigerian,
  default_category_slug = excluded.default_category_slug,
  priority_weight = excluded.priority_weight;

-- ============================================================================
-- 13. ENABLE SUPABASE REALTIME PUBLICATIONS (IDEMPOTENT)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'video_comments'
  ) then
    alter publication supabase_realtime add table public.video_comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prayer_requests'
  ) then
    alter publication supabase_realtime add table public.prayer_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'prayer_encouragements'
  ) then
    alter publication supabase_realtime add table public.prayer_encouragements;
  end if;
end $$;

-- ============================================================================
-- 14. LIVE BROADCAST REMINDER SUBSCRIPTIONS (WEB PUSH, EMAIL & WHATSAPP)
--     & CLOUD DISCOVERED VIDEOS PERSISTENCE (FOR CLOUDFLARE PAGES + SUPABASE)
-- ============================================================================
create table if not exists public.broadcast_reminders (
  id uuid primary key default gen_random_uuid(),
  subscriber_key text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
  email text default '',
  whatsapp_phone text default '',
  web_push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  advance_minutes integer not null default 10,
  program_ids text[] not null default '{"sched-nsppd","sched-hallelujah-challenge"}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.discovered_videos (
  youtube_video_id text primary key,
  video_payload jsonb not null,
  primary_category_slug text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'broadcast_reminders'
  ) then
    alter publication supabase_realtime add table public.broadcast_reminders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'discovered_videos'
  ) then
    alter publication supabase_realtime add table public.discovered_videos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fellowship_room_messages'
  ) then
    alter publication supabase_realtime add table public.fellowship_room_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_messages'
  ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end $$;

-- ============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES FOR CLOUDFLARE PAGES & STATIC CLIENTS
-- ============================================================================

-- Enable RLS on all 19 tables
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.watch_history enable row level security;
alter table public.saved_videos enable row level security;
alter table public.video_comments enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.fellowship_room_messages enable row level security;
alter table public.community_messages enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_encouragements enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.youtube_api_logs enable row level security;
alter table public.broadcast_reminders enable row level security;
alter table public.discovered_videos enable row level security;

-- Idempotent RLS Policies: Drop existing if present, then recreate cleanly
drop policy if exists "Public profiles read" on public.profiles;
create policy "Public profiles read" on public.profiles for select using (true);
drop policy if exists "Public profiles insert" on public.profiles;
create policy "Public profiles insert" on public.profiles for insert with check (true);
drop policy if exists "Public profiles update" on public.profiles;
create policy "Public profiles update" on public.profiles for update using (true);

drop policy if exists "Public categories read" on public.categories;
create policy "Public categories read" on public.categories for select using (true);
drop policy if exists "Categories manage" on public.categories;
create policy "Categories manage" on public.categories for all using (true) with check (true);

drop policy if exists "Public channels read" on public.channels;
create policy "Public channels read" on public.channels for select using (true);
drop policy if exists "Channels manage" on public.channels;
create policy "Channels manage" on public.channels for all using (true) with check (true);

drop policy if exists "Public videos read" on public.videos;
create policy "Public videos read" on public.videos for select using (true);
drop policy if exists "Videos manage" on public.videos;
create policy "Videos manage" on public.videos for all using (true) with check (true);

drop policy if exists "Watch history manage" on public.watch_history;
create policy "Watch history manage" on public.watch_history for all using (true) with check (true);

drop policy if exists "Saved videos manage" on public.saved_videos;
create policy "Saved videos manage" on public.saved_videos for all using (true) with check (true);

drop policy if exists "Video comments read" on public.video_comments;
create policy "Video comments read" on public.video_comments for select using (true);
drop policy if exists "Video comments manage" on public.video_comments;
create policy "Video comments manage" on public.video_comments for all using (true) with check (true);

drop policy if exists "User follows manage" on public.user_follows;
create policy "User follows manage" on public.user_follows for all using (true) with check (true);

drop policy if exists "User blocks manage" on public.user_blocks;
create policy "User blocks manage" on public.user_blocks for all using (true) with check (true);

drop policy if exists "Conversations manage" on public.conversations;
create policy "Conversations manage" on public.conversations for all using (true) with check (true);

drop policy if exists "Direct messages manage" on public.direct_messages;
create policy "Direct messages manage" on public.direct_messages for all using (true) with check (true);

drop policy if exists "Fellowship room messages read" on public.fellowship_room_messages;
create policy "Fellowship room messages read" on public.fellowship_room_messages for select using (true);
drop policy if exists "Fellowship room messages manage" on public.fellowship_room_messages;
create policy "Fellowship room messages manage" on public.fellowship_room_messages for all using (true) with check (true);

drop policy if exists "Community messages read" on public.community_messages;
create policy "Community messages read" on public.community_messages for select using (true);
drop policy if exists "Community messages manage" on public.community_messages;
create policy "Community messages manage" on public.community_messages for all using (true) with check (true);

drop policy if exists "Prayer requests read" on public.prayer_requests;
create policy "Prayer requests read" on public.prayer_requests for select using (true);
drop policy if exists "Prayer requests manage" on public.prayer_requests;
create policy "Prayer requests manage" on public.prayer_requests for all using (true) with check (true);

drop policy if exists "Prayer encouragements read" on public.prayer_encouragements;
create policy "Prayer encouragements read" on public.prayer_encouragements for select using (true);
drop policy if exists "Prayer encouragements manage" on public.prayer_encouragements;
create policy "Prayer encouragements manage" on public.prayer_encouragements for all using (true) with check (true);

drop policy if exists "Moderation reports manage" on public.moderation_reports;
create policy "Moderation reports manage" on public.moderation_reports for all using (true) with check (true);

drop policy if exists "YouTube API logs manage" on public.youtube_api_logs;
create policy "YouTube API logs manage" on public.youtube_api_logs for all using (true) with check (true);

drop policy if exists "Broadcast reminders manage" on public.broadcast_reminders;
create policy "Broadcast reminders manage" on public.broadcast_reminders for all using (true) with check (true);

drop policy if exists "Discovered videos read" on public.discovered_videos;
create policy "Discovered videos read" on public.discovered_videos for select using (true);
drop policy if exists "Discovered videos manage" on public.discovered_videos;
create policy "Discovered videos manage" on public.discovered_videos for all using (true) with check (true);

-- ============================================================================
-- 16. REAL HUMAN VISITOR ANALYTICS BY COUNTRY (CLOUDFLARE CF-IPCOUNTRY + SUPABASE)
--     Privacy-friendly: stores zero raw IP addresses or personal details
-- ============================================================================
create table if not exists public.visitor_pageviews (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  session_id text not null,
  country_code text not null default 'XX',
  country_name text not null default 'Unknown',
  city text not null default '',
  region text not null default '',
  page_path text not null default '/',
  page_view text not null default 'streaming',
  referrer_host text not null default '',
  device_type text not null default 'desktop',
  created_at timestamptz not null default now()
);

create index if not exists idx_visitor_pageviews_created_at
  on public.visitor_pageviews(created_at desc);
create index if not exists idx_visitor_pageviews_country
  on public.visitor_pageviews(country_code, created_at desc);
create index if not exists idx_visitor_pageviews_visitor
  on public.visitor_pageviews(visitor_id, created_at desc);

alter table public.visitor_pageviews enable row level security;

drop policy if exists "Visitor pageviews insert" on public.visitor_pageviews;
create policy "Visitor pageviews insert" on public.visitor_pageviews for insert with check (true);
drop policy if exists "Visitor pageviews read" on public.visitor_pageviews;
create policy "Visitor pageviews read" on public.visitor_pageviews for select using (true);


