import type { OrbitalElements } from './solar';

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
// These fixed teaching ellipses omit planetary perturbations and real epochs.
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

export function cometActivity(distanceAU: number) {
  return Math.max(0, Math.min(1, (4 - distanceAU) / 3));
}
