export type Moon = {
  name: string;
  en: string;
  highlight: string;
  description: string;
  source: string;
};
export type MoonSystem = { summary: string; moons: Moon[] };

// Representative moons, not a census: new small satellites are still being discovered.
export const moonSystems: Record<string, MoonSystem> = {
  mercury: {
    summary:
      '水星没有已知的天然卫星。天然卫星是绕行星等天体运行的自然天体，与人造卫星不同。',
    moons: [],
  },
  venus: {
    summary: '金星没有已知的天然卫星。并不是每颗行星都有自己的月亮。',
    moons: [],
  },
  earth: {
    summary:
      '地球只有一颗天然卫星。月球的引力参与塑造潮汐，也帮助稳定地轴的倾斜。',
    moons: [
      {
        name: '月球',
        en: 'Moon',
        highlight: '我们的近邻',
        description:
          '约每 27.3 天绕地球一周。自转与公转同步，因此我们总是看到大致相同的一面；月相变化来自日照角度的变化。',
        source: 'moon/facts',
      },
    ],
  },
  mars: {
    summary: '火星的两颗小卫星都形状不规则，表面遍布撞击坑。',
    moons: [
      {
        name: '火卫一',
        en: 'Phobos',
        highlight: '比火星自转更快',
        description:
          '靠近火星运行，不到 8 小时就绕行一周。它正缓慢向火星靠近，遥远的未来可能碎裂成环或撞上火星。',
        source: 'mars/moons/phobos',
      },
      {
        name: '火卫二',
        en: 'Deimos',
        highlight: '更远、更小',
        description:
          '在火卫一外侧运行，约 30 小时绕行一周。覆盖表面的松散物质让它看起来比火卫一更平滑。',
        source: 'mars/moons/deimos',
      },
    ],
  },
  jupiter: {
    summary: '四颗伽利略卫星如同一个小型世界家族。木星还有许多更小的卫星。',
    moons: [
      {
        name: '木卫一',
        en: 'Io',
        highlight: '火山世界',
        description:
          '太阳系火山活动最剧烈的天体。木星与其他卫星的引力拉扯产生潮汐加热，让内部持续释放热量。',
        source: 'jupiter/moons/io',
      },
      {
        name: '木卫二',
        en: 'Europa',
        highlight: '冰下海洋',
        description:
          '冰壳下很可能藏着全球性液态海洋。它是探索宜居环境的重要目标，但目前并没有发现生命。',
        source: 'jupiter/moons/europa',
      },
      {
        name: '木卫三',
        en: 'Ganymede',
        highlight: '太阳系最大卫星',
        description:
          '直径比水星还大，但质量更小。它拥有自身产生的磁场，是卫星中的独特世界。',
        source: 'jupiter/moons/ganymede',
      },
      {
        name: '木卫四',
        en: 'Callisto',
        highlight: '古老的撞击记录',
        description:
          '四颗伽利略卫星中离木星最远的一颗。密集的撞击坑保存了漫长历史，内部也可能存在海洋。',
        source: 'jupiter/moons/callisto',
      },
    ],
  },
  saturn: {
    summary:
      '从拥有浓厚大气的土卫六，到喷出冰粒的土卫二，土星的卫星世界远不止壮观的光环。',
    moons: [
      {
        name: '土卫六',
        en: 'Titan',
        highlight: '甲烷湖泊与浓厚大气',
        description:
          '太阳系第二大卫星，拥有以氮为主的浓厚大气。表面的液态甲烷和乙烷形成河流、湖泊与海洋。',
        source: 'saturn/moons/titan',
      },
      {
        name: '土卫二',
        en: 'Enceladus',
        highlight: '向太空喷出的海洋线索',
        description:
          '冰壳下存在全球性海洋。南极裂缝喷出的水汽和冰粒，为研究内部环境提供了窗口，也补充着土星 E 环。',
        source: 'saturn/moons/enceladus',
      },
      {
        name: '土卫一',
        en: 'Mimas',
        highlight: '巨大的赫歇尔撞击坑',
        description:
          '体积很小，却有一个占据显著表面积的巨大撞击坑。一次古老撞击给它留下了醒目的外貌。',
        source: 'saturn/moons/mimas',
      },
      {
        name: '土卫八',
        en: 'Iapetus',
        highlight: '一半明亮，一半暗淡',
        description:
          '两个半球亮度相差很大，赤道附近还隆起一条奇特山脊。它展示了冰、尘埃与日照共同改变表面的过程。',
        source: 'saturn/moons/iapetus',
      },
    ],
  },
  uranus: {
    summary:
      '五颗主要卫星由内向外是天卫五、天卫一、天卫二、天卫三和天卫四。名字来自莎士比亚和蒲柏的文学作品。',
    moons: [
      {
        name: '天卫五',
        en: 'Miranda',
        highlight: '拼接般的地形',
        description:
          '五颗主要卫星中最小、最靠内的一颗。断崖、沟槽与不同年龄的地形交错，记录了复杂的地质变化。',
        source: 'uranus/moons/miranda',
      },
      {
        name: '天卫一',
        en: 'Ariel',
        highlight: '明亮的峡谷世界',
        description:
          '表面有交错的峡谷与沟槽，相对较少的巨大撞击坑提示部分地表曾被重新塑造。',
        source: 'uranus/moons/ariel',
      },
      {
        name: '天卫二',
        en: 'Umbriel',
        highlight: '暗色的古老表面',
        description:
          '五颗主要卫星中表面最暗的一颗，遍布撞击坑；赤道附近有一个醒目的明亮环状地貌。',
        source: 'uranus/moons/umbriel',
      },
      {
        name: '天卫三',
        en: 'Titania',
        highlight: '天王星最大的卫星',
        description:
          '冰与岩石构成的世界，表面巨大的断层和峡谷提示内部演化曾让外壳发生伸展。',
        source: 'uranus/moons/titania',
      },
      {
        name: '天卫四',
        en: 'Oberon',
        highlight: '主要卫星中最外侧',
        description:
          '天王星第二大卫星，古老表面密布撞击坑。一些撞击坑底部覆盖着暗色物质。',
        source: 'uranus/moons/oberon',
      },
    ],
  },
  neptune: {
    summary:
      '海王星的卫星系统以逆行的海卫一最为特别，其他卫星中既有近距离的小天体，也有遥远的不规则卫星。',
    moons: [
      {
        name: '海卫一',
        en: 'Triton',
        highlight: '逆向公转的大卫星',
        description:
          '绕行方向与海王星自转方向相反，可能是被捕获的柯伊伯带天体。旅行者 2 号在其冰冷表面发现了喷流。',
        source: 'neptune/moons/triton',
      },
      {
        name: '海卫二',
        en: 'Nereid',
        highlight: '高度拉长的轨道',
        description:
          '在偏心率很高的轨道上绕行，离海王星的距离在一圈中变化显著，与近圆轨道的规则卫星很不一样。',
        source: 'neptune/moons/nereid',
      },
    ],
  },
  pluto: {
    summary: '冥王星有五颗已知卫星，这里介绍其中最大的冥卫一。',
    moons: [
      {
        name: '冥卫一',
        en: 'Charon',
        highlight: '彼此始终以同一面相对',
        description:
          '直径约为冥王星的一半。两者相互潮汐锁定，共同绕位于冥王星之外的质心运行。',
        source: 'dwarf-planets/pluto/moons/charon',
      },
    ],
  },
};
