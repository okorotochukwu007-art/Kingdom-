import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Flame,
  HeartHandshake,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  DAILY_ALTAR_EVENT,
  DailyAltarProgress,
  getDailyAltarProgress,
  getVerseOfTheDay,
  recordDailyAltarActivity,
} from '../utils/dailyAltar.ts';
import { emitAppToast, shareDailyVerse } from '../utils/shareVideo.ts';

interface DailyAltarCardProps {
  userId?: string | null;
  onOpenPrayerWall?: () => void;
}

export const DailyAltarCard: React.FC<DailyAltarCardProps> = ({
  userId,
  onOpenPrayerWall,
}) => {
  const [progress, setProgress] = useState<DailyAltarProgress>(() =>
    getDailyAltarProgress(userId)
  );
  const [sharingVerse, setSharingVerse] = useState(false);

  const verse = React.useMemo(() => getVerseOfTheDay(), []);

  useEffect(() => {
    setProgress(getDailyAltarProgress(userId));
  }, [userId]);

  useEffect(() => {
    const sync = () => setProgress(getDailyAltarProgress(userId));
    window.addEventListener(DAILY_ALTAR_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DAILY_ALTAR_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);

  const checkedInToday =
    progress.todayActivities.checkin ||
    progress.todayActivities.watch ||
    progress.todayActivities.pray;

  const formattedToday = React.useMemo(() => {
    try {
      return new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Today';
    }
  }, []);

  const handleAmenCheckIn = () => {
    const res = recordDailyAltarActivity('checkin', userId);
    setProgress(res.progress);
    if (res.streakJustIncremented) {
      emitAppToast(
        res.progress.currentStreak > 1
          ? `${res.progress.currentStreak}-Day Altar Streak kept alive!`
          : 'Day 1 Daily Altar Streak started!'
      );
    } else {
      emitAppToast('Amen! Today’s Daily Altar is already active.');
    }
  };

  const handleShareVerse = async () => {
    setSharingVerse(true);
    try {
      await shareDailyVerse(verse.text, verse.reference);
    } finally {
      setSharingVerse(false);
    }
  };

  return (
    <section
      aria-label="Daily Altar & Verse of the Day"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#17151B] via-[#121215] to-[#0D0D10] border border-amber-500/25 p-4 sm:p-6 shadow-xl"
    >
      <div className="flex flex-col gap-3.5 sm:gap-4">
        {/* Top Row: Label + Streak Badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-300 tracking-tight">
                  Daily Altar · Verse of the Day
                </span>
                <span className="text-[11px] text-zinc-500 hidden sm:inline">
                  {formattedToday}
                </span>
              </div>
            </div>
          </div>

          {/* Streak Counter Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
                progress.currentStreak > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              <Flame
                className={`w-3.5 h-3.5 ${
                  progress.currentStreak > 0
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-zinc-500'
                }`}
              />
              <span className="font-mono tabular-nums">
                {progress.currentStreak > 0
                  ? `${progress.currentStreak}-Day Streak`
                  : 'Start Streak'}
              </span>
            </div>
            {progress.bestStreak > progress.currentStreak && (
              <span className="text-[11px] font-mono tabular-nums text-zinc-400 hidden sm:inline">
                Best: {progress.bestStreak}d
              </span>
            )}
          </div>
        </div>

        {/* Verse Text + Reference + Prayer Prompt */}
        <div className="flex flex-col gap-1.5">
          <blockquote className="font-display text-base sm:text-xl font-medium text-zinc-50 leading-snug">
            “{verse.text}”
          </blockquote>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="font-semibold text-amber-400">{verse.reference}</span>
            <span aria-hidden="true" className="text-zinc-600">
              ·
            </span>
            <span className="text-zinc-400">{verse.prayerPrompt}</span>
          </div>
        </div>

        {/* Bottom Row: Today's Habits + Actions */}
        <div className="pt-2.5 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Today's 3-Part Spiritual Rhythm */}
          <div className="flex items-center flex-wrap gap-2 text-[11px]">
            {[
              { key: 'checkin', label: 'Daily Word', done: progress.todayActivities.checkin },
              { key: 'watch', label: 'Watch Sermon', done: progress.todayActivities.watch },
              { key: 'pray', label: 'Pray', done: progress.todayActivities.pray },
            ].map((item) => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                  item.done
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
                }`}
              >
                {item.done ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                )}
                <span>{item.label}</span>
              </span>
            ))}
          </div>

          {/* Interactive Mobile CTA Row */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAmenCheckIn}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all min-h-[38px] active:scale-95 ${
                progress.todayActivities.checkin
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md'
              }`}
            >
              {progress.todayActivities.checkin ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Amen · Claimed</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{checkedInToday ? 'Amen · Claim Word' : 'Amen · Check In'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareVerse}
              disabled={sharingVerse}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-medium transition-colors min-h-[38px]"
              title="Share Today's Verse on WhatsApp or Social"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Share Verse</span>
            </button>

            {onOpenPrayerWall && (
              <button
                type="button"
                onClick={onOpenPrayerWall}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-amber-300 text-xs font-medium transition-colors min-h-[38px]"
              >
                <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
                <span>Prayer Wall</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
