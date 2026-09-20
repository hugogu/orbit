/**
 * Editorial guide to the recurring sky events an observer can plan for.
 *
 * This catalog explains concepts; it computes nothing. Predicted eclipse
 * circumstances live in `lib/sky-events.ts`, and the observing dates quoted
 * here are the long-term averages published by the sources on each topic, not
 * an ephemeris. Text is written in the source language and translated at
 * presentation time, like every other catalog in `lib/`.
 */

export type EventCategoryId =
  | 'meteor-shower'
  | 'planet-aspect'
  | 'moon-phase'
  | 'eclipse'
  | 'sun-earth';

export type EventCategory = {
  id: EventCategoryId;
  name: string;
  en: string;
  /** What the whole family has in common; the index page leads with it. */
  summary: string;
};

export type EventTopic = {
  id: string;
  name: string;
  en: string;
  category: EventCategoryId;
  /** When it recurs, in words. Shown beside the name wherever it is listed. */
  season: string;
  /** One sentence: the index card and the page description both use it. */
  summary: string;
  headline: string;
  intro: string;
  sections: { heading: string; text: string }[];
  facts: { label: string; value: string }[];
  observing: string[];
  /** Catalog ids that tie an event back to the bodies producing it. */
  bodies: string[];
  sources: { name: string; url: string }[];
};

const imo = {
  name: 'IMO Meteor Shower Calendar',
  url: 'https://www.imo.net/resources/calendar/',
};
const ams = {
  name: 'American Meteor Society',
  url: 'https://www.amsmeteors.org/calendar/',
};
const nasaShower = (slug: string, name: string) => ({
  name: `NASA Science — ${name}`,
  url: `https://science.nasa.gov/solar-system/meteors-meteorites/${slug}/`,
});

export const eventCategories: EventCategory[] = [
  {
    id: 'meteor-shower',
    name: '流星雨',
    en: 'Meteor showers',
    summary:
      '流星雨来自彗星或小行星沿轨道遗留的尘埃带。地球每年在相近的日期穿过同一条尘埃带，尘粒以每秒几十公里的速度冲入大气，在约 80 至 120 公里高处气化发光。由于这些尘粒的轨道彼此平行，透视效果让所有流星看起来都从天球上同一点辐射开来，流星雨也因此以辐射点所在的星座命名。',
  },
  {
    id: 'planet-aspect',
    name: '行星相位',
    en: 'Planetary aspects',
    summary:
      '一颗行星什么时候可见、有多亮、朝向我们的是被照亮的哪一面，取决于它、地球和太阳三者的相对方位。合、冲、大距、凌日和掩星，描述的都是这种几何关系中的几个特殊时刻。',
  },
  {
    id: 'moon-phase',
    name: '月相与月球',
    en: 'The Moon',
    summary:
      '月相是太阳、地球和月球相对位置的直接体现，与地球的影子无关。在一个朔望月里，我们看到的是月球被照亮半球的不同部分；而月球轨道并非正圆，它与地球的距离变化还会改变满月的大小和亮度。',
  },
  {
    id: 'eclipse',
    name: '日月食',
    en: 'Eclipses',
    summary:
      '当太阳、地球和月球接近一条直线时，一个天体的影子会落到另一个天体上。月球轨道相对黄道倾斜约 5°，因此食只发生在交点附近——这也是观测台的“天象推演”能够逐次列出未来日食与月食的原因。',
  },
  {
    id: 'sun-earth',
    name: '太阳与地球',
    en: 'Sun and Earth',
    summary:
      '地球自身的运动也在制造周而复始的天象：地轴的倾斜决定昼夜长短与正午太阳高度的年度变化，椭圆轨道则让日地距离在一年中往复改变。这两件事常被混为一谈，却分别对应着四季和日面的大小。',
  },
];

export const eventTopics: EventTopic[] = [
  {
    id: 'quadrantids',
    name: '象限仪座流星雨',
    en: 'Quadrantids',
    category: 'meteor-shower',
    season: '每年 1 月初',
    summary: '极大只持续几个小时的冬季流星雨，母天体可能是一颗熄火彗星。',
    headline: '一年最早的一场，也是最短的一场',
    intro:
      '象限仪座流星雨在每年 1 月初达到极大，出现率与英仙座、双子座同级，却常常被错过：它的峰值只持续几个小时，一旦错开时区，剩下的就只有零星流星。它的辐射点位于牧夫座北部，那里曾经属于已被废弃的“象限仪座”，流星雨保留了这个旧星座的名字。',
    sections: [
      {
        heading: '窄得像一道闸门的极大',
        text: '多数流星雨的尘埃带足够宽，地球要穿行一两天；象限仪座的这条很窄，峰值前后 6 小时内出现率就会减半。于是同一年里，某个经度看到的是满天流星，另一侧的夜空却几乎空白。出发之前，值得先查一份当年的极大时刻预报。',
      },
      {
        heading: '一颗停止活动的彗星',
        text: '目前普遍认为母天体是小行星 2003 EH₁，它的轨道与 1490 年的一次彗星记录吻合，很可能是一颗已经耗尽挥发物的熄火彗星核。这类天体提醒我们：彗星与小行星之间并没有一条清晰的界线。',
      },
    ],
    facts: [
      { label: '活跃期', value: '12 月 28 日至 1 月 12 日' },
      { label: '通常极大', value: '1 月 3 日前后' },
      { label: '理想条件下的 ZHR', value: '约 110' },
      { label: '母天体', value: '小行星 2003 EH₁' },
    ],
    observing: [
      '极大只持续数小时，出发前先确认当年的预报时刻。',
      '辐射点在后半夜升高，黎明前几小时最有利。',
      '1 月的夜间寒冷，保暖装备比望远镜更要紧。',
    ],
    bodies: [],
    sources: [nasaShower('quadrantids', 'Quadrantids'), imo],
  },
  {
    id: 'lyrids',
    name: '天琴座流星雨',
    en: 'Lyrids',
    category: 'meteor-shower',
    season: '每年 4 月下旬',
    summary: '有两千多年观测记录的春季流星雨，偶尔出现短暂爆发。',
    headline: '有文字记录最久的一场流星雨',
    intro:
      '天琴座流星雨在 4 月下旬极大，寻常年份每小时十余颗，但它是人类记录最早的流星雨之一：中国古籍中公元前 687 年“星陨如雨”的记载，一般认为说的就是这场流星雨。它的母天体是一颗周期约 415 年的长周期彗星。',
    sections: [
      {
        heading: '偶尔出现的爆发',
        text: '天琴座流星雨的出现率并不稳定，1803 年、1922 年和 1982 年都出现过每小时接近百颗的短时爆发，原因可能是地球偶然穿过了尘埃带中较密的细丝。这类爆发难以提前预测，也让寻常年份的观测多了一分期待。',
      },
      {
        heading: '四百年才回来一次的母彗星',
        text: 'C/1861 G1（撒切尔）彗星上一次通过近日点是在 1861 年，下一次要等到 23 世纪。我们每年看到的，是它在过去多次回归中沿轨道洒落、至今仍在缓慢扩散的尘埃。',
      },
    ],
    facts: [
      { label: '活跃期', value: '4 月 14 日至 4 月 30 日' },
      { label: '通常极大', value: '4 月 22 日前后' },
      { label: '理想条件下的 ZHR', value: '约 18' },
      { label: '母天体', value: 'C/1861 G1（撒切尔）彗星' },
    ],
    observing: [
      '辐射点在午夜后升到高空，后半夜条件最好。',
      '亮度中等偏亮，城市近郊也能看到较亮的成员。',
      '遇上满月的年份，出现率会被月光大幅削弱。',
    ],
    bodies: [],
    sources: [nasaShower('lyrids', 'Lyrids'), imo],
  },
  {
    id: 'eta-aquariids',
    name: '宝瓶座η流星雨',
    en: 'Eta Aquariids',
    category: 'meteor-shower',
    season: '每年 5 月初',
    summary: '哈雷彗星留下的高速流星，南半球的观测条件明显更好。',
    headline: '哈雷彗星每年寄来的两封信之一',
    intro:
      '宝瓶座η流星雨的尘埃来自 1P/哈雷彗星。地球在 5 月初穿过它轨道的入境一侧，流星以约 66 公里每秒冲入大气，速度快，常留下持续几秒的余迹。辐射点靠近天赤道以南，纬度越靠南，能看到它的时间越长。',
    sections: [
      {
        heading: '为什么南半球更占优势',
        text: '辐射点在黎明前才升起。北半球中纬度地区它刚离开地平线天就亮了，有效窗口只有一小时左右；南半球则有好几个小时的黑暗时间。同一场流星雨，在不同纬度数到的出现率可以相差数倍。',
      },
      {
        heading: '同一颗彗星的另一场流星雨',
        text: '地球在 10 月还会穿过哈雷轨道的另一侧，形成猎户座流星雨。两场流星雨的速度同样接近上限，正是因为它们的尘埃来自同一条逆行轨道。',
      },
    ],
    facts: [
      { label: '活跃期', value: '4 月 19 日至 5 月 28 日' },
      { label: '通常极大', value: '5 月 6 日前后' },
      { label: '理想条件下的 ZHR', value: '约 50，南半球' },
      { label: '母天体', value: '1P/哈雷彗星' },
    ],
    observing: [
      '黎明前两小时是唯一有效的窗口，越靠南越充裕。',
      '流星速度快、余迹明显，适合长曝光拍摄。',
      '面向东南方开阔的地平线，不要只盯着辐射点。',
    ],
    bodies: ['halley'],
    sources: [nasaShower('eta-aquarids', 'Eta Aquarids'), imo],
  },
  {
    id: 'perseids',
    name: '英仙座流星雨',
    en: 'Perseids',
    category: 'meteor-shower',
    season: '每年 8 月中旬',
    summary: '北半球条件最好的年度流星雨，出现率稳定，极大期夜里温暖。',
    headline: '北半球最容易看到的一场',
    intro:
      '英仙座流星雨在 8 月 12 日前后极大，理想条件下每小时可见近百颗。它之所以成为北半球最受欢迎的流星雨，一半因为出现率稳定，另一半因为极大期正值温暖的夏夜，辐射点整夜都在地平线之上。',
    sections: [
      {
        heading: '一颗巨大的母彗星',
        text: '109P/斯威夫特—塔特尔彗星的核直径约 26 公里，是已知会周期性接近地球轨道的最大天体之一，周期约 133 年。它在 1992 年回归后，沿途留下的尘埃仍在被地球每年穿过。',
      },
      {
        heading: '火流星的比例偏高',
        text: '英仙座流星以约 59 公里每秒进入大气，其中不乏亮于金星的火流星，也常留下短暂的余迹。它们在城市近郊也容易被看到，但要真正数清出现率，仍然需要远离灯光。',
      },
    ],
    facts: [
      { label: '活跃期', value: '7 月 17 日至 8 月 24 日' },
      { label: '通常极大', value: '8 月 12 日前后' },
      { label: '理想条件下的 ZHR', value: '约 100' },
      { label: '母天体', value: '109P/斯威夫特—塔特尔彗星' },
    ],
    observing: [
      '辐射点整夜可见，午夜后升高，出现率随之上升。',
      '用肉眼看最合适，望远镜的视场反而太小。',
      '到达观测地后，给眼睛 20 分钟适应黑暗。',
    ],
    bodies: [],
    sources: [nasaShower('perseids', 'Perseids'), imo],
  },
  {
    id: 'orionids',
    name: '猎户座流星雨',
    en: 'Orionids',
    category: 'meteor-shower',
    season: '每年 10 月下旬',
    summary: '哈雷彗星尘埃的另一场，速度接近上限，极大平缓。',
    headline: '秋夜里速度最快的流星之一',
    intro:
      '猎户座流星雨在 10 月下旬极大，出现率中等，但流星速度接近上限：约 66 公里每秒。它的尘埃同样来自 1P/哈雷彗星，只是地球这次穿过的是轨道的另一侧。极大前后一周内出现率变化不大，不必死守某一个晚上。',
    sections: [
      {
        heading: '平缓的极大',
        text: '与象限仪座相反，猎户座流星雨的尘埃带宽阔，极大前后好几个晚上的出现率都接近峰值。这让它对天气格外宽容：某一夜多云，第二夜仍然值得出门。',
      },
      {
        heading: '辐射点与猎户座',
        text: '辐射点位于猎户举起的“棍棒”附近，午夜后随猎户座升上高空。流星本身可能出现在天空的任何方向，只盯着辐射点看，反而会错过更长的轨迹。',
      },
    ],
    facts: [
      { label: '活跃期', value: '10 月 2 日至 11 月 7 日' },
      { label: '通常极大', value: '10 月 21 日前后' },
      { label: '理想条件下的 ZHR', value: '约 20' },
      { label: '母天体', value: '1P/哈雷彗星' },
    ],
    observing: [
      '极大平缓，前后数夜的条件都接近峰值。',
      '午夜后辐射点升高，黎明前最有利。',
      '流星速度快，肉眼看到的多是一闪而过的细亮线。',
    ],
    bodies: ['halley'],
    sources: [nasaShower('orionids', 'Orionids'), imo],
  },
  {
    id: 'leonids',
    name: '狮子座流星雨',
    en: 'Leonids',
    category: 'meteor-shower',
    season: '每年 11 月中旬',
    summary: '平时安静，却在母彗星回归前后可能爆发成流星暴。',
    headline: '三十三年一遇的流星暴',
    intro:
      '狮子座流星雨在 11 月 17 日前后极大，常年每小时只有十余颗，但它是历史上最壮观的流星暴的来源：1833 年和 1966 年，观测者报告过每小时数千甚至数万颗的盛况。这种爆发与母彗星 55P/坦普尔—塔特尔约 33 年的回归周期有关。',
    sections: [
      {
        heading: '尘埃细丝与流星暴',
        text: '彗星每次回归都会留下一条新的尘埃细丝。当地球恰好穿过一条年轻而致密的细丝时，出现率会在一两个小时内暴涨。1999 至 2002 年的几次爆发已经能够被提前预报，这也是流星天文学的一次重要验证。',
      },
      {
        heading: '太阳系里最快的流星',
        text: '狮子座流星以约 71 公里每秒迎面撞入大气，是主要流星雨中速度最快的。高速意味着更明亮的痕迹，也更容易留下持续数秒的余迹。',
      },
    ],
    facts: [
      { label: '活跃期', value: '11 月 6 日至 11 月 30 日' },
      { label: '通常极大', value: '11 月 17 日前后' },
      { label: '理想条件下的 ZHR', value: '约 15，爆发年除外' },
      { label: '母天体', value: '55P/坦普尔—塔特尔彗星' },
    ],
    observing: [
      '辐射点在午夜后升起，后半夜才进入状态。',
      '常年出现率不高，更适合当作长时间守候的项目。',
      '爆发年份会有专门的预报，值得提前关注。',
    ],
    bodies: [],
    sources: [nasaShower('leonids', 'Leonids'), imo],
  },
  {
    id: 'geminids',
    name: '双子座流星雨',
    en: 'Geminids',
    category: 'meteor-shower',
    season: '每年 12 月中旬',
    summary: '一年中出现率最高的流星雨，母天体是一颗小行星。',
    headline: '一年之中最可靠的一场',
    intro:
      '双子座流星雨在 12 月 14 日前后极大，理想条件下每小时超过 100 颗，是一年里出现率最高、也最稳定的一场。它的辐射点傍晚就已升起，整夜可以观测；流星速度约 35 公里每秒，偏慢，明亮的成员常带黄白色。',
    sections: [
      {
        heading: '来自小行星的流星雨',
        text: '多数流星雨源自彗星，双子座却来自小行星 3200 法厄同。它的近日点只有 0.14 AU，掠日时表面受热开裂并抛出尘埃，行为介于小行星与彗星之间。这条尘埃带至今仍在变浓，双子座流星雨在近一个世纪里越来越强。',
      },
      {
        heading: '适合初学者的一场',
        text: '辐射点傍晚升起，出现率高、速度偏慢，即使在城市边缘也能看到一些较亮的成员。唯一的代价是 12 月的寒冷：一把躺椅和足够的保暖装备，比任何设备都实用。',
      },
    ],
    facts: [
      { label: '活跃期', value: '12 月 4 日至 12 月 20 日' },
      { label: '通常极大', value: '12 月 14 日前后' },
      { label: '理想条件下的 ZHR', value: '约 150' },
      { label: '母天体', value: '小行星 3200 法厄同' },
    ],
    observing: [
      '傍晚辐射点就已升起，不必等到后半夜。',
      '流星偏慢、轨迹较长，适合固定机位的星野拍摄。',
      '躺下平视天顶附近，视野比追着辐射点更有效率。',
    ],
    bodies: [],
    sources: [nasaShower('geminids', 'Geminids'), imo],
  },
  {
    id: 'ursids',
    name: '小熊座流星雨',
    en: 'Ursids',
    category: 'meteor-shower',
    season: '每年 12 月下旬',
    summary: '紧随双子座之后的小流星雨，辐射点终夜不落。',
    headline: '冬至前后的一场安静流星雨',
    intro:
      '小熊座流星雨在 12 月 22 日前后极大，常年每小时约 10 颗，容易被刚刚结束的双子座流星雨盖过。它的辐射点在小熊座，对北半球中高纬度地区来说属于拱极星区，整夜都在地平线之上。',
    sections: [
      {
        heading: '偶发的增强',
        text: '1945 年和 1986 年曾出现每小时数十颗的增强，一般认为与母彗星 8P/塔特尔通过远日点后尘埃分布的变化有关。这场流星雨的观测记录相对稀少，业余观测仍然有价值。',
      },
      {
        heading: '拱极的辐射点',
        text: '因为辐射点靠近北天极，北半球观测者不必等它升起，也不用担心它落下；代价是南半球几乎看不到这场流星雨。',
      },
    ],
    facts: [
      { label: '活跃期', value: '12 月 17 日至 12 月 26 日' },
      { label: '通常极大', value: '12 月 22 日前后' },
      { label: '理想条件下的 ZHR', value: '约 10' },
      { label: '母天体', value: '8P/塔特尔彗星' },
    ],
    observing: [
      '辐射点终夜可见，任何时段都能开始观测。',
      '出现率低，建议连续观察一小时以上再做判断。',
      '南半球基本看不到，属于北半球专属的流星雨。',
    ],
    bodies: [],
    sources: [ams, imo],
  },
  {
    id: 'conjunction',
    name: '合相',
    en: 'Conjunction',
    category: 'planet-aspect',
    season: '全年不定期',
    summary: '两个天体在天球上靠近到几乎相接，实际距离却仍然遥远。',
    headline: '看起来相邻，其实相隔数亿公里',
    intro:
      '当两个天体的黄经相同，就称为“合”。它们处在接近同一条视线的方向上，看上去可能相距不到一个满月的宽度，但这只是投影效果：一次行星合月，月球在 38 万公里外，行星往往在几亿公里外。',
    sections: [
      {
        heading: '几种常见的合',
        text: '最常见的是行星合月：月球每个月都会从行星附近经过。行星之间的合少见得多，木星与土星的“大合”约 20 年一次，2020 年那一次两者相距仅约 0.1°，肉眼几乎连成一点。内行星还分上合与下合，分别位于太阳的背面与前方。',
      },
      {
        heading: '合相为什么值得看',
        text: '合相把亮度和颜色都不同的两个天体放进同一个视场，也是一堂直观的尺度课：同样明亮的两个光点，可能一个还在地月系统之内，另一个已经远在木星轨道之外。',
      },
    ],
    facts: [
      { label: '几何关系', value: '两个天体黄经相同' },
      { label: '常见类型', value: '行星合月、行星互合、内行星上合与下合' },
      { label: '木土大合周期', value: '约 20 年' },
      { label: '2020 年木土大合角距', value: '约 0.1°' },
    ],
    observing: [
      '合相前后几天都值得看，角距每天都在变化。',
      '靠近太阳的合相只能在曙暮光中观察，注意避开太阳。',
      '双筒或低倍望远镜常能把两者收进同一视场。',
    ],
    bodies: ['jupiter', 'saturn', 'moon-moon'],
    sources: [
      {
        name: 'NASA Science — Skywatching',
        url: 'https://science.nasa.gov/skywatching/',
      },
      {
        name: "NASA Science — What's Up",
        url: 'https://science.nasa.gov/skywatching/whats-up/',
      },
    ],
  },
  {
    id: 'opposition',
    name: '冲',
    en: 'Opposition',
    category: 'planet-aspect',
    season: '外行星每一到两年一次',
    summary: '行星与太阳分列地球两侧，整夜可见，也最为明亮。',
    headline: '一颗外行星一年中最好的夜晚',
    intro:
      '当一颗外行星与太阳的黄经相差 180°，地球正好位于两者之间，这就是“冲”。此时行星日落时升起、日出时落下，整夜可见，距离地球也接近最近，因而显得最亮，望远镜里的视面也最大。',
    sections: [
      {
        heading: '冲日间隔取决于会合周期',
        text: '木星每约 13 个月冲日一次，火星约 26 个月一次。差别来自两颗行星与地球的角速度之差：行星离太阳越远，地球追上它所需的时间就越接近一年。',
      },
      {
        heading: '不是每次冲都一样近',
        text: '火星轨道的偏心率较大，“大冲”时距离约 0.37 AU，普通的冲则超过 0.6 AU，视直径几乎差了一倍。土星冲日时环的倾角还会改变它的亮度，因此同一颗行星的每次冲日并不等价。',
      },
    ],
    facts: [
      { label: '几何关系', value: '太阳—地球—行星接近一条直线' },
      { label: '可见时段', value: '整夜' },
      { label: '木星冲日间隔', value: '约 13 个月' },
      { label: '火星冲日间隔', value: '约 26 个月' },
    ],
    observing: [
      '午夜前后行星升到最高，大气宁静度也最好。',
      '冲日前后数周的观测条件都接近最佳。',
      '水星和金星在地球轨道之内，不会出现冲。',
    ],
    bodies: ['mars', 'jupiter', 'saturn'],
    sources: [
      {
        name: 'NASA Science — Skywatching',
        url: 'https://science.nasa.gov/skywatching/',
      },
      {
        name: 'NASA Science — Mars Facts',
        url: 'https://science.nasa.gov/mars/facts/',
      },
    ],
  },
  {
    id: 'elongation',
    name: '大距',
    en: 'Greatest elongation',
    category: 'planet-aspect',
    season: '水星每年数次，金星约每 19 个月',
    summary: '内行星离太阳的视角距最大，也是最容易找到它们的时候。',
    headline: '水星和金星最容易被找到的日子',
    intro:
      '水星和金星的轨道在地球之内，从地球看，它们始终在太阳附近来回摆动。当这个角距达到最大时称为“大距”：东大距时行星位于日落后的西方低空，西大距时位于日出前的东方低空。',
    sections: [
      {
        heading: '为什么水星这么难看到',
        text: '水星的最大角距只有 18° 到 28°，意味着它总在曙暮光中出没，高度低，受大气消光的影响也大。金星的角距可达约 47°，能在暗夜里停留数小时，也因此成了人们熟悉的“启明星”和“长庚星”。',
      },
      {
        heading: '大距与相位',
        text: '内行星也有盈亏。大距前后，望远镜中的行星接近半圆形；越接近下合，它离地球越近、视面越大，被照亮的部分却越细，最终收成一弯细钩。',
      },
    ],
    facts: [
      { label: '水星最大角距', value: '约 18° 至 28°' },
      { label: '金星最大角距', value: '约 45° 至 47°' },
      { label: '东大距', value: '日落后的西方低空' },
      { label: '西大距', value: '日出前的东方低空' },
    ],
    observing: [
      '在日落后或日出前约 40 分钟寻找，地平线要开阔。',
      '金星亮度可达 −4 等，白天用望远镜也能找到。',
      '太阳仍在地平线上时，绝不要用光学设备搜寻。',
    ],
    bodies: ['mercury', 'venus'],
    sources: [
      {
        name: 'NASA Science — Mercury Facts',
        url: 'https://science.nasa.gov/mercury/facts/',
      },
      {
        name: 'NASA Science — Venus Facts',
        url: 'https://science.nasa.gov/venus/venus-facts/',
      },
    ],
  },
  {
    id: 'transit',
    name: '凌日',
    en: 'Transit',
    category: 'planet-aspect',
    season: '水星凌日每世纪约 13 次',
    summary: '内行星从日面前方经过，罕见，而且必须用滤光设备观测。',
    headline: '太阳表面上一个缓慢移动的黑点',
    intro:
      '当水星或金星恰好从地球与太阳之间穿过，并且足够靠近黄道面时，我们会看到一个黑色小圆面在日面上移动，这就是凌日。轨道倾角让这种排列相当罕见：水星凌日每世纪约 13 到 14 次，金星凌日则以 8 年一对、间隔一个多世纪的节奏出现。',
    sections: [
      {
        heading: '历史上的一把量天尺',
        text: '18 世纪的天文学家远赴各地观测金星凌日，用不同地点记录的接触时刻之差计算日地距离。那是人类第一次较高精度地测定天文单位，也是国际科学合作的早期范例。',
      },
      {
        heading: '今天的凌星观测',
        text: '同样的几何关系被用在系外行星搜寻上：当行星从遥远恒星前方经过，恒星亮度会下降千分之几。开普勒和 TESS 望远镜正是依靠这种周期性的微小变暗，发现了数千颗系外行星。',
      },
    ],
    facts: [
      { label: '必要条件', value: '行星处于下合，且靠近黄道面' },
      { label: '下一次水星凌日', value: '2032 年 11 月 13 日' },
      { label: '上一次金星凌日', value: '2012 年 6 月 5 日至 6 日' },
      { label: '下一次金星凌日', value: '2117 年 12 月' },
    ],
    observing: [
      '必须使用合格的太阳滤光片，绝不可直视或用无防护的望远镜观看。',
      '投影法既安全，又适合多人一起观看。',
      '水星的视面很小，需要望远镜，单靠日食眼镜看不到。',
    ],
    bodies: ['mercury', 'venus', 'sun'],
    sources: [
      {
        name: 'NASA — Transits of Mercury and Venus',
        url: 'https://eclipse.gsfc.nasa.gov/transit/transit.html',
      },
      {
        name: 'NASA Science — Eclipse Eye Safety',
        url: 'https://science.nasa.gov/eclipses/safety/',
      },
    ],
  },
  {
    id: 'occultation',
    name: '掩星',
    en: 'Occultation',
    category: 'planet-aspect',
    season: '月掩星每月都有',
    summary: '较近的天体从更远的天体前方经过，把它短暂遮住。',
    headline: '一次精确到秒的遮挡',
    intro:
      '当一个较近的天体从更远天体的前方经过并将其遮住，就是掩星。最常见的是月掩星：月球沿轨道每天东移约 13°，不断把背景恒星“关掉”又“打开”。小行星掩恒星虽然罕见得多，却是测量小行星形状最有效的手段之一。',
    sections: [
      {
        heading: '没有大气的边缘',
        text: '月球没有大气，被掩恒星会在瞬间消失，几乎没有渐暗的过程。这种干脆的掩始终是检验恒星是否为双星的好办法：如果亮度分两步下降，说明它其实是靠得很近的两颗恒星。',
      },
      {
        heading: '用掩星测量天体',
        text: '多名观测者在不同地点记录同一次小行星掩星的持续时间，把这些弦拼起来，就能勾勒出小行星的轮廓。1977 年，天文学家正是在一次天王星掩星中意外发现了天王星环。',
      },
    ],
    facts: [
      { label: '最常见类型', value: '月掩恒星与月掩行星' },
      { label: '恒星消失过程', value: '几乎在瞬间完成' },
      { label: '可见带', value: '通常只有数十到数百公里宽' },
      { label: '代表性成果', value: '1977 年发现天王星环' },
    ],
    observing: [
      '掩星只在一条窄带内可见，出发前先确认所在位置。',
      '记录时刻需要精确到秒，手机的网络授时已足够业余使用。',
      '月掩行星时，行星圆面会在一两秒内逐渐被遮住，与恒星不同。',
    ],
    bodies: ['moon-moon', 'uranus'],
    sources: [
      {
        name: 'International Occultation Timing Association',
        url: 'https://occultations.org/',
      },
      {
        name: 'NASA Science — Uranus Facts',
        url: 'https://science.nasa.gov/uranus/facts/',
      },
    ],
  },
  {
    id: 'moon-phases',
    name: '月相',
    en: 'Lunar phases',
    category: 'moon-phase',
    season: '周期约 29.5 天',
    summary: '月球被照亮的半球朝向地球的角度在变，于是有了一个月的盈亏。',
    headline: '一个月里的八种面貌',
    intro:
      '月球本身不发光，太阳永远只照亮它的一半。随着月球绕地球运行，我们看到这个被照亮半球的比例不断变化：从朔到望再回到朔，平均需要 29.53 天，称为一个朔望月。',
    sections: [
      {
        heading: '朔望月为什么比公转周期长',
        text: '月球相对恒星绕地球一圈只需 27.32 天，但这段时间里地球也沿轨道前进了约 27°，月球必须再多走两天多，才能重新回到太阳、地球、月球的同一相对位置。前者叫恒星月，后者才是我们熟悉的月相周期。',
      },
      {
        heading: '上弦与下弦怎么分',
        text: '上弦月出现在朔之后约七天，傍晚位于南方天空，亮面朝西；下弦月出现在望之后约七天，后半夜升起，亮面朝东。记住“上弦上半夜、亮面朝西”，就不容易把两者弄反。',
      },
    ],
    facts: [
      { label: '朔望月', value: '29.53 天' },
      { label: '恒星月', value: '27.32 天' },
      {
        label: '八个相位',
        value: '朔、蛾眉、上弦、盈凸、望、亏凸、下弦、残月',
      },
      { label: '与地球阴影的关系', value: '没有关系' },
    ],
    observing: [
      '上下弦前后的明暗界线附近，环形山的阴影最长、最立体。',
      '满月时正面照明，反差最低，反而不利于看细节。',
      '朔之后两三天的蛾眉月常伴随地照，能看到月球的暗部。',
    ],
    bodies: ['moon-moon', 'earth'],
    sources: [
      {
        name: 'NASA Science — Moon Phases',
        url: 'https://science.nasa.gov/moon/moon-phases/',
      },
      {
        name: 'NASA Science — Moon Facts',
        url: 'https://science.nasa.gov/moon/facts/',
      },
    ],
  },
  {
    id: 'supermoon',
    name: '超级月亮',
    en: 'Supermoon',
    category: 'moon-phase',
    season: '一年约三到四次',
    summary: '满月恰好发生在月球接近近地点时，看起来更大、更亮。',
    headline: '近地点满月的另一个名字',
    intro:
      '月球轨道是一个椭圆，近地点约 36.3 万公里，远地点约 40.7 万公里。当满月恰好发生在近地点附近，它的视直径比远地点的满月大约 14%，亮度高约 30%，这就是媒体所说的“超级月亮”——一个流行说法，而不是天文学术语。',
    sections: [
      {
        heading: '肉眼能看出差别吗',
        text: '单独看一轮满月，很难判断它是不是“超级”的：天上没有参照物，14% 的直径差要并排比较才明显。真正让月亮显得巨大的，是它靠近地平线时的月亮错觉，那与距离无关。',
      },
      {
        heading: '潮汐会更大吗',
        text: '近地点满月时，日月的引潮力叠加，潮差确实会略大于平均值，称为近地点大潮。但增幅通常只有几厘米到几十厘米，除非叠加风暴潮，一般不会带来额外影响。',
      },
    ],
    facts: [
      { label: '近地点距离', value: '约 356,500 km' },
      { label: '远地点距离', value: '约 406,700 km' },
      { label: '视直径差', value: '约 14%' },
      { label: '亮度差', value: '约 30%' },
    ],
    observing: [
      '与建筑或山脊同框拍摄，才能体现出尺寸的差别。',
      '月出后不久拍摄，可以同时利用月亮错觉和地景。',
      '同一套设备在近地点与远地点各拍一张，对比最直观。',
    ],
    bodies: ['moon-moon'],
    sources: [
      {
        name: 'NASA Science — Supermoons',
        url: 'https://science.nasa.gov/moon/supermoons/',
      },
      {
        name: 'NASA Science — Moon Phases',
        url: 'https://science.nasa.gov/moon/moon-phases/',
      },
    ],
  },
  {
    id: 'blue-moon',
    name: '蓝月',
    en: 'Blue moon',
    category: 'moon-phase',
    season: '平均每 2 到 3 年一次',
    summary: '与颜色无关的历法巧合：一段时间里多出来的那次满月。',
    headline: '一个与颜色无关的名字',
    intro:
      '“蓝月”通常指一个公历月份里的第二次满月。因为朔望月比大多数月份短一两天，这种巧合平均每 2.7 年出现一次。更早的定义则来自农事历：当一个季节里出现四次满月，其中的第三次被称为蓝月。',
    sections: [
      {
        heading: '两个定义的来历',
        text: '季节定义出现得更早；月份定义源自 1946 年一篇杂志文章对旧历的误读，却因广为流传而固定了下来。两者都只是历法上的巧合，与月球本身的状态无关。',
      },
      {
        heading: '真正发蓝的月亮',
        text: '月亮偶尔确实会呈现蓝色：当大气中悬浮着尺度接近 1 微米的颗粒时——例如 1883 年喀拉喀托火山喷发或大规模森林火灾之后——红光被优先散射，月亮就会显出淡蓝色。这与“蓝月”这个名字毫无关系。',
      },
    ],
    facts: [
      { label: '常用定义', value: '一个公历月里的第二次满月' },
      { label: '较早的定义', value: '一季四次满月中的第三次' },
      { label: '出现频率', value: '平均每 2.7 年一次' },
      { label: '与颜色的关系', value: '没有关系' },
    ],
    observing: [
      '蓝月与寻常满月在天空中没有任何区别。',
      '二月永远不会出现月份定义下的蓝月。',
      '想拍到真正发蓝的月亮，靠的是火山灰或烟尘，而不是历法。',
    ],
    bodies: ['moon-moon'],
    sources: [
      {
        name: 'NASA Science — Moon Phases',
        url: 'https://science.nasa.gov/moon/moon-phases/',
      },
      {
        name: 'NASA Science — Skywatching',
        url: 'https://science.nasa.gov/skywatching/',
      },
    ],
  },
  {
    id: 'solar-eclipse',
    name: '日食',
    en: 'Solar eclipse',
    category: 'eclipse',
    season: '每年 2 至 5 次',
    summary: '月球挡住太阳，只有本影扫过的窄带上才能看到全食。',
    headline: '一条几百公里宽的影子路径',
    intro:
      '日食发生在朔，并且月球恰好位于黄道交点附近的时候。月球的本影在地表扫出一条通常不到 300 公里宽的窄带，只有带内才能看到全食；带外的大片区域看到的是偏食。月球距离稍远时本影够不到地面，就成为环食。',
    sections: [
      {
        heading: '全食、环食与全环食',
        text: '月球的视直径随距离在约 29.4′ 到 33.5′ 之间变化，太阳则在约 31.6′ 到 32.7′ 之间。前者更大时是全食，更小时留下一圈光环，即环食；少数日食在食带中段是全食、两端是环食，称为全环食。',
      },
      {
        heading: '沙罗周期',
        text: '相似的日食每隔 6,585.3 天（约 18 年 11 天 8 小时）重复一次，称为沙罗周期。多出来的三分之一天让食带每次向西移动约 120° 经度，因此同一个地点要等很久才能再次遇上全食。',
      },
    ],
    facts: [
      { label: '发生条件', value: '朔，且月球靠近黄道交点' },
      { label: '全食带宽度', value: '通常不超过 300 km' },
      { label: '全食持续时间', value: '通常不超过 7.5 分钟' },
      { label: '沙罗周期', value: '约 18 年 11 天 8 小时' },
    ],
    observing: [
      '除全食阶段以外，任何时候都必须使用合格的太阳滤光片。',
      '普通墨镜、曝光过的胶片和滤光不足的装置都不安全。',
      '观测台的“天象推演”可以列出未来的日食，并跳到食甚时刻。',
    ],
    bodies: ['sun', 'moon-moon', 'earth'],
    sources: [
      {
        name: 'NASA Science — Eclipses',
        url: 'https://science.nasa.gov/eclipses/',
      },
      {
        name: 'NASA — Eclipse Web Site',
        url: 'https://eclipse.gsfc.nasa.gov/eclipse.html',
      },
    ],
  },
  {
    id: 'lunar-eclipse',
    name: '月食',
    en: 'Lunar eclipse',
    category: 'eclipse',
    season: '每年 0 至 3 次',
    summary: '月球进入地球的影子，整个夜半球都能同时看到。',
    headline: '半个地球同时可见的一场食',
    intro:
      '月食发生在望，并且月球靠近黄道交点的时候。与日食不同，地球的影子足够大，月球需要一个多小时才能完全进入本影；而夜半球上的所有人都在同时看同一个过程，不必赶到某条窄带上去。',
    sections: [
      {
        heading: '红月亮的由来',
        text: '全食期间月球并不会完全消失：太阳光穿过地球大气边缘时被折射进本影，蓝光在途中被散射掉，剩下的红光把月球染成暗红色。这实际上是把地球上所有的日出和日落，同时投影到了月面上。',
      },
      {
        heading: '半影、偏食与全食',
        text: '月球先进入半影，亮度只是略微变暗，肉眼常常察觉不到；随后进入本影，形成偏食；完全进入本影之后就是全食。半影月食没有本影阶段，因此也谈不上食分。',
      },
    ],
    facts: [
      { label: '发生条件', value: '望，且月球靠近黄道交点' },
      { label: '可见范围', value: '整个夜半球' },
      { label: '全食阶段', value: '最长约 100 分钟' },
      { label: '观测安全', value: '可以直接用肉眼观看' },
    ],
    observing: [
      '不需要任何滤光设备，双筒望远镜就能看清红色的层次。',
      '全食期间天空变暗，可以顺便观察月球附近的暗星。',
      '观测台的“天象推演”会给出每次月食的各个接触时刻。',
    ],
    bodies: ['moon-moon', 'earth', 'sun'],
    sources: [
      {
        name: 'NASA Science — Eclipses',
        url: 'https://science.nasa.gov/eclipses/',
      },
      {
        name: 'NASA — Eclipse Web Site',
        url: 'https://eclipse.gsfc.nasa.gov/eclipse.html',
      },
    ],
  },
  {
    id: 'equinox-solstice',
    name: '二分二至',
    en: 'Equinoxes and solstices',
    category: 'sun-earth',
    season: '每年四次',
    summary: '地轴倾斜造成的四个节点，决定昼夜长短与四季。',
    headline: '四季来自倾斜，而不是距离',
    intro:
      '地球的自转轴相对轨道面倾斜约 23.4°，而且在公转过程中指向基本不变。于是太阳直射点在南北回归线之间往返：两次经过赤道时是春分和秋分，到达最北和最南时是夏至和冬至。',
    sections: [
      {
        heading: '分点那天昼夜真的等长吗',
        text: '接近等长，但并不精确。大气折射让太阳在几何上还位于地平线之下时就已可见，而日出日落又以日面上缘为准，因此白昼比黑夜长了几分钟。真正昼夜等长的那天叫均时日，通常落在分点前后几天。',
      },
      {
        heading: '至点与最早的日落',
        text: '冬至是白昼最短的一天，却不是日落最早的一天。真太阳时与平太阳时之间的差（时差）让最早的日落出现在冬至之前，最晚的日出出现在冬至之后。这也是日晷与钟表对不上的原因之一。',
      },
    ],
    facts: [
      { label: '地轴倾角', value: '约 23.4°' },
      { label: '春分与秋分', value: '太阳直射赤道' },
      { label: '夏至与冬至', value: '太阳直射南北回归线' },
      { label: '昼夜精确等长', value: '均时日，并非分点当天' },
    ],
    observing: [
      '分点前后，太阳几乎正东升起、正西落下，适合校准方位。',
      '每天在同一时刻记录太阳的位置，一年就能画出日行迹。',
      '至点前后太阳高度变化最慢，“至”本就是停滞的意思。',
    ],
    bodies: ['earth', 'sun'],
    sources: [
      {
        name: 'NASA Space Place — Why Does Earth Have Seasons?',
        url: 'https://spaceplace.nasa.gov/seasons/en/',
      },
      {
        name: 'NOAA National Weather Service — Seasons',
        url: 'https://www.weather.gov/cle/Seasons',
      },
    ],
  },
  {
    id: 'perihelion-aphelion',
    name: '近日点与远日点',
    en: 'Perihelion and aphelion',
    category: 'sun-earth',
    season: '每年各一次',
    summary: '地球轨道并非正圆，日地距离一年里相差约 500 万公里。',
    headline: '离太阳最近的时候，北半球正是冬天',
    intro:
      '地球在每年 1 月初经过近日点，约 1.471 亿公里；7 月初到达远日点，约 1.521 亿公里。两者相差约 3.3%，太阳的视直径和地球接收到的辐照度随之变化，但这与四季的成因无关。',
    sections: [
      {
        heading: '距离变化有多大影响',
        text: '辐照度与距离的平方成反比，近日点比远日点高约 6.8%。相比之下，地轴倾斜造成的季节性差异要大得多：北半球夏至与冬至的正午太阳高度可以相差 47°。这正是四季由倾角而非距离决定的直接证据。',
      },
      {
        heading: '北半球的冬半年更短',
        text: '根据开普勒第二定律，地球在近日点附近走得更快。以北半球计，秋分到春分只有约 179 天，而春分到秋分有约 186 天。也就是说，北半球的冬半年比夏半年短了一周左右。',
      },
    ],
    facts: [
      { label: '近日点日期', value: '1 月初' },
      { label: '近日点距离', value: '约 1.471 亿 km' },
      { label: '远日点日期', value: '7 月初' },
      { label: '远日点距离', value: '约 1.521 亿 km' },
    ],
    observing: [
      '用同一套设备在 1 月和 7 月各拍一张日面，可以比较视直径。',
      '观测太阳必须使用专用滤光片，没有例外。',
      '日地距离的这点变化，不会带来可以察觉的气温差别。',
    ],
    bodies: ['earth', 'sun'],
    sources: [
      {
        name: 'NASA Science — Earth Facts',
        url: 'https://science.nasa.gov/earth/facts/',
      },
      {
        name: 'NOAA National Weather Service — Seasons',
        url: 'https://www.weather.gov/cle/Seasons',
      },
    ],
  },
];

export function eventTopic(id: string): EventTopic | undefined {
  return eventTopics.find((topic) => topic.id === id);
}

export function eventCategory(id: EventCategoryId): EventCategory {
  return eventCategories.find((category) => category.id === id)!;
}

/** Index order follows the categories, so a reader scans families, not ids. */
export function topicsByCategory(id: EventCategoryId): EventTopic[] {
  return eventTopics.filter((topic) => topic.category === id);
}
