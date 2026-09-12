'use client';
import { useI18n } from '../lib/i18n/provider';
import type { OrbitingMoon } from '../lib/moon-orbits';
import { bodies } from '../lib/solar';
import { moonRadii } from '../lib/eclipse-shadows';
import { moonSemimajorKm } from '../lib/satellite-elements';
import { bodyDetailsPath } from '../lib/seo';
import CuriosityCard from './curiosity-card';
import ConceptHint from './concept-hint';
export default function MoonDetails({
  moon,
  curiosityIndex,
  onSelect,
}: {
  moon: OrbitingMoon;
  curiosityIndex?: number;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const parent = bodies.find((b) => b.id === moon.parentId)!;
  return (
    <article
      className="moon-details"
      aria-label={t('{{name}}介绍', { name: t(moon.name) })}
    >
      <p className="eyebrow">
        {t('{{name}}的天然卫星', { name: t(parent.name) })}
      </p>
      <div className="detail-heading">
        <h2>{t(moon.name)}</h2>
        <span className="type-chip">{t('天然卫星')}</span>
        <ConceptHint
          label={t(
            '半径采用球形近似，轨道半长轴从主星中心计量。除月球外的卫星表面配色与自转朝向仍为教学示意。',
          )}
        />
      </div>
      <p className="description">{t(moon.description)}</p>
      <div className="facts">
        <div>
          <span>{t('平均半径')}</span>
          <strong>
            {moonRadii[moon.en].toLocaleString(locale)} <small>km</small>
          </strong>
        </div>
        <div>
          <span>{t('平均直径')}</span>
          <strong>
            {(moonRadii[moon.en] * 2).toLocaleString(locale)} <small>km</small>
          </strong>
        </div>
        <div>
          <span>{t('轨道半长轴')}</span>
          <strong>
            {moonSemimajorKm(moon).toLocaleString(locale)} <small>km</small>
          </strong>
        </div>
        <div>
          <span>{t('公转周期')}</span>
          <strong>
            {moon.period} <small>{t('天')}</small>
          </strong>
        </div>
      </div>
      <CuriosityCard id={moon.id} index={curiosityIndex} name={t(moon.name)} />
      <button
        className="secondary-action moon-back-action"
        onClick={() => onSelect(parent.id)}
      >
        {t('返回{{name}}', { name: t(parent.name) })}
      </button>
      <a
        className="source"
        href={`https://science.nasa.gov/${moon.source}/`}
        target="_blank"
        rel="noreferrer"
      >
        {t('阅读 NASA 的{{name}}资料 ↗', { name: t(moon.name) })}
      </a>
      <a
        className="source"
        href="https://ssd.jpl.nasa.gov/sats/phys_par/"
        target="_blank"
        rel="noreferrer"
      >
        {t('JPL 卫星物理参数 ↗')}
      </a>
      <a className="source" href={`#${moon.id}`}>
        {t('此卫星的独立链接 ↗')}
      </a>
      <a className="source" href={bodyDetailsPath(locale, moon.id)}>
        {t('阅读{{name}}的完整资料 ↗', { name: t(moon.name) })}
      </a>
    </article>
  );
}
