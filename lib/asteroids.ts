import { AstroTime } from 'astronomy-engine';
import { Vector3 } from 'three';
import {
  bodies,
  orbitPosition,
  eccentricPosition,
  type ScaleMode,
} from './solar';

export type Asteroid = {
  id: string;
  number: number;
  name: string;
  en: string;
  type: string;
  color: string;
  radius: number;
  diameter: number;
  rotationHours: number;
  axes: number[];
  size: number;
  surface: 'round' | 'rock' | 'top';
  spectral: string;
  texture: string;
  source: string;
  sourceName: string;
  description: string;
  intro: string;
  feature: string;
  fact: string;
  orbit: {
    epoch: number;
    au: number;
    e: number;
    inc: number;
    node: number;
    peri: number;
    mean: number;
    period: number;
  };
};

// NASA/JPL SBDB snapshot retrieved 2026-09-13. Epoch JD(TDB), a(AU),
// angles(degrees), period(days). Physical diameter(km) and rotation period(h).
// https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=1&full-prec=true&phys-par=true
// Also queried by number: 2, 3, 4, 16, 433, 25143, 101955, 162173.
// Fixed two-body propagation omits perturbations and is not a precision ephemeris.
export const asteroids: Asteroid[] = [
  {
    id: 'ceres',
    number: 1,
    name: '谷神星',
    en: 'CERES',
    type: '矮行星',
    color: '#b0aba1',
    diameter: 939.4,
    rotationHours: 9.07417,
    axes: [1.03, 0.95, 1.03],
    size: 0.65,
    surface: 'round',
    spectral: 'C',
    source: 'https://science.nasa.gov/dwarf-planets/ceres/facts/',
    sourceName: 'NASA Science',
    radius: 469.7,
    texture: 'asteroid_surface',
    description:
      '小行星带中最大的天体，也是内太阳系唯一的矮行星。岩石与冰共同塑造了这个世界。',
    intro:
      '谷神星连接着岩质小行星与富冰世界。黎明号的近距离观测，让人们得以研究它的撞击坑、盐类沉积与内部演化。',
    feature:
      '奥卡托撞击坑内的明亮区域富含盐类，记录了地下含盐液体与地表之间的联系。',
    fact: '黎明号于 2015 年进入谷神星轨道，此前已绕灶神星运行。',
    orbit: {
      epoch: 2461200.5,
      au: 2.765552595034094,
      e: 0.07969229514816586,
      inc: 10.58802780183462,
      node: 80.24862682043221,
      peri: 73.29421453021587,
      mean: 274.4193463761342,
      period: 1679.853119758983,
    },
  },
  {
    id: 'pallas',
    number: 2,
    name: '智神星',
    en: 'PALLAS',
    type: '主带小行星',
    color: '#969fa6',
    diameter: 513,
    rotationHours: 7.8132214,
    axes: [1.11, 0.87, 1.04],
    size: 0.52,
    surface: 'rock',
    spectral: 'B',
    source: 'https://www.eso.org/public/images/potw2008a/',
    sourceName: 'ESO',
    radius: 256.5,
    texture: 'asteroid_surface',
    description: '一颗大型主带小行星，以高度倾斜的轨道和密集的撞击坑著称。',
    intro:
      '智神星的轨道明显偏离多数主带天体所在的平面。把镜头拉远，可以看到它在黄道上下穿行的轨迹。',
    feature:
      '欧洲南方天文台的高分辨率观测显示，智神星两个半球都布满大型撞击坑。',
    fact: '智神星的轨道倾角约 35°，比多数主带小行星更大。',
    orbit: {
      epoch: 2461200.5,
      au: 2.769559010737709,
      e: 0.2307000995648547,
      inc: 34.93279321851542,
      node: 172.8866193357694,
      peri: 310.9699161652136,
      mean: 254.2496521742734,
      period: 1683.504809564834,
    },
  },
  {
    id: 'juno',
    number: 3,
    name: '婚神星',
    en: 'JUNO',
    type: '主带小行星',
    color: '#bfaa90',
    diameter: 246.596,
    rotationHours: 7.21,
    axes: [1.18, 0.8, 1.06],
    size: 0.4,
    surface: 'rock',
    spectral: 'Sk',
    source: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=3',
    sourceName: 'NASA/JPL SBDB',
    radius: 123.298,
    texture: 'asteroid_surface',
    description: '编号为 3 的岩质主带小行星，沿较为偏心的椭圆轨道绕太阳运行。',
    intro:
      '婚神星展示了主带轨道的多样性。它在近日点与远日点之间有明显的日距变化，可与更接近圆形轨道的灶神星比较。',
    feature:
      'JPL 数据库将婚神星的 SMASSII 光谱类型列为 Sk，属于以硅酸盐特征为主的 S 类谱系。',
    fact: '婚神星是绕太阳运行的小行星，与探测木星的朱诺号航天器不是同一个对象。',
    orbit: {
      epoch: 2461200.5,
      au: 2.670989527103278,
      e: 0.2556999836681878,
      inc: 12.98659236598085,
      node: 169.8115953492418,
      peri: 247.8950743075613,
      mean: 262.7322944883855,
      period: 1594.434579527149,
    },
  },
  {
    id: 'vesta',
    number: 4,
    name: '灶神星',
    en: 'VESTA',
    type: '主带小行星',
    color: '#b9b0a5',
    diameter: 522.77,
    rotationHours: 5.3421276322,
    axes: [1.09, 0.87, 1.06],
    size: 0.54,
    surface: 'rock',
    spectral: 'V',
    source: 'https://science.nasa.gov/solar-system/asteroids/4-vesta/',
    sourceName: 'NASA Science',
    radius: 261.385,
    texture: 'asteroid_surface',
    description:
      '一颗保留早期分层与火山活动痕迹的大型主带天体，是黎明号曾经绕行的目标。',
    intro:
      '灶神星像一颗未能长成行星的胚胎。它的地表与撞击盆地，帮助科学家追溯太阳系早期岩质天体的演化。',
    feature:
      '灶神星南部的巨大撞击盆地记录了猛烈碰撞；部分喷出的物质后来以陨石形式到达地球。',
    fact: '黎明号从 2011 年至 2012 年绕灶神星运行，随后前往谷神星。',
    orbit: {
      epoch: 2461200.5,
      au: 2.361365965127599,
      e: 0.09020374382834395,
      inc: 7.143925545058711,
      node: 103.701293265032,
      peri: 151.4686478221564,
      mean: 81.19015607686903,
      period: 1325.389042911101,
    },
  },
  {
    id: 'psyche',
    number: 16,
    name: '灵神星',
    en: 'PSYCHE',
    type: '主带小行星',
    color: '#a89b86',
    diameter: 222,
    rotationHours: 4.196,
    axes: [1.25, 0.77, 1.07],
    size: 0.42,
    surface: 'rock',
    spectral: 'X',
    source: 'https://science.nasa.gov/solar-system/asteroids/16-psyche/',
    sourceName: 'NASA Science',
    radius: 111,
    texture: 'asteroid_surface',
    description: '一颗富含金属的主带小行星，可能保留着早期天体内部演化的线索。',
    intro:
      '灵神星的金属与岩石混合物使它成为特殊的探索目标。研究它，可以检验原行星内部物质如何形成与暴露的假说。',
    feature:
      '灵神星不是一颗已确认的纯金属球；其结构与成分仍是探测任务要研究的问题。',
    fact: 'NASA 的 Psyche 探测器于 2023 年发射，以这颗小行星为探测目标。',
    orbit: {
      epoch: 2461200.5,
      au: 2.925720466462538,
      e: 0.1349324738201893,
      inc: 3.098749116151128,
      node: 149.9753859305033,
      peri: 230.0326782748359,
      mean: 79.76939505329617,
      period: 1827.87996016922,
    },
  },
  {
    id: 'eros',
    number: 433,
    name: '爱神星',
    en: 'EROS',
    type: '近地小行星',
    color: '#c2aa87',
    diameter: 16.84,
    rotationHours: 5.27,
    axes: [2.04, 0.665, 0.665],
    size: 0.3,
    surface: 'rock',
    spectral: 'S',
    source: 'https://science.nasa.gov/solar-system/asteroids/433-eros/',
    sourceName: 'NASA Science',
    radius: 8.42,
    texture: 'asteroid_surface',
    description:
      '形状细长的近地小行星，人类首次绕小行星运行与在其表面着陆的目标。',
    intro:
      '爱神星并不是规整的球体。它细长的外形提醒我们，小天体的引力往往不足以将自身塑造成圆球。',
    feature: '爱神星最长方向约 34 公里；等体积直径远小于其最大长度。',
    fact: 'NEAR Shoemaker 于 2000 年进入爱神星轨道，并在 2001 年着陆。',
    orbit: {
      epoch: 2461200.5,
      au: 1.458243716760167,
      e: 0.2228779627700761,
      inc: 10.82854410314273,
      node: 304.2679713350896,
      peri: 178.9181319135911,
      mean: 62.51145501986792,
      period: 643.1963890927677,
    },
  },
  {
    id: 'itokawa',
    number: 25143,
    name: '丝川小行星',
    en: 'ITOKAWA',
    type: '近地小行星',
    color: '#b4a590',
    diameter: 0.33,
    rotationHours: 12.132,
    axes: [1.62, 0.633, 0.89],
    size: 0.23,
    surface: 'rock',
    spectral: 'S(IV)',
    source: 'https://science.nasa.gov/solar-system/asteroids/25143-itokawa/',
    sourceName: 'NASA Science',
    radius: 0.165,
    texture: 'asteroid_surface',
    description: '由岩块聚集而成的小型近地天体，隼鸟号曾把它的尘埃带回地球。',
    intro:
      '丝川的外形像不规则的双瓣岩块。探测器观测与返回样本一起，揭示了碎石堆天体和普通球粒陨石之间的联系。',
    feature:
      '丝川的表面同时存在大块岩石与相对平滑的区域，反映了碎屑在微弱引力下的迁移。',
    fact: '日本隼鸟号于 2010 年把丝川样本带回地球，实现了首次小行星样本返回。',
    orbit: {
      epoch: 2461200.5,
      au: 1.324052284342771,
      e: 0.2801776414987972,
      inc: 1.620940810523569,
      node: 69.07449749929083,
      peri: 162.8409022415483,
      mean: 170.653905937934,
      period: 556.4884171058932,
    },
  },
  {
    id: 'bennu',
    number: 101955,
    name: '贝努小行星',
    en: 'BENNU',
    type: '近地小行星',
    color: '#8b8983',
    diameter: 0.48444,
    rotationHours: 4.296061,
    axes: [1.04, 0.94, 1.02],
    size: 0.25,
    surface: 'top',
    spectral: 'B',
    source:
      'https://science.nasa.gov/solar-system/asteroids/101955-bennu/facts/',
    sourceName: 'NASA Science',
    radius: 0.24222,
    texture: 'asteroid_surface',
    description: '一颗富碳、近似陀螺形的近地小行星，是 OSIRIS-REx 的采样目标。',
    intro:
      '贝努是由许多岩块在引力作用下聚集而成的碎石堆。它暗淡而崎岖的表面，保存着早期太阳系物质的线索。',
    feature: '贝努的赤道附近向外隆起，整体外观类似陀螺，表面遍布大小岩块。',
    fact: 'OSIRIS-REx 于 2020 年采集贝努物质，并在 2023 年将样本送回地球。',
    orbit: {
      epoch: 2455562.5,
      au: 1.126391025894812,
      e: 0.2037450762416414,
      inc: 6.03494377024794,
      node: 2.06086619569642,
      peri: 66.22306084084298,
      mean: 101.703952002457,
      period: 436.6487281120201,
    },
  },
  {
    id: 'ryugu',
    number: 162173,
    name: '龙宫小行星',
    en: 'RYUGU',
    type: '近地小行星',
    color: '#918b83',
    diameter: 0.896,
    rotationHours: 7.63262,
    axes: [1.12, 0.98, 1.12],
    size: 0.28,
    surface: 'top',
    spectral: 'Cb',
    source: 'https://www.isas.jaxa.jp/en/topics/002893.html',
    sourceName: 'JAXA / ISAS',
    radius: 0.448,
    texture: 'asteroid_surface',
    description:
      '隼鸟二号探访的富碳近地小行星，具有明显的赤道隆起与碎石堆结构。',
    intro:
      '龙宫与贝努都是研究原始物质的重要样本。对龙宫返回物质的分析，让科学家能在实验室里检验小行星上水与有机物的历史。',
    feature:
      '龙宫样本含有经历水作用的矿物与有机物，为研究早期太阳系的化学过程提供了材料。',
    fact: '隼鸟二号在 2019 年两次采样，并于 2020 年将约 5.4 克龙宫物质送回地球。',
    orbit: {
      epoch: 2461200.5,
      au: 1.190918932702464,
      e: 0.1910730046480051,
      inc: 5.866442486408568,
      node: 251.2897123995624,
      peri: 211.608993811871,
      mean: 62.34067409463987,
      period: 474.7027265420688,
    },
  },
];

export const asteroidModelNote =
  '小行星位置由 JPL 带历元轨道快照作二体近似计算，未计入行星摄动与热辐射效应，不用于近距离交会或撞击预测。形状、色彩、地貌与自转轴为示意；真实大小采用等效半径，小行星不参与食影计算。';
export const asteroidSurfaceNote =
  '采用 cubicApocalypse / CelestiaContent 的 CC BY 4.0 岩质贴图；色彩、凹凸与外形为教学示意，不是该天体的实测全球地图。';

function elements(asteroid: Asteroid) {
  const orbit = asteroid.orbit;
  // Match the neighboring planetary semimajor axes in the illustrated layout.
  const outer = bodies.findIndex((body) => body.au >= orbit.au);
  const left = bodies[outer - 1],
    right = bodies[outer];
  const distance =
    left.distance +
    ((right.distance - left.distance) * (orbit.au - left.au)) /
      (right.au - left.au);
  return { ...orbit, inc: 0, phase: (orbit.mean * Math.PI) / 180, distance };
}
function orient(asteroid: Asteroid, point: number[]): [number, number, number] {
  const { peri, inc, node } = asteroid.orbit;
  const deg = Math.PI / 180;
  const v = new Vector3(point[0], -point[2], 0)
    .applyAxisAngle(new Vector3(0, 0, 1), peri * deg)
    .applyAxisAngle(new Vector3(1, 0, 0), inc * deg)
    .applyAxisAngle(new Vector3(0, 0, 1), node * deg);
  return [v.x, v.z, -v.y];
}
const orbits = new Map(
  asteroids.map((asteroid) => [asteroid.id, elements(asteroid)]),
);
export function asteroidPosition(
  asteroid: Asteroid,
  days: number,
  scale: ScaleMode,
) {
  return orient(
    asteroid,
    orbitPosition(
      orbits.get(asteroid.id)!,
      new AstroTime(days).tt - (asteroid.orbit.epoch - 2451545),
      scale,
    ),
  );
}
export function asteroidOrbitPoint(
  asteroid: Asteroid,
  anomaly: number,
  scale: ScaleMode,
) {
  return orient(
    asteroid,
    eccentricPosition(orbits.get(asteroid.id)!, anomaly, scale),
  );
}
export function asteroidFacts(asteroid: Asteroid) {
  return [
    ['等效直径', asteroid.diameter, 'km'],
    ['轨道半长轴', asteroid.orbit.au, 'AU'],
    ['模型公转周期', asteroid.orbit.period / 365.256, '年'],
    ['自转周期', asteroid.rotationHours, '小时'],
    ['轨道倾角', asteroid.orbit.inc, '°'],
    ['轨道偏心率', asteroid.orbit.e, ''],
  ] as const;
}
