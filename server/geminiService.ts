import { GoogleGenAI, Type } from '@google/genai';
import { MarriageCollectionSlug, SpeakerGender } from '../src/types/kingdom.ts';
import {
  LEGACY_TO_MAIN_CATEGORY_MAP,
  MAIN_STREAMING_CATEGORY_SLUGS,
  SEED_CATEGORIES,
} from './seedData.ts';

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ClassificationResult {
  primaryCategorySlug: string;
  secondaryCategorySlugs: string[];
  subcategoryLabel: string;
  legacyCategorySlug?: string;
  marriageCollections: MarriageCollectionSlug[];
  reason: string;
  isRelevantChristianContent: boolean;
  shouldQueueForAdminReview?: boolean;
}

/**
 * STRICT MARRIAGE & RELATIONSHIPS SUBJECT EVALUATOR
 * Evaluates a video by its actual title, subject, and context — NEVER simply by the
 * minister's name or because a music video mentions "single" or a sermon mentions
 * "relationship with the Holy Spirit".
 */
export function evaluateMarriageAndRelationships(
  title: string,
  description: string,
  channelTitle: string,
  channelType: string,
  speakerGender?: SpeakerGender
): {
  isMarriageRelevant: boolean;
  marriageCollections: MarriageCollectionSlug[];
  subcategoryLabel: string;
  reason: string;
} {
  const titleLower = title.toLowerCase();
  const descLower = description.slice(0, 450).toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // 1. HARD EXCLUSIONS: Never allow music videos, Hallelujah Challenge, prayer watches,
  // spiritual-only "relationship with God/Holy Spirit", or feature drama movies in Marriage & Relationships
  if (
    channelType === 'artist' ||
    channelType === 'movie_studio' ||
    channelType === 'animation_studio'
  ) {
    return { isMarriageRelevant: false, marriageCollections: [], subcategoryLabel: '', reason: '' };
  }

  if (
    /\b(hallelujah challenge|hallelujah festival|nsppd|manna water|revival hour|night of mercy|official video|official audio|lyric video|music video|praise medley|worship session|spontaneous worship|latest nigerian movie|nigerian movie|full movie)\b/i.test(
      combined
    )
  ) {
    return { isMarriageRelevant: false, marriageCollections: [], subcategoryLabel: '', reason: '' };
  }

  // Exclude spiritual phrases like "Relationship with the Holy Spirit", "Relationship with God/Jesus", "Bride of Christ"
  if (
    /\b(relationship with (?:the )?(?:holy spirit|god|jesus|christ|the lord|the father)|intimate with the holy spirit|fellowship with the holy spirit|bride of christ)\b/i.test(
      titleLower
    )
  ) {
    return { isMarriageRelevant: false, marriageCollections: [], subcategoryLabel: '', reason: '' };
  }

  // Exclude vague/personal/promo titles that do not teach a marriage/relationship subject
  if (
    /^(watch the full video|this or that|this was us \d+ years ago|church invite)$/i.test(
      titleLower.trim()
    ) ||
    /\b(days to my wife's birthday|global app|stay connected to the wisdom|don't want to miss this|encounter '\d+|moment of refreshing with)\b/i.test(
      titleLower
    )
  ) {
    return { isMarriageRelevant: false, marriageCollections: [], subcategoryLabel: '', reason: '' };
  }

  // Exclude general sermons on faith, ministry regret, national transformation, or finances unless tied to marriage/family
  if (
    /\b(what i regret after \d+ years of ministry|if your faith isn't working|what nigeria needs is not just more money|connection between influence, character|how to attract favor|keys to multiplication|prevailing prayer|watchmen|victory over amalek|global anointing service|special thanksgiving service|cathedral dedication)\b/i.test(
      titleLower
    )
  ) {
    return { isMarriageRelevant: false, marriageCollections: [], subcategoryLabel: '', reason: '' };
  }

  // 2. STRICT TITLE-LEVEL SUBJECT VERIFICATION
  const hasExplicitMarriageTitleTopic =
    /\b(marriage|marriages|marital|marry|married|marrying|dating|courtship|courting|single|singles|singleness|fiance|fiancee|wedding|bride|groom|husband|husbands|wife|wives|spouse|spouses|couple|couples|boyfriend|girlfriend|life partner|right partner|the one|love code|talking stage|celibate|celibacy|breakup|heartbreak|infidelity|cheating|divorce|submission|submit in marriage|parent|parents|parenting|raising children|mother|mothers|motherhood|father|fathers|fatherhood|family|families|godly home|home builder|relationship|relationships|his needs|her needs|love series|opposite sex)\b/i.test(
      titleLower
    ) ||
    (/\b(love|partner|babe|woman|women|man|men|home|children)\b/i.test(titleLower) &&
      /\b(marriage|marital|dating|courtship|relationship|singles|husband|wife|couples|parenting|wedding)\b/i.test(
        descLower
      ));

  if (!hasExplicitMarriageTitleTopic) {
    return { isMarriageRelevant: false, marriageCollections: [], subcategoryLabel: '', reason: '' };
  }

  // 3. ASSIGN TO THE 13 MARRIAGE & RELATIONSHIPS COLLECTIONS
  const collections = new Set<MarriageCollectionSlug>();
  let subcategoryLabel = 'Marriage & Family Teaching';

  // (2) Christian Dating & Courtship
  if (
    /\b(dating|courtship|courting|talking stage|boyfriend|girlfriend|long-distance relationship|kissing|how far is too far|celibate|celibacy|opposite sex|is this really the one|searching for the one|finding the right partner|attract.*partner|faulty relationship selection|how we met|love story|love code)\b/i.test(
      combined
    )
  ) {
    collections.add('christian-dating-courtship');
    subcategoryLabel = 'Christian Dating & Courtship';
  }

  // (3) Advice for Singles
  if (
    /\b(single|singles|singleness|unmarried|not married|why are you not married|late marriage|marrying young|waiting|before you marry|ready for marriage|breakup|surviving a breakup|attract.*wrong person)\b/i.test(
      combined
    )
  ) {
    collections.add('advice-for-singles');
    if (subcategoryLabel === 'Marriage & Family Teaching') subcategoryLabel = 'Advice for Singles';
  }

  // (4) Preparing for Marriage
  if (
    /\b(before marriage|before you marry|before getting married|getting married soon|prepare.*marriage|prepared for marriage|instrument rated for marriage|compatibility|wedding|thresholds every single|things to do before|should marry him|recognize your god given|recognise your god given|fears about him|don't marry)\b/i.test(
      combined
    )
  ) {
    collections.add('preparing-for-marriage');
    if (subcategoryLabel === 'Marriage & Family Teaching') subcategoryLabel = 'Preparing for Marriage';
  }

  // (5) Marriage Counselling
  if (
    /\b(counselling|counseling|communication|conflict|conflicts|differences|love and respect|his needs|her needs|pillars|stages every couple|stages of marriage|expectations in relationship|what not to delegate|secret to a successful marriage|make your marriage work|what happy couples do|love tonics|sweet marriage|marital success|succeed in marriage|succeeding in marriage)\b/i.test(
      combined
    )
  ) {
    collections.add('marriage-counselling');
    if (subcategoryLabel === 'Marriage & Family Teaching') subcategoryLabel = 'Marriage Counselling';
  }

  // (6) Marriage Restoration
  if (
    /\b(save your marriage|divorce|bounced back|bad marriage|troubled marriage|crisis|infidelity|cheating|mending broken|healing|trauma and marriage|anger in marriage|forgiveness|rescue series|marriage from hell|keep your marriage from crashing|don't let your marriage die|wife battering|say "i'm sorry"|say i'm sorry)\b/i.test(
      combined
    )
  ) {
    collections.add('marriage-restoration');
    subcategoryLabel = 'Marriage Restoration';
  }

  // (7) Women & Relationships
  const isFemaleSpeaker =
    speakerGender === 'female' ||
    /\b(mildred|nike adeyemi|funke|miracle|laju|sarah omakwu|laurie idahosa|deola ojo|ibukun awosika)\b/i.test(
      `${titleLower} ${channelTitle.toLowerCase()}`
    );
  if (
    /\b(women|woman|wife|wives|ladies|mothers|girl|sisters|matriarch|losing yourself as a wife|married women|submit in marriage|submission|husband or boyfriend)\b/i.test(
      combined
    ) ||
    isFemaleSpeaker
  ) {
    collections.add('women-and-relationships');
  }

  // (8) Men & Relationships
  if (
    /\b(men|man|husband|husbands|fathers|fatherhood|brothers|god given wife|when i ask men|where are the men)\b/i.test(
      titleLower
    ) ||
    (speakerGender === 'male' &&
      /\b(men|husband|father|leadership in marriage|marry right|marry any man)\b/i.test(combined))
  ) {
    collections.add('men-and-relationships');
  }

  // (9) Husband & Wife Teachings
  if (
    /\b(husband|wife|husbands|wives|couple|couples|spouse|submission|submit|complement your partner|love and respect|his needs|her needs|gender roles|living in harmony|serving one another|married|years of marriage|marriage triangle)\b/i.test(
      combined
    )
  ) {
    collections.add('husband-and-wife-teachings');
    if (subcategoryLabel === 'Marriage & Family Teaching') subcategoryLabel = 'Husband & Wife Teachings';
  }

  // (10) Parenting & Family
  if (
    /\b(parent|parents|parenting|child|children|kids|son|daughter|mothers|fathers|father's day|mother's day|pregnant|expectant mothers|raising children|gen z parent|family|families)\b/i.test(
      combined
    )
  ) {
    collections.add('parenting-and-family');
    subcategoryLabel = 'Parenting & Family Life';
  }

  // (11) Relationship Questions & Answers
  if (
    /\b(q\s*&\s*a|question and answer|questions and answers|answer.*questions|answers|open mic|ask men|the question christians are afraid to ask|is kissing a sin|should you accept gifts)\b/i.test(
      combined
    )
  ) {
    collections.add('relationship-qa');
    subcategoryLabel = 'Relationship Q&A';
  }

  // (12) Marriage Conferences
  if (
    /\b(conference|summit|banquet|marital matters meeting|love code service|singles' summit|mothers' summit|university of marriage|seminar|symposium)\b/i.test(
      combined
    )
  ) {
    collections.add('marriage-conferences');
  }

  // (13) Building a Godly Home
  if (
    /\b(godly home|great family|love that builds|covenant pathway|marital bliss|back to the design|marriage is good|beauty of marriage|preserve|preserving relationships|lasting relationships|living in harmony|god kind of love|build.*marriage|successful marriage)\b/i.test(
      combined
    )
  ) {
    collections.add('building-a-godly-home');
  }

  // Always include 'trending-marriage-teachings' as an eligible collection so high-velocity videos surface there
  collections.add('trending-marriage-teachings');

  // Ensure every genuine marriage video has at least one specific thematic collection in addition to trending
  if (collections.size === 1) {
    collections.add('building-a-godly-home');
    collections.add('husband-and-wife-teachings');
  }

  return {
    isMarriageRelevant: true,
    marriageCollections: Array.from(collections),
    subcategoryLabel,
    reason: `Verified Christian marriage, courtship, family, or relationship teaching from ${channelTitle}.`,
  };
}

/**
 * High-precision deterministic semantic classifier tailored to the EIGHT Approved Main
 * Streaming Categories in KINGDOM+ while keeping the 4 Christian Movie categories intact
 * and preserving legacy subcategory labels so zero information is ever lost.
 */
export function classifyVideoDeterministic(
  title: string,
  description: string,
  channelTitle: string,
  channelType: string,
  defaultCategorySlug: string,
  durationSeconds?: number | null,
  liveBroadcastContent?: 'live' | 'upcoming' | 'none',
  speakerGender?: SpeakerGender
): ClassificationResult {
  const text = `${title} ${description.slice(0, 500)}`.toLowerCase();
  const titleLower = title.toLowerCase();
  const secondary = new Set<string>();
  const mappedDefault = LEGACY_TO_MAIN_CATEGORY_MAP[defaultCategorySlug || 'sermons-teachings'] || {
    mainSlug: 'sermons-teachings',
    subcategoryLabel: 'Sermons & Teachings',
  };
  let primary: string = mappedDefault.mainSlug;
  let subcategoryLabel = mappedDefault.subcategoryLabel || 'Sermons & Teachings';
  let legacyCategorySlug: string | undefined =
    defaultCategorySlug && defaultCategorySlug !== mappedDefault.mainSlug
      ? defaultCategorySlug
      : undefined;
  let reason = `Curated under ${primary.replace(/-/g, ' ')} from verified official channel (${channelTitle}).`;

  // 0. Filter out generic/unrelated/clickbait or non-Christian content
  if (
    /\b(prank|crypto|forex|betting|casino|gossip|nollywood gossip|celebrity drama|unboxing|gaming|highlights reel|discusses donald trump)\b/i.test(
      titleLower
    )
  ) {
    return {
      primaryCategorySlug: 'sermons-teachings',
      secondaryCategorySlugs: [],
      subcategoryLabel: 'Sermons & Teachings',
      marriageCollections: [],
      reason: 'Filtered out: unrelated or non-ministry content.',
      isRelevantChristianContent: false,
    };
  }

  // Quarantine vague teaser/promo/personal snippets to Admin Review Queue
  if (
    /^(watch the full video|this or that|this was us \d+ years ago|church invite|#sarahomakwu)$/i.test(
      titleLower.trim()
    ) ||
    /\b(17 days to my wife's birthday|sam oye global app|stay connected to the wisdom|you really don’t want to miss this|you really don't want to miss this)\b/i.test(
      titleLower
    )
  ) {
    return {
      primaryCategorySlug: 'sermons-teachings',
      secondaryCategorySlugs: [],
      subcategoryLabel: 'Sermons & Teachings',
      marriageCollections: [],
      reason: 'Sent to Admin Review Queue: promotional or short personal clip without a full teaching topic.',
      isRelevantChristianContent: true,
      shouldQueueForAdminReview: true,
    };
  }

  // 1. Dedicated Christian Movie or Animation Studio (Section 2: Movies MUST remain untouched in their movie categories!)
  if (
    channelType === 'movie_studio' ||
    channelType === 'animation_studio' ||
    defaultCategorySlug === 'real-christian-movies' ||
    defaultCategorySlug === 'bible-stories' ||
    defaultCategorySlug === 'christian-animations' ||
    defaultCategorySlug === 'bible-story-cartoons' ||
    /\b(latest nigerian movie|latest mount zion movie|nigerian christian movie|full movie)\b/i.test(
      titleLower
    )
  ) {
    if (
      defaultCategorySlug === 'bible-story-cartoons' ||
      /\b(kids|cartoon|children|elementary|early childhood|sunday school|hey-o)\b/i.test(text)
    ) {
      primary = 'bible-story-cartoons';
      subcategoryLabel = 'Bible Story Cartoons';
      reason = `Animated Bible story cartoon curated from ${channelTitle}.`;
      secondary.add('christian-animations');
      secondary.add('bible-stories');
    } else if (
      defaultCategorySlug === 'christian-animations' ||
      /\b(superbook|bibleproject|animated|animation|3d)\b/i.test(text)
    ) {
      primary = 'christian-animations';
      subcategoryLabel = 'Christian Animations';
      reason = `Animated biblical narrative from ${channelTitle}.`;
      secondary.add('bible-stories');
    } else if (
      defaultCategorySlug === 'bible-stories' ||
      /\b(the chosen|jesus|moses|david|samson|gospel of|testament|jerusalem|nativity|disciples)\b/i.test(
        text
      )
    ) {
      primary = 'bible-stories';
      subcategoryLabel = 'Bible Stories';
      reason = `Biblical dramatisation and scriptural story from ${channelTitle}.`;
      secondary.add('real-christian-movies');
    } else {
      primary = 'real-christian-movies';
      subcategoryLabel = 'Real Christian Movies';
      reason = `Christian feature movie or faith drama series from ${channelTitle}.`;
    }
    secondary.delete(primary);
    return {
      primaryCategorySlug: primary,
      secondaryCategorySlugs: Array.from(secondary).slice(0, 2),
      subcategoryLabel,
      marriageCollections: [],
      reason,
      isRelevantChristianContent: true,
    };
  }

  // 2. Active LIVE broadcasts -> Live & Special Broadcasts
  if (liveBroadcastContent === 'live') {
    primary = 'live-special-broadcasts';
    subcategoryLabel = 'Live Broadcast';
    legacyCategorySlug = 'live-worship';
    reason = `Active live Christian broadcast streaming now from ${channelTitle}.`;
    if (/\b(nsppd|prayer|intercession|warfare|hallelujah challenge)\b/i.test(text)) {
      secondary.add('prayer-spiritual-warfare');
    } else if (channelType === 'artist') {
      secondary.add('worship-praise');
    } else {
      secondary.add('sermons-teachings');
    }
    secondary.delete(primary);
    return {
      primaryCategorySlug: primary,
      secondaryCategorySlugs: Array.from(secondary).slice(0, 2),
      subcategoryLabel,
      legacyCategorySlug,
      marriageCollections: [],
      reason,
      isRelevantChristianContent: true,
    };
  }

  // 3. Gospel Artists & Worship Leaders (Must be evaluated BEFORE general keyword rules so music videos NEVER bleed into Marriage & Relationships!)
  if (channelType === 'artist') {
    // Hallelujah Challenge / Prayer sessions led by worship leaders (e.g. Nathaniel Bassey) -> Prayer & Spiritual Warfare
    if (
      /\b(hallelujah challenge|hallelujah festival|prayer session|midnight prayer|hours in tongues)\b/i.test(
        titleLower
      )
    ) {
      primary = 'prayer-spiritual-warfare';
      subcategoryLabel = 'Hallelujah Challenge & Prayer Watch';
      reason = `Corporate worship and midnight prayer watch (${title}) led by ${channelTitle}.`;
      secondary.add('worship-praise');
      secondary.add('live-special-broadcasts');
    } else if (
      /\b(praise medley|praise session|highlife|thanksgiving|afrogospel|energetic praise|nigerian praise|yoruba praise|igbo praise|hausa gospel|shout hallelujah|praise party|alujo|odupe|shekere african praise)\b/i.test(
        text
      )
    ) {
      primary = 'worship-praise';
      subcategoryLabel = 'Praise & Thanksgiving';
      legacyCategorySlug = 'praise-thanksgiving';
      reason = `Energetic praise session or Nigerian gospel medley from ${channelTitle}.`;
      secondary.add('gospel-music');
    } else {
      const hasDeepWorshipMarkers =
        /\b(spontaneous worship|deep worship|chant|chants|soaking worship|altar worship|worship session|worship ministration|live ministration|worship night|uninterrupted worship|ascend|spirit of god|holy spirit|yahweh|elohim|adonai|revival worship|mount carmel worship|hausa worship medley)\b/i.test(
          text
        );
      const isExtendedSession = Boolean(durationSeconds && durationSeconds >= 660);

      if (hasDeepWorshipMarkers || (defaultCategorySlug === 'deep-worship' && isExtendedSession)) {
        primary = 'worship-praise';
        subcategoryLabel = 'Deep Worship';
        legacyCategorySlug = 'deep-worship';
        reason = `Extended or spontaneous deep worship ministration from ${channelTitle}.`;
        secondary.add('gospel-music');
        if (/\b(live at|live in|concert)\b/i.test(titleLower)) {
          secondary.add('live-special-broadcasts');
        }
      } else if (
        /\b(live worship|live recording|live in lagos|live at|worship experience|worship concert)\b/i.test(
          titleLower
        ) &&
        isExtendedSession
      ) {
        primary = 'worship-praise';
        subcategoryLabel = 'Live Worship';
        legacyCategorySlug = 'live-worship';
        reason = `Full-length live worship performance from ${channelTitle}.`;
        secondary.add('gospel-music');
        secondary.add('live-special-broadcasts');
      } else {
        primary = 'gospel-music';
        subcategoryLabel = 'Official Gospel Music';
        reason = `Official gospel music release or performance by ${channelTitle}.`;
        if (
          defaultCategorySlug === 'deep-worship' ||
          defaultCategorySlug === 'worship-praise' ||
          defaultCategorySlug === 'praise-thanksgiving'
        ) {
          secondary.add('worship-praise');
        }
      }
    }

    secondary.delete(primary);
    return {
      primaryCategorySlug: primary,
      secondaryCategorySlugs: Array.from(secondary).slice(0, 2),
      subcategoryLabel,
      legacyCategorySlug,
      marriageCollections: [],
      reason,
      isRelevantChristianContent: true,
    };
  }

  // 4. STRICT MARRIAGE & RELATIONSHIPS CHECK (Evaluated by actual video subject, never by minister name alone!)
  const marriageCheck = evaluateMarriageAndRelationships(
    title,
    description,
    channelTitle,
    channelType,
    speakerGender
  );
  if (marriageCheck.isMarriageRelevant) {
    primary = 'marriage-relationships';
    subcategoryLabel = marriageCheck.subcategoryLabel;
    reason = marriageCheck.reason;
    secondary.add('sermons-teachings');
    if (marriageCheck.marriageCollections.includes('marriage-conferences')) {
      secondary.add('conferences-events');
    }
    secondary.delete(primary);
    return {
      primaryCategorySlug: primary,
      secondaryCategorySlugs: Array.from(secondary).slice(0, 2),
      subcategoryLabel,
      marriageCollections: marriageCheck.marriageCollections,
      reason,
      isRelevantChristianContent: true,
    };
  }

  // 5. Prayer & Spiritual Warfare (Includes NSPPD, Hallelujah Challenge, midnight prayers, deliverance, fasting)
  if (
    /\b(nsppd|prayer session|midnight prayer|morning prayer|command the morning|prayer and fasting|fasting|deliverance|spiritual warfare|warfare prayer|altar of fire|intercession|healing service|night of mercy|hallelujah challenge|hallelujah festival|hours in tongues|praying in the spirit|revival hour|manna water|prophetic prayer hour|prayer watch|prevailing prayer)\b/i.test(
      text
    )
  ) {
    primary = 'prayer-spiritual-warfare';
    if (/\bhallelujah challenge\b/i.test(text)) {
      subcategoryLabel = 'Hallelujah Challenge';
    } else if (/\bnsppd\b/i.test(text)) {
      subcategoryLabel = 'NSPPD Prayer Broadcast';
    } else if (/\b(deliverance|spiritual warfare|warfare)\b/i.test(text)) {
      subcategoryLabel = 'Spiritual Warfare & Deliverance';
    } else {
      subcategoryLabel = 'Prayer & Intercession';
    }
    reason = `Fervent prayer session, spiritual warfare, or deliverance programme from ${channelTitle}.`;
    if (/\b(prophetic|declaration|blessing|new month)\b/i.test(text)) {
      secondary.add('sermons-teachings');
    }
    if (/\b(live|broadcast|stream)\b/i.test(titleLower)) {
      secondary.add('live-special-broadcasts');
    }
  }
  // 6. Conferences & Events (The Experience Lagos, Shiloh, Holy Ghost Congress, WAFBEC, Church Conventions, Leadership Events)
  else if (
    /\b(the experience lagos|the experience\b|shiloh\s*\d*|holy ghost congress|wafbec|koinonia conference|sound of revival|festival of life|global crusade|kingdom life world conference|convocation|annual convention|international conference|ministers conference|church convention|special convention|wisdom conference|word conference)\b/i.test(
      text
    )
  ) {
    primary = 'conferences-events';
    subcategoryLabel = 'Christian Conferences & Conventions';
    reason = `Complete Christian conference or major ministry convention recording from ${channelTitle}.`;
    secondary.add('sermons-teachings');
    if (/\b(live)\b/i.test(titleLower)) {
      secondary.add('live-special-broadcasts');
    }
  }
  // 7. Live & Special Broadcasts (Live church services, Sunday live broadcasts, special live programmes, communion services)
  else if (
    /\b(sunday live service|sunday service|live church service|live service|special broadcast|live broadcast|global communion service|global service|special live|live worship service|sunday worship service|first sunday service|cross over service|crossover service|miracle service|communion service|easter live|christmas carol service|holy ghost service|night of bliss|special thanksgiving service)\b/i.test(
      titleLower
    ) ||
    (defaultCategorySlug === 'live-special-broadcasts' &&
      /\b(service|broadcast|live|sunday|midweek|communion)\b/i.test(titleLower))
  ) {
    primary = 'live-special-broadcasts';
    subcategoryLabel = /\b(sunday|church service)\b/i.test(titleLower)
      ? 'Live Church Service'
      : 'Special Live Broadcast';
    legacyCategorySlug = 'live-worship';
    reason = `Live church service or special ministry broadcast from ${channelTitle}.`;
    secondary.add('sermons-teachings');
  }
  // 8. Worship & Praise from Churches/Ministries
  else if (
    /\b(praise medley|praise session|thanksgiving service|evening of praise|jesus praise|shout hallelujah|worship session|deep worship|praise & worship session)\b/i.test(
      titleLower
    )
  ) {
    primary = 'worship-praise';
    subcategoryLabel = /\b(praise|thanksgiving)\b/i.test(titleLower)
      ? 'Praise & Thanksgiving'
      : 'Deep Worship';
    legacyCategorySlug = /\b(praise|thanksgiving)\b/i.test(titleLower)
      ? 'praise-thanksgiving'
      : 'deep-worship';
    reason = `Congregational worship, praise, and thanksgiving session from ${channelTitle}.`;
    secondary.add('sermons-teachings');
  }
  // 9. Christian Living — Testimonies
  else if (
    /\b(testimony|testimonies|miracle|healed of|delivered from|what god cannot do does not exist)\b/i.test(
      titleLower
    )
  ) {
    primary = 'christian-living';
    subcategoryLabel = 'Testimonies';
    legacyCategorySlug = 'testimonies';
    reason = `Documented Christian testimony and thanksgiving story from ${channelTitle}.`;
    secondary.add('prayer-spiritual-warfare');
  }
  // 10. Christian Living — Christian Motivation, Faith & Purpose, Personal Development, Spiritual Discipline, Character
  else if (
    /\b(purpose|personal development|discipline|career|financial wisdom|finances|wealth|excellence|mindset|overcoming challenges|destiny|vision|time management|how to succeed|capacity|solving problems|reinventing yourself|achieve greatness|keys to multiplication|character|christian living|christian lifestyle|spiritual discipline|success principles|daily living|mental health|emotional intelligence)\b/i.test(
      text
    )
  ) {
    primary = 'christian-living';
    subcategoryLabel = 'Christian Motivation & Purpose';
    legacyCategorySlug = 'christian-motivation';
    reason = `Teaching on Christian living, faith & purpose, discipline, and personal development from ${channelTitle}.`;
    secondary.add('sermons-teachings');
  }
  // 11. Sermons & Teachings — Prophetic Messages
  else if (
    /\b(prophetic|prophecy|new month|happy new month|prophetic declaration|prophetic word|enter the month|thus saith the lord|anointing service|covenant day of|revival message|i will overturn)\b/i.test(
      text
    )
  ) {
    primary = 'sermons-teachings';
    subcategoryLabel = 'Prophetic Messages';
    legacyCategorySlug = 'prophetic-messages';
    reason = `Officially published prophetic teaching and declaration from ${channelTitle}.`;
    secondary.add('prayer-spiritual-warfare');
  }
  // 12. Sermons & Teachings — Bible Study & Biblical Explanations
  else if (
    /\b(bible study|digging deep|verse by verse|book of|epistle|exegesis|scriptural study|sunday school|doctrine|biblical explanation)\b/i.test(
      text
    )
  ) {
    primary = 'sermons-teachings';
    subcategoryLabel = 'Bible Study';
    legacyCategorySlug = 'bible-study';
    reason = `Structured Bible study and doctrinal teaching from ${channelTitle}.`;
  }
  // 13. Sermons & Teachings — Christian Leadership & Spiritual Growth
  else if (
    /\b(leadership|spiritual growth|spiritual maturity|knowing god|holy spirit|kingdom principles)\b/i.test(
      text
    )
  ) {
    primary = 'sermons-teachings';
    subcategoryLabel = 'Spiritual Growth & Leadership';
    reason = `Full sermon on spiritual growth and Christian leadership from ${channelTitle}.`;
    secondary.add('christian-living');
  }
  // 14. Default for Ministers/Churches -> NEVER default to 'marriage-relationships' if evaluateMarriageAndRelationships returned false!
  else {
    primary =
      mappedDefault.mainSlug && mappedDefault.mainSlug !== 'marriage-relationships'
        ? mappedDefault.mainSlug
        : 'sermons-teachings';
    subcategoryLabel = mappedDefault.subcategoryLabel || 'Sermons & Teachings';
    reason = `Full sermon and biblical teaching from ${channelTitle}.`;
    if (primary !== 'sermons-teachings') {
      secondary.add('sermons-teachings');
    }
  }

  // Strictly ensure 'marriage-relationships' is never in secondary unless marriageCheck passed
  secondary.delete('marriage-relationships');
  secondary.delete(primary);

  return {
    primaryCategorySlug: primary,
    secondaryCategorySlugs: Array.from(secondary).slice(0, 2),
    subcategoryLabel,
    legacyCategorySlug,
    marriageCollections: [],
    reason,
    isRelevantChristianContent: true,
  };
}

/**
 * Uses Gemini 3.8 Flash on the server to classify a video into the 8 Approved Main KINGDOM+
 * categories and evaluate its relevance for Nigerian & international Christian audiences.
 */
export async function classifyVideoWithGemini(
  title: string,
  description: string,
  channelTitle: string,
  channelType: string,
  defaultCategorySlug: string,
  speakerGender?: SpeakerGender
): Promise<ClassificationResult> {
  const deterministic = classifyVideoDeterministic(
    title,
    description,
    channelTitle,
    channelType,
    defaultCategorySlug,
    null,
    'none',
    speakerGender
  );

  // Respect strict deterministic guardrails for Marriage & Relationships, Artists, Movies, and Admin Review Queue
  if (
    deterministic.primaryCategorySlug === 'marriage-relationships' ||
    channelType === 'artist' ||
    channelType === 'movie_studio' ||
    channelType === 'animation_studio' ||
    deterministic.shouldQueueForAdminReview
  ) {
    return deterministic;
  }

  const ai = getGenAIClient();
  if (!ai) {
    return deterministic;
  }

  const validSlugs: string[] = [...MAIN_STREAMING_CATEGORY_SLUGS];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Classify this Christian YouTube video for KINGDOM+, a Nigerian-first premium Christian streaming platform.
Channel: ${channelTitle} (${channelType})
Video Title: ${title}
Description Snippet: ${description.slice(0, 450)}
Allowed Main Category Slugs: ${validSlugs.join(', ')}`,
      config: {
        systemInstruction:
          'You are the editorial curator for KINGDOM+. Select the most accurate primaryCategorySlug and up to 2 secondaryCategorySlugs from the allowed 8 main categories. CRITICAL RULE: Only assign marriage-relationships if the actual video title and subject are explicitly about Christian dating, courtship, singles, marriage preparation, marriage counselling, marriage restoration, husband/wife roles, parenting, or building a godly home. Never assign Hallelujah Challenge, prayer watches, gospel music, or general sermons to marriage-relationships.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryCategorySlug: { type: Type.STRING },
            secondaryCategorySlugs: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            subcategoryLabel: { type: Type.STRING },
            reason: { type: Type.STRING },
            isRelevantChristianContent: { type: Type.BOOLEAN },
          },
          required: ['primaryCategorySlug', 'secondaryCategorySlugs', 'reason', 'isRelevantChristianContent'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    let primary = validSlugs.includes(parsed.primaryCategorySlug)
      ? parsed.primaryCategorySlug
      : deterministic.primaryCategorySlug;

    // Enforce strict Marriage & Relationships guardrail even on AI output
    if (primary === 'marriage-relationships' && !deterministic.marriageCollections.length) {
      primary = deterministic.primaryCategorySlug;
    }

    const secondary = Array.isArray(parsed.secondaryCategorySlugs)
      ? parsed.secondaryCategorySlugs
          .filter(
            (s: string) =>
              validSlugs.includes(s) && s !== primary && s !== 'marriage-relationships'
          )
          .slice(0, 2)
      : [];

    return {
      primaryCategorySlug: primary,
      secondaryCategorySlugs: secondary,
      subcategoryLabel: parsed.subcategoryLabel || deterministic.subcategoryLabel,
      legacyCategorySlug: deterministic.legacyCategorySlug,
      marriageCollections:
        primary === 'marriage-relationships' ? deterministic.marriageCollections : [],
      reason: parsed.reason || deterministic.reason,
      isRelevantChristianContent: parsed.isRelevantChristianContent !== false,
    };
  } catch {
    return deterministic;
  }
}
