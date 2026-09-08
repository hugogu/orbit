import type { OrbitingMoon } from '../lib/moon-orbits';
import { bodies } from '../lib/solar';
import { moonRadii } from '../lib/eclipse-shadows';
import { moonSemimajorKm } from '../lib/satellite-elements';
import CuriosityCard from './curiosity-card';
export default function MoonDetails({
  moon,
  curiosityIndex,
  onSelect,
}: {
  moon: OrbitingMoon;
  curiosityIndex?: number;
  onSelect: (id: string) => void;
}) {
  const parent = bodies.find((b) => b.id === moon.parentId)!;
  return (
    <article aria-label={`${moon.name}介绍`}>
      <p className="eyebrow">
        {moon.en.toUpperCase()} · {parent.name}的天然卫星
      </p>
      <div className="detail-heading">
        <h2>{moon.name}</h2>
        <span className="type-chip">天然卫星</span>
      </div>
      <p className="description">{moon.description}</p>
      <div className="facts">
        <div>
          <span>平均半径</span>
          <strong>
            {moonRadii[moon.en].toLocaleString()} <small>km</small>
          </strong>
        </div>
        <div>
          <span>平均直径</span>
          <strong>
            {(moonRadii[moon.en] * 2).toLocaleString()} <small>km</small>
          </strong>
        </div>
        <div>
          <span>轨道半长轴</span>
          <strong>
            {moonSemimajorKm(moon).toLocaleString()} <small>km</small>
          </strong>
        </div>
        <div>
          <span>公转周期</span>
          <strong>
            {moon.period} <small>天</small>
          </strong>
        </div>
      </div>
      <CuriosityCard id={moon.id} index={curiosityIndex} name={moon.name} />
      <p className="little-note">
        半径采用球形近似，轨道半长轴从主星中心计量。除月球外的卫星表面配色与自转朝向仍为教学示意。
      </p>
      <button className="secondary-action" onClick={() => onSelect(parent.id)}>
        返回{parent.name}
      </button>
      <a
        className="source"
        href={`https://science.nasa.gov/${moon.source}/`}
        target="_blank"
        rel="noreferrer"
      >
        阅读 NASA 的{moon.name}资料 ↗
      </a>
      <a
        className="source"
        href="https://ssd.jpl.nasa.gov/sats/phys_par/"
        target="_blank"
        rel="noreferrer"
      >
        JPL 卫星物理参数 ↗
      </a>
      <a className="source" href={`#${moon.id}`}>
        此卫星的独立链接 ↗
      </a>
    </article>
  );
}
