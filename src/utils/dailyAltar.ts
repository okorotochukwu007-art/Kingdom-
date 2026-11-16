export interface DailyVerse {
  reference: string;
  text: string;
  prayerPrompt: string;
}

export interface DailyAltarProgress {
  currentStreak: number;
  bestStreak: number;
  totalDaysActive: number;
  lastCheckInDate: string | null;
  todayDate: string;
  todayActivities: {
    checkin: boolean;
    watch: boolean;
    pray: boolean;
  };
}

export type AltarActivityType = 'checkin' | 'watch' | 'pray';

export const DAILY_ALTAR_EVENT = 'kingdom-daily-altar-change';
const STORAGE_PREFIX = 'kingdom_plus_daily_altar_v1_';

const DAILY_VERSES: DailyVerse[] = [
  {
    reference: 'Psalm 23:1',
    text: 'The Lord is my shepherd; I shall not want.',
    prayerPrompt: 'Thank God for His guidance and daily provision over your family.',
  },
  {
    reference: 'Isaiah 40:31',
    text: 'Those who wait on the Lord shall renew their strength; they shall mount up with wings like eagles.',
    prayerPrompt: 'Ask the Holy Spirit for fresh strength and peace for today.',
  },
  {
    reference: 'Jeremiah 29:11',
    text: 'For I know the thoughts that I think toward you, says the Lord, thoughts of peace and not of evil, to give you a future and a hope.',
    prayerPrompt: 'Declare God’s peace and bright future over every plan this week.',
  },
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through Christ who strengthens me.',
    prayerPrompt: 'Commit today’s work and challenges into Christ’s capable hands.',
  },
  {
    reference: 'Proverbs 3:5–6',
    text: 'Trust in the Lord with all your heart, and lean not on your own understanding; in all your ways acknowledge Him, and He shall direct your paths.',
    prayerPrompt: 'Seek divine direction before making any big decision today.',
  },
  {
    reference: 'Psalm 91:1–2',
    text: 'He who dwells in the secret place of the Most High shall abide under the shadow of the Almighty.',
    prayerPrompt: 'Pray for divine covering and protection over your household.',
  },
  {
    reference: 'Joshua 1:9',
    text: 'Be strong and of good courage; do not be afraid, nor be dismayed, for the Lord your God is with you wherever you go.',
    prayerPrompt: 'Release fear and step boldly into today knowing God goes before you.',
  },
  {
    reference: 'Romans 8:28',
    text: 'And we know that all things work together for good to those who love God, to those who are the called according to His purpose.',
    prayerPrompt: 'Trust God to turn every delay or battle into a testimony.',
  },
  {
    reference: 'Psalm 27:1',
    text: 'The Lord is my light and my salvation; whom shall I fear? The Lord is the strength of my life; of whom shall I be afraid?',
    prayerPrompt: 'Declare light over darkness and victory over every anxiety.',
  },
  {
    reference: 'Lamentations 3:22–23',
    text: 'Through the Lord’s mercies we are not consumed, because His compassions fail not. They are new every morning; great is Your faithfulness.',
    prayerPrompt: 'Give thanks for fresh mercy and grace waking you up today.',
  },
  {
    reference: 'Isaiah 41:10',
    text: 'Fear not, for I am with you; be not dismayed, for I am your God. I will strengthen you, yes, I will help you.',
    prayerPrompt: 'Receive God’s supernatural help in your finances, health, and calling.',
  },
  {
    reference: 'Psalm 118:24',
    text: 'This is the day the Lord has made; we will rejoice and be glad in it.',
    prayerPrompt: 'Choose joy and thanksgiving at the start of today.',
  },
  {
    reference: '2 Corinthians 5:7',
    text: 'For we walk by faith, not by sight.',
    prayerPrompt: 'Pray for steadfast faith beyond what your eyes can see right now.',
  },
  {
    reference: 'Ephesians 3:20',
    text: 'Now to Him who is able to do exceedingly abundantly above all that we ask or think, according to the power that works in us.',
    prayerPrompt: 'Believe God for breakthroughs beyond human expectations.',
  },
  {
    reference: 'Matthew 6:33',
    text: 'But seek first the kingdom of God and His righteousness, and all these things shall be added to you.',
    prayerPrompt: 'Put God first in your schedule, heart, and priorities today.',
  },
  {
    reference: 'Psalm 46:1',
    text: 'God is our refuge and strength, a very present help in trouble.',
    prayerPrompt: 'Rest in God’s unshakeable presence and help right now.',
  },
  {
    reference: 'Galatians 6:9',
    text: 'And let us not grow weary while doing good, for in due season we shall reap if we do not lose heart.',
    prayerPrompt: 'Pray for endurance as you wait for your harvest season.',
  },
  {
    reference: 'Psalm 121:1–2',
    text: 'I will lift up my eyes to the hills—from whence comes my help? My help comes from the Lord, who made heaven and earth.',
    prayerPrompt: 'Look to the Lord alone as your true source of help.',
  },
  {
    reference: '2 Timothy 1:7',
    text: 'For God has not given us a spirit of fear, but of power and of love and of a sound mind.',
    prayerPrompt: 'Speak peace, clarity, and boldness over your mind today.',
  },
  {
    reference: 'Psalm 34:8',
    text: 'Oh, taste and see that the Lord is good; blessed is the man who trusts in Him!',
    prayerPrompt: 'Expect tangible reminders of God’s goodness today.',
  },
  {
    reference: 'Proverbs 18:10',
    text: 'The name of the Lord is a strong tower; the righteous run to it and are safe.',
    prayerPrompt: 'Call on the name of Jesus over your home, travel, and work.',
  },
  {
    reference: 'Romans 15:13',
    text: 'Now may the God of hope fill you with all joy and peace in believing, that you may abound in hope by the power of the Holy Spirit.',
    prayerPrompt: 'Ask the Holy Spirit to overflow your heart with hope today.',
  },
  {
    reference: 'Matthew 11:28',
    text: 'Come to Me, all you who labor and are heavy laden, and I will give you rest.',
    prayerPrompt: 'Hand over every heavy burden to Jesus in prayer right now.',
  },
  {
    reference: 'Isaiah 54:17',
    text: 'No weapon formed against you shall prosper, and every tongue which rises against you in judgment you shall condemn.',
    prayerPrompt: 'Pray in authority over your destiny, family, and peace.',
  },
  {
    reference: 'Philippians 4:6–7',
    text: 'Be anxious for nothing, but in everything by prayer and supplication, with thanksgiving, let your requests be made known to God.',
    prayerPrompt: 'Turn every worry into a prayer of thanksgiving right now.',
  },
  {
    reference: 'John 16:33',
    text: 'In the world you will have tribulation; but be of good cheer, I have overcome the world.',
    prayerPrompt: 'Walk in the victory Christ already won for you.',
  },
  {
    reference: 'Psalm 37:4',
    text: 'Delight yourself also in the Lord, and He shall give you the desires of your heart.',
    prayerPrompt: 'Spend a quiet moment simply worshipping God for who He is.',
  },
  {
    reference: '1 Peter 5:7',
    text: 'Casting all your care upon Him, for He cares for you.',
    prayerPrompt: 'Trust that God genuinely cares about every detail of your life.',
  },
  {
    reference: 'Hebrews 11:1',
    text: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
    prayerPrompt: 'Speak faith-filled declarations over the promises you are trusting God for.',
  },
  {
    reference: 'Joel 2:25',
    text: 'So I will restore to you the years that the swarming locust has eaten.',
    prayerPrompt: 'Pray for divine restoration over lost time, opportunities, and joy.',
  },
  {
    reference: 'Psalm 1:1–3',
    text: 'He shall be like a tree planted by the rivers of water, that brings forth its fruit in its season, and whatever he does shall prosper.',
    prayerPrompt: 'Ask God to root you deeply in His Word so you bear lasting fruit.',
  },
];

export function formatLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getYesterdayDateKey(baseDate: Date = new Date()): string {
  const prev = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1);
  return formatLocalDateKey(prev);
}

export function getVerseOfTheDay(date: Date = new Date()): DailyVerse {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const idx = Math.abs(dayOfYear) % DAILY_VERSES.length;
  return DAILY_VERSES[idx];
}

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

interface StoredAltarData {
  currentStreak: number;
  bestStreak: number;
  totalDaysActive: number;
  lastCheckInDate: string | null;
  lastActivitiesDate: string | null;
  todayActivities: {
    checkin: boolean;
    watch: boolean;
    pray: boolean;
  };
}

function readStoredAltar(key: string): StoredAltarData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredAltarData;
    }
  } catch {}
  return null;
}

export function getDailyAltarProgress(userId?: string | null): DailyAltarProgress {
  const today = formatLocalDateKey();
  const yesterday = getYesterdayDateKey();

  let stored = readStoredAltar(getStorageKey(userId));
  // If signed-in user has no saved streak yet, inherit guest streak if present
  if (!stored && userId) {
    stored = readStoredAltar(getStorageKey(null));
  }

  if (!stored) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalDaysActive: 0,
      lastCheckInDate: null,
      todayDate: today,
      todayActivities: { checkin: false, watch: false, pray: false },
    };
  }

  const isActiveToday = stored.lastCheckInDate === today;
  const isAliveFromYesterday = stored.lastCheckInDate === yesterday;
  const effectiveStreak =
    isActiveToday || isAliveFromYesterday ? stored.currentStreak || 0 : 0;

  const todayActivities =
    stored.lastActivitiesDate === today && stored.todayActivities
      ? {
          checkin: Boolean(stored.todayActivities.checkin),
          watch: Boolean(stored.todayActivities.watch),
          pray: Boolean(stored.todayActivities.pray),
        }
      : { checkin: false, watch: false, pray: false };

  return {
    currentStreak: effectiveStreak,
    bestStreak: stored.bestStreak || effectiveStreak,
    totalDaysActive: stored.totalDaysActive || 0,
    lastCheckInDate: stored.lastCheckInDate || null,
    todayDate: today,
    todayActivities,
  };
}

export function recordDailyAltarActivity(
  activity: AltarActivityType,
  userId?: string | null
): { progress: DailyAltarProgress; streakJustIncremented: boolean } {
  const today = formatLocalDateKey();
  const yesterday = getYesterdayDateKey();
  const key = getStorageKey(userId);
  const current = getDailyAltarProgress(userId);

  const alreadyCheckedInToday = current.lastCheckInDate === today;
  let nextStreak = current.currentStreak;
  let nextTotalDays = current.totalDaysActive;
  let streakJustIncremented = false;

  if (!alreadyCheckedInToday) {
    if (current.lastCheckInDate === yesterday) {
      nextStreak = (current.currentStreak || 0) + 1;
    } else {
      nextStreak = 1;
    }
    nextTotalDays += 1;
    streakJustIncremented = true;
  }

  const nextBest = Math.max(current.bestStreak, nextStreak);
  const nextActivities = {
    ...current.todayActivities,
    [activity]: true,
  };

  const payload: StoredAltarData = {
    currentStreak: nextStreak,
    bestStreak: nextBest,
    totalDaysActive: nextTotalDays,
    lastCheckInDate: today,
    lastActivitiesDate: today,
    todayActivities: nextActivities,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      if (userId) {
        // Keep guest copy in sync so pre-login view stays consistent
        localStorage.setItem(getStorageKey(null), JSON.stringify(payload));
      }
    } catch {}
    window.dispatchEvent(new CustomEvent(DAILY_ALTAR_EVENT));
  }

  return {
    progress: {
      currentStreak: nextStreak,
      bestStreak: nextBest,
      totalDaysActive: nextTotalDays,
      lastCheckInDate: today,
      todayDate: today,
      todayActivities: nextActivities,
    },
    streakJustIncremented,
  };
}
