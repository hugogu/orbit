'use client';
import { useState } from 'react';
import { FlaskConical, Plus, RotateCcw, X } from 'lucide-react';
import type { Translate } from '../lib/i18n';
import { useI18n } from '../lib/i18n/provider';
import type { SandboxEvent, SandboxRun } from '../lib/sandbox/run';
import type { SandboxScenario } from '../lib/sandbox/scenario';
import type { NewBody } from '../lib/sandbox/edits';
import { elapsedLabel } from '../lib/sandbox/view';

/** Starting points for a body the viewer creates, in kilograms and kilometres. */
const templates: { label: string; mass: number; radius: number }[] = [
  { label: '小天体', mass: 1e21, radius: 500 },
  { label: '类地行星', mass: 6e24, radius: 6400 },
  { label: '巨行星', mass: 1.9e27, radius: 70000 },
  { label: '褐矮星', mass: 4e28, radius: 80000 },
];
const palette = ['#7fd4ff', '#ffb37f', '#b6ff9c', '#ff9cc7', '#d4b6ff'];

function eventLabel(
  event: SandboxEvent,
  name: (id: string) => string,
  t: Translate,
) {
  return event.kind === 'escape'
    ? t('{{name}} 已脱离系统', { name: name(event.id) })
    : t('{{absorbed}} 并入 {{into}}', {
        absorbed: name(event.absorbed),
        into: name(event.into),
      });
}

export default function SandboxPanel({
  scenario,
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
  scenario: SandboxScenario | null;
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
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [template, setTemplate] = useState(1);
  const [distance, setDistance] = useState('3');
  const [name, setName] = useState('');

  if (!scenario || !run)
    return (
      <div className="sandbox-panel">
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
    const spec = scenario.bodies.find((body) => body.id === id);
    return spec ? t(spec.name) : id;
  };
  const recent = run.events.slice(-4).reverse();
  // A body the run has absorbed is gone from the simulation but still listed
  // in the scenario it started from, so the list marks it rather than
  // silently dropping a row the viewer put there.
  const alive = new Set(run.variant.map((body) => body.id));

  return (
    <div className="sandbox-panel">
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
          {scenario.bodies.map((body) => (
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
                        scenario.bodies.filter((body) => !body.sourceId)
                          .length % palette.length
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
        {recent.length === 0 ? (
          <p className="sandbox-quiet">{t('暂未发生变化')}</p>
        ) : (
          <ul>
            {recent.map((event) => (
              <li
                key={`${event.kind}-${event.day}-${
                  event.kind === 'escape' ? event.id : event.absorbed
                }`}
              >
                <span>{eventLabel(event, label, t)}</span>
                <small>{elapsedLabel(event.day, t)}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sandbox-actions">
        <button className="ghost-action" onClick={onRestart}>
          <RotateCcw size={15} />
          {t('重新开始')}
        </button>
        <button className="ghost-action" onClick={onLeave}>
          {t('退出沙盘')}
        </button>
      </div>
    </div>
  );
}
