'use client';
import { useI18n } from '../lib/i18n/provider';
import { useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, Orbit } from 'lucide-react';
import { bodies } from '../lib/solar';
import { comets } from '../lib/comets';
import { orbitingMoons } from '../lib/moon-orbits';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';
import { bodyDetailsPath } from '../lib/seo';

function BodyTree({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const parent = orbitingMoons.find((m) => m.id === selected)?.parentId;
  const [expanded, setExpanded] = useState<string[]>(parent ? [parent] : []);
  function handleProfileClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
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
  return (
    <nav className="body-tree" aria-label={t('天体与卫星目录')}>
      {[...bodies, ...comets].map((body, i) => {
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
                  <span
                    className="planet-dot"
                    style={{ background: body.color }}
                  />
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
                  {open ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
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
      })}
    </nav>
  );
}
export default function BodyNavigation({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const parent = orbitingMoons.find((m) => m.id === selected)?.parentId;
  return (
    <>
      <div className="desktop-body-tree">
        <BodyTree
          key={parent ?? 'bodies'}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
      <button className="mobile-body-picker" onClick={() => setOpen(true)}>
        <Orbit size={18} /> {t('天体导航')}
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
            {t('展开行星下的卫星，点击名称即可定位。')}
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
