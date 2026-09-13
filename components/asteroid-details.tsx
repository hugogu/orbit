'use client';
import { ArrowUpRight } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import {
  type Asteroid,
  asteroidFacts,
  asteroidModelNote,
  asteroidSurfaceNote,
} from '../lib/asteroids';
import { bodyDetailsPath } from '../lib/seo';
import CuriosityCard from './curiosity-card';

export default function AsteroidDetails({
  asteroid,
  curiosityIndex,
}: {
  asteroid: Asteroid;
  curiosityIndex?: number;
}) {
  const { t, locale } = useI18n();
  return (
    <>
      <div className="eyebrow">
        {t('小行星档案')} / {asteroid.number} {asteroid.en}
      </div>
      <div className="detail-heading asteroid-heading">
        <h2>{t(asteroid.name)}</h2>
        <span className="type-chip">{t(asteroid.type)}</span>
      </div>
      <p className="description">{t(asteroid.description)}</p>
      <div className="facts">
        {asteroidFacts(asteroid)
          .slice(0, 4)
          .map(([label, value, unit]) => (
            <div key={label}>
              <span>{t(label)}</span>
              <strong>
                {value.toLocaleString(locale, {
                  maximumFractionDigits: value < 1 ? 5 : 3,
                })}{' '}
                <small>{t(unit)}</small>
              </strong>
            </div>
          ))}
      </div>
      <CuriosityCard
        id={asteroid.id}
        name={t(asteroid.name)}
        index={curiosityIndex}
        showSource={false}
      />
      <details className="physical-facts">
        <summary>{t('数据与计算说明')}</summary>
        <p className="little-note">{t(asteroidModelNote)}</p>
        <p className="little-note">{t(asteroidSurfaceNote)}</p>
        <a className="source" href={'/textures/satellites/CREDITS.md'}>
          {t('图像与授权')}
        </a>
      </details>
      <a className="source" href={bodyDetailsPath(locale, asteroid.id)}>
        {t('阅读{{name}}的完整资料', { name: t(asteroid.name) })}
      </a>
      <a
        className="source"
        href={asteroid.source}
        target="_blank"
        rel="noreferrer"
      >
        {asteroid.sourceName}
        <ArrowUpRight className="external-arrow" aria-hidden="true" />
      </a>
      {asteroid.sourceName !== 'NASA/JPL SBDB' && (
        <a
          className="source"
          href={`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${asteroid.number}`}
          target="_blank"
          rel="noreferrer"
        >
          {t('轨道参数：JPL 小天体数据库')}
          <ArrowUpRight className="external-arrow" aria-hidden="true" />
        </a>
      )}
    </>
  );
}
