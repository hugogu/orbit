'use client';
import { useI18n } from '../lib/i18n/provider';
import { useId, useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, Orbit } from 'lucide-react';
import { bodies } from '../lib/solar';
import { comets } from '../lib/comets';
import { asteroids } from '../lib/asteroids';
import { orbitingMoons } from '../lib/moon-orbits';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';
import { bodyDetailsPath } from '../lib/seo';

const smallBodyGroups = [
  { id: 'asteroids', name: '小行星', entries: asteroids },
  { id: 'comets', name: '彗星', entries: comets },
];
function selectionBranch(selected: string | null) {
  return (
    orbitingMoons.find((m) => m.id === selected)?.parentId ??
    smallBodyGroups.find((group) =>
      group.entries.some((body) => body.id === selected),
    )?.id
  );
}

function BodyTree({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const treeId = useId();
  const parent = selectionBranch(selected);
  const [expanded, setExpanded] = useState<string[]>(parent ? [parent] : []);
  function handleProfileClick(
    event: MouseEvent<HTMLAnchorElement>,
    id: string,
  ) {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onSelect(id);
    }
  }
  const renderBody = (
    body:
      | (typeof bodies)[number]
      | (typeof comets)[number]
      | (typeof asteroids)[number],
    i: number,
  ) => {
    const moons = orbitingMoons.filter((m) => m.parentId === body.id);
    const open = expanded.includes(body.id);
    return (
      <div key={body.id} className="body-branch">
        <div className="body-branch-row">
          <h3 className="body-option-heading">
            <a
              className={`body-option ${selected === body.id ? 'active' : ''}`}
              href={bodyDetailsPath(locale, body.id)}
              aria-current={selected === body.id ? 'true' : undefined}
              onClick={(event) => handleProfileClick(event, body.id)}
            >
              <span className="body-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="planet-dot" style={{ background: body.color }} />
              <span>
                {t(body.name)}
                <small>{body.en.split(' / ')[0]}</small>
              </span>
            </a>
          </h3>
          {moons.length > 0 && (
            <button
              className="moon-expander"
              aria-label={t(
                open ? '收起{{name}}的卫星' : '展开{{name}}的卫星',
                { name: t(body.name) },
              )}
              aria-expanded={open}
              onClick={() =>
                setExpanded((v) =>
                  open ? v.filter((id) => id !== body.id) : [...v, body.id],
                )
              }
            >
              <span>{moons.length}</span>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        {open && (
          <ul
            className="moon-children"
            aria-label={t('{{name}}的卫星', { name: t(body.name) })}
          >
            {moons.map((moon) => (
              <li key={moon.id}>
                <h4>
                  <a
                    className={`body-option ${selected === moon.id ? 'active' : ''}`}
                    href={bodyDetailsPath(locale, moon.id)}
                    aria-current={selected === moon.id ? 'true' : undefined}
                    onClick={(event) => handleProfileClick(event, moon.id)}
                  >
                    <span
                      className="planet-dot"
                      style={{ background: moon.color }}
                    />
                    <span>
                      {t(moon.name)}
                      <small>{moon.en}</small>
                    </span>
                  </a>
                </h4>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
  return (
    <nav className="body-tree" aria-label={t('天体与卫星目录')}>
      {bodies.map(renderBody)}
      {smallBodyGroups.map((group) => {
        const open = expanded.includes(group.id);
        return (
          <section className="small-body-group" key={group.id}>
            <h3>
              <button
                className="small-body-expander"
                aria-expanded={open}
                aria-controls={`${treeId}-${group.id}`}
                onClick={() =>
                  setExpanded((v) =>
                    open ? v.filter((id) => id !== group.id) : [...v, group.id],
                  )
                }
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>{t(group.name)}</span>
                <small>{group.entries.length}</small>
              </button>
            </h3>
            <div id={`${treeId}-${group.id}`} hidden={!open}>
              {group.entries.map(renderBody)}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
export default function BodyNavigation({
  selected,
  onSelect,
  label,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  label?: string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const parent = selectionBranch(selected);
  return (
    <>
      <div className="desktop-body-tree">
        <BodyTree
          key={parent ?? 'bodies'}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
      <button
        className="mobile-body-picker"
        aria-label={t('天体导航')}
        onClick={() => setOpen(true)}
      >
        <Orbit size={18} />
        <span>{label ?? t('天体导航')}</span>
        <ChevronDown size={16} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          closeLabel={t('Close')}
          side="bottom"
          className="navigation-sheet"
        >
          <SheetTitle>{t('天体导航')}</SheetTitle>
          <SheetDescription>
            {t('展开卫星、小行星或彗星分组，点击名称即可定位。')}
          </SheetDescription>
          <BodyTree
            key={parent ?? 'bodies'}
            selected={selected}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
