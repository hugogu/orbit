'use client';
import { useI18n } from '../lib/i18n/provider';
import type { Body } from '../lib/solar';
import { extraFacts } from '../lib/physical-facts';
import ConceptHint from './concept-hint';
export default function PhysicalFacts({ body }: { body: Body }) {
  const { t, locale } = useI18n();
  return (
    <details className="physical-facts">
      <summary>
        <span className="physical-facts-label">
          {t('更多基础数据')}
          <ConceptHint
            label={t(
              body.id === 'sun'
                ? '太阳没有固体表面，温度随层次变化，自转随纬度变化。'
                : '引力数据为赤道参考值；巨行星没有可站立的固体表面。自转方向相对于太阳系通常的公转方向。轨道参数为科普近似值。',
            )}
          />
        </span>
      </summary>
      <div className="facts">
        {extraFacts(body, locale).map((f) => (
          <div key={t(f.label)}>
            <span>{t(f.label)}</span>
            <strong>
              {t(f.value)}
              {f.unit && (
                <>
                  {' '}
                  <small>{t(f.unit)}</small>
                </>
              )}
            </strong>
          </div>
        ))}
      </div>
      <a
        className="source"
        href={
          body.id === 'sun'
            ? 'https://science.nasa.gov/sun/facts/'
            : 'https://ssd.jpl.nasa.gov/planets/phys_par.html'
        }
        target="_blank"
        rel="noreferrer"
      >
        {t('数据来源：')}
        {body.id === 'sun' ? t('NASA 太阳资料') : t('JPL 行星物理参数')} ↗
      </a>
    </details>
  );
}
