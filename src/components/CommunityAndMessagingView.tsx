import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  BookOpen,
  Check,
  Flag,
  Flame,
  Hash,
  Heart,
  HeartHandshake,
  MapPin,
  MessageSquare,
  Music,
  Paperclip,
  Plus,
  Search,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Conversation,
  DirectMessage,
  EventAttachment,
  FellowshipRoomId,
  FellowshipRoomMessage,
  UserProfile,
} from '../types/kingdom.ts';
import { formatRelativeDate, getBrowserSupabaseClient } from '../utils/formatters.ts';
import { useDataSaver } from '../hooks/useDataSaver.ts';
import { getDailyAltarProgress } from '../utils/dailyAltar.ts';
import { emitAppToast } from '../utils/shareVideo.ts';
import { normalizeOutgoingAttachment } from '../utils/attachmentHelper.ts';
import { EventAttachmentCard, EventAttachmentComposer } from './EventAttachmentUI.tsx';

export type CommunitySubTab = 'rooms' | 'messages' | 'directory';

interface CommunityAndMessagingViewProps {
  currentUser: UserProfile | null;
  authToken: string | null;
  onRequireAuth: () => void;
  initialSubTab?: CommunitySubTab;
}

interface FellowshipRoomConfig {
  id: FellowshipRoomId;
  name: string;
  tagline: string;
  welcomeNote: string;
  icon: 'flame' | 'heart' | 'music' | 'book' | 'hands';
}

const FELLOWSHIP_ROOMS: FellowshipRoomConfig[] = [
  {
    id: 'morning-altar',
    name: 'Morning Altar Partners',
    tagline: 'NSPPD, NLP & early morning prayer accountability',
    welcomeNote: 'Share prayer points, morning declarations, and encourage fellow early-risers.',
    icon: 'flame',
  },
  {
    id: 'singles-marriage',
    name: 'Singles, Courtship & Marriage',
    tagline: 'Godly relationships, wisdom & building strong homes',
    welcomeNote: 'Discuss Christian courtship, marriage teachings, and pray for godly families.',
    icon: 'heart',
  },
  {
    id: 'worshippers-choir',
    name: 'Worshippers & Gospel Music',
    tagline: 'Soaking worship, favorite hymns & praise sessions',
    welcomeNote: 'Share songs lifting your spirit today or connect with fellow worshippers.',
    icon: 'music',
  },
  {
    id: 'bible-study-purpose',
    name: 'Bible Study & Purpose',
    tagline: 'Scripture insights, career wisdom & spiritual growth',
    welcomeNote: 'Ask Bible questions, share sermon takeaways, and grow together in the Word.',
    icon: 'book',
  },
  {
    id: 'intercessors',
    name: 'Intercessors Watch',
    tagline: 'Standing in the gap for families, nations & healing',
    welcomeNote: 'Join saints around the world interceding for revival, peace, and breakthroughs.',
    icon: 'hands',
  },
];

const LOCAL_ROOMS_KEY_PREFIX = 'kingdom_plus_room_msgs_v1_';
const LOCAL_DM_KEY_PREFIX = 'kingdom_plus_dm_thread_v1_';

function getSupabaseClient() {
  if (typeof window === 'undefined') return null;
  const url =
    (window as any).__KINGDOM_SUPABASE_URL__ ||
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    'https://hswbafspnhgojjuyhnqa.supabase.co';
  const key =
    (window as any).__KINGDOM_SUPABASE_KEY__ ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_mscwd1aUENWUlwyCkm9aFg_CNXyRyfG';
  return getBrowserSupabaseClient(url, key);
}

function getRoomIcon(icon: FellowshipRoomConfig['icon']) {
  switch (icon) {
    case 'flame':
      return <Flame className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'heart':
      return <Heart className="w-4 h-4 text-rose-400 shrink-0" />;
    case 'music':
      return <Music className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'book':
      return <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />;
    default:
      return <HeartHandshake className="w-4 h-4 text-amber-300 shrink-0" />;
  }
}

export const CommunityAndMessagingView: React.FC<CommunityAndMessagingViewProps> = ({
  currentUser,
  authToken,
  onRequireAuth,
  initialSubTab = 'rooms',
}) => {
  const { isDataSaverActive } = useDataSaver();
  const [activeSubTab, setActiveSubTab] = useState<CommunitySubTab>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Members & Connections
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);
  const [filterConnectedOnly, setFilterConnectedOnly] = useState(false);

  // Fellowship Rooms (Group Chats)
  const [selectedRoomId, setSelectedRoomId] = useState<FellowshipRoomId | null>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'morning-altar' : null
  );
  const [roomMessages, setRoomMessages] = useState<FellowshipRoomMessage[]>([]);
  const [roomSummary, setRoomSummary] = useState<
    Record<string, { count: number; lastMessageAt: string | null }>
  >({});
  const [roomMessageInput, setRoomMessageInput] = useState('');
  const [showRoomAttachmentTray, setShowRoomAttachmentTray] = useState(false);
  const [draftRoomAttachment, setDraftRoomAttachment] = useState<Partial<EventAttachment>>({});
  const [sendingRoomMsg, setSendingRoomMsg] = useState(false);
  const roomMessagesEndRef = useRef<HTMLDivElement>(null);

  // Private Messaging (1-on-1)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [showDmAttachmentTray, setShowDmAttachmentTray] = useState(false);
  const [draftDmAttachment, setDraftDmAttachment] = useState<Partial<EventAttachment>>({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [showNewChatPicker, setShowNewChatPicker] = useState(false);
  const dmEndRef = useRef<HTMLDivElement>(null);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');

  // Latest-state refs so persistent WebSocket & Realtime callbacks never read stale closures
  const currentUserRef = useRef(currentUser);
  const authTokenRef = useRef(authToken);
  const selectedRecipientRef = useRef(selectedRecipient);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const activeSubTabRef = useRef(activeSubTab);
  const membersRef = useRef(members);
  const conversationsRef = useRef(conversations);

  const wsRef = useRef<WebSocket | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const supabaseSubscribedRef = useRef(false);
  const wsConnectedRef = useRef(false);
  const wsUnavailableOnHostRef = useRef(false);
  const hasEverOpenedWsRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const processedDmIdsRef = useRef<Set<string>>(new Set());
  const processedRoomMsgIdsRef = useRef<Set<string>>(new Set());

  const syncTransportStatus = () => {
    if (wsConnectedRef.current || supabaseSubscribedRef.current) {
      setWsStatus('live');
    } else if (wsUnavailableOnHostRef.current) {
      setWsStatus('connecting');
    } else {
      setWsStatus('reconnecting');
    }
  };

  const broadcastRealtimeEvent = (eventName: string, payload: Record<string, any>) => {
    const ch = supabaseChannelRef.current;
    if (!ch) return;
    try {
      Promise.resolve(
        ch.send({
          type: 'broadcast',
          event: eventName,
          payload,
        })
      ).catch(() => {});
    } catch {}
  };

  const ensureSupabaseProfileExists = async (sb: any, profile: UserProfile): Promise<string> => {
    if (!sb || !profile?.id) return profile?.id || '';
    try {
      const { data: byId } = await sb
        .from('profiles')
        .select('id')
        .eq('id', profile.id)
        .limit(1);
      if (Array.isArray(byId) && byId[0]?.id) return byId[0].id;

      const normalizedEmail = (profile.email || '').trim().toLowerCase();
      if (normalizedEmail) {
        const { data: byEmail } = await sb
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .limit(1);
        if (Array.isArray(byEmail) && byEmail[0]?.id) return byEmail[0].id;
      }

      const { error: upsertErr } = await sb.from('profiles').upsert(
        {
          id: profile.id,
          email: normalizedEmail || `${profile.id}@kingdom.local`,
          full_name: profile.full_name || 'Believer',
          username: profile.username || profile.id.slice(0, 12),
          avatar_url: profile.avatar_url || '',
          bio: profile.bio || '',
          location: profile.location || 'Nigeria',
          denomination_or_church: profile.denomination_or_church || '',
          role: profile.role || 'member',
          is_suspended: Boolean(profile.is_suspended),
          is_online: Boolean(profile.is_online),
          last_seen_at: profile.last_seen_at || new Date().toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (upsertErr && normalizedEmail) {
        const { data: retryByEmail } = await sb
          .from('profiles')
          .select('id')
          .eq('email', normalizedEmail)
          .limit(1);
        if (Array.isArray(retryByEmail) && retryByEmail[0]?.id) return retryByEmail[0].id;
      }
    } catch {}
    return profile.id;
  };

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);
  useEffect(() => {
    selectedRecipientRef.current = selectedRecipient;
  }, [selectedRecipient]);
  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);
  useEffect(() => {
    activeSubTabRef.current = activeSubTab;
  }, [activeSubTab]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const myStreak = useMemo(
    () => (currentUser ? getDailyAltarProgress(currentUser.id).currentStreak : 0),
    [currentUser?.id, activeSubTab]
  );

  const showNotice = (text: string) => {
    setStatusNotice(text);
    window.setTimeout(() => setStatusNotice(null), 3500);
  };

  const buildAuthHeaders = (includeJson = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    const activeToken = authTokenRef.current;
    const activeUser = currentUserRef.current;
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (activeToken) headers.Authorization = `Bearer ${activeToken}`;
    if (activeUser?.id) headers['X-Kingdom-User-Id'] = activeUser.id;
    if (activeUser?.email) headers['X-Kingdom-User-Email'] = activeUser.email;
    return headers;
  };

  const buildSyntheticProfile = (userId: string): UserProfile => ({
    id: userId,
    email: '',
    full_name: 'KINGDOM+ Member',
    username: userId.slice(0, 12),
    bio: '',
    location: 'Global',
    denomination_or_church: '',
    role: 'member',
    is_suspended: false,
    is_online: false,
    last_seen_at: new Date().toISOString(),
    preferences: { favoriteCategories: [], favoriteMinisters: [] },
    created_at: new Date().toISOString(),
  });

  // Fetch Members (Server API + Supabase fallback merge so live online status works everywhere)
  const fetchCommunityData = async () => {
    let loadedMembers: UserProfile[] = [];
    let gotServerFollowing = false;
    const nowMs = Date.now();
    const ONLINE_WINDOW_MS = 3 * 60 * 1000;

    try {
      const res = await fetch('/api/community/members', { headers: buildAuthHeaders(false) });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.members)) loadedMembers = data.members;
        if (Array.isArray(data.followingIds)) {
          setFollowingIds(data.followingIds);
          gotServerFollowing = true;
          if (currentUser) {
            try {
              localStorage.setItem(
                `kingdom_plus_following_${currentUser.id}`,
                JSON.stringify(data.followingIds)
              );
            } catch {}
          }
        }
        if (Array.isArray(data.blockedIds)) setBlockedIds(data.blockedIds);
      }
    } catch {}

    // Also merge fresher Supabase profiles if available (covers static / multi-device cloud signups)
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: sbProfiles } = await sb
          .from('profiles')
          .select('*')
          .eq('is_suspended', false)
          .limit(150);
        if (Array.isArray(sbProfiles)) {
          for (const raw of sbProfiles as UserProfile[]) {
            if (!raw?.id) continue;
            const isRecent =
              Boolean(raw.is_online) &&
              nowMs - new Date(raw.last_seen_at || 0).getTime() < ONLINE_WINDOW_MS;
            const normalized: UserProfile = { ...raw, is_online: isRecent };
            const existingIdx = loadedMembers.findIndex(
              (m) =>
                m.id === normalized.id ||
                (m.email && normalized.email && m.email.toLowerCase() === normalized.email.toLowerCase())
            );
            if (existingIdx === -1) {
              loadedMembers.push(normalized);
            } else {
              const prevMs = new Date(loadedMembers[existingIdx].last_seen_at || 0).getTime();
              const nextMs = new Date(normalized.last_seen_at || 0).getTime();
              if (nextMs > prevMs) {
                loadedMembers[existingIdx] = {
                  ...loadedMembers[existingIdx],
                  is_online: normalized.is_online,
                  last_seen_at: normalized.last_seen_at,
                };
              }
            }
          }
        }

        if (!gotServerFollowing && currentUser) {
          const { data: sbFollows } = await sb
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', currentUser.id);
          if (Array.isArray(sbFollows)) {
            setFollowingIds(sbFollows.map((r: any) => r.following_id).filter(Boolean));
            gotServerFollowing = true;
          }
        }
      }
    } catch {}

    if (!gotServerFollowing && currentUser) {
      try {
        const cached = localStorage.getItem(`kingdom_plus_following_${currentUser.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setFollowingIds(parsed);
        }
      } catch {}
    }

    if (currentUser) {
      const selfIdx = loadedMembers.findIndex(
        (m) =>
          m.id === currentUser.id ||
          (m.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
      );
      const selfOnline = {
        ...currentUser,
        is_online: true,
        last_seen_at: new Date().toISOString(),
      };
      if (selfIdx === -1) {
        loadedMembers = [selfOnline, ...loadedMembers];
      } else {
        loadedMembers[selfIdx] = { ...loadedMembers[selfIdx], is_online: true };
      }
    }

    if (loadedMembers.length > 0) {
      setMembers(loadedMembers);
      setSelectedRecipient((prev) => {
        if (!prev) return prev;
        const fresh = loadedMembers.find((m) => m.id === prev.id);
        return fresh ? { ...prev, is_online: fresh.is_online, last_seen_at: fresh.last_seen_at } : prev;
      });
    }
  };

  const fetchRoomSummary = async () => {
    if (!wsUnavailableOnHostRef.current) {
      try {
        const res = await fetch('/api/community/rooms/summary');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data?.summary) {
            setRoomSummary(data.summary);
            return;
          }
        }
      } catch {}
    }

    // Cloudflare Pages / static Supabase fallback
    try {
      const sb = getSupabaseClient();
      if (!sb) return;
      const { data: rows, error } = await sb
        .from('fellowship_room_messages')
        .select('room_id, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && Array.isArray(rows)) {
        const summary: Record<string, { count: number; lastMessageAt: string | null }> = {};
        for (const r of FELLOWSHIP_ROOMS) {
          summary[r.id] = { count: 0, lastMessageAt: null };
        }
        for (const row of rows as Array<{ room_id?: string; created_at?: string }>) {
          if (!row?.room_id) continue;
          if (!summary[row.room_id]) {
            summary[row.room_id] = { count: 0, lastMessageAt: null };
          }
          summary[row.room_id].count += 1;
          if (!summary[row.room_id].lastMessageAt && row.created_at) {
            summary[row.room_id].lastMessageAt = row.created_at;
          }
        }
        setRoomSummary(summary);
      }
    } catch {}
  };

  const fetchRoomMessages = async (roomId: FellowshipRoomId) => {
    if (!wsUnavailableOnHostRef.current) {
      try {
        const res = await fetch(`/api/community/rooms/${roomId}/messages`);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setRoomMessages(data.messages);
            try {
              localStorage.setItem(`${LOCAL_ROOMS_KEY_PREFIX}${roomId}`, JSON.stringify(data.messages));
            } catch {}
            return;
          }
        }
      } catch {}
    }

    // Cloudflare Pages / static Supabase fallback
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: sbMsgs, error } = await sb
          .from('fellowship_room_messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(100);
        if (!error && Array.isArray(sbMsgs)) {
          const normalized: FellowshipRoomMessage[] = sbMsgs.map((r: any) => ({
            id: r.id,
            room_id: r.room_id,
            user_id: r.user_id,
            user_full_name: r.user_full_name || 'Believer',
            user_username: r.user_username || 'member',
            user_location: r.user_location || 'Nigeria',
            content: r.content || '',
            ...(r.attachment ? { attachment: r.attachment } : {}),
            amen_user_ids: Array.isArray(r.amen_user_ids) ? r.amen_user_ids : [],
            created_at: r.created_at || new Date().toISOString(),
          }));
          setRoomMessages((prev) => {
            if (selectedRoomIdRef.current !== roomId) return prev;
            const byId = new Map<string, FellowshipRoomMessage>();
            for (const m of normalized) byId.set(m.id, m);
            for (const m of prev) {
              if (!byId.has(m.id) && m.room_id === roomId) byId.set(m.id, m);
            }
            const merged = Array.from(byId.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            try {
              localStorage.setItem(`${LOCAL_ROOMS_KEY_PREFIX}${roomId}`, JSON.stringify(merged));
            } catch {}
            return merged;
          });
          return;
        }
      }
    } catch {}

    try {
      const raw = localStorage.getItem(`${LOCAL_ROOMS_KEY_PREFIX}${roomId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRoomMessages(parsed);
      }
    } catch {}
  };

  const fetchConversations = async () => {
    const activeUser = currentUserRef.current;
    if (!activeUser) return;
    if (!wsUnavailableOnHostRef.current) {
      try {
        const res = await fetch('/api/messages/conversations', {
          headers: buildAuthHeaders(false),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.conversations)) {
            setConversations(data.conversations);
            return;
          }
        }
      } catch {}
    }

    // Cloudflare Pages / static Supabase fallback
    try {
      const sb = getSupabaseClient();
      if (!sb) return;
      const { data: sbConvs } = await sb
        .from('conversations')
        .select('*')
        .or(`participant_one_id.eq.${activeUser.id},participant_two_id.eq.${activeUser.id}`)
        .order('last_message_at', { ascending: false })
        .limit(100);
      if (Array.isArray(sbConvs)) {
        const convIds = sbConvs.map((c: any) => c.id).filter(Boolean);
        const otherIds = Array.from(
          new Set(
            sbConvs
              .map((c: any) =>
                c.participant_one_id === activeUser.id ? c.participant_two_id : c.participant_one_id
              )
              .filter(Boolean)
          )
        );

        const profileMap = new Map<string, UserProfile>();
        for (const m of membersRef.current) profileMap.set(m.id, m);
        const missingIds = otherIds.filter((id) => !profileMap.has(id));
        if (missingIds.length > 0) {
          const { data: sbProfiles } = await sb
            .from('profiles')
            .select('*')
            .in('id', missingIds);
          if (Array.isArray(sbProfiles)) {
            const nowMs = Date.now();
            for (const p of sbProfiles as UserProfile[]) {
              if (!p?.id) continue;
              const isRecent =
                Boolean(p.is_online) &&
                nowMs - new Date(p.last_seen_at || 0).getTime() < 3 * 60 * 1000;
              profileMap.set(p.id, { ...p, is_online: isRecent });
            }
          }
        }

        const unreadByConv = new Map<string, number>();
        if (convIds.length > 0) {
          const { data: unreadRows } = await sb
            .from('direct_messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .eq('is_read', false)
            .neq('sender_id', activeUser.id);
          if (Array.isArray(unreadRows)) {
            for (const row of unreadRows as Array<{ conversation_id?: string }>) {
              if (row?.conversation_id) {
                unreadByConv.set(
                  row.conversation_id,
                  (unreadByConv.get(row.conversation_id) || 0) + 1
                );
              }
            }
          }
        }

        const hydrated: Conversation[] = sbConvs.map((c: any) => {
          const otherId =
            c.participant_one_id === activeUser.id
              ? c.participant_two_id
              : c.participant_one_id;
          const other = profileMap.get(otherId) || buildSyntheticProfile(otherId);
          return {
            ...c,
            other_participant: other,
            unread_count: unreadByConv.get(c.id) || 0,
          };
        });
        setConversations(hydrated);
      }
    } catch {}
  };

  const fetchMessagesForRecipient = async (recipientId: string) => {
    const activeUser = currentUserRef.current;
    if (!activeUser) return;
    if (!wsUnavailableOnHostRef.current) {
      try {
        const res = await fetch(`/api/messages/${recipientId}`, {
          headers: buildAuthHeaders(false),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            const serverMsgs: DirectMessage[] = data.messages;
            const serverConvId = data.conversationId || serverMsgs[0]?.conversation_id || null;
            setMessages((prev) => {
              if (selectedRecipientRef.current?.id !== recipientId) return prev;
              const byId = new Map<string, DirectMessage>();
              for (const m of serverMsgs) byId.set(m.id, m);
              for (const m of prev) {
                if (!byId.has(m.id) && (!serverConvId || m.conversation_id === serverConvId)) {
                  byId.set(m.id, m);
                }
              }
              const merged = Array.from(byId.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              try {
                const key = `${LOCAL_DM_KEY_PREFIX}${[activeUser.id, recipientId].sort().join('_')}`;
                localStorage.setItem(key, JSON.stringify(merged));
              } catch {}
              return merged;
            });
            setConversations((prev) =>
              prev.map((c) =>
                c.other_participant?.id === recipientId ? { ...c, unread_count: 0 } : c
              )
            );
            return;
          }
        }
      } catch {}
    }

    // Cloudflare Pages / static Supabase fallback
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: sbConvRows, error: convErr } = await sb
          .from('conversations')
          .select('*')
          .or(
            `and(participant_one_id.eq.${activeUser.id},participant_two_id.eq.${recipientId}),and(participant_one_id.eq.${recipientId},participant_two_id.eq.${activeUser.id})`
          )
          .order('last_message_at', { ascending: false })
          .limit(1);

        const sbConv = Array.isArray(sbConvRows) ? sbConvRows[0] : null;
        if (convErr || !sbConv?.id) {
          if (!convErr && selectedRecipientRef.current?.id === recipientId) {
            try {
              const key = `${LOCAL_DM_KEY_PREFIX}${[activeUser.id, recipientId].sort().join('_')}`;
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  setMessages(parsed);
                  return;
                }
              }
            } catch {}
            setMessages([]);
          }
          return;
        }

        const { data: sbMsgs, error } = await sb
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', sbConv.id)
          .order('created_at', { ascending: true })
          .limit(200);

        if (!error && Array.isArray(sbMsgs)) {
          const normalized: DirectMessage[] = sbMsgs.map((m: any) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            content: m.content || '',
            ...(m.attachment ? { attachment: m.attachment } : {}),
            is_read: Boolean(m.is_read),
            ...(m.read_at ? { read_at: m.read_at } : {}),
            created_at: m.created_at || new Date().toISOString(),
          }));

          const hasUnreadFromOther = normalized.some(
            (m) => m.sender_id === recipientId && !m.is_read
          );
          if (hasUnreadFromOther) {
            const readIso = new Date().toISOString();
            Promise.resolve(
              sb.from('direct_messages')
                .update({ is_read: true, read_at: readIso })
                .eq('conversation_id', sbConv.id)
                .eq('sender_id', recipientId)
                .eq('is_read', false)
            )
              .then(() => {
                broadcastRealtimeEvent('dm:read', {
                  conversationId: sbConv.id,
                  readerId: activeUser.id,
                });
              })
              .catch(() => {});
          }

          setMessages((prev) => {
            if (selectedRecipientRef.current?.id !== recipientId) return prev;
            const byId = new Map<string, DirectMessage>();
            for (const m of normalized) byId.set(m.id, m);
            for (const m of prev) {
              if (!byId.has(m.id) && m.conversation_id === sbConv.id) {
                byId.set(m.id, m);
              }
            }
            const merged = Array.from(byId.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            try {
              const key = `${LOCAL_DM_KEY_PREFIX}${[activeUser.id, recipientId].sort().join('_')}`;
              localStorage.setItem(key, JSON.stringify(merged));
            } catch {}
            return merged;
          });
          setConversations((prev) =>
            prev.map((c) =>
              c.id === sbConv.id || c.other_participant?.id === recipientId
                ? { ...c, unread_count: 0 }
                : c
            )
          );
          return;
        }
      }
    } catch {}

    // Offline cache fallback
    try {
      const key = `${LOCAL_DM_KEY_PREFIX}${[activeUser.id, recipientId].sort().join('_')}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed);
      } else {
        setMessages([]);
      }
    } catch {}
  };

  // Idempotent handler for incoming Direct Messages (via WebSocket or Supabase Realtime)
  const applyIncomingDirectMessage = (
    incomingMsg: DirectMessage,
    incomingConv?: Partial<Conversation> | null,
    incomingSender?: UserProfile | null
  ) => {
    const me = currentUserRef.current;
    if (!me || !incomingMsg?.id) return;

    const otherId =
      incomingMsg.sender_id === me.id
        ? incomingConv
          ? incomingConv.participant_one_id === me.id
            ? incomingConv.participant_two_id
            : incomingConv.participant_one_id
          : selectedRecipientRef.current?.id
        : incomingMsg.sender_id;

    if (!otherId) return;

    const activeRecip = selectedRecipientRef.current;
    const isViewingThisThread = Boolean(activeRecip && activeRecip.id === otherId);
    const isFocusedOnThread = Boolean(
      isViewingThisThread && activeSubTabRef.current === 'messages' && !document.hidden
    );

    if (isViewingThisThread) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        const next = [...prev, incomingMsg];
        try {
          const key = `${LOCAL_DM_KEY_PREFIX}${[me.id, otherId].sort().join('_')}`;
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Acknowledge read status immediately when chat is open & visible (Node or Cloudflare Supabase)
      if (incomingMsg.sender_id !== me.id && isFocusedOnThread) {
        if (!wsUnavailableOnHostRef.current) {
          fetch(`/api/messages/${otherId}`, {
            headers: buildAuthHeaders(false),
          }).catch(() => {});
        } else {
          const sb = getSupabaseClient();
          if (sb && incomingMsg.conversation_id) {
            Promise.resolve(
              sb.from('direct_messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', incomingMsg.id)
            )
              .then(() => {
                broadcastRealtimeEvent('dm:read', {
                  conversationId: incomingMsg.conversation_id,
                  readerId: me.id,
                });
              })
              .catch(() => {});
          }
        }
      }
    }

    const isFirstTimeSeen = !processedDmIdsRef.current.has(incomingMsg.id);
    processedDmIdsRef.current.add(incomingMsg.id);
    if (processedDmIdsRef.current.size > 500) {
      const oldest = processedDmIdsRef.current.values().next().value;
      if (oldest) processedDmIdsRef.current.delete(oldest);
    }

    const previewText =
      incomingMsg.content ||
      (incomingMsg.attachment?.event_title
        ? `Event: ${incomingMsg.attachment.event_title}`
        : 'Attached an event flyer');
    const shouldIncrementUnread =
      isFirstTimeSeen && incomingMsg.sender_id !== me.id && !isFocusedOnThread;

    const resolvedOther: UserProfile =
      (incomingSender && incomingSender.id === otherId ? incomingSender : null) ||
      membersRef.current.find((m) => m.id === otherId) ||
      conversationsRef.current.find((c) => c.other_participant?.id === otherId)?.other_participant ||
      buildSyntheticProfile(otherId);

    setConversations((prev) => {
      const idx = prev.findIndex(
        (c) =>
          c.id === incomingMsg.conversation_id ||
          c.other_participant?.id === otherId
      );
      let next: Conversation[];
      if (idx === -1) {
        const created: Conversation = {
          id: incomingMsg.conversation_id,
          participant_one_id: incomingConv?.participant_one_id || incomingMsg.sender_id,
          participant_two_id: incomingConv?.participant_two_id || otherId,
          last_message_text: previewText,
          last_message_at: incomingMsg.created_at,
          unread_count: shouldIncrementUnread ? 1 : 0,
          other_participant: resolvedOther,
        };
        next = [created, ...prev];
      } else {
        const existing = prev[idx];
        const updated: Conversation = {
          ...existing,
          last_message_text: previewText,
          last_message_at: incomingMsg.created_at,
          unread_count: isFocusedOnThread
            ? 0
            : (existing.unread_count || 0) + (shouldIncrementUnread ? 1 : 0),
          other_participant: existing.other_participant || resolvedOther,
        };
        next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      return next.sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    });

    if (shouldIncrementUnread) {
      emitAppToast(`New message from ${resolvedOther.full_name}: ${previewText.slice(0, 60)}`);
    }
  };

  // Idempotent handler for incoming Fellowship Room messages
  const applyIncomingRoomMessage = (roomId: FellowshipRoomId, incomingMsg: FellowshipRoomMessage) => {
    if (!roomId || !incomingMsg?.id) return;
    const isNew = !processedRoomMsgIdsRef.current.has(incomingMsg.id);
    processedRoomMsgIdsRef.current.add(incomingMsg.id);
    if (processedRoomMsgIdsRef.current.size > 500) {
      const oldest = processedRoomMsgIdsRef.current.values().next().value;
      if (oldest) processedRoomMsgIdsRef.current.delete(oldest);
    }
    if (isNew) {
      setRoomSummary((prev) => {
        const cur = prev[roomId] || { count: 0, lastMessageAt: null };
        return {
          ...prev,
          [roomId]: {
            count: cur.count + 1,
            lastMessageAt: incomingMsg.created_at,
          },
        };
      });
    }
    if (selectedRoomIdRef.current === roomId) {
      setRoomMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;
        const next = [...prev, incomingMsg];
        try {
          localStorage.setItem(`${LOCAL_ROOMS_KEY_PREFIX}${roomId}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  const resyncAllCommunityState = () => {
    fetchCommunityData();
    fetchRoomSummary();
    if (selectedRoomIdRef.current) {
      fetchRoomMessages(selectedRoomIdRef.current);
    }
    if (currentUserRef.current) {
      fetchConversations();
      if (selectedRecipientRef.current) {
        fetchMessagesForRecipient(selectedRecipientRef.current.id);
      }
    }
  };

  // Persistent Real-Time WebSocket Engine (/ws/community when hosted on Node server)
  useEffect(() => {
    if (typeof window === 'undefined' || wsUnavailableOnHostRef.current) return;
    let disposed = false;
    let pingTimer: number | null = null;

    const connectWebSocket = async () => {
      if (disposed || wsUnavailableOnHostRef.current) return;

      // Probe once whether Express backend API exists; on Cloudflare Pages static hosting, skip WS retries cleanly
      if (!hasEverOpenedWsRef.current) {
        try {
          const probe = await fetch('/api/community/rooms/summary');
          const probeCt = probe.headers.get('content-type') || '';
          if (!probeCt.includes('application/json')) {
            wsUnavailableOnHostRef.current = true;
            syncTransportStatus();
            return;
          }
        } catch {
          // Proceed to WS attempt
        }
      }

      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams();
      if (authToken) params.set('token', authToken);
      if (currentUser?.id) params.set('userId', currentUser.id);
      if (currentUser?.email) params.set('email', currentUser.email);

      const wsUrl = `${protocol}//${window.location.host}/ws/community?${params.toString()}`;
      if (!supabaseSubscribedRef.current) {
        setWsStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
      } catch {
        syncTransportStatus();
        return;
      }

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        hasEverOpenedWsRef.current = true;
        wsConnectedRef.current = true;
        reconnectAttemptRef.current = 0;
        syncTransportStatus();

        if (authToken && currentUser?.id) {
          try {
            ws.send(
              JSON.stringify({
                type: 'auth',
                token: authToken,
                userId: currentUser.id,
                email: currentUser.email,
              })
            );
          } catch {}
        }

        if (pingTimer) window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            } catch {}
          }
        }, 25000);

        resyncAllCommunityState();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (!data?.type) return;

          if (data.type === 'ws:ready') {
            wsConnectedRef.current = true;
            syncTransportStatus();
            resyncAllCommunityState();
            return;
          }

          if (data.type === 'dm:message' && data.message) {
            applyIncomingDirectMessage(
              data.message as DirectMessage,
              data.conversation || null,
              data.sender || null
            );
            return;
          }

          if (data.type === 'dm:read' && data.conversationId) {
            if (data.readerId !== currentUserRef.current?.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.conversation_id === data.conversationId &&
                  m.sender_id === currentUserRef.current?.id &&
                  !m.is_read
                    ? { ...m, is_read: true, read_at: new Date().toISOString() }
                    : m
                )
              );
            }
            return;
          }

          if (data.type === 'room:message' && data.roomId && data.message) {
            applyIncomingRoomMessage(
              data.roomId as FellowshipRoomId,
              data.message as FellowshipRoomMessage
            );
            return;
          }

          if (data.type === 'room:amen' && data.roomId && data.message) {
            if (selectedRoomIdRef.current === data.roomId) {
              setRoomMessages((prev) =>
                prev.map((m) => (m.id === data.message.id ? data.message : m))
              );
            }
            return;
          }

          if (data.type === 'presence:update' && data.userId) {
            const isOnline = Boolean(data.is_online);
            const lastSeenAt = data.last_seen_at || new Date().toISOString();
            setMembers((prev) =>
              prev.map((m) =>
                m.id === data.userId ? { ...m, is_online: isOnline, last_seen_at: lastSeenAt } : m
              )
            );
            setSelectedRecipient((prev) =>
              prev && prev.id === data.userId
                ? { ...prev, is_online: isOnline, last_seen_at: lastSeenAt }
                : prev
            );
            setConversations((prev) =>
              prev.map((c) =>
                c.other_participant && c.other_participant.id === data.userId
                  ? {
                      ...c,
                      other_participant: {
                        ...c.other_participant,
                        is_online: isOnline,
                        last_seen_at: lastSeenAt,
                      },
                    }
                  : c
              )
            );
          }
        } catch {
          // Ignore malformed WS frame
        }
      };

      ws.onclose = () => {
        wsConnectedRef.current = false;
        if (pingTimer) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;

        if (!hasEverOpenedWsRef.current && reconnectAttemptRef.current >= 1) {
          wsUnavailableOnHostRef.current = true;
          syncTransportStatus();
          return;
        }

        syncTransportStatus();
        const delayMs = Math.min(10000, 1000 * Math.pow(2, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(connectWebSocket, delayMs);
      };

      ws.onerror = () => {
        // onclose handles fallback & reconnect cleanly
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      wsConnectedRef.current = false;
      if (pingTimer) window.clearInterval(pingTimer);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [currentUser?.id, currentUser?.email, authToken]);

  // Primary Cloudflare Real-Time Engine (Supabase Realtime Broadcast + Postgres Changes)
  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) return;
    let channel: ReturnType<typeof sb.channel> | null = null;

    try {
      channel = sb
        .channel('kingdom-community-realtime-global', {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'dm:message' }, ({ payload }: any) => {
          const me = currentUserRef.current;
          const msg = payload?.message as DirectMessage | undefined;
          const conv = payload?.conversation as Partial<Conversation> | undefined;
          if (!me || !msg?.id) return;
          const involvesMe =
            payload?.recipientId === me.id ||
            msg.sender_id === me.id ||
            conv?.participant_one_id === me.id ||
            conv?.participant_two_id === me.id;
          if (!involvesMe) return;
          applyIncomingDirectMessage(msg, conv || null, payload?.sender || null);
        })
        .on('broadcast', { event: 'dm:read' }, ({ payload }: any) => {
          if (!payload?.conversationId || payload?.readerId === currentUserRef.current?.id) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.conversation_id === payload.conversationId &&
              m.sender_id === currentUserRef.current?.id &&
              !m.is_read
                ? { ...m, is_read: true, read_at: new Date().toISOString() }
                : m
            )
          );
        })
        .on('broadcast', { event: 'room:message' }, ({ payload }: any) => {
          if (payload?.roomId && payload?.message) {
            applyIncomingRoomMessage(
              payload.roomId as FellowshipRoomId,
              payload.message as FellowshipRoomMessage
            );
          }
        })
        .on('broadcast', { event: 'room:amen' }, ({ payload }: any) => {
          if (payload?.roomId && payload?.message && selectedRoomIdRef.current === payload.roomId) {
            setRoomMessages((prev) =>
              prev.map((m) => (m.id === payload.message.id ? payload.message : m))
            );
          }
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'direct_messages' },
          async (payload: any) => {
            const row = payload?.new;
            const me = currentUserRef.current;
            if (!row?.id || !me) return;

            let matchedConv: Partial<Conversation> | undefined = conversationsRef.current.find(
              (c) => c.id === row.conversation_id
            );
            const activeRecip = selectedRecipientRef.current;
            let involvesMe =
              row.sender_id === me.id ||
              Boolean(matchedConv) ||
              (activeRecip && row.sender_id === activeRecip.id);

            if (!involvesMe && row.conversation_id) {
              try {
                const { data: sbConv } = await sb
                  .from('conversations')
                  .select('*')
                  .eq('id', row.conversation_id)
                  .maybeSingle();
                if (
                  sbConv &&
                  (sbConv.participant_one_id === me.id || sbConv.participant_two_id === me.id)
                ) {
                  matchedConv = sbConv;
                  involvesMe = true;
                }
              } catch {}
            }
            if (!involvesMe) return;

            const incomingMsg: DirectMessage = {
              id: row.id,
              conversation_id: row.conversation_id,
              sender_id: row.sender_id,
              content: row.content || '',
              ...(row.attachment ? { attachment: row.attachment } : {}),
              is_read: Boolean(row.is_read),
              created_at: row.created_at || new Date().toISOString(),
            };
            applyIncomingDirectMessage(incomingMsg, matchedConv || null, null);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'direct_messages' },
          (payload: any) => {
            const row = payload?.new;
            const me = currentUserRef.current;
            if (!row?.id || !me || !row.is_read) return;
            if (row.sender_id === me.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === row.id
                    ? { ...m, is_read: true, read_at: row.read_at || new Date().toISOString() }
                    : m
                )
              );
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'fellowship_room_messages' },
          (payload: any) => {
            const row = payload?.new;
            if (!row?.id || !row?.room_id) return;
            const incomingMsg: FellowshipRoomMessage = {
              id: row.id,
              room_id: row.room_id,
              user_id: row.user_id,
              user_full_name: row.user_full_name || 'Believer',
              user_username: row.user_username || 'member',
              user_location: row.user_location || 'Nigeria',
              content: row.content || '',
              ...(row.attachment ? { attachment: row.attachment } : {}),
              amen_user_ids: Array.isArray(row.amen_user_ids) ? row.amen_user_ids : [],
              created_at: row.created_at || new Date().toISOString(),
            };
            applyIncomingRoomMessage(row.room_id as FellowshipRoomId, incomingMsg);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'fellowship_room_messages' },
          (payload: any) => {
            const row = payload?.new;
            if (!row?.id || !row?.room_id) return;
            if (selectedRoomIdRef.current === row.room_id) {
              setRoomMessages((prev) =>
                prev.map((m) =>
                  m.id === row.id
                    ? {
                        ...m,
                        amen_user_ids: Array.isArray(row.amen_user_ids) ? row.amen_user_ids : m.amen_user_ids,
                      }
                    : m
                )
              );
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            supabaseSubscribedRef.current = true;
            syncTransportStatus();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            supabaseSubscribedRef.current = false;
            syncTransportStatus();
          }
        });

      supabaseChannelRef.current = channel;
    } catch {
      // Ignore if Realtime is unavailable
    }

    return () => {
      supabaseSubscribedRef.current = false;
      supabaseChannelRef.current = null;
      if (channel) {
        try {
          sb.removeChannel(channel);
        } catch {}
      }
    };
  }, [currentUser?.id]);

  // Initial Data Load, Focus Resync & Light Fallback Safety-Net Polling
  useEffect(() => {
    resyncAllCommunityState();

    const safetyPollMs = isDataSaverActive ? 20000 : 8000;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      resyncAllCommunityState();
    }, safetyPollMs);

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        resyncAllCommunityState();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [authToken, currentUser?.id, selectedRecipient?.id, selectedRoomId, activeSubTab, isDataSaverActive]);

  useEffect(() => {
    dmEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedRecipient?.id]);

  useEffect(() => {
    roomMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length, selectedRoomId]);

  // Actions: Follow, Block, Report
  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    const wasFollowing = followingIds.includes(targetUserId);
    try {
      const res = await fetch('/api/community/follow', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ targetUserId }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.followingIds)) {
          setFollowingIds(data.followingIds);
          try {
            localStorage.setItem(
              `kingdom_plus_following_${currentUser.id}`,
              JSON.stringify(data.followingIds)
            );
          } catch {}
          emitAppToast(data.connected ? 'Connected with member!' : 'Connection removed');
          return;
        }
      }
      if (ct.includes('application/json')) {
        const errData = await res.json().catch(() => null);
        if (errData?.error) {
          showNotice(errData.error);
          if (res.status === 401) onRequireAuth();
          return;
        }
      }
    } catch {}

    // Offline / static Supabase fallback
    try {
      const sb = getSupabaseClient();
      if (sb) {
        if (wasFollowing) {
          await sb
            .from('user_follows')
            .delete()
            .eq('follower_id', currentUser.id)
            .eq('following_id', targetUserId);
        } else {
          await sb.from('user_follows').upsert(
            {
              follower_id: currentUser.id,
              following_id: targetUserId,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'follower_id,following_id' }
          );
        }
      }
    } catch {}

    setFollowingIds((prev) => {
      const next = prev.includes(targetUserId)
        ? prev.filter((id) => id !== targetUserId)
        : [...prev, targetUserId];
      try {
        localStorage.setItem(`kingdom_plus_following_${currentUser.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    emitAppToast(wasFollowing ? 'Connection removed' : 'Connected with member!');
  };

  const handleToggleBlock = async (targetUserId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      const res = await fetch('/api/community/block', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ targetUserId }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.blockedIds)) {
          setBlockedIds(data.blockedIds);
          showNotice('Member block preferences updated.');
          return;
        }
      }
    } catch {}
    setBlockedIds((prev) =>
      prev.includes(targetUserId) ? prev.filter((id) => id !== targetUserId) : [...prev, targetUserId]
    );
    showNotice('Member block preferences updated.');
  };

  const handleReportMember = async (member: Pick<UserProfile, 'id' | 'full_name' | 'username'>) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          targetType: 'user',
          targetId: member.id,
          targetSummary: `${member.full_name} (@${member.username})`,
          reason: 'Member conduct or profile reported for review',
        }),
      });
    } catch {}
    showNotice(`Report submitted regarding @${member.username}.`);
  };

  // Open Private Chat from ANY tab (Directory, Feed, Rooms, Prayer Wall, New Chat Picker)
  const openDirectChat = (member: UserProfile) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (member.id === currentUser.id) return;
    if (selectedRecipientRef.current?.id !== member.id) {
      try {
        const key = `${LOCAL_DM_KEY_PREFIX}${[currentUser.id, member.id].sort().join('_')}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          setMessages(Array.isArray(parsed) ? parsed : []);
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    }
    setSelectedRecipient(member);
    setShowNewChatPicker(false);
    setActiveSubTab('messages');
    fetchMessagesForRecipient(member.id);
  };

  const openDirectChatFromSummary = (summary: {
    id: string;
    full_name: string;
    username: string;
    location?: string;
    denomination_or_church?: string;
  }) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    if (!summary.id || summary.id === currentUser.id) return;
    const matched = members.find((m) => m.id === summary.id);
    if (matched) {
      openDirectChat(matched);
      return;
    }
    const syntheticProfile: UserProfile = {
      id: summary.id,
      email: '',
      full_name: summary.full_name,
      username: summary.username,
      bio: '',
      location: summary.location || 'Nigeria',
      denomination_or_church: summary.denomination_or_church || '',
      role: 'member',
      is_suspended: false,
      is_online: false,
      last_seen_at: new Date().toISOString(),
      preferences: { favoriteCategories: [], favoriteMinisters: [] },
      created_at: new Date().toISOString(),
    };
    openDirectChat(syntheticProfile);
  };

  // Send Private Message
  const sendPrivateText = async (textToSend: string) => {
    const outgoingAttachment = showDmAttachmentTray
      ? normalizeOutgoingAttachment(draftDmAttachment)
      : undefined;

    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!selectedRecipient || (!textToSend.trim() && !outgoingAttachment)) return;
    if (blockedIds.includes(selectedRecipient.id)) {
      showNotice('Unblock this member first to send a private message.');
      return;
    }

    const content = textToSend.trim();
    const targetRecipient = selectedRecipient;
    setSendingMsg(true);
    try {
      if (!wsUnavailableOnHostRef.current) {
        try {
          const res = await fetch(`/api/messages/${targetRecipient.id}`, {
            method: 'POST',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({
              content,
              ...(outgoingAttachment ? { attachment: outgoingAttachment } : {}),
            }),
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            if (data.message) {
              applyIncomingDirectMessage(
                data.message as DirectMessage,
                data.conversation || null,
                targetRecipient
              );
              setMessageInput('');
              setDraftDmAttachment({});
              setShowDmAttachmentTray(false);
              return;
            }
          } else if (ct.includes('application/json')) {
            const errData = await res.json().catch(() => null);
            if (errData?.error) {
              showNotice(errData.error);
              if (res.status === 401) onRequireAuth();
              return;
            }
          }
        } catch {}
      }

      // Cloudflare Pages / static Supabase cloud persistence + Realtime broadcast
      const nowIso = new Date().toISOString();
      const previewText =
        content ||
        (outgoingAttachment?.event_title
          ? `Event: ${outgoingAttachment.event_title}`
          : 'Attached an event flyer');
      const sb = getSupabaseClient();
      let convId = `conv-${[currentUser.id, targetRecipient.id].sort().join('_')}`;
      let convObj: Conversation | null = null;
      const msgId = crypto.randomUUID ? crypto.randomUUID() : `dm-${Date.now()}`;
      let persistedContent = content;

      if (sb) {
        try {
          const senderSbId = await ensureSupabaseProfileExists(sb, currentUser);
          const recipSbId = await ensureSupabaseProfileExists(sb, targetRecipient);

          const { data: existingRows } = await sb
            .from('conversations')
            .select('*')
            .or(
              `and(participant_one_id.eq.${senderSbId},participant_two_id.eq.${recipSbId}),and(participant_one_id.eq.${recipSbId},participant_two_id.eq.${senderSbId})`
            )
            .order('last_message_at', { ascending: false })
            .limit(1);

          const existingConv = Array.isArray(existingRows) ? existingRows[0] : null;
          if (existingConv?.id) {
            convId = existingConv.id;
            convObj = {
              id: existingConv.id,
              participant_one_id: existingConv.participant_one_id,
              participant_two_id: existingConv.participant_two_id,
              last_message_text: previewText,
              last_message_at: nowIso,
              unread_count: 0,
            };
            await sb
              .from('conversations')
              .update({ last_message_text: previewText, last_message_at: nowIso })
              .eq('id', convId);
          } else {
            const newConvId = crypto.randomUUID ? crypto.randomUUID() : convId;
            convId = newConvId;
            convObj = {
              id: newConvId,
              participant_one_id: senderSbId,
              participant_two_id: recipSbId,
              last_message_text: previewText,
              last_message_at: nowIso,
              unread_count: 0,
            };
            const { error: convInsertErr } = await sb.from('conversations').insert([
              {
                id: newConvId,
                participant_one_id: senderSbId,
                participant_two_id: recipSbId,
                last_message_text: previewText,
                last_message_at: nowIso,
                created_at: nowIso,
              },
            ]);
            if (convInsertErr) {
              const { data: racedRows } = await sb
                .from('conversations')
                .select('*')
                .or(
                  `and(participant_one_id.eq.${senderSbId},participant_two_id.eq.${recipSbId}),and(participant_one_id.eq.${recipSbId},participant_two_id.eq.${senderSbId})`
                )
                .order('last_message_at', { ascending: false })
                .limit(1);
              if (racedRows?.[0]?.id) {
                convId = racedRows[0].id;
                convObj = {
                  id: racedRows[0].id,
                  participant_one_id: racedRows[0].participant_one_id,
                  participant_two_id: racedRows[0].participant_two_id,
                  last_message_text: previewText,
                  last_message_at: nowIso,
                  unread_count: 0,
                };
                await sb
                  .from('conversations')
                  .update({ last_message_text: previewText, last_message_at: nowIso })
                  .eq('id', convId);
              } else {
                console.error('Supabase conversation insert error:', convInsertErr);
                showNotice('Unable to start chat conversation. Please try again.');
                return;
              }
            }
          }

          const coreDmRow = {
            id: msgId,
            conversation_id: convId,
            sender_id: senderSbId,
            content,
            is_read: false,
            created_at: nowIso,
          };

          let dmResult = await sb
            .from('direct_messages')
            .insert([
              outgoingAttachment ? { ...coreDmRow, attachment: outgoingAttachment } : coreDmRow,
            ]);

          if (
            dmResult.error &&
            outgoingAttachment &&
            (dmResult.error.code === 'PGRST204' ||
              String(dmResult.error.message || '').includes('attachment'))
          ) {
            persistedContent = [
              content,
              `[Event Flyer: ${outgoingAttachment.event_title || 'Event'}${outgoingAttachment.event_date ? ` · ${outgoingAttachment.event_date}` : ''}${outgoingAttachment.event_location ? ` · ${outgoingAttachment.event_location}` : ''}]`,
            ]
              .filter(Boolean)
              .join('\n');
            dmResult = await sb
              .from('direct_messages')
              .insert([{ ...coreDmRow, content: persistedContent }]);
          }

          if (dmResult.error) {
            console.error('Supabase direct_messages insert error:', dmResult.error);
            showNotice('Could not deliver private message. Please try again.');
            return;
          }

          try {
            const coreCommRow = {
              id: msgId,
              message_scope: 'direct',
              conversation_id: convId,
              sender_id: senderSbId,
              sender_full_name: currentUser.full_name,
              sender_username: currentUser.username,
              sender_location: currentUser.location || 'Nigeria',
              recipient_id: recipSbId,
              content: persistedContent,
              is_read: false,
              created_at: nowIso,
            };
            await sb
              .from('community_messages')
              .insert([
                outgoingAttachment ? { ...coreCommRow, attachment: outgoingAttachment } : coreCommRow,
              ]);
          } catch {}
        } catch (err) {
          console.error('Cloud DM send error:', err);
          showNotice('Could not send private message right now.');
          return;
        }
      }

      const cloudMsg: DirectMessage = {
        id: msgId,
        conversation_id: convId,
        sender_id: currentUser.id,
        content: persistedContent,
        ...(outgoingAttachment ? { attachment: outgoingAttachment } : {}),
        is_read: false,
        created_at: nowIso,
      };

      broadcastRealtimeEvent('dm:message', {
        message: cloudMsg,
        conversation: convObj || {
          id: convId,
          participant_one_id: currentUser.id,
          participant_two_id: targetRecipient.id,
          last_message_text: previewText,
          last_message_at: nowIso,
        },
        sender: currentUser,
        recipientId: targetRecipient.id,
      });

      applyIncomingDirectMessage(cloudMsg, convObj, targetRecipient);
      setMessageInput('');
      setDraftDmAttachment({});
      setShowDmAttachmentTray(false);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendPrivateText(messageInput);
  };

  // Fellowship Room Actions
  const sendRoomText = async (textToSend: string) => {
    const outgoingAttachment = showRoomAttachmentTray
      ? normalizeOutgoingAttachment(draftRoomAttachment)
      : undefined;

    if (!selectedRoomId || (!textToSend.trim() && !outgoingAttachment)) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    const roomId = selectedRoomId;
    const content = textToSend.trim();
    setSendingRoomMsg(true);
    try {
      if (!wsUnavailableOnHostRef.current) {
        try {
          const res = await fetch(`/api/community/rooms/${roomId}/messages`, {
            method: 'POST',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({
              content,
              ...(outgoingAttachment ? { attachment: outgoingAttachment } : {}),
            }),
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            if (data.message) {
              applyIncomingRoomMessage(roomId, data.message as FellowshipRoomMessage);
              setRoomMessageInput('');
              setDraftRoomAttachment({});
              setShowRoomAttachmentTray(false);
              return;
            }
          } else if (ct.includes('application/json')) {
            const errData = await res.json().catch(() => null);
            if (errData?.error) {
              showNotice(errData.error);
              if (res.status === 401) onRequireAuth();
              return;
            }
          }
        } catch {}
      }

      // Cloudflare Pages / static Supabase cloud persistence + Realtime broadcast
      const nowIso = new Date().toISOString();
      let persistedRoomContent = content;
      const msgId = crypto.randomUUID ? crypto.randomUUID() : `rmsg-${Date.now()}`;

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const senderSbId = await ensureSupabaseProfileExists(sb, currentUser);
          const coreRoomRow = {
            id: msgId,
            room_id: roomId,
            user_id: senderSbId,
            user_full_name: currentUser.full_name,
            user_username: currentUser.username,
            user_location: currentUser.location || 'Nigeria',
            content,
            amen_user_ids: [] as string[],
            created_at: nowIso,
          };
          let roomRes = await sb
            .from('fellowship_room_messages')
            .insert([
              outgoingAttachment ? { ...coreRoomRow, attachment: outgoingAttachment } : coreRoomRow,
            ]);
          if (
            roomRes.error &&
            outgoingAttachment &&
            (roomRes.error.code === 'PGRST204' ||
              String(roomRes.error.message || '').includes('attachment'))
          ) {
            persistedRoomContent = [
              content,
              `[Event Flyer: ${outgoingAttachment.event_title || 'Event'}${outgoingAttachment.event_date ? ` · ${outgoingAttachment.event_date}` : ''}${outgoingAttachment.event_location ? ` · ${outgoingAttachment.event_location}` : ''}]`,
            ]
              .filter(Boolean)
              .join('\n');
            roomRes = await sb
              .from('fellowship_room_messages')
              .insert([{ ...coreRoomRow, content: persistedRoomContent }]);
          }

          try {
            const coreCommRow = {
              id: msgId,
              message_scope: 'room',
              room_id: roomId,
              sender_id: senderSbId,
              sender_full_name: currentUser.full_name,
              sender_username: currentUser.username,
              sender_location: currentUser.location || 'Nigeria',
              content: persistedRoomContent,
              amen_user_ids: [] as string[],
              is_read: true,
              created_at: nowIso,
            };
            await sb
              .from('community_messages')
              .insert([
                outgoingAttachment ? { ...coreCommRow, attachment: outgoingAttachment } : coreCommRow,
              ]);
          } catch {}
        } catch {}
      }

      const cloudMsg: FellowshipRoomMessage = {
        id: msgId,
        room_id: roomId,
        user_id: currentUser.id,
        user_full_name: currentUser.full_name,
        user_username: currentUser.username,
        user_location: currentUser.location || 'Nigeria',
        content: persistedRoomContent,
        ...(outgoingAttachment ? { attachment: outgoingAttachment } : {}),
        amen_user_ids: [],
        created_at: nowIso,
      };

      broadcastRealtimeEvent('room:message', { roomId, message: cloudMsg });
      applyIncomingRoomMessage(roomId, cloudMsg);
      setRoomMessageInput('');
      setDraftRoomAttachment({});
      setShowRoomAttachmentTray(false);
    } finally {
      setSendingRoomMsg(false);
    }
  };

  const handleToggleRoomAmen = async (msgId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    if (!selectedRoomId) return;
    const roomId = selectedRoomId;
    try {
      const res = await fetch(`/api/community/rooms/${roomId}/messages/${msgId}/amen`, {
        method: 'POST',
        headers: buildAuthHeaders(false),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.message) {
          setRoomMessages((prev) => prev.map((m) => (m.id === msgId ? data.message : m)));
          return;
        }
      }
    } catch {}

    let updatedMessage: FellowshipRoomMessage | null = null;
    setRoomMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const has = m.amen_user_ids.includes(currentUser.id);
        updatedMessage = {
          ...m,
          amen_user_ids: has
            ? m.amen_user_ids.filter((id) => id !== currentUser.id)
            : [...m.amen_user_ids, currentUser.id],
        };
        return updatedMessage;
      })
    );

    if (updatedMessage) {
      const sb = getSupabaseClient();
      if (sb) {
        Promise.resolve(
          sb.from('fellowship_room_messages')
            .update({ amen_user_ids: (updatedMessage as FellowshipRoomMessage).amen_user_ids })
            .eq('id', msgId)
        ).catch(() => {});
      }
      broadcastRealtimeEvent('room:amen', { roomId, message: updatedMessage });
    }
  };

  const filteredMembers = members
    .filter((m) => {
      if (filterOnlineOnly && !m.is_online) return false;
      if (filterConnectedOnly && !followingIds.includes(m.id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q) ||
        (m.denomination_or_church || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => Number(b.is_online) - Number(a.is_online));

  const chatableMembers = useMemo(() => {
    const q = newChatSearch.trim().toLowerCase();
    return members
      .filter((m) => m.id !== currentUser?.id && !blockedIds.includes(m.id))
      .filter((m) => {
        if (!q) return true;
        return (
          m.full_name.toLowerCase().includes(q) ||
          m.username.toLowerCase().includes(q) ||
          (m.location || '').toLowerCase().includes(q) ||
          (m.denomination_or_church || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.is_online) - Number(a.is_online));
  }, [members, currentUser?.id, blockedIds, newChatSearch]);

  const onlineMembersCount = members.filter((m) => m.is_online).length;
  const totalUnreadMessages = conversations.reduce((acc, c) => acc + c.unread_count, 0);
  const activeRoomConfig = FELLOWSHIP_ROOMS.find((r) => r.id === selectedRoomId) || null;

  return (
    <section className="max-w-[1440px] w-full overflow-x-clip mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-7">
      {/* Header & Clean 3-Tab Community Navigation */}
      <div className="flex flex-col gap-5 border-b border-zinc-800 pb-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-amber-400 mb-1.5">
              Fellowship Rooms, Private Chat &amp; Members
            </p>
            <h1 className="font-display text-2xl sm:text-4xl font-semibold text-zinc-50">
              KINGDOM+ Community
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-2xl">
              Join live fellowship rooms, share event flyers, or private chat directly with believers across Nigeria and the world.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-400 font-mono tabular-nums shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                wsStatus === 'live'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsStatus === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span>{wsStatus === 'live' ? 'Real-time Live' : 'Syncing...'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterConnectedOnly(false);
                setFilterOnlineOnly(true);
                setActiveSubTab('directory');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-200">{onlineMembersCount} online</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterOnlineOnly(false);
                setFilterConnectedOnly(false);
                setActiveSubTab('directory');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>{members.length} members</span>
            </button>
          </div>
        </div>

        {/* Clean 3-Tab Navigation Bar */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto no-scrollbar w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveSubTab('rooms')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
              activeSubTab === 'rooms'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Fellowship Rooms</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              setActiveSubTab('messages');
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
              activeSubTab === 'messages'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Private Chat</span>
            {totalUnreadMessages > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 font-mono tabular-nums text-[10px] font-bold">
                {totalUnreadMessages}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('directory')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
              activeSubTab === 'directory'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({members.length})</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          {statusNotice}
        </div>
      )}

      {/* ====================================================================
          1. FELLOWSHIP ROOMS (GROUP CHATS)
      ==================================================================== */}
      {activeSubTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
          {/* Room Selector Sidebar (Full screen on mobile when no room selected) */}
          <div
            className={`${
              selectedRoomId ? 'hidden lg:flex' : 'flex'
            } lg:col-span-4 bg-[#121215] border border-zinc-800 rounded-xl p-4 flex-col gap-3`}
          >
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-semibold text-zinc-100">Open Fellowship Rooms</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Join believers in group fellowship or tap any member to private chat.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {FELLOWSHIP_ROOMS.map((room) => {
                const isSelected = selectedRoomId === room.id;
                const count = roomSummary[room.id]?.count || 0;

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      fetchRoomMessages(room.id);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-500/45'
                        : 'bg-zinc-900/40 border-zinc-800/70 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/90 flex items-center justify-center shrink-0 mt-0.5">
                      {getRoomIcon(room.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                          {room.name}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-zinc-400 shrink-0">
                          {count} msgs
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                        {room.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Group Room Chat */}
          <div
            className={`${
              selectedRoomId ? 'flex' : 'hidden lg:flex'
            } lg:col-span-8 bg-[#121215] border border-zinc-800 rounded-xl p-4 sm:p-5 flex-col justify-between min-h-[480px]`}
          >
            {activeRoomConfig ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRoomId(null)}
                      className="lg:hidden px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-amber-400 shrink-0"
                    >
                      ← Rooms
                    </button>
                    {getRoomIcon(activeRoomConfig.icon)}
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-100 truncate">
                        {activeRoomConfig.name}
                      </h3>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {activeRoomConfig.welcomeNote}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Room Messages Stream */}
                <div className="flex-1 py-4 overflow-y-auto max-h-[380px] flex flex-col gap-3">
                  {roomMessages.length === 0 ? (
                    <div className="my-auto text-center px-4 py-8 flex flex-col items-center gap-3">
                      <Hash className="w-7 h-7 text-amber-400/70" />
                      <p className="text-xs text-zinc-300 max-w-sm">
                        Welcome to <strong>{activeRoomConfig.name}</strong>! Say hello or drop a prayer / encouragement below to start the conversation.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {[
                          'Good morning saints! 🙏',
                          'Praying in agreement with everyone today 🔥',
                          'Grace & peace to everyone here ✨',
                        ].map((starter) => (
                          <button
                            key={starter}
                            type="button"
                            onClick={() => sendRoomText(starter)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-amber-300 transition-colors"
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    roomMessages.map((msg) => {
                      const isMine = msg.user_id === currentUser?.id;
                      const hasAmen = currentUser
                        ? msg.amen_user_ids.includes(currentUser.id)
                        : false;
                      const msgOnline = Boolean(members.find((m) => m.id === msg.user_id)?.is_online);

                      return (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-xl border ${
                            isMine
                              ? 'bg-amber-500/10 border-amber-500/30 self-end max-w-[88%] sm:max-w-[78%]'
                              : 'bg-zinc-900/80 border-zinc-800 self-start max-w-[92%] sm:max-w-[82%]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                              {msgOnline && (
                                <span
                                  title="Online now"
                                  className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                                />
                              )}
                              <span className="font-semibold text-amber-300 truncate">
                                {msg.user_full_name}
                              </span>
                              <span className="text-zinc-500 truncate">
                                @{msg.user_username}
                              </span>
                              {msg.user_location && (
                                <span className="text-zinc-500 hidden sm:inline">
                                  · {msg.user_location}
                                </span>
                              )}
                            </div>

                            {!isMine && (
                              <button
                                type="button"
                                onClick={() =>
                                  openDirectChatFromSummary({
                                    id: msg.user_id,
                                    full_name: msg.user_full_name,
                                    username: msg.user_username,
                                    location: msg.user_location,
                                  })
                                }
                                className="text-[10px] font-medium text-amber-400 hover:underline whitespace-nowrap shrink-0"
                              >
                                Private Chat
                              </button>
                            )}
                          </div>

                          {msg.content && (
                            <p className="text-xs text-zinc-100 leading-relaxed whitespace-pre-line">
                              {msg.content}
                            </p>
                          )}

                          {msg.attachment && (
                            <div className="mt-2">
                              <EventAttachmentCard attachment={msg.attachment} compact />
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleRoomAmen(msg.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono tabular-nums border transition-colors ${
                                hasAmen
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <span className="font-sans">Amen 🙏</span>
                              {msg.amen_user_ids.length > 0 && <span>{msg.amen_user_ids.length}</span>}
                            </button>

                            <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={roomMessagesEndRef} />
                </div>

                {/* Room Composer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendRoomText(roomMessageInput);
                  }}
                  className="pt-3 border-t border-zinc-800 flex flex-col gap-2.5"
                >
                  {showRoomAttachmentTray && (
                    <EventAttachmentComposer
                      compact
                      value={draftRoomAttachment}
                      onChange={setDraftRoomAttachment}
                      onRemove={() => {
                        setShowRoomAttachmentTray(false);
                        setDraftRoomAttachment({});
                      }}
                    />
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRoomAttachmentTray(!showRoomAttachmentTray)}
                      title="Attach event flyer or meeting details"
                      className={`px-3 py-2.5 rounded-lg border transition-colors shrink-0 ${
                        showRoomAttachmentTray
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={roomMessageInput}
                      onChange={(e) => setRoomMessageInput(e.target.value)}
                      placeholder={
                        currentUser
                          ? `Chat or share event in ${activeRoomConfig.name}...`
                          : 'Sign in to join the group conversation...'
                      }
                      className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={
                        sendingRoomMsg ||
                        (!roomMessageInput.trim() && !normalizeOutgoingAttachment(draftRoomAttachment))
                      }
                      className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="my-auto text-center py-12 text-xs text-zinc-500">
                Select any Fellowship Room to join the conversation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          2. PRIVATE CHAT (1-ON-1 DIRECT MESSAGING + MEMBER FINDER)
      ==================================================================== */}
      {activeSubTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
          {/* Left 4 Columns: Active Chats + "+ New Private Chat" Member Picker */}
          <div
            className={`${
              selectedRecipient ? 'hidden lg:flex' : 'flex'
            } lg:col-span-4 bg-[#121215] border border-zinc-800 rounded-xl p-4 flex-col gap-3`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Private Chats</h2>
                <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                  {conversations.length} active conversation{conversations.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatPicker(!showNewChatPicker)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showNewChatPicker ? 'Show Chats' : 'New Chat'}</span>
              </button>
            </div>

            {showNewChatPicker ? (
              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                    placeholder="Search believer by name, @username, or city..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[390px]">
                  {chatableMembers.length === 0 ? (
                    <div className="py-8 px-3 text-center text-xs text-zinc-500">
                      {members.length <= 1
                        ? 'Invite fellow believers or friends to register on KINGDOM+ to start private 1-on-1 chats.'
                        : 'No matching members found.'}
                    </div>
                  ) : (
                    chatableMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => openDirectChat(member)}
                        className="w-full text-left p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 flex items-center justify-between gap-2.5 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative w-8 h-8 rounded-full bg-zinc-800 text-amber-400 font-semibold flex items-center justify-center text-xs shrink-0">
                            {member.full_name.charAt(0).toUpperCase()}
                            {member.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#121215]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-zinc-100 truncate">
                              {member.full_name}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate">
                              @{member.username} · {member.location || 'Worldwide'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-amber-400 shrink-0">
                          Chat →
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[440px]">
                {conversations.length === 0 && !selectedRecipient ? (
                  <div className="py-8 px-4 text-center flex flex-col items-center gap-3">
                    <MessageSquare className="w-7 h-7 text-zinc-600" />
                    <p className="text-xs text-zinc-400">
                      No direct conversations yet. Tap <strong>New Chat</strong> above or pick any member below to start a private conversation.
                    </p>
                    {chatableMembers.slice(0, 4).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => openDirectChat(member)}
                        className="w-full text-left p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-medium text-zinc-200 truncate">
                          {member.full_name} (@{member.username})
                        </span>
                        <span className="text-amber-400 shrink-0">Chat</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const other = conv.other_participant;
                    if (!other) return null;
                    const isSelected = selectedRecipient?.id === other.id;

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => {
                          setConversations((prev) =>
                            prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
                          );
                          openDirectChat(other);
                        }}
                        className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-zinc-900 border-amber-500/40'
                            : 'bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 truncate">
                            {other.full_name}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {conv.last_message_text || 'Start conversation'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <span
                            className={`text-[10px] ${
                              other.is_online ? 'text-emerald-400' : 'text-zinc-500'
                            }`}
                          >
                            {other.is_online ? 'Online' : 'Offline'}
                          </span>
                          {conv.unread_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 text-[10px] font-mono tabular-nums font-bold">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Right 8 Columns: Active 1-on-1 Private Chat Thread */}
          <div
            className={`${
              selectedRecipient ? 'flex' : 'hidden lg:flex'
            } lg:col-span-8 bg-[#121215] border border-zinc-800 rounded-xl p-4 sm:p-5 flex-col justify-between min-h-[480px]`}
          >
            {selectedRecipient ? (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRecipient(null)}
                      className="lg:hidden px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-amber-400 shrink-0"
                    >
                      ← All Chats
                    </button>
                    <div className="w-9 h-9 rounded-full bg-zinc-800 text-amber-400 font-semibold flex items-center justify-center text-xs shrink-0">
                      {selectedRecipient.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">
                        {selectedRecipient.full_name}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 truncate">
                        <span>@{selectedRecipient.username}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            selectedRecipient.is_online ? 'text-emerald-400' : 'text-zinc-500'
                          }
                        >
                          {selectedRecipient.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleBlock(selectedRecipient.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors"
                    >
                      {blockedIds.includes(selectedRecipient.id) ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportMember(selectedRecipient)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                    >
                      Report
                    </button>
                  </div>
                </div>

                {/* Direct Message History */}
                <div className="flex-1 py-4 overflow-y-auto max-h-[380px] flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <div className="my-auto text-center px-4 py-6 flex flex-col items-center gap-3">
                      <p className="text-xs text-zinc-400 max-w-sm">
                        Send a private greeting, prayer, or word of encouragement to{' '}
                        <strong className="text-zinc-200">{selectedRecipient.full_name}</strong>.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {[
                          'Grace & peace to you! 🙏',
                          'Praying with you today ✨',
                          'Glad to connect with you on KINGDOM+!',
                        ].map((icebreaker) => (
                          <button
                            key={icebreaker}
                            type="button"
                            onClick={() => sendPrivateText(icebreaker)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-amber-300 transition-colors"
                          >
                            {icebreaker}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === currentUser?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`max-w-[80%] sm:max-w-[75%] rounded-xl px-4 py-2.5 text-xs ${
                            isMine
                              ? 'self-end bg-amber-500 text-zinc-950 font-medium'
                              : 'self-start bg-zinc-900 border border-zinc-800 text-zinc-100'
                          }`}
                        >
                          {msg.content && (
                            <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                          )}
                          {msg.attachment && (
                            <div className={msg.content ? 'mt-2' : ''}>
                              <EventAttachmentCard attachment={msg.attachment} compact />
                            </div>
                          )}
                          <div
                            className={`text-[10px] mt-1 font-mono tabular-nums ${
                              isMine ? 'text-zinc-900/75' : 'text-zinc-500'
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {isMine && (msg.is_read ? ' · Read' : ' · Sent')}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={dmEndRef} />
                </div>

                {/* Direct Chat Composer */}
                <form onSubmit={handleSendMessage} className="pt-3 border-t border-zinc-800 flex flex-col gap-2.5">
                  {showDmAttachmentTray && (
                    <EventAttachmentComposer
                      compact
                      value={draftDmAttachment}
                      onChange={setDraftDmAttachment}
                      onRemove={() => {
                        setShowDmAttachmentTray(false);
                        setDraftDmAttachment({});
                      }}
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDmAttachmentTray(!showDmAttachmentTray)}
                      title="Attach event flyer or details"
                      className={`px-3 py-2.5 rounded-lg border transition-colors shrink-0 ${
                        showDmAttachmentTray
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder={`Private message ${selectedRecipient.full_name}...`}
                      className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={
                        sendingMsg ||
                        (!messageInput.trim() && !normalizeOutgoingAttachment(draftDmAttachment))
                      }
                      className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="my-auto text-center py-12 px-4 flex flex-col items-center gap-3">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
                <h3 className="text-sm font-semibold text-zinc-200">
                  Private 1-on-1 Fellowship Chat
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Select an active conversation on the left or click <strong>New Chat</strong> to private message any believer on KINGDOM+.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatPicker(true)}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors"
                >
                  Start a New Private Chat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          5. MEMBERS DIRECTORY
      ==================================================================== */}
      {activeSubTab === 'directory' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 min-w-0 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find members by name, username, city (e.g. Lagos, Abuja), or church..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end flex-wrap gap-2.5">
              <span className="text-xs text-zinc-400 font-mono tabular-nums">
                {onlineMembersCount} online now
              </span>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setFilterConnectedOnly(!filterConnectedOnly)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    filterConnectedOnly
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  Connected ({followingIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterOnlineOnly(!filterOnlineOnly)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  filterOnlineOnly
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {filterOnlineOnly ? 'Showing Online Only' : 'Online Only'}
              </button>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#121215] border border-zinc-800 text-center flex flex-col items-center gap-3">
              <Users className="w-8 h-8 text-zinc-500" />
              <h3 className="text-base font-semibold text-zinc-200">
                {members.length === 0
                  ? 'No community members have registered yet'
                  : 'No members match your current filter'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md">
                {members.length === 0
                  ? 'KINGDOM+ does not generate fake user accounts. Create your account to become the first verified member in the community directory.'
                  : 'Try clearing your search query or switching back to all members.'}
              </p>
              {!currentUser && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="mt-2 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors"
                >
                  Create Member Account
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMembers.map((member) => {
                const isMe = currentUser?.id === member.id;
                const isFollowing = followingIds.includes(member.id);
                const isBlocked = blockedIds.includes(member.id);

                return (
                  <div
                    key={member.id}
                    className="p-5 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between gap-4"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-11 h-11 rounded-full bg-zinc-800 text-amber-400 font-semibold flex items-center justify-center text-sm shrink-0">
                            {member.full_name.charAt(0).toUpperCase()}
                            {member.is_online && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#121215]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2 truncate">
                              <span className="truncate">{member.full_name}</span>
                              {isMe && (
                                <span className="text-[11px] font-normal text-amber-400 shrink-0">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                              <span className="truncate">@{member.username}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  member.is_online ? 'text-emerald-400' : 'text-zinc-500'
                                }
                              >
                                {member.is_online
                                  ? 'Online now'
                                  : `Seen ${formatRelativeDate(member.last_seen_at)}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isMe && myStreak > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-semibold text-amber-300 shrink-0">
                            <Flame className="w-3 h-3" />
                            <span>{myStreak}d</span>
                          </span>
                        )}
                      </div>

                      {member.bio && (
                        <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                          {member.bio}
                        </p>
                      )}

                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                        {member.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-zinc-500" />
                            {member.location}
                          </span>
                        )}
                        {member.denomination_or_church && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{member.denomination_or_church}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {!isMe && (
                      <div className="pt-3 border-t border-zinc-800/80 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleFollow(member.id)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                            isFollowing
                              ? 'bg-zinc-900 border-amber-500/40 text-amber-300'
                              : 'bg-amber-500 border-amber-500 text-zinc-950 font-semibold hover:bg-amber-400'
                          }`}
                        >
                          {isFollowing ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <UserPlus className="w-3.5 h-3.5" />
                          )}
                          <span>{isFollowing ? 'Connected' : 'Connect'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openDirectChat(member)}
                          disabled={isBlocked}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Private Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleBlock(member.id)}
                          title={isBlocked ? 'Unblock member' : 'Block member'}
                          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReportMember(member)}
                          title="Report member"
                          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
