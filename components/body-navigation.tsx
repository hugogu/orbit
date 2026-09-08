'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Orbit } from 'lucide-react';
import { bodies } from '../lib/solar';
import { comets } from '../lib/comets';
import { orbitingMoons } from '../lib/moon-orbits';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet';

function BodyTree({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const parent = orbitingMoons.find((m) => m.id === selected)?.parentId;
  const [expanded, setExpanded] = useState<string[]>(parent ? [parent] : []);
  return (
    <nav className="body-tree" aria-label="天体与卫星目录">
      {[...bodies, ...comets].map((body, i) => {
        const moons = orbitingMoons.filter((m) => m.parentId === body.id);
        const open = expanded.includes(body.id);
        return (
          <div key={body.id} className="body-branch">
            <div className="body-branch-row">
              <button
                className={`body-option ${selected === body.id ? 'active' : ''}`}
                aria-current={selected === body.id ? 'true' : undefined}
                onClick={() => onSelect(body.id)}
              >
                <span className="body-number">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="planet-dot"
                  style={{ background: body.color }}
                />
                <span>
                  {body.name}
                  <small>{body.en.split(' / ')[0]}</small>
                </span>
              </button>
              {moons.length > 0 && (
                <button
                  className="moon-expander"
                  aria-label={`${open ? '收起' : '展开'}${body.name}的卫星`}
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
              <ul className="moon-children" aria-label={`${body.name}的卫星`}>
                {moons.map((moon) => (
                  <li key={moon.id}>
                    <button
                      className={selected === moon.id ? 'active' : ''}
                      aria-current={selected === moon.id ? 'true' : undefined}
                      onClick={() => onSelect(moon.id)}
                    >
                      <span
                        className="planet-dot"
                        style={{ background: moon.color }}
                      />
                      <span>
                        {moon.name}
                        <small>{moon.en}</small>
                      </span>
                    </button>
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
        <Orbit size={18} /> 天体导航 <ChevronDown size={16} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="navigation-sheet">
          <SheetTitle>天体导航</SheetTitle>
          <SheetDescription>
            展开行星下的卫星，点击名称即可定位。
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
