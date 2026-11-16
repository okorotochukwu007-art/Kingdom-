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
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    if (currentUser?.id) headers['X-Kingdom-User-Id'] = currentUser.id;
    if (currentUser?.email) headers['X-Kingdom-User-Email'] = currentUser.email;
    return headers;
  };

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
    try {
      const res = await fetch('/api/community/rooms/summary');
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data?.summary) setRoomSummary(data.summary);
      }
    } catch {}
  };

  const fetchRoomMessages = async (roomId: FellowshipRoomId) => {
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
    try {
      const raw = localStorage.getItem(`${LOCAL_ROOMS_KEY_PREFIX}${roomId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRoomMessages(parsed);
      }
    } catch {}
  };

  const fetchConversations = async () => {
    if (!authToken || !currentUser) return;
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

    // Supabase direct conversations fallback for cloud-only sessions
    try {
      const sb = getSupabaseClient();
      if (!sb) return;
      const { data: sbConvs } = await sb
        .from('conversations')
        .select('*')
        .or(`participant_one_id.eq.${currentUser.id},participant_two_id.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false });
      if (Array.isArray(sbConvs)) {
        const hydrated: Conversation[] = sbConvs
          .map((c: any) => {
            const otherId =
              c.participant_one_id === currentUser.id
                ? c.participant_two_id
                : c.participant_one_id;
            const other = members.find((m) => m.id === otherId);
            return {
              ...c,
              other_participant: other,
              unread_count: 0,
            };
          })
          .filter((c) => Boolean(c.other_participant));
        setConversations(hydrated);
      }
    } catch {}
  };

  const fetchMessagesForRecipient = async (recipientId: string) => {
    if (!authToken || !currentUser) return;
    try {
      const res = await fetch(`/api/messages/${recipientId}`, {
        headers: buildAuthHeaders(false),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
          return;
        }
      }
    } catch {}

    // Fallback to local thread cache if offline
    try {
      const key = `${LOCAL_DM_KEY_PREFIX}${[currentUser.id, recipientId].sort().join('_')}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed);
      } else {
        setMessages([]);
      }
    } catch {}
  };

  useEffect(() => {
    fetchCommunityData();
    fetchRoomSummary();
    if (authToken) fetchConversations();
    if (selectedRoomId) fetchRoomMessages(selectedRoomId);

    const pollMs = isDataSaverActive ? 15000 : 4000;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      fetchCommunityData();
      if (activeSubTab === 'rooms') {
        fetchRoomSummary();
        if (selectedRoomId) fetchRoomMessages(selectedRoomId);
      }
      if (authToken && activeSubTab === 'messages') {
        fetchConversations();
        if (selectedRecipient) {
          fetchMessagesForRecipient(selectedRecipient.id);
        }
      }
    }, pollMs);

    const handleFocusRefresh = () => {
      if (!document.hidden) {
        fetchCommunityData();
      }
    };
    window.addEventListener('focus', handleFocusRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocusRefresh);
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
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    if (member.id === currentUser.id) return;
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

    if (!currentUser || !authToken || !selectedRecipient || (!textToSend.trim() && !outgoingAttachment)) return;
    if (blockedIds.includes(selectedRecipient.id)) {
      showNotice('Unblock this member first to send a private message.');
      return;
    }

    const content = textToSend.trim();
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/messages/${selectedRecipient.id}`, {
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
          setMessages((prev) => [...prev, data.message]);
          setMessageInput('');
          setDraftDmAttachment({});
          setShowDmAttachmentTray(false);
          fetchConversations();
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

      // Offline / static fallback persistence
      const localMsg: DirectMessage = {
        id: crypto.randomUUID ? crypto.randomUUID() : `dm-${Date.now()}`,
        conversation_id: `conv-${[currentUser.id, selectedRecipient.id].sort().join('_')}`,
        sender_id: currentUser.id,
        content,
        ...(outgoingAttachment ? { attachment: outgoingAttachment } : {}),
        is_read: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, localMsg];
        try {
          const key = `${LOCAL_DM_KEY_PREFIX}${[currentUser.id, selectedRecipient.id].sort().join('_')}`;
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
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
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    const content = textToSend.trim();
    setSendingRoomMsg(true);
    try {
      const res = await fetch(`/api/community/rooms/${selectedRoomId}/messages`, {
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
          setRoomMessages((prev) => [...prev, data.message]);
          setRoomMessageInput('');
          setDraftRoomAttachment({});
          setShowRoomAttachmentTray(false);
          fetchRoomSummary();
          return;
        }
      }
      const localMsg: FellowshipRoomMessage = {
        id: `rmsg-${Date.now()}`,
        room_id: selectedRoomId,
        user_id: currentUser.id,
        user_full_name: currentUser.full_name,
        user_username: currentUser.username,
        user_location: currentUser.location || 'Nigeria',
        content,
        ...(outgoingAttachment ? { attachment: outgoingAttachment } : {}),
        amen_user_ids: [],
        created_at: new Date().toISOString(),
      };
      setRoomMessages((prev) => {
        const next = [...prev, localMsg];
        try {
          localStorage.setItem(`${LOCAL_ROOMS_KEY_PREFIX}${selectedRoomId}`, JSON.stringify(next));
        } catch {}
        return next;
      });
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
    try {
      const res = await fetch(`/api/community/rooms/${selectedRoomId}/messages/${msgId}/amen`, {
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
    setRoomMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const has = m.amen_user_ids.includes(currentUser.id);
        return {
          ...m,
          amen_user_ids: has
            ? m.amen_user_ids.filter((id) => id !== currentUser.id)
            : [...m.amen_user_ids, currentUser.id],
        };
      })
    );
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

          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums shrink-0">
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
                          setSelectedRecipient(other);
                          fetchMessagesForRecipient(other.id);
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
