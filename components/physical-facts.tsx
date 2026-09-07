import type { Body } from '../lib/solar';
import { extraFacts } from '../lib/physical-facts';
export default function PhysicalFacts({ body }: { body: Body }) {
  return (
    <details className="physical-facts">
      <summary>更多基础数据</summary>
      <div className="facts">
        {extraFacts(body).map((f) => (
          <div key={f.label}>
            <span>{f.label}</span>
            <strong>
              {f.value}
              {f.unit && (
                <>
                  {' '}
                  <small>{f.unit}</small>
                </>
              )}
            </strong>
          </div>
        ))}
      </div>
      <p className="little-note">
        {body.id === 'sun'
          ? '太阳没有固体表面，温度随层次变化，自转随纬度变化。'
          : '引力数据为赤道参考值；巨行星没有可站立的固体表面。自转方向相对于太阳系通常的公转方向。轨道参数为科普近似值。'}
      </p>
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
        数据来源：{body.id === 'sun' ? 'NASA 太阳资料' : 'JPL 行星物理参数'} ↗
      </a>
    </details>
  );
}
