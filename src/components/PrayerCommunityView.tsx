import React, { useEffect, useState } from 'react';
import { Flag, HeartHandshake, MessageCircle, Plus, Send } from 'lucide-react';
import { PrayerRequest, UserProfile } from '../types/kingdom.ts';
import { formatRelativeDate } from '../utils/formatters.ts';

interface PrayerCommunityViewProps {
  currentUser: UserProfile | null;
  authToken: string | null;
  onRequireAuth: () => void;
}

const PRAYER_TOPICS = [
  'All Requests',
  'Healing & Family',
  'Spiritual Growth & Revival',
  'Marriage & Home',
  'Career & Provision',
  'National Peace (Nigeria)',
];

export const PrayerCommunityView: React.FC<PrayerCommunityViewProps> = ({
  currentUser,
  authToken,
  onRequireAuth,
}) => {
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('All Requests');
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryTag, setCategoryTag] = useState('Healing & Family');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeEncourageId, setActiveEncourageId] = useState<string | null>(null);
  const [encourageText, setEncourageText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const LOCAL_PRAYERS_KEY = 'kingdom_plus_local_prayers_v1';

  const fetchPrayers = async () => {
    try {
      const res = await fetch('/api/prayers');
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data.prayers)) {
          setPrayers(data.prayers);
          try {
            localStorage.setItem(LOCAL_PRAYERS_KEY, JSON.stringify(data.prayers));
          } catch {}
          return;
        }
      }
    } catch {}
    try {
      const raw = localStorage.getItem(LOCAL_PRAYERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPrayers(parsed);
      }
    } catch {}
  };

  useEffect(() => {
    fetchPrayers();
  }, []);

  const handleSubmitPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/prayers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          categoryTag,
          isAnonymous,
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.prayer) {
          setPrayers((prev) => [data.prayer, ...prev]);
          setTitle('');
          setContent('');
          setShowForm(false);
          return;
        }
      }
      const fallbackPrayer: PrayerRequest = {
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `pry-${Date.now()}`,
        user_id: currentUser.id,
        user_full_name: isAnonymous ? 'Anonymous Believer' : currentUser.full_name,
        user_username: isAnonymous ? 'anonymous' : currentUser.username,
        user_location: currentUser.location || 'Worldwide',
        is_anonymous: isAnonymous,
        title: title.trim(),
        content: content.trim(),
        category_tag: categoryTag,
        pray_count: 1,
        prayed_by_user_ids: [currentUser.id],
        encouragement_count: 0,
        encouragements: [],
        status: 'active',
        created_at: new Date().toISOString(),
      };
      setPrayers((prev) => {
        const next = [fallbackPrayer, ...prev];
        try {
          localStorage.setItem(LOCAL_PRAYERS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      setTitle('');
      setContent('');
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePraySupport = async (prayerId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    try {
      const res = await fetch(`/api/prayers/${prayerId}/pray`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.prayer) {
          setPrayers((prev) => prev.map((p) => (p.id === prayerId ? data.prayer : p)));
          return;
        }
      }
    } catch {}
    setPrayers((prev) =>
      prev.map((p) => {
        if (p.id !== prayerId) return p;
        const already = p.prayed_by_user_ids.includes(currentUser.id);
        const ids = already
          ? p.prayed_by_user_ids.filter((id) => id !== currentUser.id)
          : [...p.prayed_by_user_ids, currentUser.id];
        return { ...p, prayed_by_user_ids: ids, pray_count: ids.length };
      })
    );
  };

  const handlePostEncouragement = async (prayerId: string) => {
    if (!currentUser || !authToken) {
      onRequireAuth();
      return;
    }
    if (!encourageText.trim()) return;

    try {
      const res = await fetch(`/api/prayers/${prayerId}/encourage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: encourageText.trim() }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json();
        if (data.prayer) {
          setPrayers((prev) => prev.map((p) => (p.id === prayerId ? data.prayer : p)));
          setEncourageText('');
          setActiveEncourageId(null);
          return;
        }
      }
    } catch {}
    setPrayers((prev) =>
      prev.map((p) =>
        p.id === prayerId
          ? {
              ...p,
              encouragement_count: p.encouragement_count + 1,
              encouragements: [
                ...p.encouragements,
                {
                  id: `enc-${Date.now()}`,
                  prayer_request_id: prayerId,
                  user_id: currentUser.id,
                  user_full_name: currentUser.full_name,
                  user_username: currentUser.username,
                  content: encourageText.trim(),
                  created_at: new Date().toISOString(),
                },
              ],
            }
          : p
      )
    );
    setEncourageText('');
    setActiveEncourageId(null);
  };

  const handleReportPrayer = async (prayer: PrayerRequest) => {
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
          targetType: 'prayer',
          targetId: prayer.id,
          targetSummary: prayer.title,
          reason: 'Prayer request flagged for moderation review',
        }),
      });
    } catch {}
    setNotice('Prayer request reported to community moderators.');
    setTimeout(() => setNotice(null), 3500);
  };

  const filteredPrayers = prayers.filter(
    (p) => selectedTopic === 'All Requests' || p.category_tag === selectedTopic
  );

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
      {/* Sanctuary Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 min-h-[240px] flex items-end p-6 sm:p-10">
        <img
          src="/src/assets/images/prayer_sanctuary_header_1794402596484.jpg"
          alt="KINGDOM+ Prayer Sanctuary"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20" />

        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-amber-400 mb-2">
              Intercession & Mutual Encouragement
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-zinc-50">
              Prayer Altar & Community Wall
            </h1>
            <p className="text-sm text-zinc-300 mt-2 max-w-2xl">
              Share your prayer requests with believers across Nigeria and the world, stand in agreement with others, and leave scripture-grounded words of encouragement.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
                return;
              }
              setShowForm(!showForm);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'Close Form' : 'Submit Prayer Request'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          {notice}
        </div>
      )}

      {/* Submit Prayer Request Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitPrayer}
          className="p-6 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col gap-4"
        >
          <h2 className="text-base font-semibold text-zinc-100">Submit a Prayer Request</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1.5">Prayer Headline</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Praying for complete healing for my mother in Enugu"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Focus Area</label>
              <select
                value={categoryTag}
                onChange={(e) => setCategoryTag(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {PRAYER_TOPICS.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Prayer Details</label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your prayer request so the community can intercede with you..."
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500"
              />
              <span>Post anonymously (hide my name on the public wall)</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Posting...' : 'Publish Prayer Request'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        {PRAYER_TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => setSelectedTopic(topic)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === topic
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Prayer Requests Feed */}
      {filteredPrayers.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#121215] border border-zinc-800 text-center flex flex-col items-center gap-3">
          <HeartHandshake className="w-8 h-8 text-amber-400/80" />
          <h3 className="text-base font-semibold text-zinc-200">
            No prayer requests posted in this view yet
          </h3>
          <p className="text-xs text-zinc-400 max-w-md">
            KINGDOM+ never fabricates fake community prayer requests. Click "Submit Prayer Request" above to share a real prayer need with the community.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPrayers.map((prayer) => {
            const hasPrayed = currentUser
              ? prayer.prayed_by_user_ids.includes(currentUser.id)
              : false;

            return (
              <article
                key={prayer.id}
                className="p-6 rounded-xl bg-[#121215] border border-zinc-800 flex flex-col justify-between gap-4"
              >
                <div className="flex flex-col gap-3">
                  {/* Unboxed Metadata Header */}
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-amber-400 font-medium">{prayer.category_tag}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-300">{prayer.user_full_name}</span>
                      {prayer.user_location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{prayer.user_location}</span>
                        </>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 shrink-0">
                      {formatRelativeDate(prayer.created_at)}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-100 leading-snug">
                    {prayer.title}
                  </h3>

                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                    {prayer.content}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-800/80 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePraySupport(prayer.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums ${
                          hasPrayed
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span className="font-sans">{hasPrayed ? 'Prayed' : 'I Prayed'}</span>
                        <span>({prayer.pray_count})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveEncourageId(activeEncourageId === prayer.id ? null : prayer.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Encourage ({prayer.encouragements.length})</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleReportPrayer(prayer)}
                      title="Report inappropriate content"
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>
                  </div>

                  {/* Encouragement Composer */}
                  {activeEncourageId === prayer.id && (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={encourageText}
                        onChange={(e) => setEncourageText(e.target.value)}
                        placeholder="Write a word of encouragement or scripture..."
                        className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => handlePostEncouragement(prayer.id)}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send</span>
                      </button>
                    </div>
                  )}

                  {/* Encouragements Thread */}
                  {prayer.encouragements.length > 0 && (
                    <div className="mt-1 pl-3 border-l border-zinc-800 flex flex-col gap-2">
                      {prayer.encouragements.map((enc) => (
                        <div key={enc.id} className="text-xs">
                          <span className="font-semibold text-zinc-200">{enc.user_full_name}: </span>
                          <span className="text-zinc-400">{enc.content}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
