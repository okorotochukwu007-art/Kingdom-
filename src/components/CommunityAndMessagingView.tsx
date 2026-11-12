import React, { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Flag,
  MapPin,
  MessageSquare,
  Search,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { Conversation, DirectMessage, UserProfile } from '../types/kingdom.ts';
import { formatRelativeDate } from '../utils/formatters.ts';

interface CommunityAndMessagingViewProps {
  currentUser: UserProfile | null;
  authToken: string | null;
  onRequireAuth: () => void;
}

export const CommunityAndMessagingView: React.FC<CommunityAndMessagingViewProps> = ({
  currentUser,
  authToken,
  onRequireAuth,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'messages'>('directory');
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);

  // Messaging state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const fetchCommunityData = async () => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch('/api/community/members', { headers });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      if (Array.isArray(data.members)) setMembers(data.members);
      if (Array.isArray(data.followingIds)) setFollowingIds(data.followingIds);
      if (Array.isArray(data.blockedIds)) setBlockedIds(data.blockedIds);
    } catch {}
  };

  const fetchConversations = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/messages/conversations', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      }
    } catch {}
  };

  const fetchMessagesForRecipient = async (recipientId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/messages/${recipientId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok || !ct.includes('application/json')) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch {}
  };

  useEffect(() => {
    fetchCommunityData();
    if (authToken) fetchConversations();
    const interval = window.setInterval(() => {
      fetchCommunityData();
      if (authToken) {
        fetchConversations();
        if (selectedRecipient) {
          fetchMessagesForRecipient(selectedRecipient.id);
        }
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [authToken, selectedRecipient?.id]);

  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      const res = await fetch('/api/community/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.followingIds)) {
          setFollowingIds(data.followingIds);
          return;
        }
      }
    } catch {}
    setFollowingIds((prev) =>
      prev.includes(targetUserId) ? prev.filter((id) => id !== targetUserId) : [...prev, targetUserId]
    );
  };

  const handleToggleBlock = async (targetUserId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      const res = await fetch('/api/community/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.blockedIds)) {
          setBlockedIds(data.blockedIds);
          setStatusNotice('Member block preferences updated.');
          setTimeout(() => setStatusNotice(null), 3500);
          return;
        }
      }
    } catch {}
    setBlockedIds((prev) =>
      prev.includes(targetUserId) ? prev.filter((id) => id !== targetUserId) : [...prev, targetUserId]
    );
    setStatusNotice('Member block preferences updated.');
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleReportMember = async (member: UserProfile) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          targetType: 'user',
          targetId: member.id,
          targetSummary: `${member.full_name} (@${member.username})`,
          reason: 'Member conduct or profile reported for review',
        }),
      });
    } catch {}
    setStatusNotice(`Report submitted regarding @${member.username}.`);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const openDirectChat = (member: UserProfile) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    setSelectedRecipient(member);
    setActiveSubTab('messages');
    fetchMessagesForRecipient(member.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !authToken || !selectedRecipient || !messageInput.trim()) return;

    setSendingMsg(true);
    try {
      const res = await fetch(`/api/messages/${selectedRecipient.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: messageInput.trim() }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
          setMessageInput('');
          fetchConversations();
        }
      }
    } finally {
      setSendingMsg(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (filterOnlineOnly && !m.is_online) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q) ||
      m.location.toLowerCase().includes(q) ||
      m.denomination_or_church.toLowerCase().includes(q)
    );
  });

  const onlineMembersCount = members.filter((m) => m.is_online).length;
  const totalUnreadMessages = conversations.reduce((acc, c) => acc + c.unread_count, 0);

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-medium text-amber-400 mb-2">
            Believers Fellowship & Real-Time Connection
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-zinc-50">
            KINGDOM+ Community
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Connect with fellow believers across Nigeria and the diaspora, see who is currently online, and share encouragement via real-time private messaging.
          </p>
        </div>

        {/* Interactive Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('directory')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'directory'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members Directory ({members.length})</span>
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
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'messages'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Private Messages</span>
            {totalUnreadMessages > 0 && (
              <span className="font-mono tabular-nums text-[11px] underline">
                ({totalUnreadMessages} new)
              </span>
            )}
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          {statusNotice}
        </div>
      )}

      {activeSubTab === 'directory' ? (
        <div className="flex flex-col gap-6">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find members by name, username, city (e.g. Lagos, Abuja), or church..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-400 font-mono tabular-nums">
                {onlineMembersCount} currently online
              </span>
              <button
                type="button"
                onClick={() => setFilterOnlineOnly(!filterOnlineOnly)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  filterOnlineOnly
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {filterOnlineOnly ? 'Showing Online Only' : 'Filter Online Members'}
              </button>
            </div>
          </div>

          {/* Members Grid */}
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
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-zinc-800 text-amber-400 font-semibold flex items-center justify-center text-sm shrink-0">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                              <span>{member.full_name}</span>
                              {isMe && (
                                <span className="text-[11px] font-normal text-amber-400">(You)</span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                              <span>@{member.username}</span>
                              <span aria-hidden="true">·</span>
                              <span className={member.is_online ? 'text-emerald-400' : 'text-zinc-500'}>
                                {member.is_online ? 'Online now' : `Seen ${formatRelativeDate(member.last_seen_at)}`}
                              </span>
                            </div>
                          </div>
                        </div>
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
                          {isFollowing ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                          <span>{isFollowing ? 'Connected' : 'Connect'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openDirectChat(member)}
                          disabled={isBlocked}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
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
      ) : (
        /* 1-to-1 Real-Time Private Messaging Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[540px]">
          {/* Left 4 Columns: Conversations List */}
          <div className="lg:col-span-4 bg-[#121215] border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-semibold text-zinc-100">Direct Conversations</h2>
              <span className="text-xs font-mono tabular-nums text-zinc-400">
                {conversations.length} active
              </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto max-h-[460px]">
              {conversations.length === 0 && !selectedRecipient ? (
                <div className="py-12 px-4 text-center text-xs text-zinc-500">
                  No direct conversations yet. Select any believer from the Members Directory and click "Message" to begin a one-to-one chat.
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
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
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
                        <span className="text-[10px] text-zinc-500">
                          {other.is_online ? 'Online' : 'Offline'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="text-[11px] font-mono tabular-nums font-semibold text-amber-400">
                            {conv.unread_count} unread
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right 8 Columns: Active Chat Thread */}
          <div className="lg:col-span-8 bg-[#121215] border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
            {selectedRecipient ? (
              <>
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      {selectedRecipient.full_name}
                    </div>
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <span>@{selectedRecipient.username}</span>
                      <span aria-hidden="true">·</span>
                      <span className={selectedRecipient.is_online ? 'text-emerald-400' : 'text-zinc-500'}>
                        {selectedRecipient.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleBlock(selectedRecipient.id)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors"
                    >
                      {blockedIds.includes(selectedRecipient.id) ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportMember(selectedRecipient)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-amber-400 transition-colors"
                    >
                      Report
                    </button>
                  </div>
                </div>

                {/* Message History */}
                <div className="flex-1 py-4 overflow-y-auto max-h-[380px] flex flex-col gap-3">
                  {messages.length === 0 ? (
                    <div className="my-auto text-center text-xs text-zinc-500">
                      Send a greeting or word of encouragement to {selectedRecipient.full_name}.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMine = msg.sender_id === currentUser?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`max-w-[75%] rounded-xl px-4 py-2.5 text-xs ${
                            isMine
                              ? 'self-end bg-amber-500 text-zinc-950 font-medium'
                              : 'self-start bg-zinc-900 border border-zinc-800 text-zinc-100'
                          }`}
                        >
                          <p className="leading-relaxed">{msg.content}</p>
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
                </div>

                {/* Composer */}
                <form onSubmit={handleSendMessage} className="pt-3 border-t border-zinc-800 flex gap-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Message ${selectedRecipient.full_name}...`}
                    className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg || !messageInput.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="my-auto text-center py-16">
                <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-zinc-200">Select a Conversation</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Choose a conversation on the left or visit the Members Directory to start a private one-to-one chat.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
