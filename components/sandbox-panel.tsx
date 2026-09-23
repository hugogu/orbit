'use client';
import { useEffect, useRef, useState } from 'react';
import { FlaskConical, LogOut, Plus, RotateCcw, X } from 'lucide-react';
import type { Translate } from '../lib/i18n';
import { useI18n } from '../lib/i18n/provider';
import type { SandboxEvent, SandboxRun } from '../lib/sandbox/run';
import { fieldSpec, type NewBody } from '../lib/sandbox/edits';
import { elapsedLabel, formatReading } from '../lib/sandbox/view';

/** Starting points for a body the viewer creates, in kilograms and kilometres. */
const templates: { label: string; mass: number; radius: number }[] = [
  { label: '小天体', mass: 1e21, radius: 500 },
  { label: '类地行星', mass: 6e24, radius: 6400 },
  { label: '巨行星', mass: 1.9e27, radius: 70000 },
  { label: '褐矮星', mass: 4e28, radius: 80000 },
];
const palette = ['#7fd4ff', '#ffb37f', '#b6ff9c', '#ff9cc7', '#d4b6ff'];
/**
 * Vertical travel that counts as a swipe rather than a tap. Below it the
 * gesture falls through to the button's own click, which is what keeps the
 * handle working from a keyboard as well as a finger.
 */
const SWIPE_PX = 24;
/** The most entries the event log holds; a wild run can produce far more. */
const MAX_LOGGED_EVENTS = 100;
/** How near the foot of the log still counts as following it. */
const FOLLOW_SLACK_PX = 8;

function eventLabel(
  event: SandboxEvent,
  name: (id: string) => string,
  t: Translate,
) {
  switch (event.kind) {
    case 'escape':
      return t('{{name}} 已脱离系统', { name: name(event.id) });
    case 'collision':
      return t('{{absorbed}} 并入 {{into}}', {
        absorbed: name(event.absorbed),
        into: name(event.into),
      });
    case 'add':
      return t('{{name}} 加入系统', { name: name(event.id) });
    case 'remove':
      return t('{{name}} 已移除', { name: name(event.id) });
    case 'set':
      return t('{{name}} {{field}}已调整', {
        name: name(event.id),
        field: t(fieldSpec(event.field).label),
      });
  }
}

/** The before and after of a changed value, read the way the editor shows it. */
function changeDetail(
  event: Extract<SandboxEvent, { kind: 'set' }>,
  t: Translate,
  locale: string,
) {
  const spec = fieldSpec(event.field);
  const reading = (value: number) =>
    formatReading(value, spec.precision, locale);
  // Held to its number, so a narrow panel never strands the unit on its own.
  return `${reading(event.from)} → ${reading(event.to)}\u00a0${t(spec.unit)}`;
}

export default function SandboxPanel({
  run,
  selected,
  baseline,
  trails,
  onEnter,
  onLeave,
  onRestart,
  onSelect,
  onRemove,
  onAdd,
  onBaselineChange,
  onTrailsChange,
}: {
  run: SandboxRun | null;
  selected: string | null;
  baseline: boolean;
  trails: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onRestart: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (body: NewBody) => void;
  onBaselineChange: (value: boolean) => void;
  onTrailsChange: (value: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const [adding, setAdding] = useState(false);
  const [template, setTemplate] = useState(1);
  const [distance, setDistance] = useState('3');
  const [name, setName] = useState('');
  // On a phone the panel covers the sky it exists to explain, so it folds
  // down to its handle. The state lives here because only that layout uses
  // it; a wide screen has room for the whole panel and ignores it.
  const [collapsed, setCollapsed] = useState(false);
  const swipe = useRef({ from: 0, handled: false });
  // The event list reads like any log: oldest first, each new entry at the
  // foot. Listing newest first slid every row down by one whenever something
  // happened, so nothing stayed still long enough to read. Now a row never
  // moves once written, and the view follows the newest entry only while the
  // viewer is already at the bottom — scrolling back to read an older one is
  // not undone by the next event.
  const log = useRef<HTMLUListElement>(null);
  const following = useRef(true);
  const eventCount = run?.events.length ?? 0;
  // A new run starts a new log, followed from its first entry however far
  // back the viewer had scrolled in the last one.
  useEffect(() => {
    following.current = true;
  }, [run]);
  useEffect(() => {
    const list = log.current;
    if (list && following.current) list.scrollTop = list.scrollHeight;
  }, [eventCount]);

  const handle = (
    <button
      className="sandbox-handle"
      aria-expanded={!collapsed}
      aria-label={t(collapsed ? '展开沙盘面板' : '收起沙盘面板')}
      title={t(collapsed ? '展开沙盘面板' : '收起沙盘面板')}
      onPointerDown={(event) => {
        swipe.current = { from: event.clientY, handled: false };
      }}
      onPointerUp={(event) => {
        const travelled = event.clientY - swipe.current.from;
        if (Math.abs(travelled) < SWIPE_PX) return;
        // A swipe says which way to go; a tap only toggles.
        swipe.current.handled = true;
        setCollapsed(travelled > 0);
      }}
      onClick={() => {
        if (swipe.current.handled) {
          swipe.current.handled = false;
          return;
        }
        setCollapsed((value) => !value);
      }}
    >
      <span className="sandbox-grip" aria-hidden="true" />
      {collapsed && run && <em>{elapsedLabel(run.elapsedDays, t)}</em>}
    </button>
  );

  if (!run)
    return (
      <div className="sandbox-panel" data-collapsed={collapsed}>
        {handle}
        <p className="sandbox-intro">
          {t(
            '从当前模拟时刻分叉，用牛顿万有引力逐步积分。质量与速度真正参与受力计算，天体可以被抛出、被俘获或相撞。',
          )}
        </p>
        <button className="primary-action" onClick={onEnter}>
          {t('进入沙盘')}
          <FlaskConical size={17} />
        </button>
      </div>
    );

  const label = (id: string) => {
    const spec = run.facts.find((body) => body.id === id);
    return spec ? t(spec.name) : id;
  };
  const history = run.events.slice(-MAX_LOGGED_EVENTS);
  // Where the shown part of the log starts within the whole: the log only
  // ever grows, so an entry's place in it is a key that never changes hands.
  const firstShown = run.events.length - history.length;
  // A body the run has absorbed is gone from the simulation but still listed
  // in the scenario it started from, so the list marks it rather than
  // silently dropping a row the viewer put there.
  const alive = new Set(run.variant.map((body) => body.id));

  return (
    <div className="sandbox-panel" data-collapsed={collapsed}>
      {handle}
      <dl className="sandbox-readout">
        <div>
          <dt>{t('已运行')}</dt>
          <dd>{elapsedLabel(run.elapsedDays, t)}</dd>
        </div>
        <div>
          <dt>{t('积分步长')}</dt>
          <dd>{t('{{value}} 天', { value: run.step.toFixed(3) })}</dd>
        </div>
        <div>
          <dt>{t('能量漂移')}</dt>
          <dd>{(run.energyDrift * 100).toExponential(1)}%</dd>
        </div>
      </dl>
      {run.throttled && (
        <p className="sandbox-note">
          {t('设备跟不上所选流速，演算正在放慢。步长不变，精度不受影响。')}
        </p>
      )}

      <div className="sandbox-toggles">
        <label>
          <input
            type="checkbox"
            checked={baseline}
            onChange={(event) => onBaselineChange(event.target.checked)}
          />
          {t('对照原始轨迹')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={trails}
            onChange={(event) => onTrailsChange(event.target.checked)}
          />
          {t('显示轨迹')}
        </label>
      </div>

      <div className="sandbox-bodies">
        <h3>{t('天体列表')}</h3>
        <ul>
          {run.facts.map((body) => (
            <li key={body.id} data-gone={!alive.has(body.id)}>
              <button
                className={`sandbox-body${body.id === selected ? ' active' : ''}`}
                onClick={() => onSelect(body.id)}
              >
                <i style={{ background: body.color }} aria-hidden="true" />
                <span>{t(body.name)}</span>
              </button>
              <button
                className="sandbox-remove"
                aria-label={t('移除{{name}}', { name: t(body.name) })}
                title={t('移除{{name}}', { name: t(body.name) })}
                onClick={() => onRemove(body.id)}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
        {adding ? (
          <div className="sandbox-add">
            <label>
              {t('名称')}
              <input
                value={name}
                placeholder={t('新天体')}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="sandbox-templates">
              {templates.map((item, index) => (
                <button
                  key={item.label}
                  className={index === template ? 'active' : ''}
                  onClick={() => setTemplate(index)}
                >
                  {t(item.label)}
                </button>
              ))}
            </div>
            <label>
              {t('日心距离')}
              <input
                type="number"
                min="0.02"
                max="120"
                step="0.1"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
            </label>
            <div className="sandbox-actions">
              <button
                className="primary-action"
                onClick={() => {
                  const chosen = templates[template];
                  onAdd({
                    name: name.trim() || t('新天体'),
                    mass: chosen.mass,
                    radius: chosen.radius,
                    distance: Number(distance) || 3,
                    color:
                      palette[
                        run.facts.filter((body) => !body.sourceId).length %
                          palette.length
                      ],
                  });
                  setAdding(false);
                  setName('');
                }}
              >
                {t('添加')}
              </button>
              <button className="ghost-action" onClick={() => setAdding(false)}>
                {t('取消')}
              </button>
            </div>
          </div>
        ) : (
          <button className="ghost-action" onClick={() => setAdding(true)}>
            <Plus size={15} />
            {t('添加天体')}
          </button>
        )}
      </div>

      <div className="sandbox-events">
        <h3>{t('最近事件')}</h3>
        {history.length === 0 ? (
          <p className="sandbox-quiet">{t('暂未发生变化')}</p>
        ) : (
          <ul
            ref={log}
            onScroll={(event) => {
              const list = event.currentTarget;
              following.current =
                list.scrollHeight - list.scrollTop - list.clientHeight <
                FOLLOW_SLACK_PX;
            }}
          >
            {history.map((event, index) => (
              <li key={firstShown + index} data-kind={event.kind}>
                <span>{eventLabel(event, label, t)}</span>
                <small>{elapsedLabel(event.day, t)}</small>
                {event.kind === 'set' && (
                  <em>{changeDetail(event, t, locale)}</em>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sandbox-actions">
        <button
          className="ghost-action"
          aria-label={t('重新开始')}
          title={t('重新开始')}
          onClick={onRestart}
        >
          <RotateCcw size={15} />
          {t('重置')}
        </button>
        <button className="ghost-action" onClick={onLeave}>
          <LogOut size={15} />
          {t('退出')}
        </button>
      </div>
    </div>
  );
}
