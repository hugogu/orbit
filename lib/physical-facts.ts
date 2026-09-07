import type { Body } from './solar';
export type Fact = { label: string; value: string; unit?: string };
// JPL physical parameters, retrieved 2026-09-08. Mass kg, density g/cm³,
// equatorial gravity m/s², escape velocity km/s. Pluto's source mass uses 10^18 kg.
export const physicalParameters: Record<
  string,
  { mass: number; density: number; gravity: number; escape: number }
> = {
  mercury: { mass: 0.330103e24, density: 5.4289, gravity: 3.7, escape: 4.25 },
  venus: { mass: 4.86731e24, density: 5.243, gravity: 8.87, escape: 10.36 },
  earth: { mass: 5.97217e24, density: 5.5134, gravity: 9.8, escape: 11.19 },
  mars: { mass: 0.641691e24, density: 3.934, gravity: 3.71, escape: 5.03 },
  jupiter: { mass: 1898.125e24, density: 1.3262, gravity: 24.79, escape: 60.2 },
  saturn: { mass: 568.317e24, density: 0.6871, gravity: 10.44, escape: 36.09 },
  uranus: { mass: 86.8099e24, density: 1.27, gravity: 8.87, escape: 21.38 },
  neptune: { mass: 102.4092e24, density: 1.638, gravity: 11.15, escape: 23.56 },
  pluto: { mass: 13024.6e18, density: 1.853, gravity: 0.62, escape: 1.21 },
};
export function extraFacts(body: Body): Fact[] {
  if (body.id === 'sun')
    return [
      { label: '主要成分', value: '氢与氦' },
      { label: '光球温度（约）', value: '5,500', unit: '°C' },
      { label: '核心温度（约）', value: '1,500 万', unit: '°C' },
      { label: '能源机制', value: '氢核聚变' },
    ];
  const p = physicalParameters[body.id];
  const [mantissa, exponent] = p.mass.toExponential(3).split('e');
  return [
    {
      label: '质量（约）',
      value: `${mantissa} × 10${Number(exponent)
        .toString()
        .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])}`,
      unit: 'kg',
    },
    { label: '平均密度', value: p.density.toFixed(3), unit: 'g/cm³' },
    { label: '赤道引力加速度', value: p.gravity.toFixed(2), unit: 'm/s²' },
    { label: '逃逸速度', value: p.escape.toFixed(2), unit: 'km/s' },
    {
      label: '直径（由平均半径）',
      value: (body.radius * 2).toLocaleString('zh-CN'),
      unit: 'km',
    },
    { label: '轨道偏心率（约）', value: String(body.e) },
    { label: '轨道倾角（约）', value: String(body.inc), unit: '°' },
    {
      label: '自转方向',
      value: ['venus', 'uranus', 'pluto'].includes(body.id) ? '逆行' : '顺行',
    },
  ];
}
