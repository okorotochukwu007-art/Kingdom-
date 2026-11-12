import {
  ContentCategory,
  KingdomChannel,
  KingdomVideo,
  WorshipSubcategoryConfig,
  WorshipSubcategorySlug,
} from '../src/types/kingdom.ts';
import {
  computeVideoRankingMetrics,
  fetchChannelVideosViaOfficialXmlFeed,
  RawFeedVideoItem,
  searchYouTubeStructured,
} from './youtubeService.ts';

export const WORSHIP_SUBCATEGORIES: WorshipSubcategoryConfig[] = [
  {
    slug: 'deep-worship',
    name: 'Deep Worship',
    subtitle: 'Intimate altar worship, soak sessions, and reverent communion songs',
    display_order: 1,
  },
  {
    slug: 'high-praise-celebration',
    name: 'High Praise and Celebration',
    subtitle: 'Joyful Nigerian high praise medleys, energetic celebration, and Afro-gospel anthems',
    display_order: 2,
  },
  {
    slug: 'prayer-spiritual-warfare-worship',
    name: 'Prayer and Spiritual Warfare',
    subtitle: 'Prophetic chants, intercession worship, and spiritual warfare anthems',
    display_order: 3,
  },
  {
    slug: 'spontaneous-worship',
    name: 'Spontaneous Worship',
    subtitle: 'Unscripted Spirit-led worship flows, prophetic moments, and altar ministrations',
    display_order: 4,
  },
  {
    slug: 'live-worship-sessions',
    name: 'Live Worship Sessions',
    subtitle: 'Full live worship ministrations, church worship nights, and concert recordings',
    display_order: 5,
  },
  {
    slug: 'thanksgiving-songs',
    name: 'Thanksgiving Songs',
    subtitle: 'Anthems of gratitude, testimony, and celebrating the goodness of God',
    display_order: 6,
  },
  {
    slug: 'classic-gospel-hits',
    name: 'Classic Gospel Hits',
    subtitle: 'Timeless, multi-million-view evergreen worship and praise classics loved across generations',
    display_order: 7,
  },
  {
    slug: 'new-trending-gospel',
    name: 'New and Trending Gospel Songs',
    subtitle: 'Recent worship and praise releases gaining rapid momentum and strong engagement',
    display_order: 8,
  },
  {
    slug: 'international-worship',
    name: 'International Worship',
    subtitle: 'Global worship anthems from Maverick City, Elevation, Hillsong, CeCe Winans, Don Moen, Brandon Lake & William McDowell',
    display_order: 9,
  },
  {
    slug: 'nigerian-gospel',
    name: 'Nigerian Gospel',
    subtitle: 'Authentic Nigerian worship and praise from the 29 approved Nigerian gospel ministers',
    display_order: 10,
  },
];

export interface ApprovedWorshipArtistSpec {
  order: number;
  channelId: string;
  youtubeChannelId: string;
  artistName: string;
  channelTitle: string;
  handle: string;
  isNigerian: boolean;
  isFeatured: boolean;
  avatarUrl: string;
  bio: string;
  aliases: string[];
  defaultSubcategory: WorshipSubcategorySlug;
  discoveryQueries: string[];
}

/**
 * THE EXACT 36 APPROVED WORSHIP & PRAISE ARTISTS (Section 3)
 * 1–29: Nigerian Gospel Artists
 * 30–36: International Gospel Artists and Worship Groups
 */
export const APPROVED_WORSHIP_PRAISE_ARTISTS: ApprovedWorshipArtistSpec[] = [
  // ==========================================================================
  // NIGERIAN GOSPEL ARTISTS (1 - 29)
  // ==========================================================================
  {
    order: 1,
    channelId: 'ch-nathaniel-bassey',
    youtubeChannelId: 'UCRe2Ir9wtPk_YQjElam7n2w',
    artistName: 'Nathaniel Bassey',
    channelTitle: 'Nathaniel Bassey Main',
    handle: '@NathanielBasseyMain',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/NathanielBasseyMain',
    bio: 'Renowned Nigerian gospel trumpeter, worship leader, pastor, and convener of the Hallelujah Challenge.',
    aliases: ['Pastor Nathaniel Bassey', 'Nathaniel Bassey Main'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'Nathaniel Bassey Imela Onise Iyanu Olowogbogboro',
      'Nathaniel Bassey Tobechukwu Ebenezer See What The Lord Has Done',
      'Nathaniel Bassey Yahweh Sabaoth Jesus Iye Hallelujah',
    ],
  },
  {
    order: 2,
    channelId: 'ch-moses-bliss',
    youtubeChannelId: 'UCv88VZJUuRoot7GfSO_sm-g',
    artistName: 'Moses Bliss',
    channelTitle: 'Moses Bliss',
    handle: '@MosesBliss',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/MosesBliss',
    bio: 'Nigerian gospel music minister, worship leader, and founder of Spotlite Nation.',
    aliases: ['Minister Moses Bliss', 'Spotlite Nation'],
    defaultSubcategory: 'thanksgiving-songs',
    discoveryQueries: [
      'Moses Bliss Too Faithful Bigger Everyday Miracle No Dey Tire Jesus',
      'Moses Bliss Daddy Wey Dey Pamper Taking Care Lovequiera',
    ],
  },
  {
    order: 3,
    channelId: 'ch-mercy-chinwo',
    youtubeChannelId: 'UCtIRyuESlnOflQCpmk-fHUw',
    artistName: 'Mercy Chinwo',
    channelTitle: 'Mercy Chinwo',
    handle: '@mercy_chinwo',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/mercy_chinwo',
    bio: 'Award-winning Nigerian gospel singer, songwriter, and worship leader known for anthems of faith and gratitude.',
    aliases: ['Mercy Chinwo Blessed', 'Mercy Chinwo Official'],
    defaultSubcategory: 'thanksgiving-songs',
    discoveryQueries: [
      'Mercy Chinwo Excess Love Obinasom Chinedum',
      'Mercy Chinwo Confidence Wonder You Do This One',
    ],
  },
  {
    order: 4,
    channelId: 'ch-dunsin-oyekan',
    youtubeChannelId: 'UC9unpsMUkOGDIMraqBfZtYg',
    artistName: 'Dunsin Oyekan',
    channelTitle: 'Dunsin Oyekan',
    handle: '@DunsinOyekan',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/DunsinOyekan',
    bio: 'Nigerian gospel psalmist, multi-instrumentalist, and revival worship leader known for deep prophetic worship.',
    aliases: ['Minister Dunsin Oyekan', 'The Eagle'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'Dunsin Oyekan Fragrance To Fire Omemma More Than A Song',
      'Dunsin Oyekan Worthy Of My Praise Yah Breathe Imole De',
    ],
  },
  {
    order: 5,
    channelId: 'ch-sinach',
    youtubeChannelId: 'UC6fh2aHqQtqSwPdDtafewNw',
    artistName: 'Sinach',
    channelTitle: 'Sinach',
    handle: '@SINACH',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/SINACH',
    bio: 'Internationally acclaimed Nigerian gospel singer and songwriter of global anthems including "Way Maker" and "I Know Who I Am".',
    aliases: ['SINACH', 'Way Maker'],
    defaultSubcategory: 'classic-gospel-hits',
    discoveryQueries: [
      'Sinach Way Maker I Know Who I Am Rejoice',
      'Sinach The Name of Jesus Great Are You Lord Awesome God',
    ],
  },
  {
    order: 6,
    channelId: 'ch-victoria-orenze',
    youtubeChannelId: 'UCo9_ALYi0IYcMn7K84YFTzw',
    artistName: 'Victoria Orenze',
    channelTitle: 'Victoria Orenze',
    handle: '@VictoriaOrenze',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/VictoriaOrenze',
    bio: 'Nigerian prophetic worship leader and psalmist known for intense Spirit-led altar worship and spiritual warfare chants.',
    aliases: ['Minister Victoria Orenze'],
    defaultSubcategory: 'prayer-spiritual-warfare-worship',
    discoveryQueries: [
      'Victoria Orenze On Fire Spirit Chant Covenant Keeping God',
      'Victoria Orenze Gratitude Set On Course Ascend',
    ],
  },
  {
    order: 7,
    channelId: 'ch-minister-guc',
    youtubeChannelId: 'UCAdAODvRZIWoY2RtdxdGyPA',
    artistName: 'Minister GUC',
    channelTitle: 'Minister GUC',
    handle: '@MinisterGUC',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/MinisterGUC',
    bio: 'Nigerian gospel music minister and worship leader known for deeply devotional songs of consecration and surrender.',
    aliases: ['GUC', 'Gift Ugochukwu Christopher'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'Minister GUC All That Matters Yours Obinigwe',
      'Minister GUC IkeNile Captured My Heart Knowing You',
    ],
  },
  {
    order: 8,
    channelId: 'ch-sunmisola-agbebi',
    youtubeChannelId: 'UCySzzBJLlLcw8RCdSwQGZZw',
    artistName: 'Sunmisola Agbebi',
    channelTitle: 'Sunmisola Agbebi',
    handle: '@SunmisolaAgbebi',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/SunmisolaAgbebi',
    bio: 'Nigerian worship leader known for intimate, soul-lifting live worship sessions and spontaneous ministrations.',
    aliases: ['Minister Sunmisola Agbebi', 'Sunmisola Agbebi Okeleye'],
    defaultSubcategory: 'spontaneous-worship',
    discoveryQueries: [
      'Sunmisola Agbebi My Daddy My Daddy Koseunti Bba',
      'Sunmisola Agbebi Aileyipada Spontaneous Worship Live',
    ],
  },
  {
    order: 9,
    channelId: 'ch-lawrence-oyor',
    youtubeChannelId: 'UCNeLs83EPGjX8Pz7wsiBckw',
    artistName: 'Lawrence Oyor',
    channelTitle: 'Lawrence Oyor',
    handle: '@LawrenceOyor',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/LawrenceOyor',
    bio: 'Nigerian revivalist and prophetic worship chant leader inspiring hunger for God and spiritual awakening.',
    aliases: ['Evangelist Lawrence Oyor', 'Davidic Minstrels'],
    defaultSubcategory: 'prayer-spiritual-warfare-worship',
    discoveryQueries: [
      'Lawrence Oyor Bowl of Fire Alignment Favour',
      'Lawrence Oyor Grocery Store Prophetic Chant Worship',
    ],
  },
  {
    order: 10,
    channelId: 'ch-judikay',
    youtubeChannelId: 'UCQmRXe_YwIXaGcODToPXAEg',
    artistName: 'Judikay',
    channelTitle: 'Official Judikay',
    handle: '@OfficialJudikay',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/OfficialJudikay',
    bio: 'Nigerian gospel music minister and worship leader celebrated for vibrant praise medleys and heartfelt worship anthems.',
    aliases: ['Official Judikay', 'Judith Kanayo'],
    defaultSubcategory: 'thanksgiving-songs',
    discoveryQueries: [
      'Judikay Capable God More Than Gold Omemma',
      'Judikay Jesus Is Coming Mudiana Nothing Is Too Hard For You',
    ],
  },
  {
    order: 11,
    channelId: 'ch-ebuka-songs',
    youtubeChannelId: 'UCKQ-h4Ge2Ov_EoWcZzmmT2g',
    artistName: 'Ebuka Songs',
    channelTitle: 'Ebuka Songs',
    handle: '@EbukaSongs',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/EbukaSongs',
    bio: 'Nigerian gospel worship minister known for fervent altar worship and songs of consecration.',
    aliases: ['Minister Ebuka Songs', 'I Will Pray'],
    defaultSubcategory: 'prayer-spiritual-warfare-worship',
    discoveryQueries: [
      'Ebuka Songs I Will Pray Calling My Name Midnight Cry',
      'Ebuka Songs Jesus Oh Total Submission New Generation',
    ],
  },
  {
    order: 12,
    channelId: 'ch-steve-crown',
    youtubeChannelId: 'UCjTAH49kFeXioaTEKr6pPIg',
    artistName: 'Steve Crown',
    channelTitle: 'Steve Crown',
    handle: '@SteveCrownOfficial',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/SteveCrownOfficial',
    bio: 'Abuja-based Nigerian gospel music minister and worship leader known for "You Are Great" and "All The Glory".',
    aliases: ['Minister Steve Crown', 'Steve Crown Official'],
    defaultSubcategory: 'classic-gospel-hits',
    discoveryQueries: [
      'Steve Crown You Are Great All The Glory Angels Bow',
      'Steve Crown You Are Yahweh Hosanna Imela',
    ],
  },
  {
    order: 13,
    channelId: 'ch-eben',
    youtubeChannelId: 'UCuhIZxVdLucf3HUViYc0QZw',
    artistName: 'Eben',
    channelTitle: 'Official Eben',
    handle: '@OfficialEben',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/OfficialEben',
    bio: 'Nigerian gospel vocalist and worship leader known for victorious praise and worship anthems.',
    aliases: ['Minister Eben', 'Official Eben'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'Eben Victory Imaranma All The Way',
      'Eben Jesus At The Center God All By Yourself',
    ],
  },
  {
    order: 14,
    channelId: 'ch-tim-godfrey',
    youtubeChannelId: 'UCUGxX9TxsmjfqDbo4uPMQFg',
    artistName: 'Tim Godfrey',
    channelTitle: 'Tim Godfrey World',
    handle: '@TimGodfreyWorld',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/TimGodfreyWorld',
    bio: 'Nigerian gospel music director, worshipper, and convener of the annual Fearless Gospel Concert.',
    aliases: ['Dr. Tim Godfrey', 'Tim Godfrey World', 'Rox Nation'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'Tim Godfrey Nara Travis Greene Miracles Everywhere',
      'Tim Godfrey Big God Okaka Toya Fearless',
    ],
  },
  {
    order: 15,
    channelId: 'ch-ada-ehi',
    youtubeChannelId: 'UCpM0LdoSSvRgW-AqBTOhKow',
    artistName: 'Ada Ehi',
    channelTitle: 'Ada Ehi',
    handle: '@AdaEhi',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/AdaEhi',
    bio: 'Nigerian gospel singer-songwriter and recording artist known for faith-filled contemporary gospel hits.',
    aliases: ['Ada Ogochukwu Ehi'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'Ada Ehi Only You Jesus Overcame Cheta Congratulations',
      'Ada Ehi I Testify Fix My Eyes On You Settled',
    ],
  },
  {
    order: 16,
    channelId: 'ch-frank-edwards',
    youtubeChannelId: 'UCWhUxVq72zmbcWlm9uguLPg',
    artistName: 'Frank Edwards',
    channelTitle: 'Frank Edwards',
    handle: '@FrankEdwardsYouTube',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/FrankEdwardsYouTube',
    bio: 'Nigerian contemporary gospel singer, producer, and multi-instrumentalist.',
    aliases: ['Frankrichboy', 'Rocktown'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'Frank Edwards Mma Mma Oghene Do Under The Canopy',
      'Frank Edwards You Too Dey Bless Me Believers Anthem',
    ],
  },
  {
    order: 17,
    channelId: 'ch-tope-alabi',
    youtubeChannelId: 'UCSso6ynLza_BKtcqMDzK-MQ',
    artistName: 'Tope Alabi',
    channelTitle: 'Tope Alabi Official',
    handle: '@TopeAlabiOfficial',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/TopeAlabiOfficial',
    bio: 'Celebrated Nigerian gospel music minister and indigenous Yoruba & English worship and praise leader.',
    aliases: ['Evangelist Tope Alabi', 'Tope Alabi Official'],
    defaultSubcategory: 'spontaneous-worship',
    discoveryQueries: [
      'Tope Alabi Yes and AmenLogan Ti Ode Mimo Loluwa',
      'Tope Alabi You Are Worthy Kabi O Osi Praise Medley',
    ],
  },
  {
    order: 18,
    channelId: 'ch-kaestrings',
    youtubeChannelId: 'UCRcFzNorSvQQ9wckhicB5cg',
    artistName: 'Kaestrings',
    channelTitle: 'Kaestrings',
    handle: '@KaestringsMusic',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/KaestringsMusic',
    bio: 'Nigerian acoustic gospel minstrel known for Hausa and English deep worship ballads including "Ga Shi Nan".',
    aliases: ['Kingsley Innocent', 'Minister Kaestrings'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'Kaestrings Ga Shi Nan He Is Here Haske',
      'KaestringsRahama Kaunar Allah Deep Worship',
    ],
  },
  {
    order: 19,
    channelId: 'ch-chinyere-udoma',
    youtubeChannelId: 'UCWeZVWlDkhaux-X3bR3YtnQ',
    artistName: 'Chinyere Udoma',
    channelTitle: 'Amb. Sis. Chinyere Udoma',
    handle: '@ChinyereUdoma',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/ChinyereUdoma',
    bio: 'Legendary Nigerian Igbo & English gospel music minister known for timeless thanksgiving and worship classics including "Agu N\'eche Mba" and "Adim Well Loaded".',
    aliases: ['Sis. Chinyere Udoma', 'Amb. Sis. Chinyere Udoma'],
    defaultSubcategory: 'thanksgiving-songs',
    discoveryQueries: [
      'Chinyere Udoma Ebube Dike Eze Mmuo Adim Well Loaded',
      'Chinyere Udoma Pure Praise Wind of Glory',
    ],
  },
  {
    order: 20,
    channelId: 'ch-emmaomg',
    youtubeChannelId: 'UCj_IY06T93dst_kvD7UmKcw',
    artistName: 'EmmaOMG',
    channelTitle: 'EmmaOMG',
    handle: '@EmmaOMG',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/EmmaOMG',
    bio: 'Nigerian gospel multi-instrumentalist and leader of The OhEmGee Band, famous for joyous Yoruba & Nigerian high-praise medleys and Faaji Friday worship.',
    aliases: ['Emmanuel Edunjobi', 'The OhEmGee Band', 'Faaji Friday'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'EmmaOMG Faaji Praise Session OhEmGee Band',
      'EmmaOMG Yoruba Gospel Praise Medley',
    ],
  },
  {
    order: 21,
    channelId: 'ch-gaise-baba',
    youtubeChannelId: 'UCOoO8EtJL8LMjIYogzJRfvg',
    artistName: 'Gaise Baba',
    channelTitle: 'Gaise Baba',
    handle: '@GaiseBaba',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/GaiseBaba',
    bio: 'Nigerian Afro-gospel artist and cultural creative championing vibrant, contemporary faith-inspired music.',
    aliases: ['Akinade Ibuoye'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'Gaise Baba No Turning Back Eledumare',
      'Gaise Baba Elijah Level Light',
    ],
  },
  {
    order: 22,
    channelId: 'ch-greatman-takit',
    youtubeChannelId: 'UCiXb9-vEAGIvihK5EWA4-Fw',
    artistName: 'Greatman Takit',
    channelTitle: 'Greatman Takit',
    handle: '@GreatmanTakit',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/GreatmanTakit',
    bio: 'Nigerian Afro-gospel artist and songwriter blending contemporary rhythms with Kingdom celebration.',
    aliases: ['Greatman Ademola Takit'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'Greatman Takit Correct Commot Body Look What Youve Done',
      'Greatman Takit Sound of Rain Melody',
    ],
  },
  {
    order: 23,
    channelId: 'ch-esther-oji',
    youtubeChannelId: 'UCWRxS_nq3Ste4cCZJk49b6Q',
    artistName: 'Esther Oji',
    channelTitle: 'Official Esther Oji',
    handle: '@estheroji-official',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/estheroji-official',
    bio: 'Nigerian gospel music minister and worship vocalist.',
    aliases: ['Minister Esther Oji'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'Esther Oji Fragrance Esther Oji Worship',
      'Esther Oji You Are Everything Big God',
    ],
  },
  {
    order: 24,
    channelId: 'ch-bidemi-olaoba',
    youtubeChannelId: 'UCAIM3y9fRUWYmbVvtgPORYw',
    artistName: 'Bidemi Olaoba',
    channelTitle: 'Bidemi Olaoba',
    handle: '@BidemiOlaoba',
    isNigerian: true,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/BidemiOlaoba',
    bio: 'Nigerian gospel high-praise minister renowned for electrifying church praise sessions and "The Bible Says".',
    aliases: ['Minister Bidemi Olaoba'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'Bidemi Olaoba Unrestricted Praises High Praise',
      'Bidemi Olaoba Bonjour Baba The Bible Says Live Praise',
    ],
  },
  {
    order: 25,
    channelId: 'ch-bisimanuel',
    youtubeChannelId: 'UCDOnyWM81mpbNOrqdmfXN9Q',
    artistName: 'BisiManuel',
    channelTitle: 'Bisi Manuel',
    handle: '@BisiManuel',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/BisiManuel',
    bio: 'Nigerian gospel praise leader celebrated for high-energy Nigerian church praise medleys and thanksgiving sessions.',
    aliases: ['Bisi Manuel', 'Bisimanuel'],
    defaultSubcategory: 'high-praise-celebration',
    discoveryQueries: [
      'BisiManuel Heavy Praise Medley High Praise',
      'Bisi Manuel Nigerian Gospel Praise Session',
    ],
  },
  {
    order: 26,
    channelId: 'ch-adeyinka-alaseyori',
    youtubeChannelId: 'UChmpYz_wW1CbD8aaIRYCtvw',
    artistName: 'Adeyinka Alaseyori',
    channelTitle: 'Adeyinka Alaseyori',
    handle: '@AdeyinkaAlaseyori',
    isNigerian: true,
    isFeatured: true,
    avatarUrl:
      'https://yt3.googleusercontent.com/3zbZv2UaokmOiyBWNc_PSlugSsEN0mkHsFE2eiWCbhQPccSMt8NWJgAWocFqohRdqGV3ZATfAQ=s900-c-k-c0x00ffffff-no-rj',
    bio: 'Nigerian Yoruba & English gospel worship and praise minister known for "Oniduro Mi" and deep thanksgiving medleys.',
    aliases: ['Evang. Adeyinka Alaseyori', 'Oniduro Mi'],
    defaultSubcategory: 'thanksgiving-songs',
    discoveryQueries: [
      'Adeyinka Alaseyori Oniduro Mi Aye Ope Yo',
      'Adeyinka Alaseyori Unlimited God Praise Medley',
    ],
  },
  {
    order: 27,
    channelId: 'ch-paul-tomisin',
    youtubeChannelId: 'UCHaCFyUqNFqWgJ7T9ld3Z1w',
    artistName: 'Paul Tomisin',
    channelTitle: 'Paul Tomisin',
    handle: '@PaulTomisin',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/PaulTomisin',
    bio: 'Nigerian gospel worship leader known for heartfelt Yoruba and English spontaneous worship sessions.',
    aliases: ['Minister Paul Tomisin'],
    defaultSubcategory: 'spontaneous-worship',
    discoveryQueries: [
      'Paul Tomisin Worship At Home Spontaneous Worship',
      'Paul Tomisin Yoruba Worship Medley',
    ],
  },
  {
    order: 28,
    channelId: 'ch-limoblaze',
    youtubeChannelId: 'UC93WkV5EatZqTyUEU2jxbiw',
    artistName: 'Limoblaze',
    channelTitle: 'Limoblaze',
    handle: '@Limoblaze',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/Limoblaze',
    bio: 'Award-winning Nigerian Afro-gospel artist and songwriter known for "Jireh (My Provider)" and "Desire".',
    aliases: ['Samuel Onwubiko'],
    defaultSubcategory: 'new-trending-gospel',
    discoveryQueries: [
      'Limoblaze Jireh My Provider Desire Mind',
      'Limoblaze Gold Pretty Girl No Greater Love',
    ],
  },
  {
    order: 29,
    channelId: 'ch-victor-thompson',
    youtubeChannelId: 'UCgepPM3g7Y1j78bgqTQbYAw',
    artistName: 'Victor Thompson',
    channelTitle: 'Victor Thompson Music',
    handle: '@VictorThompsonMusic',
    isNigerian: true,
    isFeatured: false,
    avatarUrl: 'https://unavatar.io/youtube/VictorThompsonMusic',
    bio: 'Nigerian gospel singer and worshipper known globally for the anthem "This Year (Blessings)".',
    aliases: ['Victor Thompson Music'],
    defaultSubcategory: 'thanksgiving-songs',
    discoveryQueries: [
      'Victor Thompson This Year Blessings Official Video',
      'Victor Thompson Fragrance of Worship Trusted',
    ],
  },

  // ==========================================================================
  // INTERNATIONAL GOSPEL ARTISTS & WORSHIP GROUPS (30 - 36)
  // ==========================================================================
  {
    order: 30,
    channelId: 'ch-maverick-city',
    youtubeChannelId: 'UCeFWKvh1eNWWOq5pq2Z4rYg',
    artistName: 'Maverick City Music',
    channelTitle: 'Maverick City Music',
    handle: '@MaverickCityMusic',
    isNigerian: false,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/MaverickCityMusic',
    bio: 'Global collective of Christian songwriters and worship leaders known for "Jireh", "Promises", and "Firm Foundation".',
    aliases: ['Maverick City', 'TRIBL'],
    defaultSubcategory: 'international-worship',
    discoveryQueries: [
      'Maverick City Music Promises Jireh Firm Foundation',
      'Maverick City Music Man of Your Word Wait On You Refiner',
    ],
  },
  {
    order: 31,
    channelId: 'ch-elevation-worship',
    youtubeChannelId: 'UCSf-NCzjwcnXErUBW_qeFvA',
    artistName: 'Elevation Worship',
    channelTitle: 'Elevation Worship',
    handle: '@ElevationWorship',
    isNigerian: false,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/ElevationWorship',
    bio: 'Contemporary worship ministry of Elevation Church producing global anthems including "Praise", "The Blessing", and "Graves Into Gardens".',
    aliases: ['Elevation Worship Official'],
    defaultSubcategory: 'international-worship',
    discoveryQueries: [
      'Elevation Worship Praise The Blessing Graves Into Gardens',
      'Elevation Worship Trust In God More Than Able Do It Again',
    ],
  },
  {
    order: 32,
    channelId: 'ch-hillsong-worship',
    youtubeChannelId: 'UC4q12NoPNySbVqwpw4iO5Vg',
    artistName: 'Hillsong Worship',
    channelTitle: 'Hillsong Worship',
    handle: '@HillsongWorship',
    isNigerian: false,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/HillsongWorship',
    bio: 'Internationally renowned congregational worship ministry known for timeless anthems including "What A Beautiful Name", "Who You Say I Am", and "Cornerstone".',
    aliases: ['Hillsong UNITED'],
    defaultSubcategory: 'international-worship',
    discoveryQueries: [
      'Hillsong Worship What A Beautiful Name Who You Say I Am Cornerstone',
      'Hillsong Worship King of Kings Broken Vessels Mighty To Save',
    ],
  },
  {
    order: 33,
    channelId: 'ch-cece-winans',
    youtubeChannelId: 'UC86Zlc-v_kkZ-yKG2cJZkxQ',
    artistName: 'CeCe Winans',
    channelTitle: 'CeCe Winans',
    handle: '@CeCeWinans',
    isNigerian: false,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/CeCeWinans',
    bio: 'Multi-Grammy-winning gospel music icon whose worship anthems "Goodness of God", "Believe For It", and "Holy Forever" resonate across the globe.',
    aliases: ['Cece Winans Official'],
    defaultSubcategory: 'international-worship',
    discoveryQueries: [
      'CeCe Winans Goodness of God Believe For It Holy Forever',
      'CeCe Winans Worthy of It All Come Jesus Come Alabaster Box',
    ],
  },
  {
    order: 34,
    channelId: 'ch-don-moen',
    youtubeChannelId: 'UCcKxZzWKezUfFMsAUSiMY8A',
    artistName: 'Don Moen',
    channelTitle: 'DonMoenTV',
    handle: '@DonMoenTV',
    isNigerian: false,
    isFeatured: true,
    avatarUrl: 'https://unavatar.io/youtube/DonMoenTV',
    bio: 'Beloved pioneer of modern praise and worship whose songs "Thank You Lord", "God Will Make A Way", and "Give Thanks" are staples in Nigerian and global churches.',
    aliases: ['DonMoenTV', 'Pastor Don Moen'],
    defaultSubcategory: 'classic-gospel-hits',
    discoveryQueries: [
      'Don Moen Thank You Lord God Will Make A Way Give Thanks',
      'Don Moen I Will Sing Our Father Heal Me O Lord',
    ],
  },
  {
    order: 35,
    channelId: 'ch-brandon-lake',
    youtubeChannelId: 'UCUvrv1Ox5rRwzG-SHCN7zrg',
    artistName: 'Brandon Lake',
    channelTitle: 'Brandon Lake',
    handle: '@BrandonLakeOfficial',
    isNigerian: false,
    isFeatured: true,
    avatarUrl:
      'https://yt3.googleusercontent.com/5xogUbOevzekJ58fjPyu5nudWtN7A2YA8vRyiCtap0AYAoTpeRRe43StTari57TAGB87anAzZg=s900-c-k-c0x00ffffff-no-rj',
    bio: 'Worship leader and songwriter known for "Gratitude", "Praise You Anywhere", and "That\'s Who I Praise".',
    aliases: ['Brandon Lake Official'],
    defaultSubcategory: 'international-worship',
    discoveryQueries: [
      'Brandon Lake Gratitude Praise You Anywhere Thats Who I Praise',
      'Brandon Lake Hard Fought Hallelujah Count Em Miracle Child',
    ],
  },
  {
    order: 36,
    channelId: 'ch-william-mcdowell',
    youtubeChannelId: 'UC2DG1coLhDhGucGc05JX-0A',
    artistName: 'William McDowell',
    channelTitle: 'William McDowell Music',
    handle: '@WilliamMcDowellMusic',
    isNigerian: false,
    isFeatured: true,
    avatarUrl:
      'https://yt3.googleusercontent.com/4PSa86c8_9XaahMj0Y7rFtTJemF-2EdZpMFJWSDHw0TQXC9Qzol1eqNKV04x7dB7QtVKHXuHBhw=s900-c-k-c0x00ffffff-no-rj',
    bio: 'Pastor and worship leader known globally for deep altar worship anthems including "I Give Myself Away", "Withholding Nothing", and "I Won\'t Go Back".',
    aliases: ['William McDowell Music', 'Pastor William McDowell'],
    defaultSubcategory: 'deep-worship',
    discoveryQueries: [
      'William McDowell I Give Myself Away Withholding Nothing',
      'William McDowell I Wont Go Back Spirit Break Out Send The Rain',
    ],
  },
];

export const APPROVED_WORSHIP_CHANNEL_IDS = new Set(
  APPROVED_WORSHIP_PRAISE_ARTISTS.map((a) => a.youtubeChannelId)
);

export const APPROVED_WORSHIP_ARTIST_BY_CHANNEL_ID = new Map(
  APPROVED_WORSHIP_PRAISE_ARTISTS.map((a) => [a.youtubeChannelId, a])
);

export const APPROVED_WORSHIP_ARTIST_BY_INTERNAL_ID = new Map(
  APPROVED_WORSHIP_PRAISE_ARTISTS.map((a) => [a.channelId, a])
);

/**
 *Trusted official ministry / label / concert YouTube channels where approved artists
 * frequently have official multi-million-view live worship sessions or music videos
 * (e.g., Spotlite Nation, EeZee Conceptz, House On The Rock / The Experience, Koinonia Global,
 * TRIBL, Bethel Music, Hillsong UNITED, Integrity Music, Celebration Church).
 */
const LEGITIMATE_PARTNER_CHANNEL_PATTERNS =
  /\b(spotlite nation|eezee conceptz|house on the rock|the experience|koinonia|tribl|bethel music|hillsong|integrity music|celebration church|dunamis|streams of joy|roxnation|rox nation|freenation|sons of god|1spirit|davidic minstrels|hammer house|donmoen|maverick city|elevation worship|cece winans)\b/i;

/**
 * Checks if a discovered YouTube video is genuinely a worship/praise song or live worship
 * session by the specified approved artist (rejecting sermons, interviews, podcasts, gossip, or reactions).
 */
export function isAuthenticWorshipPraiseSongForArtist(params: {
  title: string;
  description: string;
  youtubeChannelId: string;
  channelTitle: string;
  durationSeconds: number | null;
  artist: ApprovedWorshipArtistSpec;
}): boolean {
  const { title, description, youtubeChannelId, channelTitle, durationSeconds, artist } = params;
  const text = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // Reject ultra-short clips (< 120s) or excessively long 5-hour marathon compilation streams (> 9000s)
  if (durationSeconds !== null && (durationSeconds < 120 || durationSeconds > 9000)) {
    return false;
  }

  // Reject unrelated sermons, interviews, podcasts, reactions, lyrics spam, 1-hour loops, or gossip
  if (
    /\b(reaction|reacts to|interview|podcast|biography|net worth|car collection|house tour|wedding video|preaching|sermon:|1 hour version|1 hour loop|8d audio|karaoke|instrumental only|tutorial|how to play|bass cover|drum cover|guitar lesson)\b/i.test(
      titleLower
    )
  ) {
    return false;
  }

  // If uploaded directly on the artist's official YouTube channel:
  if (youtubeChannelId === artist.youtubeChannelId) {
    return true;
  }

  // Otherwise, only allow if the video title explicitly credits the artist AND comes from a legitimate partner/label/ministry channel
  const artistNameLower = artist.artistName.toLowerCase();
  const matchesArtistName =
    titleLower.includes(artistNameLower) ||
    artist.aliases.some((al) => titleLower.includes(al.toLowerCase()));

  if (!matchesArtistName) {
    return false;
  }

  if (
    LEGITIMATE_PARTNER_CHANNEL_PATTERNS.test(channelTitle) ||
    channelTitle.toLowerCase().includes(artistNameLower)
  ) {
    return true;
  }

  // Also allow if it's an official collaboration with another approved artist
  for (const other of APPROVED_WORSHIP_PRAISE_ARTISTS) {
    if (
      youtubeChannelId === other.youtubeChannelId ||
      channelTitle.toLowerCase().includes(other.artistName.toLowerCase())
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes a song title for deduplication per artist so we never add duplicate uploads
 * of the same song (e.g., "Way Maker (Official Video)" vs "Way Maker - Live").
 */
export function normalizeSongTitleKey(title: string, artistName: string): string {
  let cleaned = title.toLowerCase();
  // Remove artist name and common suffixes
  const artistParts = artistName.toLowerCase().split(/\s+/);
  for (const p of artistParts) {
    if (p.length >= 3) {
      cleaned = cleaned.replace(new RegExp(`\\b${p}\\b`, 'gi'), '');
    }
  }
  cleaned = cleaned
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(
      /\b(official|music|video|live|lyric|lyrics|audio|performance|ministration|session|feat|ft|by|minister|pastor|evang|amb|sis|dr)\b/gi,
      ' '
    )
    .replace(/[^a-z0-9]/g, '')
    .trim();

  return cleaned.slice(0, 28) || title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Classifies a Worship & Praise song into the 10 Approved Subcategories (Section 6)
 * without creating duplicate video records.
 */
export function classifyWorshipPraiseSubcategories(
  video: Pick<
    KingdomVideo,
    'title' | 'description' | 'published_at' | 'view_count' | 'views_per_day' | 'duration_seconds'
  >,
  artist: ApprovedWorshipArtistSpec
): {
  primarySubcategorySlug: WorshipSubcategorySlug;
  primarySubcategoryName: string;
  subcategories: WorshipSubcategorySlug[];
} {
  const text = `${video.title} ${video.description}`.toLowerCase();
  const titleLower = video.title.toLowerCase();
  const matched = new Set<WorshipSubcategorySlug>();

  // 1. Region subcategory (9. International Worship vs 10. Nigerian Gospel)
  if (artist.isNigerian) {
    matched.add('nigerian-gospel');
  } else {
    matched.add('international-worship');
  }

  // 2. Spontaneous Worship
  if (
    /\b(spontaneous|prophetic flow|worship flow|unscripted|altar call|soaking worship|atmosphere)\b/i.test(
      text
    )
  ) {
    matched.add('spontaneous-worship');
  }

  // 3. Prayer and Spiritual Warfare
  if (
    /\b(prayer|pray|warfare|chant|chants|tongues|fire|revival|intercession|battle|deliverance|hallelujah challenge|midnight cry|spirit chant|ascend|on fire|alignment)\b/i.test(
      text
    )
  ) {
    matched.add('prayer-spiritual-warfare-worship');
  }

  // 4. High Praise and Celebration
  if (
    /\b(high praise|praise medley|faaji|celebration|dance|rejoice|unrestricted praise|heavy praise|gyration|afrogospel|afro gospel|joy|victory|miracles everywhere|nara|big god|correct|commot body|no turning back)\b/i.test(
      text
    ) ||
    artist.defaultSubcategory === 'high-praise-celebration'
  ) {
    matched.add('high-praise-celebration');
  }

  // 5. Thanksgiving Songs
  if (
    /\b(thank|thanksgiving|gratitude|goodness of god|omemma|imela|obinasom|tobechukwu|ebenezer|testimony|i testify|congratulations|too faithful|blessings|this year|oniduro|ese|ope|mma mma|oghene do|see what the lord has done|you do this one)\b/i.test(
      text
    )
  ) {
    matched.add('thanksgiving-songs');
  }

  // 6. Live Worship Sessions
  if (
    /\b(live|ministration|session|concert|experience|worship night|live in|live at|koinonia|upper room)\b/i.test(
      titleLower
    ) ||
    (video.duration_seconds && video.duration_seconds >= 900)
  ) {
    matched.add('live-worship-sessions');
  }

  // 7. Deep Worship
  if (
    /\b(worship|fragrance|yahweh|holy|worthy|surrender|all that matters|yours|my daddy|ga shi nan|i give myself away|withholding nothing|what a beautiful name|cornerstone|breathe|yah|kov|covenant|spirit|presence|glory)\b/i.test(
      text
    ) ||
    artist.defaultSubcategory === 'deep-worship'
  ) {
    if (!matched.has('high-praise-celebration')) {
      matched.add('deep-worship');
    }
  }

  // 8. Classic Gospel Hits vs New and Trending Gospel Songs
  const pubYear = new Date(video.published_at).getFullYear();
  const ageDays = Math.max(
    1,
    (Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (
    pubYear <= 2022 ||
    video.view_count >= 5_000_000 ||
    /\b(way maker|excess love|thank you lord|god will make a way|give thanks|i give myself away|withholding nothing|what a beautiful name|who you say i am|goodness of god|imela|onise iyanu|olowogbogboro|you are great|fragrance to fire|all that matters|too faithful|capable god|nara|victory|mma mma)\b/i.test(
      titleLower
    )
  ) {
    matched.add('classic-gospel-hits');
  }

  if (ageDays <= 450 || pubYear >= 2025 || video.views_per_day >= 2500) {
    matched.add('new-trending-gospel');
  }

  // Determine the single best primary thematic subcategory label for display
  const priorityOrder: WorshipSubcategorySlug[] = [
    'spontaneous-worship',
    'prayer-spiritual-warfare-worship',
    'high-praise-celebration',
    'thanksgiving-songs',
    'deep-worship',
    'live-worship-sessions',
    'classic-gospel-hits',
    'new-trending-gospel',
    'international-worship',
    'nigerian-gospel',
  ];

  let primarySubcategorySlug: WorshipSubcategorySlug = artist.defaultSubcategory;
  for (const slug of priorityOrder) {
    if (matched.has(slug)) {
      primarySubcategorySlug = slug;
      break;
    }
  }

  matched.add(primarySubcategorySlug);

  const subConfig =
    WORSHIP_SUBCATEGORIES.find((s) => s.slug === primarySubcategorySlug) ||
    WORSHIP_SUBCATEGORIES[0];

  return {
    primarySubcategorySlug,
    primarySubcategoryName: subConfig.name,
    subcategories: Array.from(matched),
  };
}

/**
 * Converts an ApprovedWorshipArtistSpec into a full KingdomChannel record.
 */
export function buildKingdomChannelForWorshipArtist(
  spec: ApprovedWorshipArtistSpec,
  existing?: KingdomChannel
): KingdomChannel {
  return {
    id: existing?.id || spec.channelId,
    youtube_channel_id: spec.youtubeChannelId,
    title: spec.channelTitle,
    speaker_name: spec.artistName,
    ministry_name: spec.channelTitle,
    aliases: Array.from(
      new Set([
        ...(existing?.aliases || []),
        ...spec.aliases,
        spec.artistName,
        spec.channelTitle,
        spec.handle,
      ])
    ),
    bio: existing?.bio || spec.bio,
    handle: spec.handle,
    channel_type: 'artist',
    is_featured_minister: existing?.is_featured_minister ?? spec.isFeatured,
    is_approved_worship_artist: true,
    worship_artist_order: spec.order,
    is_nigerian: spec.isNigerian,
    is_official_verified: true,
    default_category_slug: 'worship-praise',
    supported_categories: ['worship-praise', 'gospel-music'],
    subscriber_count: existing?.subscriber_count ?? null,
    video_count: existing?.video_count ?? null,
    view_count: existing?.view_count ?? null,
    avatar_url: existing?.avatar_url || spec.avatarUrl,
    approval_status: 'approved',
    priority_weight: spec.isNigerian ? 1.5 : 1.35,
    last_synced_at: existing?.last_synced_at ?? new Date().toISOString(),
  };
}

/**
 * Synchronously enforces that:
 * 1. All 36 approved Worship & Praise artists are present in `channels` with `is_approved_worship_artist = true`.
 * 2. Any video NOT by one of the 36 approved artists is removed from `worship-praise` (reassigned to its non-worship category or `gospel-music` without deleting the video).
 * 3. Every video in `worship-praise` has its `artist_name`, `subcategory_label`, and `worship_subcategories` populated across the 10 Worship & Praise subcategories.
 */
export function enforceWorshipPraiseCategoryIntegrity(
  channels: KingdomChannel[],
  videos: KingdomVideo[],
  categories: Array<{ id: string; slug: string; name: string }>
): void {
  // 1. Mark all channels false first, then upsert the 36 approved Worship & Praise artists
  for (const ch of channels) {
    ch.is_approved_worship_artist = false;
    ch.worship_artist_order = undefined;
  }

  const artistSpecByChannelId = new Map<string, ApprovedWorshipArtistSpec>();
  for (const spec of APPROVED_WORSHIP_PRAISE_ARTISTS) {
    const existingIdx = channels.findIndex(
      (c) => c.youtube_channel_id === spec.youtubeChannelId || c.id === spec.channelId
    );
    if (existingIdx >= 0) {
      const updated = buildKingdomChannelForWorshipArtist(spec, channels[existingIdx]);
      channels[existingIdx] = updated;
      artistSpecByChannelId.set(updated.id, spec);
    } else {
      const created = buildKingdomChannelForWorshipArtist(spec);
      channels.push(created);
      artistSpecByChannelId.set(created.id, spec);
    }
  }

  const gospelMusicCat = categories.find((c) => c.slug === 'gospel-music') || {
    id: 'cat-gospel-music',
    slug: 'gospel-music',
    name: 'Gospel Music',
  };
  const sermonsCat = categories.find((c) => c.slug === 'sermons-teachings') || {
    id: 'cat-sermons-teachings',
    slug: 'sermons-teachings',
    name: 'Sermons & Teachings',
  };
  const worshipCat = categories.find((c) => c.slug === 'worship-praise') || {
    id: 'cat-worship-praise',
    slug: 'worship-praise',
    name: 'Worship & Praise',
  };

  for (const v of videos) {
    const artistSpec = artistSpecByChannelId.get(v.channel_id);

    // If this video does NOT belong to one of the 36 approved Worship & Praise artists,
    // remove all Worship & Praise associations from it without deleting the video!
    if (!artistSpec) {
      v.worship_subcategories = [];
      if (Array.isArray(v.secondary_category_slugs)) {
        v.secondary_category_slugs = v.secondary_category_slugs.filter(
          (s) => s !== 'worship-praise'
        );
      }
      if (v.primary_category_slug === 'worship-praise') {
        const fallbackSlug =
          v.secondary_category_slugs?.find((s) => s !== 'worship-praise') ||
          (v.channel_type === 'artist' ? 'gospel-music' : 'sermons-teachings');
        const fallbackCat =
          categories.find((c) => c.slug === fallbackSlug) ||
          (v.channel_type === 'artist' ? gospelMusicCat : sermonsCat);
        v.primary_category_id = fallbackCat.id;
        v.primary_category_slug = fallbackCat.slug;
        v.primary_category_name = fallbackCat.name;
      }
      continue;
    }

    // Video belongs to one of the 36 approved Worship & Praise artists
    v.artist_name = artistSpec.artistName;

    if (
      v.primary_category_slug === 'worship-praise' ||
      v.secondary_category_slugs?.includes('worship-praise')
    ) {
      // Ensure it is a valid song/worship session and not an interview/sermon
      const validSong = isAuthenticWorshipPraiseSongForArtist({
        title: v.title,
        description: v.description,
        youtubeChannelId: artistSpec.youtubeChannelId,
        channelTitle: v.channel_title,
        durationSeconds: v.duration_seconds,
        artist: artistSpec,
      });

      if (!validSong) {
        v.worship_subcategories = [];
        v.secondary_category_slugs = (v.secondary_category_slugs || []).filter(
          (s) => s !== 'worship-praise'
        );
        if (v.primary_category_slug === 'worship-praise') {
          v.primary_category_id = gospelMusicCat.id;
          v.primary_category_slug = gospelMusicCat.slug;
          v.primary_category_name = gospelMusicCat.name;
        }
        continue;
      }

      v.primary_category_id = worshipCat.id;
      v.primary_category_slug = worshipCat.slug;
      v.primary_category_name = worshipCat.name;

      const subInfo = classifyWorshipPraiseSubcategories(v, artistSpec);
      if (!v.worship_subcategories || v.worship_subcategories.length === 0) {
        v.worship_subcategories = subInfo.subcategories;
      }
      v.subcategory_label = subInfo.primarySubcategoryName;
    }
  }
}

/**
 * Performs a complete Worship & Praise Category Refresh:
 * 1. Clears all existing Worship & Praise category associations without deleting any videos or affecting other categories.
 * 2. Harvests both old (evergreen multi-million-view classics) and new songs in parallel across all 36 Approved Artists.
 * 3. Verifies authenticity, eliminates duplicates, and assigns each song to the 10 Worship & Praise subcategories.
 */
export async function refreshWorshipAndPraiseFromYouTube(params: {
  channels: KingdomChannel[];
  videos: KingdomVideo[];
  categories: ContentCategory[];
  maxPerArtist?: number;
}): Promise<{
  clearedPrimaryCount: number;
  clearedSecondaryCount: number;
  totalCuratedSongs: number;
  perArtistCounts: Array<{ order: number; artistName: string; count: number }>;
}> {
  const { channels, videos, categories, maxPerArtist = 8 } = params;

  // 1. Mark all channels false, then upsert the 36 Approved Worship & Praise Artists
  for (const ch of channels) {
    ch.is_approved_worship_artist = false;
    ch.worship_artist_order = undefined;
  }

  const artistChannelByOrder = new Map<number, KingdomChannel>();
  for (const spec of APPROVED_WORSHIP_PRAISE_ARTISTS) {
    const idx = channels.findIndex(
      (c) => c.youtube_channel_id === spec.youtubeChannelId || c.id === spec.channelId
    );
    if (idx >= 0) {
      channels[idx] = buildKingdomChannelForWorshipArtist(spec, channels[idx]);
      artistChannelByOrder.set(spec.order, channels[idx]);
    } else {
      const created = buildKingdomChannelForWorshipArtist(spec);
      channels.push(created);
      artistChannelByOrder.set(spec.order, created);
    }
  }

  // 2. Clear ALL existing Worship & Praise associations without deleting any video
  const gospelCat = categories.find((c) => c.slug === 'gospel-music') || {
    id: 'cat-gospel-music',
    slug: 'gospel-music',
    name: 'Gospel Music',
  };
  const sermonsCat = categories.find((c) => c.slug === 'sermons-teachings') || {
    id: 'cat-sermons-teachings',
    slug: 'sermons-teachings',
    name: 'Sermons & Teachings',
  };
  const worshipCat = categories.find((c) => c.slug === 'worship-praise') || {
    id: 'cat-worship-praise',
    slug: 'worship-praise',
    name: 'Worship & Praise',
  };

  let clearedPrimaryCount = 0;
  let clearedSecondaryCount = 0;

  for (const v of videos) {
    v.worship_subcategories = [];
    if (
      Array.isArray(v.secondary_category_slugs) &&
      v.secondary_category_slugs.includes('worship-praise')
    ) {
      v.secondary_category_slugs = v.secondary_category_slugs.filter(
        (s) => s !== 'worship-praise'
      );
      clearedSecondaryCount++;
    }
    if (v.primary_category_slug === 'worship-praise') {
      const nextSlug =
        (v.secondary_category_slugs || []).find((s) => s !== 'worship-praise') ||
        (v.channel_type === 'artist' ? 'gospel-music' : 'sermons-teachings');
      const nextCat =
        categories.find((c) => c.slug === nextSlug) ||
        (v.channel_type === 'artist' ? gospelCat : sermonsCat);
      v.primary_category_id = nextCat.id;
      v.primary_category_slug = nextCat.slug;
      v.primary_category_name = nextCat.name;
      clearedPrimaryCount++;
    }
  }

  // 3. Fetch XML feeds and targeted search queries in parallel batches of 9 artists
  const harvestedByOrder = new Map<
    number,
    Array<RawFeedVideoItem & { channelTitle?: string }>
  >();

  const batchSize = 9;
  for (let i = 0; i < APPROVED_WORSHIP_PRAISE_ARTISTS.length; i += batchSize) {
    const batch = APPROVED_WORSHIP_PRAISE_ARTISTS.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (spec) => {
        const artistChannel = artistChannelByOrder.get(spec.order)!;
        const mapByYtId = new Map<string, RawFeedVideoItem & { channelTitle?: string }>();

        // (a) Existing DB videos from this artist channel
        for (const v of videos) {
          if (
            v.channel_id === artistChannel.id &&
            v.is_available &&
            v.is_embeddable &&
            v.view_count > 0
          ) {
            mapByYtId.set(v.youtube_video_id, {
              youtubeVideoId: v.youtube_video_id,
              youtubeChannelId: spec.youtubeChannelId,
              channelTitle: artistChannel.title,
              title: v.title,
              description: v.description || '',
              publishedAt: v.published_at,
              viewCount: v.view_count,
              likeCount: v.likes_verified !== false ? v.like_count : 0,
              likesVerified: v.likes_verified !== false && v.like_count > 0,
              commentCount: v.comment_count,
              durationSeconds: v.duration_seconds,
              isEmbeddable: true,
              thumbnailHighUrl: v.thumbnail_high_url,
              thumbnailMaxresUrl: v.thumbnail_maxres_url,
            });
          }
        }

        // (b) Parallel XML feed + search queries
        const [feedItems, ...searchLists] = await Promise.all([
          fetchChannelVideosViaOfficialXmlFeed(spec.youtubeChannelId).catch(() => []),
          ...spec.discoveryQueries.map((q) => searchYouTubeStructured(q, 10).catch(() => [])),
        ]);

        for (const item of feedItems) {
          const prev = mapByYtId.get(item.youtubeVideoId);
          mapByYtId.set(item.youtubeVideoId, {
            ...prev,
            ...item,
            channelTitle: artistChannel.title,
            durationSeconds: item.durationSeconds ?? prev?.durationSeconds ?? null,
            likesVerified: item.likeCount > 0,
          });
        }

        for (const sList of searchLists) {
          for (const sItem of sList) {
            const prev = mapByYtId.get(sItem.youtubeVideoId);
            if (prev) {
              prev.viewCount = Math.max(prev.viewCount, sItem.viewCount);
              if (!prev.durationSeconds && sItem.durationSeconds) {
                prev.durationSeconds = sItem.durationSeconds;
              }
              if (!prev.description && sItem.description) {
                prev.description = sItem.description;
              }
            } else {
              mapByYtId.set(sItem.youtubeVideoId, sItem);
            }
          }
        }

        harvestedByOrder.set(spec.order, Array.from(mapByYtId.values()));
      })
    );
  }

  // 4. Deduplicate, rank by engagement & view count, and assign to Worship & Praise
  const existingVideoByYtId = new Map(videos.map((v) => [v.youtube_video_id, v]));
  const globalAssignedYtIds = new Set<string>();
  const perArtistCounts: Array<{ order: number; artistName: string; count: number }> = [];
  let totalCuratedSongs = 0;

  for (const spec of APPROVED_WORSHIP_PRAISE_ARTISTS) {
    const artistChannel = artistChannelByOrder.get(spec.order)!;
    const rawCandidates = harvestedByOrder.get(spec.order) || [];

    const validCandidates = rawCandidates.filter((cand) => {
      if (globalAssignedYtIds.has(cand.youtubeVideoId)) return false;
      return isAuthenticWorshipPraiseSongForArtist({
        title: cand.title,
        description: cand.description || '',
        youtubeChannelId: cand.youtubeChannelId,
        channelTitle: cand.channelTitle || artistChannel.title,
        durationSeconds: cand.durationSeconds,
        artist: spec,
      });
    });

    validCandidates.sort((a, b) => {
      const aOfficial = a.youtubeChannelId === spec.youtubeChannelId ? 1.25 : 1.0;
      const bOfficial = b.youtubeChannelId === spec.youtubeChannelId ? 1.25 : 1.0;
      const scoreA = (a.viewCount + (a.likeCount || 0) * 15) * aOfficial;
      const scoreB = (b.viewCount + (b.likeCount || 0) * 15) * bOfficial;
      return scoreB - scoreA;
    });

    const seenTitleKeys = new Set<string>();
    const selectedForArtist: Array<RawFeedVideoItem & { channelTitle?: string }> = [];

    for (const cand of validCandidates) {
      const tKey = normalizeSongTitleKey(cand.title, spec.artistName);
      if (tKey.length >= 4 && seenTitleKeys.has(tKey)) continue;
      seenTitleKeys.add(tKey);
      selectedForArtist.push(cand);
      if (selectedForArtist.length >= maxPerArtist) break;
    }

    for (const sel of selectedForArtist) {
      globalAssignedYtIds.add(sel.youtubeVideoId);

      const metrics = computeVideoRankingMetrics({
        viewCount: sel.viewCount,
        likeCount: sel.likeCount || 0,
        commentCount: sel.commentCount ?? null,
        publishedAt: sel.publishedAt,
        isNigerianChannel: spec.isNigerian,
        isOfficialVerified: true,
        priorityWeight: artistChannel.priority_weight,
      });

      const subInfo = classifyWorshipPraiseSubcategories(
        {
          title: sel.title,
          description: sel.description || '',
          published_at: sel.publishedAt,
          view_count: sel.viewCount,
          views_per_day: metrics.viewsPerDay,
          duration_seconds: sel.durationSeconds ?? null,
        },
        spec
      );

      const existingVid = existingVideoByYtId.get(sel.youtubeVideoId);
      if (existingVid) {
        existingVid.channel_id = artistChannel.id;
        existingVid.channel_title = artistChannel.title;
        existingVid.channel_handle = artistChannel.handle;
        existingVid.channel_type = 'artist';
        existingVid.artist_name = spec.artistName;
        existingVid.channel_avatar_url = artistChannel.avatar_url;
        existingVid.is_nigerian_channel = spec.isNigerian;
        existingVid.is_official_verified = true;
        existingVid.primary_category_id = worshipCat.id;
        existingVid.primary_category_slug = worshipCat.slug;
        existingVid.primary_category_name = worshipCat.name;
        existingVid.secondary_category_slugs = Array.from(
          new Set([
            ...(existingVid.secondary_category_slugs || []).filter((s) => s !== 'worship-praise'),
            'gospel-music',
          ])
        ).slice(0, 2);
        existingVid.subcategory_label = subInfo.primarySubcategoryName;
        existingVid.worship_subcategories = subInfo.subcategories;
        existingVid.view_count = Math.max(existingVid.view_count, sel.viewCount);
        existingVid.like_count = sel.likesVerified ? sel.likeCount : 0;
        existingVid.likes_verified = Boolean(sel.likesVerified && sel.likeCount > 0);
        existingVid.duration_seconds = sel.durationSeconds ?? existingVid.duration_seconds;
        existingVid.views_per_day = metrics.viewsPerDay;
        existingVid.engagement_rate = metrics.engagementRate;
        existingVid.trending_score = metrics.trendingScore;
        existingVid.evergreen_score = metrics.evergreenScore;
        existingVid.quality_score = metrics.qualityScore;
        existingVid.approval_status = 'approved';
        existingVid.is_available = true;
        existingVid.is_embeddable = true;
      } else {
        const newVid: KingdomVideo = {
          id: `vid-${sel.youtubeVideoId}`,
          youtube_video_id: sel.youtubeVideoId,
          channel_id: artistChannel.id,
          channel_title: artistChannel.title,
          channel_handle: artistChannel.handle,
          channel_type: 'artist',
          artist_name: spec.artistName,
          channel_avatar_url: artistChannel.avatar_url,
          is_nigerian_channel: spec.isNigerian,
          is_official_verified: true,
          primary_category_id: worshipCat.id,
          primary_category_slug: worshipCat.slug,
          primary_category_name: worshipCat.name,
          secondary_category_slugs: ['gospel-music'],
          subcategory_label: subInfo.primarySubcategoryName,
          worship_subcategories: subInfo.subcategories,
          marriage_collections: [],
          title: sel.title,
          description: sel.description || '',
          thumbnail_high_url: `https://i.ytimg.com/vi/${sel.youtubeVideoId}/hqdefault.jpg`,
          thumbnail_maxres_url: `https://i.ytimg.com/vi/${sel.youtubeVideoId}/maxresdefault.jpg`,
          published_at: sel.publishedAt,
          duration_seconds: sel.durationSeconds ?? null,
          view_count: sel.viewCount,
          like_count: sel.likesVerified ? sel.likeCount : 0,
          likes_verified: Boolean(sel.likesVerified && sel.likeCount > 0),
          comment_count: null,
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
          is_featured_hero: false,
          is_trending_pinned: false,
          ai_classification_reason: `Curated high-engagement Worship & Praise song by ${spec.artistName} (${subInfo.primarySubcategoryName}).`,
          last_refreshed_at: new Date().toISOString(),
        };
        videos.push(newVid);
        existingVideoByYtId.set(newVid.youtube_video_id, newVid);
      }

      totalCuratedSongs++;
    }

    perArtistCounts.push({
      order: spec.order,
      artistName: spec.artistName,
      count: selectedForArtist.length,
    });
  }

  return {
    clearedPrimaryCount,
    clearedSecondaryCount,
    totalCuratedSongs,
    perArtistCounts,
  };
}


