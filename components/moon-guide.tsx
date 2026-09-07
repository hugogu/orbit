import { moonSystems } from '@/lib/moons';
import { orbitingMoons } from '@/lib/moon-orbits';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

export default function MoonGuide({
  bodyId,
  selected,
  onSelect,
}: {
  bodyId: string;
  selected: string | null;
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
      <Accordion
        key={`${bodyId}/${selected}`}
        defaultValue={orbitingMoons
          .filter((m) => m.id === selected)
          .map((m) => m.en)}
      >
        {system.moons.map((moon) => (
          <AccordionItem key={moon.en} value={moon.en}>
            <AccordionTrigger>
              <span>
                {moon.name}
                <small>
                  {moon.en} · {moon.highlight}
                </small>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p>{moon.description}</p>
              <button
                className="secondary-action"
                onClick={() => onSelect(`moon-${moon.en.toLowerCase()}`)}
              >
                跟随{moon.name}运行
              </button>
              <a
                className="source"
                href={`https://science.nasa.gov/${moon.source}/`}
                target="_blank"
                rel="noreferrer"
              >
                阅读 NASA 资料 ↗
              </a>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {system.moons.length > 0 && (
        <p className="little-note">
          这些卫星均在三维场景中绕行，使用底部控件调速或暂停。大小、间距和表面配色为教学示意，公转周期采用近似值。
        </p>
      )}
    </section>
  );
}
