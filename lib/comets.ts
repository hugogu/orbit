import { AstroTime } from 'astronomy-engine';
import { Vector3 } from 'three';
import {
  orbitPosition,
  eccentricPosition,
  type OrbitalElements,
} from './solar';

export type Comet = OrbitalElements & {
  id: string;
  name: string;
  en: string;
  color: string;
  description: string;
  fact: string;
  source: string;
};

// Rounded JPL SBDB osculating elements retrieved 2026-09-07.
// The epoch-aware solutions below retain the full precision SBDB snapshot.
export const comets: Comet[] = [
  {
    id: 'halley',
    name: '哈雷彗星',
    en: '1P / HALLEY',
    color: '#8de5ed',
    au: 17.9,
    e: 0.968,
    inc: 162,
    period: 27700,
    phase: 0,
    distance: 55.49,
    description:
      '约每 76 年回归一次的著名周期彗星。它逆向绕太阳运行，轨道从金星轨道以内一直延伸到海王星之外。',
    fact: '上一次回归是 1986 年，预计下一次为 2061 年。它留下的碎屑与宝瓶座 η、猎户座流星雨有关。',
    source: '1p-halley',
  },
  {
    id: 'encke',
    name: '恩克彗星',
    en: '2P / ENCKE',
    color: '#b2e9be',
    au: 2.22,
    e: 0.847,
    inc: 11.4,
    period: 1210,
    phase: 0,
    distance: 6.882,
    description:
      '一颗约 3.3 年就绕太阳一周的短周期彗星，彗核直径约 4.8 公里。它的回归节奏远比哈雷彗星快。',
    fact: '它以计算出其轨道的恩克命名，而不是最初的发现者。金牛座流星群与它有关。',
    source: '2p-encke',
  },
  {
    id: '67p',
    name: '67P 彗星',
    en: '67P / CHURYUMOV–GERASIMENKO',
    color: '#f3c88e',
    au: 3.46,
    e: 0.641,
    inc: 7.04,
    period: 2350,
    phase: 0,
    distance: 10.726,
    description:
      '丘留莫夫—格拉西缅科彗星，是罗塞塔任务的目的地。这颗木星族彗星的轨道曾被木星引力显著改变。',
    fact: '2014 年，罗塞塔探测器与菲莱着陆器实现了人类首次绕彗星运行和彗星表面着陆。',
    source: '67p-churyumov-gerasimenko',
  },
  {
    id: 'hale-bopp',
    name: '海尔—波普彗星',
    en: 'C/1995 O1 / HALE–BOPP',
    color: '#b7b6ff',
    au: 177,
    e: 0.995,
    inc: 89.3,
    period: 863000,
    phase: 0,
    distance: 548.7,
    description:
      '1997 年的大彗星，拥有巨大的彗核，曾长时间肉眼可见。它以接近垂直黄道的方向，深入遥远的外太阳系。',
    fact: '绕行一圈需要数千年。长周期彗星的轨道会受行星引力扰动，周期取决于采用的轨道历元，不能据此模型预测回归日期。',
    source: 'c-1995-o1-hale-bopp',
  },
];

// epoch JD(TDB), a(AU), e, i/node/peri/M(degrees), period(days).
// https://ssd-api.jpl.nasa.gov/sbdb.api?full-prec=true&sstr=1P (and 2P, 67P, C/1995 O1).
const solutions: Record<string, number[]> = {
  halley: [
    2439875.5, 17.92863504856923, 0.9679359956953211, 162.1905300439129,
    59.09894720612437, 112.2414314637764, 274.3823371366792, 27728.04608790421,
  ],
  encke: [
    2459897.5, 2.219666462919362, 0.8474743598998141, 11.38392682811341,
    334.1444955507088, 187.1788051568751, 257.9773631508835, 1207.897291208371,
  ],
  '67p': [
    2457305.5, 3.462249490129549, 0.6409081308996354, 7.040294937543767,
    50.13557377155012, 12.79824970228189, 8.859927425218402, 2353.076067903661,
  ],
  'hale-bopp': [
    2459837.5, 177.4333839117583, 0.9949810027633206, 89.28759424740302,
    282.7334213961641, 130.4146670659176, 3.878386339423241, 863279.5034870314,
  ],
};
export function cometElements(comet: Comet) {
  const [epoch, au, e, inc, node, peri, mean, period] = solutions[comet.id];
  return {
    epoch,
    au,
    e,
    inc,
    node,
    peri,
    mean,
    period,
    phase: (mean * Math.PI) / 180,
    distance: au * 3.1,
  };
}
function orientComet(comet: Comet, p: number[]): [number, number, number] {
  const { inc, node, peri } = cometElements(comet),
    deg = Math.PI / 180;
  const v = new Vector3(p[0], -p[2], 0)
    .applyAxisAngle(new Vector3(0, 0, 1), peri * deg)
    .applyAxisAngle(new Vector3(1, 0, 0), inc * deg)
    .applyAxisAngle(new Vector3(0, 0, 1), node * deg);
  return [v.x, v.z, -v.y];
}
export function cometPosition(comet: Comet, days: number) {
  const elements = cometElements(comet);
  return orientComet(
    comet,
    orbitPosition(
      { ...elements, inc: 0 },
      new AstroTime(days).tt - (elements.epoch - 2451545),
      'distance',
    ),
  );
}
export function cometOrbitPoint(comet: Comet, anomaly: number) {
  return orientComet(
    comet,
    eccentricPosition({ ...cometElements(comet), inc: 0 }, anomaly, 'distance'),
  );
}
export function cometPerihelion(comet: Comet, days: number) {
  const e = cometElements(comet),
    tt = new AstroTime(days).tt;
  const first = e.epoch - 2451545 - (e.mean / 360) * e.period;
  return AstroTime.FromTerrestrialTime(
    first + Math.ceil((tt - first) / e.period) * e.period,
  ).date.getTime();
}

export function cometActivity(distanceAU: number) {
  return Math.max(0, Math.min(1, (4 - distanceAU) / 3));
}
