import {
  ChristianLivingSubcategoryConfig,
  ChristianLivingSubcategorySlug,
  ContentCategory,
  KingdomChannel,
  KingdomVideo,
  SpeakerGender,
} from '../src/types/kingdom.ts';
import {
  computeVideoRankingMetrics,
  fetchChannelVideosViaOfficialXmlFeed,
  RawFeedVideoItem,
  searchYouTubeStructured,
} from './youtubeService.ts';

/**
 * THE 11 APPROVED CHRISTIAN LIVING SUBCATEGORIES (Section 6)
 */
export const CHRISTIAN_LIVING_SUBCATEGORIES: ChristianLivingSubcategoryConfig[] = [
  {
    slug: 'personal-growth-spiritual-development',
    name: 'Personal Growth and Spiritual Development',
    subtitle: 'Building spiritual maturity, discipline, mind renewal, and personal transformation',
    display_order: 1,
    is_active: true,
  },
  {
    slug: 'family-and-parenting',
    name: 'Family and Parenting',
    subtitle: 'Raising godly children, biblical family values, and generational legacy',
    display_order: 2,
    is_active: true,
  },
  {
    slug: 'christian-finances-and-wealth',
    name: 'Christian Finances and Wealth',
    subtitle: 'Kingdom stewardship, financial wisdom, diligence, business excellence, and prosperity',
    display_order: 3,
    is_active: true,
  },
  {
    slug: 'purpose-career-and-destiny',
    name: 'Purpose, Career and Destiny',
    subtitle: 'Discovering God’s assignment, leadership, workplace excellence, and fulfilling destiny',
    display_order: 4,
    is_active: true,
  },
  {
    slug: 'christian-youth-and-young-adults',
    name: 'Christian Youth and Young Adults',
    subtitle: 'Navigating young adulthood, purity, focus, mentorship, and thriving in your youth',
    display_order: 5,
    is_active: true,
  },
  {
    slug: 'faith-in-everyday-life',
    name: 'Faith in Everyday Life',
    subtitle: 'Practical biblical faith for overcoming daily challenges, peace of mind, and resilience',
    display_order: 6,
    is_active: true,
  },
  {
    slug: 'christian-character-and-values',
    name: 'Christian Character and Values',
    subtitle: 'Integrity, humility, emotional intelligence, forgiveness, honour, and Christlike character',
    display_order: 7,
    is_active: true,
  },
  {
    slug: 'christian-womanhood',
    name: 'Christian Womanhood',
    subtitle: 'Biblical identity, strength, wisdom, purpose, and grace for the modern Christian woman',
    display_order: 8,
    is_active: true,
  },
  {
    slug: 'christian-manhood',
    name: 'Christian Manhood',
    subtitle: 'Godly leadership, responsibility, vision, character, and strength for Christian men',
    display_order: 9,
    is_active: true,
  },
  {
    slug: 'friendship-and-social-life',
    name: 'Friendship and Social Life',
    subtitle: 'Strategic relationships, godly friendships, boundaries, discernment, and community',
    display_order: 10,
    is_active: true,
  },
  {
    slug: 'christianity-in-modern-society',
    name: 'Christianity in Modern Society',
    subtitle: 'Living out Christian convictions in culture, business, technology, and contemporary society',
    display_order: 11,
    is_active: true,
  },
];

export interface ApprovedChristianLivingMinisterSpec {
  order: number;
  channelId: string;
  youtubeChannelId: string;
  secondaryYoutubeChannelIds?: string[];
  ministerName: string;
  channelTitle: string;
  handle: string;
  isNigerian: boolean;
  speakerGender: SpeakerGender;
  isFeatured: boolean;
  avatarUrl: string;
  bio: string;
  aliases: string[];
  defaultSubcategory: ChristianLivingSubcategorySlug;
  discoveryQueries: string[];
}

/**
 * THE EXACT 20 APPROVED CHRISTIAN LIVING MINISTERS (Section 2)
 * 1–14: Nigerian Ministers
 * 15–20: Female Ministers and International Teachers
 */
export const APPROVED_CHRISTIAN_LIVING_MINISTERS: ApprovedChristianLivingMinisterSpec[] = [
  // ==========================================================================
  // NIGERIAN MINISTERS (1 - 14)
  // ==========================================================================
  {
    order: 1,
    channelId: 'ch-koinonia-selman',
    youtubeChannelId: 'UCq2ueL6wl7slTuInRbFpe7w',
    ministerName: 'Apostle Joshua Selman',
    channelTitle: 'Koinonia Global (Apostle Joshua Selman)',
    handle: '@KoinoniaGlobal',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/KoinoniaGlobal',
    bio: 'Founder of Eternity Network International (Koinonia), widely watched for transformative teachings on purpose, spiritual growth, kingdom finance, and godly character.',
    aliases: ['Apostle Joshua Selman', 'Joshua Selman', 'Koinonia Global', 'Eternity Network International'],
    defaultSubcategory: 'purpose-career-and-destiny',
    discoveryQueries: [
      'Apostle Joshua Selman teachings on purpose destiny time',
      'Apostle Joshua Selman Christian character honour relationships',
      'Apostle Joshua Selman financial dominion wealth wisdom',
      'Apostle Joshua Selman spiritual growth personal transformation 2025 2026',
    ],
  },
  {
    order: 2,
    channelId: 'ch-oyedepo-lfc',
    youtubeChannelId: 'UCyUKtrMdDilf74SPkCCKKtw',
    ministerName: 'Bishop David Oyedepo',
    channelTitle: 'Living Faith Church Worldwide (Bishop David Oyedepo)',
    handle: '@lfcww',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/lfcww',
    bio: 'Presiding Bishop of Living Faith Church Worldwide (Winners Chapel), renowned for teachings on faith, diligence, covenant wealth, mentality, and destiny.',
    aliases: ['Bishop David Oyedepo', 'David Oyedepo', 'Winners Chapel', 'Living Faith Church'],
    defaultSubcategory: 'christian-finances-and-wealth',
    discoveryQueries: [
      'Bishop David Oyedepo teachings on success financial wisdom diligence',
      'Bishop David Oyedepo faith in everyday life mentality purpose',
      'Bishop David Oyedepo wisdom for Christian living family destiny',
    ],
  },
  {
    order: 3,
    channelId: 'ch-jerry-eze',
    youtubeChannelId: 'UCLg4NCAJxhIvD4IRV__LOFg',
    ministerName: 'Pastor Jerry Eze',
    channelTitle: 'Pastor Jerry Eze (Streams of Joy)',
    handle: '@PastorJerryEze',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/PastorJerryEze',
    bio: 'Lead Pastor of Streams of Joy International, teaching practical everyday faith, spiritual resilience, and purposeful Christian living.',
    aliases: ['Pastor Jerry Eze', 'Jerry Eze', 'Streams of Joy International'],
    defaultSubcategory: 'faith-in-everyday-life',
    discoveryQueries: [
      'Pastor Jerry Eze sermon teaching on faith Christian living purpose',
      'Pastor Jerry Eze Streams of Joy Sunday sermon character destiny',
      'Pastor Jerry Eze overcoming challenges everyday faith sermon',
    ],
  },
  {
    order: 4,
    channelId: 'ch-pastor-chris',
    youtubeChannelId: 'UCNRo_Wza_lNTGZSEDjaQ1ng',
    ministerName: 'Pastor Chris Oyakhilome',
    channelTitle: 'Pastor Chris Online (Christ Embassy)',
    handle: '@PastorChrisOnline',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/PastorChrisOnline',
    bio: 'President of LoveWorld Inc. (Christ Embassy), author of Rhapsody of Realities, and teacher on the power of the mind, faith, and Christian growth.',
    aliases: ['Pastor Chris Oyakhilome', 'Pastor Chris', 'Christ Embassy', 'LoveWorld'],
    defaultSubcategory: 'personal-growth-spiritual-development',
    discoveryQueries: [
      'Pastor Chris Oyakhilome power of your mind Christian living',
      'Pastor Chris Oyakhilome faith character spiritual growth teaching',
      'Pastor Chris Oyakhilome success purpose Christian life',
    ],
  },
  {
    order: 5,
    channelId: 'ch-dove-tv-rccg',
    youtubeChannelId: 'UCbgM7xAXYYB6eX_CipYlTQw',
    ministerName: 'Pastor E.A. Adeboye',
    channelTitle: 'Dove Television (RCCG / Pastor E.A. Adeboye)',
    handle: '@DoveTelevision',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/DoveTelevision',
    bio: 'General Overseer of The Redeemed Christian Church of God (RCCG), revered for timeless teachings on holiness, humility, family values, and walking with God.',
    aliases: ['Pastor E.A. Adeboye', 'Pastor E A Adeboye', 'Enoch Adeboye', 'Daddy GO', 'Dove Television'],
    defaultSubcategory: 'christian-character-and-values',
    discoveryQueries: [
      'Pastor E.A. Adeboye sermon Christian living holiness humility',
      'Pastor E A Adeboye family parenting divine wisdom destiny',
      'Pastor E.A. Adeboye faith obedience Christian character',
    ],
  },
  {
    order: 6,
    channelId: 'ch-dunamis-enenche',
    youtubeChannelId: 'UCtLlKV4vUqcxezKOoeILs5Q',
    ministerName: 'Pastor Paul Enenche',
    channelTitle: 'Dunamis TV (Dr. Pastor Paul Enenche)',
    handle: '@DunamisTV',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/DunamisTV',
    bio: 'Senior Pastor of Dunamis International Gospel Centre, teaching godly character, excellence, wisdom, destiny fulfilment, and integrity.',
    aliases: ['Pastor Paul Enenche', 'Dr Paul Enenche', 'Dunamis TV'],
    defaultSubcategory: 'christian-character-and-values',
    discoveryQueries: [
      'Pastor Paul Enenche character wisdom destiny Christian living',
      'Pastor Paul Enenche financial wisdom diligence excellence',
      'Pastor Paul Enenche youth purpose spiritual growth Dunamis',
    ],
  },
  {
    order: 7,
    channelId: 'ch-sam-adeyemi',
    youtubeChannelId: 'UCxvgxpys6nNDbVvEra71v8g',
    secondaryYoutubeChannelIds: ['UCRpQyTd6PBrp95deXv2qbew'],
    ministerName: 'Pastor Sam Adeyemi',
    channelTitle: 'Pastor Sam Adeyemi (Daystar Christian Centre)',
    handle: '@Daystar-NG',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/Daystar-NG',
    bio: 'Senior Pastor of Daystar Christian Centre and global leadership teacher, renowned for practical biblical wisdom on leadership, mindset, finances, and career.',
    aliases: ['Pastor Sam Adeyemi', 'Sam Adeyemi', 'Daystar Christian Centre'],
    defaultSubcategory: 'purpose-career-and-destiny',
    discoveryQueries: [
      'Pastor Sam Adeyemi personal development leadership purpose',
      'Sam Adeyemi financial wisdom wealth creation mindset',
      'Pastor Sam Adeyemi career success Christian living modern society',
    ],
  },
  {
    order: 8,
    channelId: 'ch-covenant-nation',
    youtubeChannelId: 'UCsVBRhKh9spV-YPTub0KcxQ',
    ministerName: 'Pastor Poju Oyemade',
    channelTitle: 'The Covenant Nation (Pastor Poju Oyemade)',
    handle: '@TheCovenantNation',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/TheCovenantNation',
    bio: 'Senior Pastor of The Covenant Nation and convener of The Platform Nigeria, teaching practical faith, career excellence, finances, and civic responsibility.',
    aliases: ['Pastor Poju Oyemade', 'Poju Oyemade', 'The Covenant Nation'],
    defaultSubcategory: 'faith-in-everyday-life',
    discoveryQueries: [
      'Pastor Poju Oyemade faith in everyday life career finances',
      'Pastor Poju Oyemade wisdom relationships purpose Covenant Nation',
      'Poju Oyemade Christian living work excellence',
    ],
  },
  {
    order: 9,
    channelId: 'ch-ibiyeomie-sm',
    youtubeChannelId: 'UCH7KHtVTI91GcN6yuwvaFvQ',
    ministerName: 'Pastor David Ibiyeomie',
    channelTitle: 'Salvation Ministries (Pastor David Ibiyeomie)',
    handle: '@smhosglobal',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/smhosglobal',
    bio: 'Founder and Senior Pastor of Salvation Ministries, known for practical biblical teachings on financial stewardship, family life, wisdom, and faith.',
    aliases: ['Pastor David Ibiyeomie', 'David Ibiyeomie', 'Salvation Ministries'],
    defaultSubcategory: 'christian-finances-and-wealth',
    discoveryQueries: [
      'Pastor David Ibiyeomie financial wisdom success Christian living',
      'Pastor David Ibiyeomie character family parenting faith',
      'David Ibiyeomie wisdom for everyday life purpose',
    ],
  },
  {
    order: 10,
    channelId: 'ch-suleman-celebrationtv',
    youtubeChannelId: 'UCrF3Zv8PGIT4R4f2LMQvQSQ',
    ministerName: 'Apostle Johnson Suleman',
    channelTitle: 'CelebrationTV (Apostle Johnson Suleman)',
    handle: '@CelebrationTVNETWORK',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/CelebrationTVNETWORK',
    bio: 'General Overseer of Omega Fire Ministries International, teaching on spiritual alertness, character, destiny, and practical Christian living.',
    aliases: ['Apostle Johnson Suleman', 'Johnson Suleman', 'CelebrationTV', 'Omega Fire Ministries'],
    defaultSubcategory: 'personal-growth-spiritual-development',
    discoveryQueries: [
      'Apostle Johnson Suleman teachings on destiny character wisdom',
      'Apostle Johnson Suleman Christian living finances friendship',
      'Apostle Johnson Suleman spiritual growth purpose',
    ],
  },
  {
    order: 11,
    channelId: 'ch-harvesters-bolaji',
    youtubeChannelId: 'UCALuqr8BQi_djTbgEL5yeGA',
    ministerName: 'Pastor Bolaji Idowu',
    channelTitle: 'Harvesters TV (Pastor Bolaji Idowu)',
    handle: '@HarvestersTV',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/HarvestersTV',
    bio: 'Lead Pastor of Harvesters International Christian Centre, widely followed by young professionals for practical teachings on emotional maturity, friendships, career, and finances.',
    aliases: ['Pastor Bolaji Idowu', 'Bolaji Idowu', 'Harvesters TV', 'Harvesters International'],
    defaultSubcategory: 'christian-youth-and-young-adults',
    discoveryQueries: [
      'Pastor Bolaji Idowu personal growth character friendships finances',
      'Pastor Bolaji Idowu Harvesters purpose career emotional maturity',
      'Pastor Bolaji Idowu Christian living young adults faith',
    ],
  },
  {
    order: 12,
    channelId: 'ch-femi-lazarus',
    youtubeChannelId: 'UCgXEDFzk3TwStyRnlUJrMVA',
    ministerName: 'Pastor Femi Lazarus',
    channelTitle: 'Apostle Femi Lazarus',
    handle: '@femi_lazarus',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/femi_lazarus',
    bio: 'Lead Pastor of Light Nation Church, known for bold, practical teachings on Christian values, family parenting, youth accountability, and modern culture.',
    aliases: ['Pastor Femi Lazarus', 'Apostle Femi Lazarus', 'Femi Lazarus', 'Light Nation'],
    defaultSubcategory: 'christianity-in-modern-society',
    discoveryQueries: [
      'Apostle Femi Lazarus Christian living character parenting youth',
      'Pastor Femi Lazarus manhood womanhood values modern society',
      'Femi Lazarus spiritual growth purpose discipline',
    ],
  },
  {
    order: 13,
    channelId: 'ch-arome-osayi',
    youtubeChannelId: 'UCh6Sn6v_mdhwWTEpNvo5A4A',
    ministerName: 'Apostle Arome Osayi',
    channelTitle: 'Apostle Arome Osayi (Remnant Christian Network)',
    handle: '@ApostleAromeOsayi',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/ApostleAromeOsayi',
    bio: 'President of Remnant Christian Network (RCN), teaching apostolic doctrine, spiritual discipline, consecration, and Christian alignment in modern society.',
    aliases: ['Apostle Arome Osayi', 'Arome Osayi', 'Remnant Christian Network'],
    defaultSubcategory: 'personal-growth-spiritual-development',
    discoveryQueries: [
      'Apostle Arome Osayi spiritual growth consecration Christian character',
      'Apostle Arome Osayi Christian living workplace modern society youth',
      'Apostle Arome Osayi building capacity purpose discipline',
    ],
  },
  {
    order: 14,
    channelId: 'ch-michael-orokpo',
    youtubeChannelId: 'UCxssq4RFmPSgUzyjpIZBjSQ',
    ministerName: 'Apostle Michael Orokpo',
    channelTitle: 'Apostle Michael Orokpo',
    handle: '@ApostleOrokpoMichael',
    isNigerian: true,
    speakerGender: 'male',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/ApostleOrokpoMichael',
    bio: 'Founder of Encounter Jesus Ministries International, passionately equipping young believers in spiritual development, purity, purpose, and Kingdom values.',
    aliases: ['Apostle Michael Orokpo', 'Michael Orokpo', 'Encounter Jesus Ministries'],
    defaultSubcategory: 'christian-youth-and-young-adults',
    discoveryQueries: [
      'Apostle Michael Orokpo youth purpose spiritual growth character',
      'Apostle Michael Orokpo transformation discipline Christian living',
      'Michael Orokpo destiny capacity building young adults',
    ],
  },

  // ==========================================================================
  // FEMALE MINISTERS AND INTERNATIONAL TEACHERS (15 - 20)
  // ==========================================================================
  {
    order: 15,
    channelId: 'ch-funke-felix-adejumo',
    youtubeChannelId: 'UC3IkbUeiB39hbVrytKLiHwg',
    ministerName: 'Pastor Funke Felix-Adejumo',
    channelTitle: 'Bishop Funke Felix-Adejumo',
    handle: '@FFAdejumo',
    isNigerian: true,
    speakerGender: 'female',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/FFAdejumo',
    bio: 'President of Funke Felix-Adejumo Foundation, celebrated for empowering teachings on Christian womanhood, parenting, financial wisdom, and godly character.',
    aliases: ['Pastor Funke Felix-Adejumo', 'Bishop Funke Felix-Adejumo', 'Funke Felix-Adejumo', 'FFAdejumo'],
    defaultSubcategory: 'christian-womanhood',
    discoveryQueries: [
      'Funke Felix-Adejumo teachings on godly character womanhood',
      'Funke Felix-Adejumo parenting raising children financial wisdom',
      'Pastor Funke Felix-Adejumo purpose personal growth women',
    ],
  },
  {
    order: 16,
    channelId: 'ch-ibukun-awosika',
    youtubeChannelId: 'UCE_2owe5GgMaxxL0YSy4S8g',
    ministerName: 'Ibukun Awosika',
    channelTitle: 'Ibukun Awosika',
    handle: '@IbukunAwosika',
    isNigerian: true,
    speakerGender: 'female',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/IbukunAwosika',
    bio: 'Renowned Nigerian Christian business leader, author, and speaker equipping believers in leadership, career excellence, values, parenting, and nation building.',
    aliases: ['Ibukun Awosika', 'Mrs Ibukun Awosika'],
    defaultSubcategory: 'purpose-career-and-destiny',
    discoveryQueries: [
      'Ibukun Awosika teachings on leadership purpose career',
      'Ibukun Awosika Christian values finances womanhood parenting',
      'Ibukun Awosika youth destiny workplace integrity',
    ],
  },
  {
    order: 17,
    channelId: 'ch-mildred-okonkwo',
    youtubeChannelId: 'UC-XF1KWVOjgpiztllotMYZg',
    ministerName: 'Pastor Mildred Kingsley-Okonkwo',
    channelTitle: 'Pastor Mildred Kingsley-Okonkwo',
    handle: '@MildredKingsleyOkonkwo',
    isNigerian: true,
    speakerGender: 'female',
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/MildredKingsleyOkonkwo',
    bio: 'Co-Lead Pastor of David’s Christian Centre and founder of Just Us Girls, teaching practical wisdom on Christian womanhood, emotional wholeness, friendships, and family.',
    aliases: ['Pastor Mildred Kingsley-Okonkwo', 'Mildred Kingsley-Okonkwo', 'Pastor Mildred Okonkwo', 'Just Us Girls'],
    defaultSubcategory: 'christian-womanhood',
    discoveryQueries: [
      'Pastor Mildred Kingsley-Okonkwo womanhood personal growth character',
      'Pastor Mildred Okonkwo parenting friendship faith everyday life',
      'Mildred Kingsley-Okonkwo purpose identity emotional maturity',
    ],
  },
  {
    order: 18,
    channelId: 'ch-funke-adijuwon',
    youtubeChannelId: 'UCQJkQIIJ1ooLt-eDgNFt3nA',
    ministerName: 'Pastor Funke Adijuwon',
    channelTitle: 'Pastor Funke Adijuwon (Funke Adetuberu)',
    handle: '@FunkeAdetuberu',
    isNigerian: true,
    speakerGender: 'female',
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/FunkeAdetuberu',
    bio: 'Nigerian Christian family and lifestyle teacher equipping women, parents, and young adults with biblical wisdom for home building, character, and personal growth.',
    aliases: ['Pastor Funke Adijuwon', 'Funke Adijuwon', 'Pastor Funke Adetuberu', 'Funke Adetuberu'],
    defaultSubcategory: 'family-and-parenting',
    discoveryQueries: [
      'Funke Adetuberu parenting family values godly womanhood',
      'Pastor Funke Adijuwon Funke Adetuberu character wisdom youth',
      'Funke Adetuberu raising godly children Christian home',
    ],
  },
  {
    order: 19,
    channelId: 'ch-sarah-jakes-roberts',
    youtubeChannelId: 'UCluSFLlcF7QZFz7VRKhxStw',
    ministerName: 'Pastor Sarah Jakes Roberts',
    channelTitle: 'Sarah Jakes Roberts',
    handle: '@SarahJakesRoberts',
    isNigerian: false,
    speakerGender: 'female',
    isFeatured: true,
    avatarUrl:
      'https://yt3.googleusercontent.com/EJyK96t6ZxqfaHGkeEVb6reS8uxH3ZmM47nLx39JecAqwFgiBzuYI42qq5u-9ft2JCiUnW9buQ=s900-c-k-c0x00ffffff-no-rj',
    bio: 'Founder of Woman Evolve and Co-Pastor of The Potter’s House at One LA & Denver, inspiring millions with teachings on faith, healing, womanhood, and spiritual resilience.',
    aliases: ['Pastor Sarah Jakes Roberts', 'Sarah Jakes Roberts', 'Woman Evolve'],
    defaultSubcategory: 'christian-womanhood',
    discoveryQueries: [
      'Sarah Jakes Roberts faith personal growth purpose sermon',
      'Sarah Jakes Roberts Woman Evolve Christian womanhood character',
      'Sarah Jakes Roberts overcoming fear everyday faith 2025 2026',
    ],
  },
  {
    order: 20,
    channelId: 'ch-joyce-meyer',
    youtubeChannelId: 'UCER2LBsm4hB_Kxte63RoftQ',
    ministerName: 'Joyce Meyer',
    channelTitle: 'Joyce Meyer Ministries',
    handle: '@JoyceMeyer',
    isNigerian: false,
    speakerGender: 'female',
    isFeatured: true,
    avatarUrl:
      'https://yt3.googleusercontent.com/ytc/AIdro_kbiHtVzWb7dPO6B1tzHtpBN2kItyBJ6kJrI43vETefRV0=s900-c-k-c0x00ffffff-no-rj',
    bio: 'Internationally renowned Bible teacher and New York Times bestselling author of Battlefield of the Mind, known for practical teachings on everyday Christian living.',
    aliases: ['Joyce Meyer', 'Joyce Meyer Ministries', 'Enjoying Everyday Life'],
    defaultSubcategory: 'faith-in-everyday-life',
    discoveryQueries: [
      'Joyce Meyer teachings on everyday Christian living mind',
      'Joyce Meyer character attitude emotions spiritual growth',
      'Joyce Meyer peace faith relationships wisdom 2025 2026',
    ],
  },
];

export const APPROVED_CHRISTIAN_LIVING_CHANNEL_IDS = new Set<string>(
  APPROVED_CHRISTIAN_LIVING_MINISTERS.map((m) => m.channelId)
);

/**
 * Normalizes a video title to prevent duplicate teachings across searches.
 */
export function normalizeTeachingTitleKey(title: string, ministerName: string): string {
  const lowerMinister = ministerName.toLowerCase();
  let cleaned = title.toLowerCase();
  for (const token of lowerMinister.split(/\s+/)) {
    if (token.length > 3) {
      cleaned = cleaned.replace(new RegExp(token, 'g'), ' ');
    }
  }
  cleaned = cleaned
    .replace(/\(full sermon\)/g, ' ')
    .replace(/\[full message\]/g, ' ')
    .replace(/koinonia global/g, ' ')
    .replace(/dunamis tv/g, ' ')
    .replace(/harvesters tv/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 65) || title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

/**
 * STRICT CATEGORY EXCLUSIONS & AUTHENTICITY VALIDATION (Sections 6 & 8)
 * Rejects:
 * - Gospel songs, worship performances, praise medleys, chants
 * - Marriage counselling / dating / courtship that belongs in Marriage & Relationships
 *   (unless it is Family & Parenting or personal Womanhood/Manhood teaching)
 * - Extended prayer warfare sessions (NSPPD daily prayer, Hallelujah Challenge, midnight prayer)
 * - Unrelated church announcements, reactions, gossip, or shorts (< 180s)
 */
export function isAuthenticChristianLivingTeachingForMinister(
  raw: {
    title: string;
    description: string;
    channelTitle: string;
    youtubeChannelId: string;
    durationSeconds: number | null;
  },
  minister: ApprovedChristianLivingMinisterSpec
): boolean {
  const titleLower = raw.title.toLowerCase();
  const descLower = (raw.description || '').toLowerCase();
  const chLower = (raw.channelTitle || '').toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  // Reject very short clips (< 3 minutes)
  if (raw.durationSeconds !== null && raw.durationSeconds > 0 && raw.durationSeconds < 180) {
    return false;
  }

  // 1. Reject Gospel Music, Worship Performances & Praise Sessions (belong in Gospel Music / Worship & Praise)
  const musicOrWorshipPatterns = [
    /\bofficial\s*(music\s*)?video\b/i,
    /\bofficial\s*audio\b/i,
    /\blyric\s*video\b/i,
    /\bpraise\s*medley\b/i,
    /\bhigh\s*praise\b/i,
    /\bspontaneous\s*worship\b/i,
    /\bworship\s*session\b/i,
    /\bchant\b/i,
    /\balbum\s*launch\b/i,
    /\bmusic\s*ministration\b/i,
  ];
  if (musicOrWorshipPatterns.some((rx) => rx.test(raw.title))) {
    return false;
  }

  // 2. Reject Extended Prayer & Prophetic Warfare Sessions (belong in Prayer & Spiritual Warfare)
  const prayerWarfareExclusions = [
    /\bnsppd\b/i,
    /\bhallelujah\s*challenge\b/i,
    /\bmidnight\s*prayer\b/i,
    /\bcommand\s*the\s*morning\b/i,
    /\bwarfare\s*prayer\b/i,
    /\bprayer\s*rain\b/i,
    /\bpraying\s*in\s*tongues\b/i,
    /\bhour(s)?\s*of\s*prayer\b/i,
    /\bnight\s*of\s*deliverance\b/i,
  ];
  if (prayerWarfareExclusions.some((rx) => rx.test(raw.title))) {
    return false;
  }

  // 3. Reject Pure Dating, Courtship & Marital Conflict Counselling (belong in Marriage & Relationships)
  // Note: Parenting, raising children, family legacy, Christian womanhood, and Christian manhood ARE part of Christian Living!
  const marriageCounsellingExclusions = [
    /\bcourtship\b/i,
    /\bfinding\s*(a|your)\s*(wife|husband|spouse|life\s*partner|marriage\s*partner)\b/i,
    /\bwho\s*to\s*marry\b/i,
    /\bhow\s*to\s*choose\s*a\s*(partner|spouse|husband|wife)\b/i,
    /\bmarital\s*(crisis|conflict|intimacy|sex|divorce|infidelity)\b/i,
    /\bsingles\s*(summit|seminar|q\s*&\s*a|conference)\b/i,
    /\bdating\s*(advice|rules|tips|christian)\b/i,
    /\bbefore\s*you\s*say\s*i\s*do\b/i,
    /\bwedding\s*anniversary\b/i,
  ];
  const hasParentingFocus =
    /\b(parenting|raising\s*(godly\s*)?(children|kids|sons|daughters)|fatherhood|motherhood)\b/i.test(
      raw.title
    );
  if (!hasParentingFocus && marriageCounsellingExclusions.some((rx) => rx.test(raw.title))) {
    return false;
  }

  // 4. Reject gossip, reaction, parody, or non-teaching news clips
  const noiseExclusions = [
    /\breaction\s*to\b/i,
    /\breacts\s*to\b/i,
    /\bexposed\b/i,
    /\bscandal\b/i,
    /\bnet\s*worth\b/i,
    /\bhouse\s*and\s*cars\b/i,
    /\bbiography\s*of\b/i,
    /\bfuneral\b/i,
    /\btribute\s*to\b/i,
  ];
  if (noiseExclusions.some((rx) => rx.test(raw.title))) {
    return false;
  }

  // 5. Verify minister attribution (Official channel ID or minister name/alias in title/channel)
  const validYtIds = new Set([
    minister.youtubeChannelId,
    ...(minister.secondaryYoutubeChannelIds || []),
  ]);
  const isFromOfficialChannel = validYtIds.has(raw.youtubeChannelId);

  const nameTokens = [
    minister.ministerName.toLowerCase(),
    ...minister.aliases.map((a) => a.toLowerCase()),
  ];
  const lastName = minister.ministerName.split(' ').slice(-1)[0].toLowerCase();
  const hasMinisterNameMatch =
    nameTokens.some((tok) => titleLower.includes(tok) || chLower.includes(tok)) ||
    (lastName.length >= 5 && (titleLower.includes(lastName) || chLower.includes(lastName)));

  if (!isFromOfficialChannel && !hasMinisterNameMatch) {
    return false;
  }

  // Prevent cross-minister attribution if another minister's name is explicitly the subject of the title
  const otherMinisters = APPROVED_CHRISTIAN_LIVING_MINISTERS.filter(
    (m) => m.channelId !== minister.channelId
  );
  if (!isFromOfficialChannel) {
    for (const other of otherMinisters) {
      if (titleLower.includes(other.ministerName.toLowerCase()) && !titleLower.includes(lastName)) {
        return false;
      }
    }
  }

  // 6. Verify positive Christian Living subject relevance
  const christianLivingIndicators = [
    /\b(purpose|destiny|vision|assignment|calling|potential|career|workplace|excellence|leadership|success)\b/i,
    /\b(character|integrity|humility|attitude|honour|honor|discipline|habits|mindset|mind|emotions|emotional|wisdom|values|forgive|forgiveness)\b/i,
    /\b(finance|financial|wealth|money|stewardship|prosperity|business|diligence|generosity|investment|abundance)\b/i,
    /\b(parenting|children|family|fatherhood|motherhood|legacy|home|generation)\b/i,
    /\b(youth|young\s*adults|teenagers|campus|next\s*generation|twenty|twenties)\b/i,
    /\b(faith|peace|worry|anxiety|fear|overcoming|trusting\s*god|everyday\s*life|daily\s*life|storms|patience|waiting\s*on\s*god)\b/i,
    /\b(woman|women|womanhood|lady|ladies|daughter|queen|esther|proverbs\s*31|woman\s*evolve)\b/i,
    /\b(man|men|manhood|brother|brothers|son|father|responsibility|king|priest)\b/i,
    /\b(friend|friends|friendship|company|association|circle|relationships|people|discernment|boundaries)\b/i,
    /\b(culture|society|modern|world|nation|influence|marketplace|christian\s*living|lifestyle)\b/i,
    /\b(spiritual\s*growth|maturity|transformation|growth|capacity|seasons|time)\b/i,
  ];

  if (!christianLivingIndicators.some((rx) => rx.test(combined))) {
    // Allow official channel uploads only if they have strong teaching keywords
    if (
      !isFromOfficialChannel ||
      !/\b(how\s*to|keys\s*to|principles|wisdom|understanding|power\s*of|secret|mastering|building|living)\b/i.test(
        raw.title
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Classifies a verified Christian Living teaching into 1 or more of the 11 Subcategories
 * (Section 6) without duplicating the video record.
 */
export function classifyChristianLivingSubcategories(
  title: string,
  description: string,
  minister: ApprovedChristianLivingMinisterSpec
): {
  subcategories: ChristianLivingSubcategorySlug[];
  primarySubcategoryLabel: string;
  relevanceBoost: number;
} {
  const text = `${title} ${description}`.toLowerCase();
  const matched = new Set<ChristianLivingSubcategorySlug>();

  // 1. Personal Growth and Spiritual Development
  if (
    /\b(spiritual\s*growth|personal\s*growth|personal\s*development|maturity|transformation|mindset|mind|battlefield\s*of\s*the\s*mind|discipline|capacity|habits|consecration|seasons|time\s*management)\b/i.test(
      text
    )
  ) {
    matched.add('personal-growth-spiritual-development');
  }

  // 2. Family and Parenting
  if (
    /\b(parenting|parent|parents|raising\s*(godly\s*)?(children|kids|sons|daughters)|family\s*values|godly\s*home|motherhood|fatherhood|children|generational\s*legacy)\b/i.test(
      text
    )
  ) {
    matched.add('family-and-parenting');
  }

  // 3. Christian Finances and Wealth
  if (
    /\b(finance|finances|financial|wealth|money|prosperity|stewardship|business|entrepreneur|millionaire|debt|poverty|abundance|investment|covenant\s*wealth|diligence)\b/i.test(
      text
    )
  ) {
    matched.add('christian-finances-and-wealth');
  }

  // 4. Purpose, Career and Destiny
  if (
    /\b(purpose|destiny|career|calling|assignment|vision|leadership|workplace|excellence|success|potential|greatness|fulfilling)\b/i.test(
      text
    )
  ) {
    matched.add('purpose-career-and-destiny');
  }

  // 5. Christian Youth and Young Adults
  if (
    /\b(youth|young\s*adult|young\s*people|teenagers|twenties|20s|campus|next\s*generation|millennials|gen\s*z|early\s*in\s*life)\b/i.test(
      text
    )
  ) {
    matched.add('christian-youth-and-young-adults');
  }

  // 6. Faith in Everyday Life
  if (
    /\b(everyday\s*life|daily\s*life|faith|trusting\s*god|peace|anxiety|worry|fear|stress|overcoming|challenges|storms|waiting\s*on\s*god|hope|healing|resilience|enjoying\s*everyday\s*life)\b/i.test(
      text
    )
  ) {
    matched.add('faith-in-everyday-life');
  }

  // 7. Christian Character and Values
  if (
    /\b(character|integrity|humility|honour|honor|attitude|forgiveness|forgive|anger|offense|bitterness|self\s*control|honesty|values|morals|emotional\s*intelligence|emotional\s*maturity)\b/i.test(
      text
    )
  ) {
    matched.add('christian-character-and-values');
  }

  // 8. Christian Womanhood
  if (
    /\b(woman|women|womanhood|lady|ladies|female|daughter|queen|esther|proverbs\s*31|woman\s*evolve|just\s*us\s*girls|godly\s*woman)\b/i.test(
      text
    ) ||
    (minister.speakerGender === 'female' &&
      /\b(she|her|sister|sisters|identity|grace|strength)\b/i.test(text))
  ) {
    matched.add('christian-womanhood');
  }

  // 9. Christian Manhood
  if (
    /\b(manhood|men|godly\s*man|christian\s*man|christian\s*men|father|husband\s*leadership|masculinity|brothers|sons|king\s*and\s*priest|male\s*responsibility)\b/i.test(
      text
    )
  ) {
    matched.add('christian-manhood');
  }

  // 10. Friendship and Social Life
  if (
    /\b(friend|friends|friendship|associations|company|circle|social\s*life|toxic\s*people|boundaries|discernment|networking|mentorship|human\s*relations|wrong\s*people|right\s*people)\b/i.test(
      text
    )
  ) {
    matched.add('friendship-and-social-life');
  }

  // 11. Christianity in Modern Society
  if (
    /\b(modern\s*society|culture|contemporary|social\s*media|technology|politics|nation|marketplace|worldview|secular|compromise|salt\s*and\s*light|influence\s*in\s*society)\b/i.test(
      text
    )
  ) {
    matched.add('christianity-in-modern-society');
  }

  if (matched.size === 0) {
    matched.add(minister.defaultSubcategory);
  }

  // Ensure a secondary complementary tag if only 1 matched
  const list = Array.from(matched);
  const primarySlug = list[0];
  const primaryConfig =
    CHRISTIAN_LIVING_SUBCATEGORIES.find((s) => s.slug === primarySlug) ||
    CHRISTIAN_LIVING_SUBCATEGORIES[0];

  const relevanceBoost = Math.min(1.35, 1.0 + matched.size * 0.08);

  return {
    subcategories: list,
    primarySubcategoryLabel: primaryConfig.name,
    relevanceBoost,
  };
}

/**
 * SMART VIDEO RANKING SYSTEM FOR CHRISTIAN LIVING (Section 5)
 * Evaluates:
 * - Total views
 * - Verified likes & comments relative to views
 * - Age-adjusted view velocity so older evergreen classics are NOT disadvantaged by upload age
 * - New 2025/2026 momentum bonus for recent teachings attracting strong early viewership
 * - Subject relevance to Christian Living
 */
export function computeChristianLivingSmartScore(params: {
  viewCount: number;
  likeCount: number;
  likesVerified: boolean;
  commentCount: number | null;
  publishedAt: string;
  isNigerian: boolean;
  relevanceBoost: number;
}): number {
  const views = Math.max(0, params.viewCount);
  const likes = params.likesVerified ? Math.max(0, params.likeCount) : 0;
  const comments = Math.max(0, params.commentCount || 0);

  const publishedMs = new Date(params.publishedAt).getTime();
  const ageDays = Math.max(
    1,
    (Date.now() - (Number.isNaN(publishedMs) ? Date.now() : publishedMs)) / (1000 * 60 * 60 * 24)
  );
  const viewsPerDay = views / ageDays;

  // 1. Reach component (log-scaled total views)
  const reachScore = Math.log10(views + 10) * 26;

  // 2. Engagement rate component (likes + 3x comments per 1,000 views when verified)
  const engagementPer1k = views > 0 ? ((likes + comments * 3) / views) * 1000 : 0;
  const engagementComponent = params.likesVerified
    ? Math.min(45, engagementPer1k * 0.75)
    : Math.min(22, Math.log10(views + 10) * 3.8);

  // 3. Age-adjusted longevity & velocity component:
  //    - Older evergreen classics (ageDays >= 365) get an evergreen longevity multiplier
  //    - Recent 2025/2026 uploads (ageDays < 550) get a daily velocity momentum score
  let ageAdjustedComponent = 0;
  if (ageDays >= 365) {
    const yearsOld = Math.min(10, ageDays / 365);
    ageAdjustedComponent =
      Math.log10(views + 10) * 14 * (1 + yearsOld * 0.06) + Math.log10(viewsPerDay + 1) * 9;
  } else {
    ageAdjustedComponent =
      Math.log10(viewsPerDay + 10) * 22 + Math.log10(views + 10) * 8;
  }

  const nigerianBonus = params.isNigerian ? 1.08 : 1.0;

  return Math.round(
    (reachScore + engagementComponent + ageAdjustedComponent) *
      params.relevanceBoost *
      nigerianBonus *
      10
  ) / 10;
}

/**
 * Ensures all 20 Approved Christian Living Ministers exist in `channels` with their
 * verified metadata, and enforces that ONLY these 20 ministers appear in `christian-living`.
 * Existing videos in `christian-living` that belong to the 20 ministers and pass the strict
 * subject filter are retained; unrelated or unapproved videos have their `christian-living`
 * category association removed without deleting any video record (Section 12).
 */
export function enforceChristianLivingCategoryIntegrity(
  channels: KingdomChannel[],
  videos: KingdomVideo[],
  categories: ContentCategory[]
): {
  retainedCount: number;
  reassignedPrimaryCount: number;
  removedSecondaryCount: number;
} {
  // 1. Reset is_approved_christian_living_minister on all channels first
  for (const ch of channels) {
    ch.is_approved_christian_living_minister = false;
    ch.christian_living_minister_order = undefined;
  }

  const secondaryToPrimaryChannelId = new Map<string, string>();

  // 2. Upsert all 20 Approved Christian Living Ministers
  for (const spec of APPROVED_CHRISTIAN_LIVING_MINISTERS) {
    let ch = channels.find(
      (c) => c.id === spec.channelId || c.youtube_channel_id === spec.youtubeChannelId
    );
    if (!ch) {
      ch = {
        id: spec.channelId,
        youtube_channel_id: spec.youtubeChannelId,
        title: spec.channelTitle,
        speaker_name: spec.ministerName,
        ministry_name: spec.channelTitle,
        aliases: spec.aliases,
        bio: spec.bio,
        handle: spec.handle,
        channel_type: 'minister',
        speaker_gender: spec.speakerGender,
        is_featured_minister: spec.isFeatured,
        is_approved_christian_living_minister: true,
        christian_living_minister_order: spec.order,
        is_nigerian: spec.isNigerian,
        is_official_verified: true,
        default_category_slug: 'christian-living',
        supported_categories: ['christian-living', 'sermons-teachings'],
        subscriber_count: null,
        video_count: null,
        view_count: null,
        avatar_url: spec.avatarUrl,
        approval_status: 'approved',
        priority_weight: spec.isNigerian ? 1.55 : 1.35,
        last_synced_at: new Date().toISOString(),
      };
      channels.push(ch);
    } else {
      ch.id = spec.channelId;
      ch.youtube_channel_id = spec.youtubeChannelId;
      ch.speaker_name = spec.ministerName;
      ch.bio = ch.bio || spec.bio;
      ch.aliases = Array.from(new Set([...(ch.aliases || []), ...spec.aliases]));
      ch.speaker_gender = spec.speakerGender;
      ch.is_approved_christian_living_minister = true;
      ch.christian_living_minister_order = spec.order;
      ch.is_official_verified = true;
      ch.approval_status = 'approved';
      if (!ch.supported_categories) ch.supported_categories = [];
      if (!ch.supported_categories.includes('christian-living')) {
        ch.supported_categories.push('christian-living');
      }
    }

    if (spec.secondaryYoutubeChannelIds) {
      for (const secYtId of spec.secondaryYoutubeChannelIds) {
        const secCh = channels.find(
          (c) => c.youtube_channel_id === secYtId && c.id !== spec.channelId
        );
        if (secCh) {
          secondaryToPrimaryChannelId.set(secCh.id, spec.channelId);
        }
      }
    }
  }

  const christianLivingCat = categories.find((c) => c.slug === 'christian-living');
  const sermonsCat =
    categories.find((c) => c.slug === 'sermons-teachings') || categories[0];

  const specByChannelId = new Map<string, ApprovedChristianLivingMinisterSpec>(
    APPROVED_CHRISTIAN_LIVING_MINISTERS.map((m) => [m.channelId, m])
  );

  let retainedCount = 0;
  let reassignedPrimaryCount = 0;
  let removedSecondaryCount = 0;

  for (const v of videos) {
    // Consolidate any secondary personal channel (e.g. ch-sam-adeyemi-personal) into the primary minister channel
    const mappedPrimaryChId = secondaryToPrimaryChannelId.get(v.channel_id);
    if (mappedPrimaryChId) {
      const targetSpec = specByChannelId.get(mappedPrimaryChId);
      if (targetSpec) {
        v.channel_id = targetSpec.channelId;
        v.channel_title = targetSpec.channelTitle;
        v.channel_handle = targetSpec.handle;
        v.artist_name = targetSpec.ministerName;
      }
    }

    const ministerSpec = specByChannelId.get(v.channel_id);

    // Strip christian-living from secondary_category_slugs if not from the 20 approved ministers
    if (v.secondary_category_slugs?.includes('christian-living')) {
      if (
        !ministerSpec ||
        !isAuthenticChristianLivingTeachingForMinister(
          {
            title: v.title,
            description: v.description,
            channelTitle: v.channel_title,
            youtubeChannelId: ministerSpec.youtubeChannelId,
            durationSeconds: v.duration_seconds,
          },
          ministerSpec
        )
      ) {
        v.secondary_category_slugs = v.secondary_category_slugs.filter(
          (s) => s !== 'christian-living'
        );
        removedSecondaryCount++;
      }
    }

    if (v.primary_category_slug === 'christian-living') {
      const isAuthentic =
        Boolean(ministerSpec) &&
        isAuthenticChristianLivingTeachingForMinister(
          {
            title: v.title,
            description: v.description,
            channelTitle: v.channel_title,
            youtubeChannelId: ministerSpec!.youtubeChannelId,
            durationSeconds: v.duration_seconds,
          },
          ministerSpec!
        );

      if (!isAuthentic || !ministerSpec) {
        // Reassign out of Christian Living without deleting the video record
        if (sermonsCat) {
          v.primary_category_id = sermonsCat.id;
          v.primary_category_slug = sermonsCat.slug;
          v.primary_category_name = sermonsCat.name;
        }
        v.christian_living_subcategories = undefined;
        v.christian_living_score = undefined;
        reassignedPrimaryCount++;
      } else {
        // Retain and enrich with 11-subcategory classification and smart score
        if (christianLivingCat) {
          v.primary_category_id = christianLivingCat.id;
          v.primary_category_name = christianLivingCat.name;
        }
        v.artist_name = ministerSpec.ministerName;
        v.speaker_gender = ministerSpec.speakerGender;
        const subClass = classifyChristianLivingSubcategories(
          v.title,
          v.description,
          ministerSpec
        );
        if (!v.christian_living_subcategories || v.christian_living_subcategories.length === 0) {
          v.christian_living_subcategories = subClass.subcategories;
        }
        if (!v.subcategory_label || v.subcategory_label === 'Christian Living') {
          v.subcategory_label = subClass.primarySubcategoryLabel;
        }
        v.christian_living_score = computeChristianLivingSmartScore({
          viewCount: v.view_count,
          likeCount: v.like_count,
          likesVerified: v.likes_verified !== false && v.like_count > 0,
          commentCount: v.comment_count,
          publishedAt: v.published_at,
          isNigerian: ministerSpec.isNigerian,
          relevanceBoost: subClass.relevanceBoost,
        });
        retainedCount++;
      }
    }
  }

  return {
    retainedCount,
    reassignedPrimaryCount,
    removedSecondaryCount,
  };
}

/**
 * Harvests and curates 5–10 high-engagement old (evergreen) & new (2025–2026)
 * Christian Living teachings for each of the 20 Approved Ministers.
 */
export async function refreshChristianLivingFromYouTube(params: {
  channels: KingdomChannel[];
  videos: KingdomVideo[];
  categories: ContentCategory[];
  maxPerMinister?: number;
}): Promise<{
  retainedExistingCount: number;
  reassignedIrrelevantCount: number;
  removedSecondaryCount: number;
  totalCuratedTeachings: number;
  ministersCount: number;
  perMinisterCounts: Record<string, number>;
  subcategoryCounts: Record<string, number>;
}> {
  const { channels, videos, categories, maxPerMinister = 8 } = params;

  // Step 1: Audit existing Christian Living videos (retain valid ones from the 20 ministers, reassign others)
  const integrity = enforceChristianLivingCategoryIntegrity(channels, videos, categories);

  const christianLivingCat = categories.find((c) => c.slug === 'christian-living') || {
    id: 'cat-christian-living',
    slug: 'christian-living',
    name: 'Christian Living',
  };

  const existingByVideoId = new Map<string, KingdomVideo>();
  for (const v of videos) {
    existingByVideoId.set(v.youtube_video_id, v);
  }

  const usedVideoIdsInChristianLiving = new Set<string>();
  const usedTitleKeysPerMinister = new Map<string, Set<string>>();

  // Pre-register retained Christian Living videos
  for (const v of videos) {
    if (v.primary_category_slug === 'christian-living') {
      usedVideoIdsInChristianLiving.add(v.youtube_video_id);
      const ministerSpec = APPROVED_CHRISTIAN_LIVING_MINISTERS.find(
        (m) => m.channelId === v.channel_id
      );
      if (ministerSpec) {
        if (!usedTitleKeysPerMinister.has(ministerSpec.channelId)) {
          usedTitleKeysPerMinister.set(ministerSpec.channelId, new Set());
        }
        usedTitleKeysPerMinister
          .get(ministerSpec.channelId)!
          .add(normalizeTeachingTitleKey(v.title, ministerSpec.ministerName));
      }
    }
  }

  // Step 2: Harvest candidate teachings in parallel batches of 5 ministers
  const batchSize = 5;
  const harvestedByMinister = new Map<string, RawFeedVideoItem[]>();

  for (let i = 0; i < APPROVED_CHRISTIAN_LIVING_MINISTERS.length; i += batchSize) {
    const batch = APPROVED_CHRISTIAN_LIVING_MINISTERS.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (minister) => {
        const candidates: RawFeedVideoItem[] = [];
        try {
          // A. Official YouTube Atom XML Feed (provides exact view counts, verified likes, and recent 2025/2026 uploads)
          const xmlItems = await fetchChannelVideosViaOfficialXmlFeed(minister.youtubeChannelId);
          candidates.push(...xmlItems);

          // B. Multiple targeted Christian Living search queries (evergreen + recent)
          const searchLists = await Promise.all(
            minister.discoveryQueries.map((q) => searchYouTubeStructured(q, 12))
          );
          for (const list of searchLists) {
            candidates.push(...list);
          }
        } catch {
          // Continue gracefully if an individual request fails
        }
        harvestedByMinister.set(minister.channelId, candidates);
      })
    );
  }

  const perMinisterCounts: Record<string, number> = {};
  let totalCuratedTeachings = 0;

  // Step 3: Filter, deduplicate, rank with Smart Age-Adjusted Score, and select top 5-10 per minister
  for (const minister of APPROVED_CHRISTIAN_LIVING_MINISTERS) {
    const channelObj = channels.find((c) => c.id === minister.channelId)!;
    const rawCandidates = harvestedByMinister.get(minister.channelId) || [];

    // Also inspect existing catalog videos from this minister that might be strong Christian Living teachings
    const existingMinisterVideos = videos.filter((v) => v.channel_id === minister.channelId);
    for (const ev of existingMinisterVideos) {
      if (
        ev.primary_category_slug === 'worship-praise' ||
        ev.primary_category_slug === 'marriage-relationships'
      ) {
        continue;
      }
      rawCandidates.push({
        youtubeVideoId: ev.youtube_video_id,
        youtubeChannelId: minister.youtubeChannelId,
        title: ev.title,
        description: ev.description,
        publishedAt: ev.published_at,
        thumbnailHighUrl: ev.thumbnail_high_url,
        thumbnailMaxresUrl: ev.thumbnail_maxres_url,
        viewCount: ev.view_count,
        likeCount: ev.like_count,
        likesVerified: ev.likes_verified !== false && ev.like_count > 0,
        commentCount: ev.comment_count,
        durationSeconds: ev.duration_seconds,
        liveBroadcastContent: ev.live_broadcast_content || 'none',
        isEmbeddable: ev.is_embeddable !== false,
        channelTitle: ev.channel_title,
      });
    }

    // Deduplicate and validate authenticity + category exclusions
    const uniqueCandidates = new Map<string, RawFeedVideoItem>();
    for (const item of rawCandidates) {
      if (!item.youtubeVideoId || !/^[a-zA-Z0-9_-]{11}$/.test(item.youtubeVideoId)) continue;
      if (item.viewCount < 500) continue;

      if (
        !isAuthenticChristianLivingTeachingForMinister(
          {
            title: item.title,
            description: item.description,
            channelTitle: item.channelTitle || minister.channelTitle,
            youtubeChannelId: item.youtubeChannelId,
            durationSeconds: item.durationSeconds,
          },
          minister
        )
      ) {
        continue;
      }

      const prev = uniqueCandidates.get(item.youtubeVideoId);
      if (
        !prev ||
        (item.likesVerified && !prev.likesVerified) ||
        item.viewCount > prev.viewCount
      ) {
        uniqueCandidates.set(item.youtubeVideoId, item);
      }
    }

    // Score each candidate using the Smart Christian Living Ranking System
    const scoredCandidates = Array.from(uniqueCandidates.values()).map((raw) => {
      const subClass = classifyChristianLivingSubcategories(
        raw.title,
        raw.description,
        minister
      );
      const smartScore = computeChristianLivingSmartScore({
        viewCount: raw.viewCount,
        likeCount: raw.likeCount,
        likesVerified: Boolean(raw.likesVerified),
        commentCount: raw.commentCount,
        publishedAt: raw.publishedAt,
        isNigerian: minister.isNigerian,
        relevanceBoost: subClass.relevanceBoost,
      });
      const pubYear = new Date(raw.publishedAt).getFullYear();
      const isRecent2025Or2026 = pubYear >= 2025;
      return {
        raw,
        subClass,
        smartScore,
        isRecent2025Or2026,
      };
    });

    // Balance Evergreen Classics (pre-2025 high views) and New/Trending (2025-2026)
    const evergreenPool = scoredCandidates
      .filter((c) => !c.isRecent2025Or2026)
      .sort((a, b) => b.smartScore - a.smartScore);
    const recentPool = scoredCandidates
      .filter((c) => c.isRecent2025Or2026)
      .sort((a, b) => b.smartScore - a.smartScore);

    const picked: typeof scoredCandidates = [];
    const seenTitleKeys = new Set<string>();

    const tryPick = (cand: (typeof scoredCandidates)[0]) => {
      if (picked.length >= maxPerMinister) return;
      const tKey = normalizeTeachingTitleKey(cand.raw.title, minister.ministerName);
      if (seenTitleKeys.has(tKey)) return;
      if (
        usedVideoIdsInChristianLiving.has(cand.raw.youtubeVideoId) &&
        existingByVideoId.get(cand.raw.youtubeVideoId)?.channel_id !== minister.channelId
      ) {
        return;
      }
      seenTitleKeys.add(tKey);
      picked.push(cand);
    };

    // Pick up to 5 top evergreen teachings first
    for (const cand of evergreenPool) {
      if (picked.length >= Math.ceil(maxPerMinister * 0.6)) break;
      tryPick(cand);
    }
    // Pick up to 3-4 recent 2025/2026 teachings
    for (const cand of recentPool) {
      if (picked.length >= maxPerMinister) break;
      tryPick(cand);
    }
    // Fill any remaining slots from highest overall smartScore
    const allSorted = [...scoredCandidates].sort((a, b) => b.smartScore - a.smartScore);
    for (const cand of allSorted) {
      if (picked.length >= maxPerMinister) break;
      tryPick(cand);
    }

    // Demote any previous Christian Living videos of this minister that weren't in the top curated picks
    const pickedVideoIds = new Set(picked.map((p) => p.raw.youtubeVideoId));
    const sermonsCat = categories.find((c) => c.slug === 'sermons-teachings') || categories[0];
    for (const v of videos) {
      if (
        v.channel_id === minister.channelId &&
        v.primary_category_slug === 'christian-living' &&
        !pickedVideoIds.has(v.youtube_video_id)
      ) {
        if (sermonsCat) {
          v.primary_category_id = sermonsCat.id;
          v.primary_category_slug = sermonsCat.slug;
          v.primary_category_name = sermonsCat.name;
        }
        v.christian_living_subcategories = undefined;
      }
    }

    let ministerSelectedCount = 0;
    for (const item of picked) {
      const { raw, subClass, smartScore } = item;
      usedVideoIdsInChristianLiving.add(raw.youtubeVideoId);

      const metrics = computeVideoRankingMetrics({
        viewCount: raw.viewCount,
        likeCount: raw.likesVerified ? raw.likeCount : 0,
        commentCount: raw.commentCount,
        publishedAt: raw.publishedAt,
        isNigerianChannel: minister.isNigerian,
        isOfficialVerified: true,
        priorityWeight: channelObj.priority_weight,
      });

      const existing = existingByVideoId.get(raw.youtubeVideoId);
      if (existing) {
        existing.channel_id = channelObj.id;
        existing.channel_title = channelObj.title;
        existing.channel_handle = channelObj.handle;
        existing.channel_type = channelObj.channel_type;
        existing.speaker_gender = minister.speakerGender;
        existing.artist_name = minister.ministerName;
        existing.channel_avatar_url = channelObj.avatar_url;
        existing.is_nigerian_channel = minister.isNigerian;
        existing.is_official_verified = true;
        existing.primary_category_id = christianLivingCat.id;
        existing.primary_category_slug = 'christian-living';
        existing.primary_category_name = christianLivingCat.name;
        existing.subcategory_label = subClass.primarySubcategoryLabel;
        existing.christian_living_subcategories = subClass.subcategories;
        existing.christian_living_score = smartScore;
        existing.view_count = Math.max(existing.view_count, raw.viewCount);
        if (raw.likesVerified && raw.likeCount > 0) {
          existing.like_count = raw.likeCount;
          existing.likes_verified = true;
        } else if (existing.likes_verified === undefined) {
          existing.likes_verified = false;
          existing.like_count = 0;
        }
        existing.views_per_day = metrics.viewsPerDay;
        existing.engagement_rate = metrics.engagementRate;
        existing.trending_score = metrics.trendingScore;
        existing.evergreen_score = metrics.evergreenScore;
        existing.quality_score = metrics.qualityScore;
        existing.approval_status = 'approved';
        existing.is_available = true;
        existing.is_embeddable = true;
        existing.last_refreshed_at = new Date().toISOString();
      } else {
        const newVideo: KingdomVideo = {
          id: `vid-${raw.youtubeVideoId}`,
          youtube_video_id: raw.youtubeVideoId,
          channel_id: channelObj.id,
          channel_title: channelObj.title,
          channel_handle: channelObj.handle,
          channel_type: channelObj.channel_type,
          speaker_gender: minister.speakerGender,
          artist_name: minister.ministerName,
          channel_avatar_url: channelObj.avatar_url,
          is_nigerian_channel: minister.isNigerian,
          is_official_verified: true,
          primary_category_id: christianLivingCat.id,
          primary_category_slug: 'christian-living',
          primary_category_name: christianLivingCat.name,
          secondary_category_slugs: [],
          subcategory_label: subClass.primarySubcategoryLabel,
          christian_living_subcategories: subClass.subcategories,
          christian_living_score: smartScore,
          title: raw.title,
          description: raw.description,
          thumbnail_high_url: raw.thumbnailHighUrl,
          thumbnail_maxres_url: raw.thumbnailMaxresUrl,
          published_at: raw.publishedAt,
          duration_seconds: raw.durationSeconds,
          view_count: raw.viewCount,
          like_count: raw.likesVerified ? raw.likeCount : 0,
          likes_verified: Boolean(raw.likesVerified),
          comment_count: raw.commentCount,
          views_per_day: metrics.viewsPerDay,
          engagement_rate: metrics.engagementRate,
          trending_score: metrics.trendingScore,
          evergreen_score: metrics.evergreenScore,
          quality_score: metrics.qualityScore,
          live_broadcast_content: 'none',
          is_live_now: false,
          is_embeddable: true,
          is_available: true,
          approval_status: 'approved',
          is_featured_hero: minister.isFeatured && ministerSelectedCount === 0,
          is_trending_pinned: ministerSelectedCount === 0 && raw.viewCount > 250000,
          ai_classification_reason: `Curated Christian Living (${subClass.primarySubcategoryLabel}) — ${minister.ministerName}`,
          last_refreshed_at: new Date().toISOString(),
        };
        videos.push(newVideo);
        existingByVideoId.set(newVideo.youtube_video_id, newVideo);
      }

      ministerSelectedCount++;
      totalCuratedTeachings++;
    }

    perMinisterCounts[minister.ministerName] = ministerSelectedCount;
  }

  // Compute subcategory counts
  const subcategoryCounts: Record<string, number> = {};
  for (const sub of CHRISTIAN_LIVING_SUBCATEGORIES) {
    subcategoryCounts[sub.name] = videos.filter(
      (v) =>
        v.primary_category_slug === 'christian-living' &&
        v.approval_status === 'approved' &&
        v.christian_living_subcategories?.includes(sub.slug)
    ).length;
  }

  return {
    retainedExistingCount: integrity.retainedCount,
    reassignedIrrelevantCount: integrity.reassignedPrimaryCount,
    removedSecondaryCount: integrity.removedSecondaryCount,
    totalCuratedTeachings,
    ministersCount: APPROVED_CHRISTIAN_LIVING_MINISTERS.length,
    perMinisterCounts,
    subcategoryCounts,
  };
}

/**
 * AUTOMATIC / SCHEDULED CONTENT REFRESH FOR ADMIN APPROVAL (Section 11)
 * Periodically checks the 20 approved ministers for new Christian Living teachings,
 * refreshes statistics on existing videos, and queues newly discovered candidates
 * with `approval_status = 'pending_review'` so unverified videos are NEVER automatically
 * published without admin approval.
 */
export async function checkForNewChristianLivingSuggestions(params: {
  channels: KingdomChannel[];
  videos: KingdomVideo[];
  categories: ContentCategory[];
}): Promise<{
  refreshedExistingCount: number;
  suggestedForApprovalCount: number;
}> {
  const { channels, videos, categories } = params;
  const christianLivingCat = categories.find((c) => c.slug === 'christian-living') || {
    id: 'cat-christian-living',
    slug: 'christian-living',
    name: 'Christian Living',
  };

  const existingByYtId = new Map<string, KingdomVideo>();
  for (const v of videos) {
    existingByYtId.set(v.youtube_video_id, v);
  }

  let refreshedExistingCount = 0;
  let suggestedForApprovalCount = 0;

  const batchSize = 5;
  for (let i = 0; i < APPROVED_CHRISTIAN_LIVING_MINISTERS.length; i += batchSize) {
    const batch = APPROVED_CHRISTIAN_LIVING_MINISTERS.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (minister) => {
        try {
          const xmlItems = await fetchChannelVideosViaOfficialXmlFeed(minister.youtubeChannelId);
          const channelObj = channels.find((c) => c.id === minister.channelId);
          if (!channelObj) return;

          for (const raw of xmlItems) {
            const existing = existingByYtId.get(raw.youtubeVideoId);
            if (existing) {
              existing.view_count = Math.max(existing.view_count, raw.viewCount);
              if (raw.likesVerified && raw.likeCount > 0) {
                existing.like_count = raw.likeCount;
                existing.likes_verified = true;
              }
              existing.last_refreshed_at = new Date().toISOString();
              refreshedExistingCount++;
              continue;
            }

            // Evaluate if this new upload qualifies as a Christian Living suggestion for admin review
            if (
              raw.viewCount >= 1000 &&
              isAuthenticChristianLivingTeachingForMinister(
                {
                  title: raw.title,
                  description: raw.description,
                  channelTitle: raw.channelTitle || minister.channelTitle,
                  youtubeChannelId: raw.youtubeChannelId,
                  durationSeconds: raw.durationSeconds,
                },
                minister
              )
            ) {
              const subClass = classifyChristianLivingSubcategories(
                raw.title,
                raw.description,
                minister
              );
              const smartScore = computeChristianLivingSmartScore({
                viewCount: raw.viewCount,
                likeCount: raw.likeCount,
                likesVerified: Boolean(raw.likesVerified),
                commentCount: raw.commentCount,
                publishedAt: raw.publishedAt,
                isNigerian: minister.isNigerian,
                relevanceBoost: subClass.relevanceBoost,
              });
              const metrics = computeVideoRankingMetrics({
                viewCount: raw.viewCount,
                likeCount: raw.likesVerified ? raw.likeCount : 0,
                commentCount: raw.commentCount,
                publishedAt: raw.publishedAt,
                isNigerianChannel: minister.isNigerian,
                isOfficialVerified: true,
                priorityWeight: channelObj.priority_weight,
              });

              const suggestion: KingdomVideo = {
                id: `vid-${raw.youtubeVideoId}`,
                youtube_video_id: raw.youtubeVideoId,
                channel_id: channelObj.id,
                channel_title: channelObj.title,
                channel_handle: channelObj.handle,
                channel_type: channelObj.channel_type,
                speaker_gender: minister.speakerGender,
                artist_name: minister.ministerName,
                channel_avatar_url: channelObj.avatar_url,
                is_nigerian_channel: minister.isNigerian,
                is_official_verified: true,
                primary_category_id: christianLivingCat.id,
                primary_category_slug: 'christian-living',
                primary_category_name: christianLivingCat.name,
                secondary_category_slugs: [],
                subcategory_label: subClass.primarySubcategoryLabel,
                christian_living_subcategories: subClass.subcategories,
                christian_living_score: smartScore,
                title: raw.title,
                description: raw.description,
                thumbnail_high_url: raw.thumbnailHighUrl,
                thumbnail_maxres_url: raw.thumbnailMaxresUrl,
                published_at: raw.publishedAt,
                duration_seconds: raw.durationSeconds,
                view_count: raw.viewCount,
                like_count: raw.likesVerified ? raw.likeCount : 0,
                likes_verified: Boolean(raw.likesVerified),
                comment_count: raw.commentCount,
                views_per_day: metrics.viewsPerDay,
                engagement_rate: metrics.engagementRate,
                trending_score: metrics.trendingScore,
                evergreen_score: metrics.evergreenScore,
                quality_score: metrics.qualityScore,
                live_broadcast_content: 'none',
                is_live_now: false,
                is_embeddable: true,
                is_available: true,
                approval_status: 'pending_review', // Held for Admin Approval per Section 10 & 11
                is_featured_hero: false,
                is_trending_pinned: false,
                ai_classification_reason: `Suggested Christian Living (${subClass.primarySubcategoryLabel}) — Held for Admin Approval`,
                last_refreshed_at: new Date().toISOString(),
              };

              videos.push(suggestion);
              existingByYtId.set(suggestion.youtube_video_id, suggestion);
              suggestedForApprovalCount++;
            }
          }
        } catch {
          // Ignore individual network error
        }
      })
    );
  }

  return {
    refreshedExistingCount,
    suggestedForApprovalCount,
  };
}
