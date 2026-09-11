'use client';
import { useI18n } from '../lib/i18n/provider';
import { moonSystems } from '@/lib/moons';
import ConceptHint from './concept-hint';

export default function MoonGuide({
  bodyId,
  onSelect,
}: {
  bodyId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const system = moonSystems[bodyId];
  if (!system) return null;
  return (
    <section className="moon-guide" aria-label={t('天然卫星资料')}>
      <h3>
        {t('天然卫星')}{' '}
        <span>{system.moons.length ? t('代表性成员') : t('没有已知卫星')}</span>
        {system.moons.length > 0 && (
          <ConceptHint
            label={t(
              '在天体导航中展开卫星目录，可以单独跟随每颗卫星并阅读其介绍。使用底部控件调速或暂停。',
            )}
          />
        )}
      </h3>
      <p>{t(system.summary)}</p>
      {system.moons.length > 0 && (
        <button className="secondary-action" onClick={() => onSelect(bodyId)}>
          {t('查看整个卫星系统')}
        </button>
      )}
    </section>
  );
}
