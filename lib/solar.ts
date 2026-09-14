import type { Translate } from './i18n';
export type Body = {
  id: string;
  name: string;
  en: string;
  type: string;
  color: string;
  texture?: string;
  surfaceTexture?: string;
  radius: number;
  au: number;
  period: number;
  day: number;
  tilt: number;
  e: number;
  inc: number;
  phase: number;
  size: number;
  distance: number;
  description: string;
  fact: string;
  moons: string;
  source: string;
};
export const bodies: Body[] = [
  {
    id: 'sun',
    name: '太阳',
    en: 'SUN',
    type: 'G 型主序星',
    color: '#ffd18a',
    texture: 'sun',
    radius: 696340,
    au: 0,
    period: 0,
    day: 25.4,
    tilt: 7.25,
    e: 0,
    inc: 0,
    phase: 0,
    size: 4.8,
    distance: 0,
    description:
      '太阳是一颗 G 型主序星，拥有太阳系约 99.86% 的质量。核心的核聚变释放光和热，强大的引力让行星沿轨道运行。',
    fact: '从太阳出发的光，约需 8 分 20 秒才能抵达地球。',
    moons: '—',
    source: 'sun',
  },
  {
    id: 'mercury',
    name: '水星',
    en: 'MERCURY',
    type: '类地行星',
    color: '#b6aaa0',
    texture: 'mercury',
    surfaceTexture: 'surface_mercury_normal',
    radius: 2439.7,
    au: 0.387,
    period: 87.969,
    day: 58.646,
    tilt: 0.034,
    e: 0.2056,
    inc: 7,
    phase: 2.4,
    size: 0.55,
    distance: 12,
    description:
      '距离太阳最近、体积最小的行星。岩石表面布满撞击坑，稀薄的外逸层几乎无法保存热量，昼夜温差极大。',
    fact: '水星自转 3 圈的时间，恰好接近绕太阳公转 2 圈。',
    moons: '0',
    source: 'mercury',
  },
  {
    id: 'venus',
    name: '金星',
    en: 'VENUS',
    type: '类地行星',
    color: '#dfbc7c',
    texture: 'venus_atmosphere',
    surfaceTexture: 'surface_venus_normal',
    radius: 6051.8,
    au: 0.723,
    period: 224.701,
    day: -243.025,
    tilt: 2.64,
    e: 0.0068,
    inc: 3.39,
    phase: 4.9,
    size: 0.95,
    distance: 17,
    description:
      '与地球大小相近，却被浓厚的二氧化碳大气包裹。强烈的温室效应让它成为太阳系表面最热的行星。',
    fact: '金星缓慢地逆向自转，一次自转比它的一年还长。',
    moons: '0',
    source: 'venus',
  },
  {
    id: 'earth',
    name: '地球',
    en: 'EARTH',
    type: '类地行星',
    color: '#6eafff',
    texture: 'earth_daymap',
    surfaceTexture: 'surface_earth_normal',
    radius: 6371,
    au: 1,
    period: 365.256,
    day: 0.99727,
    tilt: 23.44,
    e: 0.0167,
    inc: 0,
    phase: 0.8,
    size: 1,
    distance: 23,
    description:
      '我们的蓝色家园，也是目前唯一已知存在生命的星球。液态海洋、保护性大气和磁场，共同造就了适宜生命的环境。',
    fact: '地轴倾斜约 23.4°，让地球在公转过程中经历四季。',
    moons: '1 · 月球',
    source: 'earth',
  },
  {
    id: 'mars',
    name: '火星',
    en: 'MARS',
    type: '类地行星',
    color: '#d78b68',
    texture: 'mars',
    surfaceTexture: 'surface_mars_normal',
    radius: 3389.5,
    au: 1.524,
    period: 686.98,
    day: 1.02596,
    tilt: 25.19,
    e: 0.0934,
    inc: 1.85,
    phase: 3.8,
    size: 0.73,
    distance: 30,
    description:
      '铁氧化物让地表呈现红色。这里拥有巨大的火山、峡谷和极地冰盖，古老河道记录了它曾经更湿润的过去。',
    fact: '火星上的奥林帕斯山是太阳系最大的火山之一。',
    moons: '2 · 火卫一、火卫二',
    source: 'mars',
  },
  {
    id: 'jupiter',
    name: '木星',
    en: 'JUPITER',
    type: '气态巨行星',
    color: '#cead8d',
    texture: 'jupiter',
    radius: 69911,
    au: 5.203,
    period: 4332.59,
    day: 0.41354,
    tilt: 3.13,
    e: 0.048386,
    inc: 1.3,
    phase: 5.6,
    size: 2.8,
    distance: 46,
    description:
      '太阳系最大的行星，以氢和氦为主。云带之间的巨大风暴持续翻涌，强大的磁场笼罩着丰富的卫星系统。',
    fact: '伽利略卫星包括木卫一、木卫二、木卫三和木卫四。',
    moons: '含 4 颗伽利略卫星',
    source: 'jupiter',
  },
  {
    id: 'saturn',
    name: '土星',
    en: 'SATURN',
    type: '气态巨行星',
    color: '#e7cf98',
    texture: 'saturn',
    radius: 58232,
    au: 9.537,
    period: 10759.22,
    day: 0.44401,
    tilt: 26.73,
    e: 0.053862,
    inc: 2.49,
    phase: 2.5,
    size: 2.35,
    distance: 62,
    description:
      '明亮的环由无数冰与岩石颗粒组成。土星是一颗低密度的气态巨行星，拥有包括土卫六在内的庞大卫星家族。',
    fact: '土卫六拥有浓厚大气，表面存在液态甲烷和乙烷的湖泊。',
    moons: '包括土卫六、土卫二',
    source: 'saturn',
  },
  {
    id: 'uranus',
    name: '天王星',
    en: 'URANUS',
    type: '冰巨行星',
    color: '#a0dcd9',
    texture: 'uranus',
    radius: 25362,
    au: 19.191,
    period: 30688.5,
    day: 0.71833,
    tilt: 97.77,
    e: 0.047257,
    inc: 0.77,
    phase: 4.0,
    size: 1.65,
    distance: 77,
    description:
      '大气中的甲烷吸收红光，赋予它蓝绿色外观。极端倾斜的自转轴让它像“躺着”一样绕太阳运行。',
    fact: '天王星的轴倾角约 98°，极地会经历漫长的白昼与黑夜。',
    moons: '包括天卫三、天卫四',
    source: 'uranus',
  },
  {
    id: 'neptune',
    name: '海王星',
    en: 'NEPTUNE',
    type: '冰巨行星',
    color: '#6b91e9',
    texture: 'neptune',
    radius: 24622,
    au: 30.069,
    period: 60182,
    day: 0.67125,
    tilt: 28.32,
    e: 0.00859,
    inc: 1.77,
    phase: 0.6,
    size: 1.6,
    distance: 92,
    description:
      '八大行星中距离太阳最远的一颗。它的寒冷大气仍充满强劲风暴；深蓝色常见影像经过增强，真实颜色较浅。',
    fact: '自 1846 年被发现以来，海王星到 2011 年才完成第一次公转。',
    moons: '包括海卫一',
    source: 'neptune',
  },
  {
    id: 'pluto',
    name: '冥王星',
    en: 'PLUTO',
    type: '矮行星',
    color: '#c5b6a8',
    texture: 'pluto',
    radius: 1188.3,
    au: 39.482,
    period: 90560,
    day: -6.387,
    tilt: 60.4,
    e: 0.2488,
    inc: 17.16,
    phase: 5.1,
    size: 0.48,
    distance: 108,
    description:
      '柯伊伯带中的冰质世界，拥有明显倾斜的椭圆轨道。2006 年被归入矮行星，其最大卫星为卡戎。',
    fact: '太阳系公认的五颗矮行星：谷神星、冥王星、妊神星、鸟神星和阋神星。',
    moons: '5 · 包括卡戎',
    source: 'dwarf-planets/pluto',
  },
];
export const regions = [
  {
    id: 'inner',
    name: '内太阳系',
    en: 'INNER SYSTEM',
    range: '0.39–1.52 AU',
    view: 65,
    text: '水星、金星、地球、火星。四颗拥有固体表面的类地行星聚集在太阳附近。',
  },
  {
    id: 'asteroids',
    name: '小行星带',
    en: 'ASTEROID BELT',
    range: '约 2.1–3.3 AU',
    view: 90,
    text: '火星与木星之间的岩石天体带，也是矮行星谷神星的家园。实际天体之间相隔很远，并非密集的石墙。',
  },
  {
    id: 'outer',
    name: '外太阳系',
    en: 'OUTER SYSTEM',
    range: '5.2–30.1 AU',
    view: 205,
    text: '木星、土星是气态巨行星；天王星、海王星是冰巨行星。它们都拥有环和卫星系统。',
  },
  {
    id: 'kuiper',
    name: '柯伊伯带',
    en: 'KUIPER BELT',
    range: '主体约 30–50 AU',
    view: 275,
    text: '海王星之外的冰质天体盘，保留着太阳系形成早期的遗迹。冥王星、妊神星和鸟神星都在这一带。',
  },
  {
    id: 'scattered',
    name: '离散盘',
    en: 'SCATTERED DISK',
    range: '延伸至数百 AU',
    view: 350,
    text: '受海王星引力散射的冰质天体分布在更偏心、倾斜的轨道上。阋神星属于这一遥远族群。',
  },
  {
    id: 'heliosphere',
    name: '日球层',
    en: 'HELIOSPHERE',
    range: '日球顶约 120 AU · 因方向而异',
    view: 400,
    text: '太阳风在星际介质中吹出的巨大空间。日球顶标志太阳风主导区的边界，并不是太阳引力的终点。',
  },
  {
    id: 'oort',
    name: '奥尔特云',
    en: 'OORT CLOUD',
    range: '约 2,000–100,000 AU',
    view: 510,
    text: '推测包围太阳系的近球状冰天体云，可能是长周期彗星的来源。尚未被直接观测；边界与规模仍有不确定性。',
  },
];
export type ScaleMode = 'illustrated' | 'distance';
export type OrbitalElements = Pick<
  Body,
  'au' | 'e' | 'inc' | 'period' | 'phase' | 'distance'
>;
export function eccentricPosition(
  body: OrbitalElements,
  eccentric: number,
  mode: ScaleMode = 'illustrated',
): [number, number, number] {
  const a = mode === 'distance' ? body.au * 3.1 : body.distance;
  const x = a * (Math.cos(eccentric) - body.e),
    z = a * Math.sqrt(1 - body.e ** 2) * Math.sin(eccentric),
    inc = (body.inc * Math.PI) / 180;
  return [x, z * Math.sin(inc), -z * Math.cos(inc)];
}
export function orbitPosition(
  body: OrbitalElements,
  days: number,
  mode: ScaleMode = 'illustrated',
): [number, number, number] {
  if (!body.period) return [0, 0, 0];
  const tau = Math.PI * 2;
  const raw = body.phase + ((days % body.period) / body.period) * tau;
  const mean = ((((raw + Math.PI) % tau) + tau) % tau) - Math.PI;
  // Bracketed Newton iteration stays stable at a comet's very eccentric perihelion.
  let low = -Math.PI,
    high = Math.PI,
    eccentric = mean;
  for (let i = 0; i < 60; i++) {
    const residual = eccentric - body.e * Math.sin(eccentric) - mean;
    if (Math.abs(residual) < 1e-13) break;
    if (residual > 0) high = eccentric;
    else low = eccentric;
    const next = eccentric - residual / (1 - body.e * Math.cos(eccentric));
    eccentric = next > low && next < high ? next : (low + high) / 2;
  }
  return eccentricPosition(body, eccentric, mode);
}
export const speeds = [1 / 86400, 1 / 1440, 0.1, 1, 10, 30, 100, 365, 3650];
export function speedLabel(
  speed: number,
  t: Translate = (key, values) =>
    key.replace('{{count}}', String(values?.count ?? '')),
) {
  return speed === 1 / 86400
    ? t('实时')
    : speed === 1 / 1440
      ? t('1 分钟 / 秒')
      : t('{{count}} 天 / 秒', { count: speed });
}
