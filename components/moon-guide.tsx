import { moonSystems } from '@/lib/moons';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

export default function MoonGuide({ bodyId }: { bodyId: string }) {
  const system = moonSystems[bodyId];
  if (!system) return null;
  return (
    <section className="moon-guide" aria-label="天然卫星资料">
      <h3>
        天然卫星{' '}
        <span>{system.moons.length ? '代表性成员' : '没有已知卫星'}</span>
      </h3>
      <p>{system.summary}</p>
      <Accordion key={bodyId}>
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
          点击名称展开资料。此处为精选介绍；三维场景目前仅演示月球绕行。
        </p>
      )}
    </section>
  );
}
