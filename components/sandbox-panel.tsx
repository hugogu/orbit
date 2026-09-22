'use client';
import { FlaskConical, RotateCcw } from 'lucide-react';
import type { Translate } from '../lib/i18n';
import { useI18n } from '../lib/i18n/provider';
import type { SandboxEvent, SandboxRun } from '../lib/sandbox/run';
import { elapsedLabel } from '../lib/sandbox/view';

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
  run,
  active,
  baseline,
  trails,
  onEnter,
  onLeave,
  onRestart,
  onBaselineChange,
  onTrailsChange,
}: {
  run: SandboxRun | null;
  active: boolean;
  baseline: boolean;
  trails: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onRestart: () => void;
  onBaselineChange: (value: boolean) => void;
  onTrailsChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const name = (id: string) => {
    const spec = run?.scenario.bodies.find((body) => body.id === id);
    return spec ? t(spec.name) : id;
  };
  const recent = run ? run.events.slice(-4).reverse() : [];

  return (
    <div className="sandbox-panel">
      <p className="sandbox-intro">
        {t(
          '从当前模拟时刻分叉，用牛顿万有引力逐步积分。质量与速度真正参与受力计算，天体可以被抛出、被俘获或相撞。',
        )}
      </p>
      {!active ? (
        <button className="primary-action" onClick={onEnter}>
          {t('进入沙盘')}
          <FlaskConical size={17} />
        </button>
      ) : (
        <>
          <dl className="sandbox-readout">
            <div>
              <dt>{t('已运行')}</dt>
              <dd>{elapsedLabel(run?.elapsedDays ?? 0, t)}</dd>
            </div>
            <div>
              <dt>{t('积分步长')}</dt>
              <dd>
                {t('{{value}} 天', { value: (run?.step ?? 0).toFixed(3) })}
              </dd>
            </div>
            <div>
              <dt>{t('能量漂移')}</dt>
              <dd>{((run?.energyDrift ?? 0) * 100).toExponential(1)}%</dd>
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
                    <span>{eventLabel(event, name, t)}</span>
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
        </>
      )}
    </div>
  );
}
