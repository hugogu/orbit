import { moonSystems } from '@/lib/moons';

export default function MoonGuide({
  bodyId,
  onSelect,
}: {
  bodyId: string;
  onSelect: (id: string) => void;
}) {
  const system = moonSystems[bodyId];
  if (!system) return null;
  return (
    <section className="moon-guide" aria-label="天然卫星资料">
      <h3>
        天然卫星{' '}
        <span>{system.moons.length ? '代表性成员' : '没有已知卫星'}</span>
      </h3>
      <p>{system.summary}</p>
      {system.moons.length > 0 && (
        <button className="secondary-action" onClick={() => onSelect(bodyId)}>
          查看整个卫星系统
        </button>
      )}
      {system.moons.length > 0 && (
        <p className="little-note">
          在天体导航中展开卫星目录，可以单独跟随每颗卫星并阅读其介绍。使用底部控件调速或暂停。
        </p>
      )}
    </section>
  );
}
