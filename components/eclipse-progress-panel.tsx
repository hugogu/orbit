'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { ChevronDown, GripVertical } from 'lucide-react';
import { Progress } from './ui/progress';
import { useI18n } from '../lib/i18n/provider';
import {
  dragBounds,
  noDragOffset,
  settleDragOffset,
  type DragBounds,
  type DragOffset,
} from '../lib/drag-offset';
import {
  eclipseProgress,
  solarCircumstance,
  solarPathWidth,
  type EclipseProgressEvent,
} from '../lib/eclipse-progress';
import { utcLabel } from '../lib/simulation-time';

const names: Record<string, string> = {
  'solar-total': '日全食',
  'solar-annular': '日环食',
  'solar-partial': '日偏食',
  'solar-hybrid': '全环食',
  'lunar-total': '月全食',
  'lunar-partial': '月偏食',
  'lunar-penumbral': '月半影食',
};
/** How far one arrow key moves the card, and how far it moves with Shift. */
const nudgeStep = 8;
const fastNudgeStep = 32;
/** Pointer travel that turns a press on the handle into a drag rather than a tap. */
const dragThreshold = 3;

export default function EclipseProgressPanel({
  event,
  time,
  onSeek,
  onObserve,
}: {
  event: EclipseProgressEvent;
  time: number;
  onSeek: (time: number) => void;
  onObserve: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia(
      '(min-width: 901px) and (min-height: 601px)',
    );
    const sync = () => setExpanded(wide.matches);
    queueMicrotask(sync);
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);
  const card = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(noDragOffset);
  const [dragging, setDragging] = useState(false);
  const grab = useRef<{
    pointer: number;
    x: number;
    y: number;
    from: DragOffset;
    bounds: DragBounds;
  } | null>(null);
  /** Set once a press travels far enough that its click is a drag's tail, not a tap. */
  const travelled = useRef(false);
  const room = useCallback((applied: DragOffset) => {
    const box = card.current?.getBoundingClientRect();
    return box
      ? dragBounds(box, applied, {
          width: window.innerWidth,
          height: window.innerHeight,
        })
      : null;
  }, []);
  /**
   * Move the card and keep it on screen, measuring the room it has right now.
   * An offset that settles where it already was comes back unchanged, which is
   * what stops the fit-to-viewport effect below from feeding itself.
   */
  const settle = useCallback(
    (to: (current: DragOffset) => DragOffset) =>
      setOffset((current) => {
        const bounds = room(current);
        return bounds
          ? settleDragOffset(current, to(current), bounds)
          : current;
      }),
    [room],
  );
  // Expanding the card, rotating the phone or resizing the window all change how
  // much room a dragged card has; it follows the corner it was left near.
  useEffect(() => {
    const fit = () => settle((current) => current);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [expanded, settle]);
  const startDrag = (pointer: PointerEvent<HTMLButtonElement>) => {
    const box = card.current?.getBoundingClientRect();
    if (pointer.button !== 0 || !box) return;
    // Capture is what keeps the moves coming once the finger leaves the handle.
    // It fails only for a pointer that is already gone, and a drag nothing can
    // follow is also a drag nothing can end, so that one is never started.
    try {
      pointer.currentTarget.setPointerCapture(pointer.pointerId);
    } catch {
      return;
    }
    travelled.current = false;
    grab.current = {
      pointer: pointer.pointerId,
      x: pointer.clientX,
      y: pointer.clientY,
      from: offset,
      // Measured once: the card cannot change size mid-drag, so every move after
      // this is arithmetic rather than another layout read.
      bounds: dragBounds(box, offset, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    };
    setDragging(true);
  };
  const moveDrag = (pointer: PointerEvent<HTMLButtonElement>) => {
    const held = grab.current;
    if (!held || held.pointer !== pointer.pointerId) return;
    const dx = pointer.clientX - held.x;
    const dy = pointer.clientY - held.y;
    if (Math.hypot(dx, dy) > dragThreshold) travelled.current = true;
    // Bounds measured at the press, so a move costs arithmetic and no layout
    // read; pushing further into an edge the card already rests on re-renders
    // nothing.
    setOffset((current) =>
      settleDragOffset(
        current,
        { x: held.from.x + dx, y: held.from.y + dy },
        held.bounds,
      ),
    );
  };
  /**
   * Release the card. A press that never travelled is a tap rather than a drag,
   * and a tap on the handle parks the card back in its corner. That is decided
   * here and not on the click that may follow, because a drag does not always
   * end in one — and a flag left over from the drag that did not would swallow
   * the next real tap. Losing the capture ends the drag by this same route, so
   * a pointer taken away mid-drag cannot leave the card held.
   */
  const endDrag = (
    pointer: PointerEvent<HTMLButtonElement>,
    tapped: boolean,
  ) => {
    const held = grab.current;
    if (!held || held.pointer !== pointer.pointerId) return;
    if (pointer.currentTarget.hasPointerCapture(pointer.pointerId))
      pointer.currentTarget.releasePointerCapture(pointer.pointerId);
    grab.current = null;
    setDragging(false);
    if (tapped && !travelled.current) setOffset(noDragOffset);
  };
  const nudge = (key: KeyboardEvent<HTMLButtonElement>) => {
    if (key.key === 'Enter' || key.key === ' ') {
      key.preventDefault();
      setOffset(noDragOffset);
      return;
    }
    const step = key.shiftKey ? fastNudgeStep : nudgeStep;
    const moves: Record<string, DragOffset> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[key.key];
    if (!move) return;
    key.preventDefault();
    settle((current) => ({ x: current.x + move.x, y: current.y + move.y }));
  };
  const progress = eclipseProgress(event, time);
  const second = Math.floor(time / 1000) * 1000;
  const current = useMemo(
    () => (event.type === 'solar' ? solarCircumstance(second) : null),
    [event.type, second],
  );
  const width = useMemo(
    () => (event.type === 'solar' ? solarPathWidth(second) : null),
    [event.type, second],
  );
  const phaseTime = (ms: number) => {
    const label = utcLabel(ms);
    return label.slice(0, 10) === utcLabel(event.peak).slice(0, 10)
      ? label.slice(11, 19)
      : label.slice(5, 19);
  };
  return (
    <section
      className="eclipse-progress panel"
      aria-label={t('天象进展')}
      data-expanded={expanded}
      data-dragging={dragging}
      ref={card}
      style={{ translate: `${offset.x}px ${offset.y}px` }}
    >
      <div className="eclipse-progress-bar">
        <button
          className="eclipse-progress-grip"
          aria-label={t('移动天象卡片')}
          title={t('拖动移动卡片，点按复位，方向键微调')}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={(pointer) => endDrag(pointer, true)}
          onPointerCancel={(pointer) => endDrag(pointer, false)}
          onLostPointerCapture={(pointer) => endDrag(pointer, false)}
          onKeyDown={nudge}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <button
          className="eclipse-progress-heading"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="eclipse-progress-details"
        >
          <span>
            <strong>
              {t(names[`${event.type}-${event.kind}`])} · {t('进行中')}
            </strong>
            <small>{utcLabel(event.peak).slice(0, 10)} · UTC</small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>
      <Progress value={progress.fraction * 100} aria-label={t('天象进展')} />
      <div className="eclipse-progress-phase">
        <span>{t(progress.stage)}</span>
        <span>{Math.round(progress.fraction * 100)}%</span>
      </div>
      <div className="eclipse-progress-details" id="eclipse-progress-details">
        {current && (
          <dl className="eclipse-circumstances">
            <div>
              <dt>{t('当前影轴位置')}</dt>
              <dd>
                {Math.abs(current.latitude).toFixed(1)}°
                {current.latitude < 0 ? 'S' : 'N'}　
                {Math.abs(current.longitude).toFixed(1)}°
                {current.longitude < 0 ? 'W' : 'E'}
              </dd>
            </div>
            <div>
              <dt>{t('中心处太阳遮掩率')}</dt>
              <dd>{(current.obscuration * 100).toFixed(1)}%</dd>
            </div>
            {width !== null && (
              <div>
                <dt>{t('此处食带宽度约')}</dt>
                <dd>{Math.round(width)} km</dd>
              </div>
            )}
          </dl>
        )}
        <ol className="eclipse-contacts">
          {event.phases.map((phase) => (
            <li key={phase.key} data-past={phase.time <= time}>
              <button
                onClick={() => onSeek(phase.time)}
                aria-label={t('跳到{{phase}}', { phase: t(phase.key) })}
              >
                <span>{t(phase.key)}</span>
                <time dateTime={new Date(phase.time).toISOString()}>
                  {phaseTime(phase.time)}
                </time>
              </button>
            </li>
          ))}
        </ol>
        <p className="eclipse-progress-note">
          {t(
            event.type === 'lunar'
              ? '月食进度为全球阶段；当地能否看到取决于月亮是否在地平线上方。'
              : event.path?.coverage === 'partial'
                ? '浅金色为整场偏食覆盖区，本次没有全食或环食带。'
                : '浅金色为完整全食／环食带，亮点为当前影轴位置。',
          )}
        </p>
        {event.type === 'solar' && (
          <p className="eclipse-progress-note">
            {t('全球进程 · 球形地球近似；各地见食时间不同。')}
          </p>
        )}
        <button className="eclipse-observe" onClick={onObserve}>
          {t('观察此天象')}
        </button>
      </div>
    </section>
  );
}
