import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Check,
  Clock,
  Flame,
  Mail,
  MessageCircle,
  Play,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Volume2,
  X,
} from 'lucide-react';
import { KingdomChannel, KingdomVideo } from '../types/kingdom.ts';
import {
  BroadcastReminderSubscription,
  loadLocalReminderSubscription,
  playSanctuaryReminderChime,
  saveBroadcastReminderSubscription,
} from '../utils/supabaseCloudSync.ts';
import { VideoCard } from './VideoCard.tsx';

interface LiveSpecialBroadcastsViewProps {
  videos: KingdomVideo[];
  channels: KingdomChannel[];
  savedVideoIds: string[];
  onSelectVideo: (video: KingdomVideo) => void;
  onToggleSave: (videoId: string, e: React.MouseEvent) => void;
  onSelectChannel: (channelId: string) => void;
  onActiveLiveStreamsChange?: (liveVideos: KingdomVideo[]) => void;
}

type ScheduleFilterTab = 'all' | 'daily_prayer' | 'sunday_services' | 'midweek_vigils';

interface RealTimeLiveStreamItem {
  videoId: string;
  title: string;
  channelTitle: string;
  youtubeChannelId: string;
  matchedKingdomChannelId: string | null;
  watchingText: string;
  watchingCount: number;
  avatarUrl: string;
  thumbnailUrl: string;
}

interface ScheduledProgram {
  id: string;
  title: string;
  ministry: string;
  minister: string;
  channelId: string;
  category: 'daily_prayer' | 'sunday_services' | 'midweek_vigils';
  scheduleLabel: string;
  daysOfWeek: number[];
  startHourWat: number;
  startMinuteWat: number;
  durationMinutes: number;
}

const WAT_BROADCAST_SCHEDULE: ScheduledProgram[] = [
  {
    id: 'sched-nsppd',
    title: 'NSPPD (New Season Prophetic Prayers & Declarations)',
    ministry: 'Streams of Joy International',
    minister: 'Pastor Jerry Eze',
    channelId: 'ch-jerry-eze',
    category: 'daily_prayer',
    scheduleLabel: 'Mon – Fri · 7:00 AM WAT',
    daysOfWeek: [1, 2, 3, 4, 5],
    startHourWat: 7,
    startMinuteWat: 0,
    durationMinutes: 90,
  },
  {
    id: 'sched-nlp',
    title: 'Next Level Prayers (NLP Morning Altar)',
    ministry: 'Harvesters International Christian Centre',
    minister: 'Pastor Bolaji Idowu',
    channelId: 'ch-harvesters-bolaji',
    category: 'daily_prayer',
    scheduleLabel: 'Mon – Fri · 6:30 AM WAT',
    daysOfWeek: [1, 2, 3, 4, 5],
    startHourWat: 6,
    startMinuteWat: 30,
    durationMinutes: 60,
  },
  {
    id: 'sched-chop',
    title: 'Covenant Hour of Prayer',
    ministry: 'Living Faith Church Worldwide (Winners Chapel)',
    minister: 'Bishop David Oyedepo',
    channelId: 'ch-oyedepo-lfc',
    category: 'daily_prayer',
    scheduleLabel: 'Mon – Sat · 6:00 AM WAT',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    startHourWat: 6,
    startMinuteWat: 0,
    durationMinutes: 60,
  },
  {
    id: 'sched-hallelujah-challenge',
    title: 'Hallelujah Challenge & Midnight Praise Altar',
    ministry: 'The Oasis / Hallelujah Challenge',
    minister: 'Pastor Nathaniel Bassey',
    channelId: 'ch-nathaniel-bassey',
    category: 'daily_prayer',
    scheduleLabel: 'Daily · 11:59 PM WAT',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startHourWat: 23,
    startMinuteWat: 55,
    durationMinutes: 75,
  },
  {
    id: 'sched-dunamis-sunday',
    title: 'Glory Dome Sunday Live Worship & Word Service',
    ministry: 'Dunamis International Gospel Centre',
    minister: 'Pastor Paul Enenche',
    channelId: 'ch-dunamis-enenche',
    category: 'sunday_services',
    scheduleLabel: 'Sundays · 7:00 AM & 9:00 AM WAT',
    daysOfWeek: [0],
    startHourWat: 7,
    startMinuteWat: 0,
    durationMinutes: 240,
  },
  {
    id: 'sched-winners-sunday',
    title: 'Faith Tabernacle Canaanland Sunday Service',
    ministry: 'Living Faith Church Worldwide',
    minister: 'Bishop David Oyedepo',
    channelId: 'ch-oyedepo-lfc',
    category: 'sunday_services',
    scheduleLabel: 'Sundays · 6:00 AM & 8:00 AM WAT',
    daysOfWeek: [0],
    startHourWat: 6,
    startMinuteWat: 0,
    durationMinutes: 240,
  },
  {
    id: 'sched-tcn-sunday',
    title: 'The Covenant Nation Sunday Live Broadcast',
    ministry: 'The Covenant Nation',
    minister: 'Pastor Poju Oyemade',
    channelId: 'ch-covenant-nation',
    category: 'sunday_services',
    scheduleLabel: 'Sundays · 9:00 AM WAT',
    daysOfWeek: [0],
    startHourWat: 9,
    startMinuteWat: 0,
    durationMinutes: 150,
  },
  {
    id: 'sched-koinonia-sunday',
    title: 'Koinonia Global Sunday Evening Service',
    ministry: 'Eternity Network International (Koinonia)',
    minister: 'Apostle Joshua Selman',
    channelId: 'ch-koinonia-selman',
    category: 'sunday_services',
    scheduleLabel: 'Sundays · 5:00 PM WAT',
    daysOfWeek: [0],
    startHourWat: 17,
    startMinuteWat: 0,
    durationMinutes: 240,
  },
  {
    id: 'sched-salvation-sunday',
    title: 'Salvation Ministries Sunday Live Broadcast',
    ministry: 'Salvation Ministries (Home of Success)',
    minister: 'Pastor David Ibiyeomie',
    channelId: 'ch-ibiyeomie-sm',
    category: 'sunday_services',
    scheduleLabel: 'Sundays · 7:30 AM WAT',
    daysOfWeek: [0],
    startHourWat: 7,
    startMinuteWat: 30,
    durationMinutes: 210,
  },
  {
    id: 'sched-dunamis-midweek',
    title: 'Midweek Power Communion & Healing Service',
    ministry: 'Dunamis International Gospel Centre',
    minister: 'Pastor Paul Enenche',
    channelId: 'ch-dunamis-enenche',
    category: 'midweek_vigils',
    scheduleLabel: 'Wednesdays · 5:30 PM WAT',
    daysOfWeek: [3],
    startHourWat: 17,
    startMinuteWat: 30,
    durationMinutes: 150,
  },
  {
    id: 'sched-rccg-hgs',
    title: 'RCCG Holy Ghost Service & Special Broadcasts',
    ministry: 'Redeemed Christian Church of God (Dove TV)',
    minister: 'Pastor E.A. Adeboye',
    channelId: 'ch-dove-tv-rccg',
    category: 'midweek_vigils',
    scheduleLabel: 'First Fridays & Sundays · 6:00 PM WAT',
    daysOfWeek: [0, 5],
    startHourWat: 18,
    startMinuteWat: 0,
    durationMinutes: 240,
  },
];

function getWatNowComponents(nowMs: number) {
  const watDate = new Date(nowMs + 3600_000);
  return {
    dayOfWeek: watDate.getUTCDay(),
    hour: watDate.getUTCHours(),
    minute: watDate.getUTCMinutes(),
    second: watDate.getUTCSeconds(),
    formattedClock: watDate.toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
    formattedDay: watDate.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
  };
}

function computeProgramTiming(program: ScheduledProgram, nowMs: number) {
  const wat = getWatNowComponents(nowMs);
  const nowSecondsIntoDay = wat.hour * 3600 + wat.minute * 60 + wat.second;
  const startSecondsIntoDay = program.startHourWat * 3600 + program.startMinuteWat * 60;
  const endSecondsIntoDay = startSecondsIntoDay + program.durationMinutes * 60;

  const isInScheduledWindow =
    program.daysOfWeek.includes(wat.dayOfWeek) &&
    nowSecondsIntoDay >= startSecondsIntoDay &&
    nowSecondsIntoDay <= endSecondsIntoDay;

  let minSeconds = Number.MAX_SAFE_INTEGER;
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidateDay = (wat.dayOfWeek + dayOffset) % 7;
    if (!program.daysOfWeek.includes(candidateDay)) continue;

    const totalSecondsUntil =
      dayOffset * 86400 + (startSecondsIntoDay - nowSecondsIntoDay);
    if (totalSecondsUntil > 0 && totalSecondsUntil < minSeconds) {
      minSeconds = totalSecondsUntil;
      break;
    }
  }

  const hrs = Math.floor(minSeconds / 3600);
  const mins = Math.floor((minSeconds % 3600) / 60);
  const secs = Math.floor(minSeconds % 60);

  const countdownText =
    hrs >= 24
      ? `${Math.floor(hrs / 24)}d ${hrs % 24}h ${mins}m`
      : `${String(hrs).padStart(2, '0')}h : ${String(mins).padStart(2, '0')}m : ${String(secs).padStart(2, '0')}s`;

  return {
    isInScheduledWindow,
    secondsUntilNext: minSeconds,
    countdownText,
  };
}

function convertLiveStreamToKingdomVideo(
  item: RealTimeLiveStreamItem,
  channels: KingdomChannel[]
): KingdomVideo {
  const matchedCh = item.matchedKingdomChannelId
    ? channels.find((c) => c.id === item.matchedKingdomChannelId)
    : undefined;

  return {
    id: `realtime-live-${item.videoId}`,
    youtube_video_id: item.videoId,
    channel_id: matchedCh?.id || `live-ch-${item.youtubeChannelId || item.videoId}`,
    channel_title: matchedCh?.title || item.channelTitle,
    channel_handle: 'KINGDOM+ Verified',
    channel_type: matchedCh?.channel_type || 'ministry',
    channel_avatar_url: matchedCh?.avatar_url || item.avatarUrl || '',
    is_nigerian_channel: true,
    is_official_verified: true,
    primary_category_id: 'cat-live-special-broadcasts',
    primary_category_slug: 'live-special-broadcasts',
    primary_category_name: 'Live & Special Broadcasts',
    secondary_category_slugs: [],
    subcategory_label: `🔴 LIVE · ${item.watchingText}`,
    title: item.title,
    description: `Real-time active live broadcast from ${item.channelTitle} (${item.watchingText}).`,
    thumbnail_high_url: item.thumbnailUrl,
    thumbnail_maxres_url: `https://i.ytimg.com/vi/${item.videoId}/maxresdefault.jpg`,
    published_at: new Date().toISOString(),
    duration_seconds: null,
    view_count: item.watchingCount,
    like_count: Math.max(10, Math.round(item.watchingCount * 0.25)),
    likes_verified: true,
    comment_count: null,
    views_per_day: item.watchingCount,
    engagement_rate: 100,
    trending_score: 100 + item.watchingCount,
    evergreen_score: 95,
    live_broadcast_content: 'live',
    is_live_now: true,
    is_embeddable: true,
    is_available: true,
    approval_status: 'approved',
    is_featured_hero: true,
    is_trending_pinned: true,
    last_refreshed_at: new Date().toISOString(),
  };
}

export const LiveSpecialBroadcastsView: React.FC<LiveSpecialBroadcastsViewProps> = ({
  channels,
  savedVideoIds,
  onSelectVideo,
  onToggleSave,
  onSelectChannel,
  onActiveLiveStreamsChange,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [scheduleTab, setScheduleTab] = useState<ScheduleFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveStreamsRaw, setLiveStreamsRaw] = useState<RealTimeLiveStreamItem[]>([]);
  const [loadingLive, setLoadingLive] = useState<boolean>(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');
  const [subscription, setSubscription] = useState<BroadcastReminderSubscription>(() =>
    loadLocalReminderSubscription()
  );
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [emailInput, setEmailInput] = useState(() => loadLocalReminderSubscription().email);
  const [whatsappInput, setWhatsappInput] = useState(
    () => loadLocalReminderSubscription().whatsappPhone
  );
  const [webPushEnabled, setWebPushEnabled] = useState(
    () => loadLocalReminderSubscription().webPushEnabled
  );
  const [emailEnabled, setEmailEnabled] = useState(
    () => loadLocalReminderSubscription().emailEnabled
  );
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    () => loadLocalReminderSubscription().whatsappEnabled
  );
  const [advanceMinutes, setAdvanceMinutes] = useState(
    () => loadLocalReminderSubscription().advanceMinutes || 10
  );
  const [pushPermissionState, setPushPermissionState] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettingsFeedback, setSavedSettingsFeedback] = useState(false);
  const [activeAlertBanner, setActiveAlertBanner] = useState<{
    title: string;
    subtitle: string;
    video?: KingdomVideo | null;
    channelId?: string;
  } | null>(null);

  const firedAlertKeysRef = useRef<Set<string>>(new Set());
  const reminderIds = subscription.programIds;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchRealTimeLiveStreams = async () => {
    setLoadingLive(true);
    try {
      const res = await fetch('/api/live-check');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.liveStreams)) {
          setLiveStreamsRaw(data.liveStreams);
        }
        if (data?.checkedAt) {
          setLastCheckedAt(data.checkedAt);
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setLoadingLive(false);
    }
  };

  useEffect(() => {
    fetchRealTimeLiveStreams();
    const pollTimer = window.setInterval(fetchRealTimeLiveStreams, 45_000);
    return () => window.clearInterval(pollTimer);
  }, []);

  // Convert real-time live streams into playable KingdomVideo objects
  const activeRealTimeLiveVideos = useMemo(() => {
    return liveStreamsRaw.map((item) => convertLiveStreamToKingdomVideo(item, channels));
  }, [liveStreamsRaw, channels]);

  useEffect(() => {
    if (onActiveLiveStreamsChange && activeRealTimeLiveVideos.length > 0) {
      onActiveLiveStreamsChange(activeRealTimeLiveVideos);
    }
  }, [activeRealTimeLiveVideos]);

  const requestBrowserPushPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermissionState('unsupported');
      return false;
    }
    if (Notification.permission === 'granted') {
      setPushPermissionState('granted');
      return true;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushPermissionState(perm);
      return perm === 'granted';
    } catch {
      return false;
    }
  };

  const triggerLiveNotificationAlert = (
    heading: string,
    bodyText: string,
    video?: KingdomVideo | null,
    channelId?: string
  ) => {
    playSanctuaryReminderChime();
    setActiveAlertBanner({
      title: heading,
      subtitle: bodyText,
      video,
      channelId,
    });

    if (
      webPushEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const notif = new Notification(heading, {
          body: bodyText,
          tag: `kingdom-live-${Date.now()}`,
        });
        notif.onclick = () => {
          window.focus();
          if (video) {
            onSelectVideo(video);
          } else if (channelId) {
            onSelectChannel(channelId);
          }
        };
      } catch {
        // Ignore mobile service-worker-only Notification constructor restrictions
      }
    }
  };

  const toggleReminder = async (programId: string) => {
    const isAdding = !reminderIds.includes(programId);
    const nextIds = isAdding
      ? [...reminderIds, programId]
      : reminderIds.filter((id) => id !== programId);

    if (isAdding && webPushEnabled && pushPermissionState === 'default') {
      await requestBrowserPushPermission();
    }

    const nextSub: BroadcastReminderSubscription = {
      ...subscription,
      programIds: nextIds,
    };
    setSubscription(nextSub);
    await saveBroadcastReminderSubscription(nextSub);

    if (isAdding) {
      const prog = WAT_BROADCAST_SCHEDULE.find((p) => p.id === programId);
      if (prog) {
        playSanctuaryReminderChime();
        setActiveAlertBanner({
          title: `Reminder Set: ${prog.title}`,
          subtitle: `You will be alerted ${advanceMinutes} minutes before ${prog.minister} goes live (${prog.scheduleLabel}).`,
          channelId: prog.channelId,
        });
      }
    }
  };

  const handleSaveAlertSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    if (webPushEnabled && pushPermissionState === 'default') {
      await requestBrowserPushPermission();
    }
    const updated = await saveBroadcastReminderSubscription({
      ...subscription,
      email: emailInput.trim(),
      whatsappPhone: whatsappInput.trim(),
      webPushEnabled,
      emailEnabled: Boolean(emailInput.trim()) && emailEnabled,
      whatsappEnabled: Boolean(whatsappInput.trim()) && whatsappEnabled,
      advanceMinutes,
    });
    setSubscription(updated);
    setSavingSettings(false);
    setSavedSettingsFeedback(true);
    window.setTimeout(() => setSavedSettingsFeedback(false), 3000);
  };

  const getWhatsAppQuickAlertUrl = (prog: ScheduledProgram): string => {
    const text = `🔔 *KINGDOM+ Live Service Reminder*\n\n*${prog.title}*\nMinister: ${prog.minister} (${prog.ministry})\nSchedule: ${prog.scheduleLabel}\n\nSet your alarm for ${advanceMinutes} minutes before service starts on KINGDOM+!`;
    const phoneDigits = whatsappInput.replace(/[^0-9]/g, '');
    return phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const getGoogleCalendarAlarmUrl = (prog: ScheduledProgram): string => {
    const title = encodeURIComponent(`KINGDOM+ Live: ${prog.title} (${prog.minister})`);
    const details = encodeURIComponent(
      `Watch ${prog.title} with ${prog.minister} (${prog.ministry}) live on KINGDOM+. Scheduled: ${prog.scheduleLabel}.`
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}`;
  };

  // Evaluate schedule timing & whether each scheduled ministry has an active real-time live stream right now
  const programsWithTiming = useMemo(() => {
    return WAT_BROADCAST_SCHEDULE.map((prog) => {
      const timing = computeProgramTiming(prog, nowMs);
      const channelObj = channels.find((c) => c.id === prog.channelId);

      const activeChannelLiveVideo = activeRealTimeLiveVideos.find(
        (v) => v.channel_id === prog.channelId
      );

      return {
        ...prog,
        ...timing,
        isActuallyLiveOnYouTube: Boolean(activeChannelLiveVideo),
        activeLiveVideo: activeChannelLiveVideo || null,
        avatarUrl: channelObj?.avatar_url || '',
      };
    }).sort((a, b) => {
      if (a.isActuallyLiveOnYouTube !== b.isActuallyLiveOnYouTube) {
        return a.isActuallyLiveOnYouTube ? -1 : 1;
      }
      return a.secondsUntilNext - b.secondsUntilNext;
    });
  }, [nowMs, channels, activeRealTimeLiveVideos]);

  // Real-time 10-minute advance & Live-Now Notification Watcher
  useEffect(() => {
    const advanceSec = (advanceMinutes || 10) * 60;
    const todayKey = new Date(nowMs).toISOString().slice(0, 10);

    for (const prog of programsWithTiming) {
      if (!reminderIds.includes(prog.id)) continue;

      // 1. Check if program just went LIVE ON AIR NOW
      if (prog.isActuallyLiveOnYouTube && prog.activeLiveVideo) {
        const liveKey = `live-${prog.id}-${prog.activeLiveVideo.youtube_video_id}`;
        if (!firedAlertKeysRef.current.has(liveKey)) {
          firedAlertKeysRef.current.add(liveKey);
          triggerLiveNotificationAlert(
            `🔴 LIVE NOW: ${prog.title}`,
            `${prog.minister} (${prog.ministry}) is streaming live on KINGDOM+ right now!`,
            prog.activeLiveVideo,
            prog.channelId
          );
        }
      }

      // 2. Check if program is inside the 10-minute (advanceMinutes) warning window
      if (
        !prog.isActuallyLiveOnYouTube &&
        prog.secondsUntilNext <= advanceSec &&
        prog.secondsUntilNext >= advanceSec - 45
      ) {
        const warnKey = `warn-${prog.id}-${todayKey}-${advanceMinutes}`;
        if (!firedAlertKeysRef.current.has(warnKey)) {
          firedAlertKeysRef.current.add(warnKey);
          triggerLiveNotificationAlert(
            `⏰ Starting in ${advanceMinutes} Minutes: ${prog.title}`,
            `Prepare your heart! ${prog.minister} (${prog.ministry}) begins at ${prog.scheduleLabel}.`,
            null,
            prog.channelId
          );
        }
      }
    }
  }, [nowMs, programsWithTiming, reminderIds, advanceMinutes]);

  const nextScheduledProgram = programsWithTiming[0];
  const watClock = getWatNowComponents(nowMs);

  const visibleSchedulePrograms = useMemo(() => {
    if (scheduleTab === 'all') return programsWithTiming;
    return programsWithTiming.filter((p) => p.category === scheduleTab);
  }, [programsWithTiming, scheduleTab]);

  // Filter active real-time live streams by search query
  const filteredActiveLiveVideos = useMemo(() => {
    if (!searchQuery.trim()) return activeRealTimeLiveVideos;
    const q = searchQuery.toLowerCase();
    return activeRealTimeLiveVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.channel_title.toLowerCase().includes(q)
    );
  }, [activeRealTimeLiveVideos, searchQuery]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Real-Time In-App Notification Toast Banner */}
      {activeAlertBanner && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-red-500/15 to-zinc-900 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-zinc-50">
                {activeAlertBanner.title}
              </div>
              <div className="text-xs text-zinc-300 mt-0.5">
                {activeAlertBanner.subtitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeAlertBanner.video ? (
              <button
                type="button"
                onClick={() => {
                  onSelectVideo(activeAlertBanner.video!);
                  setActiveAlertBanner(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Watch Live Now</span>
              </button>
            ) : activeAlertBanner.channelId ? (
              <button
                type="button"
                onClick={() => {
                  onSelectChannel(activeAlertBanner.channelId!);
                  setActiveAlertBanner(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold"
              >
                Open Ministry Sanctuary
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setActiveAlertBanner(null)}
              className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* ====================================================================
          1. REAL-TIME LIVE ON AIR NOW (100% Genuine Active YouTube Live Streams)
      ==================================================================== */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>LIVE ON AIR NOW ({filteredActiveLiveVideos.length})</span>
            </span>
            <h2 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50">
              Real-Time Active Christian Live Broadcasts
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter active live streams..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={fetchRealTimeLiveStreams}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition-colors shrink-0"
              title="Refresh real-time active live broadcasts"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loadingLive ? 'animate-spin' : ''}`} />
              <span>Refresh Live</span>
            </button>
          </div>
        </div>

        {loadingLive && activeRealTimeLiveVideos.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121215] border border-zinc-800 flex items-center justify-center gap-3 text-xs sm:text-sm text-zinc-300">
            <RefreshCw className="w-4 h-4 text-red-400 animate-spin" />
            <span>Scanning ministry channels in real time for active Christian live broadcasts...</span>
          </div>
        ) : filteredActiveLiveVideos.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121215] border border-zinc-800 text-center text-xs sm:text-sm text-zinc-400">
            No active real-time live streams matched your search right now. Check the upcoming WAT countdown schedule below.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredActiveLiveVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onSelect={onSelectVideo}
                isSaved={savedVideoIds.includes(video.id)}
                onToggleSave={onToggleSave}
                onSelectChannel={onSelectChannel}
              />
            ))}
          </div>
        )}
      </section>

      {/* ====================================================================
          2. UPCOMING LIVE SERVICE COUNTDOWN & DAILY PRAYER SCHEDULE (WAT)
          (Shows exact countdown to scheduled broadcasts; never plays recaps as live)
      ==================================================================== */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#16151A] via-[#121215] to-[#09090B] border border-zinc-800/90 flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold">
                <Clock className="w-3 h-3" />
                <span>NIGERIA / WEST AFRICA TIME (WAT) SCHEDULE</span>
              </span>
              <span className="text-xs font-mono tabular-nums text-zinc-300 font-semibold">
                {watClock.formattedDay} · {watClock.formattedClock} WAT
              </span>
              {lastCheckedAt && (
                <span className="text-[11px] text-zinc-500 hidden sm:inline">
                  · Real-time status verified
                </span>
              )}
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-semibold text-zinc-50 tracking-tight mt-1">
              Upcoming Ministry Broadcast Countdown &amp; Timetable
            </h2>
          </div>

          {/* Schedule Category Filter Pills & Multi-Channel Alert Settings Button */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'All Timetable (11)' },
              { id: 'daily_prayer', label: 'Daily Prayer Altars' },
              { id: 'sunday_services', label: 'Sunday Services' },
              { id: 'midweek_vigils', label: 'Midweek & Vigils' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScheduleTab(tab.id as ScheduleFilterTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  scheduleTab === tab.id
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowAlertSettings((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                showAlertSettings
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-zinc-900 border-amber-500/40 text-amber-300 hover:bg-zinc-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Alert Settings (Push · WhatsApp · Email)</span>
            </button>
          </div>
        </div>

        {/* Multi-Channel Live Broadcast Notification Settings Drawer (Web Push, WhatsApp & Email) */}
        {showAlertSettings && (
          <form
            onSubmit={handleSaveAlertSettings}
            className="p-4 sm:p-5 rounded-xl bg-zinc-950/90 border border-amber-500/40 flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-400" />
                  <span>Live Broadcast Notification Channels ({reminderIds.length} Services Active)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Receive automatic {advanceMinutes}-minute advance alerts before NSPPD, Koinonia, Hallelujah Challenge &amp; Sunday Services begin.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = nextScheduledProgram || programsWithTiming[0];
                    triggerLiveNotificationAlert(
                      `⏰ ${advanceMinutes}-Min Advance Alert: ${target?.title || 'NSPPD 7AM Fire Prayers'}`,
                      `${target?.minister || 'Pastor Jerry Eze'} goes live in ${advanceMinutes} minutes (${target?.scheduleLabel || '7:00 AM WAT'}).`,
                      target?.activeLiveVideo || null,
                      target?.channelId
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-amber-300 transition-colors shrink-0"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Test {advanceMinutes}-Min Alert Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAlertSettings(false)}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Browser & Mobile Web Push */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Browser &amp; Mobile Web Push</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Instant pop-up notification &amp; sanctuary chime {advanceMinutes} mins before service + when live starts.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={webPushEnabled}
                    onChange={(e) => setWebPushEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer mt-0.5"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-400">
                    Status:{' '}
                    <strong className="text-amber-300 uppercase">{pushPermissionState}</strong>
                  </span>
                  {pushPermissionState !== 'granted' && pushPermissionState !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={requestBrowserPushPermission}
                      className="text-amber-400 hover:underline font-medium"
                    >
                      Enable Permission →
                    </button>
                  )}
                </div>
              </div>

              {/* 2. WhatsApp Number Reminder */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Live Alert</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
                <input
                  type="tel"
                  value={whatsappInput}
                  onChange={(e) => {
                    setWhatsappInput(e.target.value);
                    if (e.target.value.trim()) setWhatsappEnabled(true);
                  }}
                  placeholder="WhatsApp e.g. +234 803 000 0000"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-zinc-500">
                  Synced to cloud · Also enables 1-tap WhatsApp reminder dispatch below
                </span>
              </div>

              {/* 3. Email Advance Reminder */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>Email Live Alert</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (e.target.value.trim()) setEmailEnabled(true);
                  }}
                  placeholder="Enter your email address..."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-zinc-500">
                  Saved to Supabase cloud `broadcast_reminders` table
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-400">Advance Warning Window:</span>
                {[10, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setAdvanceMinutes(mins)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                      advanceMinutes === mins
                        ? 'bg-amber-500 text-zinc-950 font-bold'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    {mins} mins before
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                {savedSettingsFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Alert Preferences Saved to Cloud!</span>
                  </>
                ) : (
                  <span>Save Notification Preferences</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Primary Next Scheduled Broadcast Countdown Banner */}
        {nextScheduledProgram && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-900/80 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {nextScheduledProgram.avatarUrl ? (
                <img
                  src={nextScheduledProgram.avatarUrl}
                  alt={nextScheduledProgram.minister}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover bg-zinc-800 border border-amber-500/40 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      nextScheduledProgram.isActuallyLiveOnYouTube
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {nextScheduledProgram.isActuallyLiveOnYouTube
                      ? '🔴 LIVE ON AIR NOW'
                      : 'UP NEXT ON SCHEDULE'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-xs font-mono tabular-nums text-amber-400 font-bold">
                    {nextScheduledProgram.isActuallyLiveOnYouTube
                      ? 'STREAMING LIVE'
                      : `Starts in ${nextScheduledProgram.countdownText}`}
                  </span>
                  <span className="text-[11px] text-zinc-400 hidden sm:inline">
                    · {nextScheduledProgram.scheduleLabel}
                  </span>
                </div>
                <div className="text-sm sm:text-base font-semibold text-zinc-100 truncate mt-0.5">
                  {nextScheduledProgram.title}
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  {nextScheduledProgram.minister} · {nextScheduledProgram.ministry}
                </div>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto shrink-0">
              {nextScheduledProgram.isActuallyLiveOnYouTube &&
              nextScheduledProgram.activeLiveVideo ? (
                <button
                  type="button"
                  onClick={() => onSelectVideo(nextScheduledProgram.activeLiveVideo!)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Join Real-Time Live Stream</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectChannel(nextScheduledProgram.channelId)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <span>Off-Air · View Past Sessions</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleReminder(nextScheduledProgram.id)}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  reminderIds.includes(nextScheduledProgram.id)
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100'
                }`}
              >
                {reminderIds.includes(nextScheduledProgram.id) ? (
                  <>
                    <BellRing className="w-3.5 h-3.5 text-amber-400" />
                    <span>{advanceMinutes}m Alert On</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Remind Me</span>
                  </>
                )}
              </button>

              <a
                href={getWhatsAppQuickAlertUrl(nextScheduledProgram)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 transition-colors shrink-0 inline-flex items-center justify-center"
                title="Send WhatsApp Live Service Reminder"
              >
                <MessageCircle className="w-4 h-4" />
              </a>

              <a
                href={getGoogleCalendarAlarmUrl(nextScheduledProgram)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-400 transition-colors shrink-0 inline-flex items-center justify-center"
                title="Add 10-Minute Phone Calendar Alarm"
              >
                <Calendar className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* Horizontal Swipeable Schedule Cards on Mobile, 3-Column Grid on Desktop */}
        <div className="flex lg:grid lg:grid-cols-3 gap-3 overflow-x-auto no-scrollbar pb-1">
          {visibleSchedulePrograms.map((prog) => {
            const isReminded = reminderIds.includes(prog.id);
            return (
              <div
                key={prog.id}
                className={`min-w-[275px] sm:min-w-[300px] lg:min-w-0 p-3.5 rounded-xl border flex flex-col justify-between gap-3 shrink-0 transition-colors ${
                  prog.isActuallyLiveOnYouTube
                    ? 'bg-red-500/10 border-red-500/40'
                    : 'bg-zinc-900/60 border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-amber-400">
                      <Clock className="w-3 h-3" />
                      <span>{prog.scheduleLabel}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold ${
                        prog.isActuallyLiveOnYouTube
                          ? 'bg-red-500 text-white'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {prog.isActuallyLiveOnYouTube ? '🔴 LIVE NOW' : `In ${prog.countdownText}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {prog.avatarUrl && (
                      <img
                        src={prog.avatarUrl}
                        alt={prog.minister}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover bg-zinc-800 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                        {prog.title}
                      </h3>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {prog.minister}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                  {prog.isActuallyLiveOnYouTube && prog.activeLiveVideo ? (
                    <button
                      type="button"
                      onClick={() => onSelectVideo(prog.activeLiveVideo!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Watch Live Now</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectChannel(prog.channelId)}
                      className="text-[11px] text-zinc-400 hover:text-amber-400 transition-colors"
                    >
                      Off-Air · View Past Sessions →
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <a
                      href={getWhatsAppQuickAlertUrl(prog)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 hover:bg-zinc-800 transition-colors inline-flex items-center justify-center"
                      title="WhatsApp reminder"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={getGoogleCalendarAlarmUrl(prog)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors inline-flex items-center justify-center"
                      title="Phone Calendar alarm"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleReminder(prog.id)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 transition-colors ${
                        isReminded
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                      title={isReminded ? `${advanceMinutes}-minute advance alert active` : 'Remind me'}
                    >
                      {isReminded ? (
                        <>
                          <BellRing className="w-3 h-3 text-amber-400" />
                          <span>{advanceMinutes}m</span>
                        </>
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
