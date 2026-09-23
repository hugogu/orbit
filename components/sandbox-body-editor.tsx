'use client';
import { useState } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import { Slider } from '@/components/ui/slider';
import {
  centralBody,
  centreOf,
  escapeSpeedAt,
  fieldPosition,
  fieldValue,
  readField,
  sandboxFields,
  type FieldSpec,
  type SandboxField,
} from '@/lib/sandbox/edits';
import {
  density,
  escapeVelocity,
  orbitState,
  surfaceGravity,
} from '@/lib/sandbox/derived';
import { spinIsSlowed } from '@/lib/sandbox/display';
import { auToKm, kmToAu } from '@/lib/sandbox/scenario';
import { SOLAR_MASS_KG } from '@/lib/sandbox/physics';
import type { SandboxRun } from '@/lib/sandbox/run';
import { formatReading as format } from '@/lib/sandbox/view';

/** Slider steps across a field's whole range. */
const STEPS = 1000;

export default function SandboxBodyEditor({
  run,
  selected,
  daysPerSecond,
  onChange,
  onReset,
  compact = false,
  onBack,
  onMore,
}: {
  run: SandboxRun;
  selected: string;
  /** The live time rate, which sets how fast the rotation can be shown. */
  daysPerSecond: number;
  onChange: (field: SandboxField, value: number) => void;
  onReset: () => void;
  /**
   * Only the fields that enter the force law, under a one-line header: the
   * form a phone keeps in reach while the sky stays in view.
   */
  compact?: boolean;
  /** Leaves the editor for the panel it replaced, in the compact form. */
  onBack?: () => void;
  /** Opens every field and reading, in the compact form. */
  onMore?: () => void;
}) {
  const { t, locale } = useI18n();
  // While a thumb is held the reading follows the drag; the run only restarts
  // once the viewer lets go, so a sweep does not replay the fork every frame.
  const [draft, setDraft] = useState<{
    field: SandboxField;
    value: number;
  } | null>(null);
  // Read live rather than from the recipe: a run keeps going while it is
  // edited, so the panel has to show where the body is now, not where it set out.
  const spec = run.liveSpec(selected);
  if (!spec) return null;
  const centre = centralBody(run.variant);
  const point = run.variant.find((body) => body.id === selected);
  const shadow = run.baseline.find((body) => body.id === selected);
  const central = centre;
  const orbit =
    point && central && point !== central ? orbitState(point, central) : null;
  const divergence =
    point && shadow
      ? Math.hypot(
          ...point.position.map((value, axis) => value - shadow.position[axis]),
        )
      : null;
  // Distance and speed are read from the central body as it is now, which is
  // what the orbit figures below are measured against too.
  const frame = centreOf(centre);
  const isCentre = spec.id === centre?.id;
  const read = (field: SandboxField) =>
    draft?.field === field ? draft.value : readField(spec, field, frame);

  const control = (field: FieldSpec) => {
    const value = read(field.id);
    return (
      <div className="sandbox-field" key={field.id}>
        <label>
          <span>{t(field.label)}</span>
          <strong>
            {format(value, field.precision, locale)}
            <small>{t(field.unit)}</small>
          </strong>
        </label>
        <Slider
          aria-label={t(field.label)}
          min={0}
          max={STEPS}
          step={1}
          value={[Math.round(fieldPosition(field, value) * STEPS)]}
          onValueChange={(next) =>
            setDraft({
              field: field.id,
              value: fieldValue(
                field,
                (Array.isArray(next) ? next[0] : next) / STEPS,
              ),
            })
          }
          onValueCommitted={(next) => {
            setDraft(null);
            onChange(
              field.id,
              fieldValue(field, (Array.isArray(next) ? next[0] : next) / STEPS),
            );
          }}
        />
      </div>
    );
  };

  const dynamical = sandboxFields.filter(
    (f) => f.kind === 'dynamical' && !(isCentre && f.fromCentre),
  );
  const appearance = sandboxFields.filter((f) => f.kind === 'appearance');
  const escape = escapeSpeedAt(
    read('distance'),
    (centre?.mass ?? 1) * SOLAR_MASS_KG,
  );
  const centreNote = isCentre ? (
    <p className="sandbox-note">
      {t('其他天体的距离与速度都从中心天体量起，所以它自身没有这两项。')}
    </p>
  ) : null;

  if (compact)
    return (
      <div className="sandbox-editor" data-compact="true">
        <div className="sandbox-editor-head">
          <button
            className="sandbox-icon-button"
            aria-label={t('返回沙盘')}
            title={t('返回沙盘')}
            onClick={onBack}
          >
            <ChevronLeft size={16} />
          </button>
          <h3>{t(spec.name)}</h3>
          {spec.sourceId && (
            <button
              className="sandbox-icon-button"
              aria-label={t('恢复真实数值')}
              title={t('恢复真实数值')}
              onClick={onReset}
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button className="ghost-action" onClick={onMore}>
            {t('全部参数')}
          </button>
        </div>
        {centreNote}
        {dynamical.map(control)}
      </div>
    );

  return (
    <div className="sandbox-editor">
      <div className="sandbox-editor-head">
        <h3>{t(spec.name)}</h3>
        {spec.sourceId && (
          <button className="ghost-action" onClick={onReset}>
            <RotateCcw size={14} />
            {t('恢复真实数值')}
          </button>
        )}
      </div>
      <p className="sandbox-note">
        {t('改动立即在当前时刻生效，已经走过的路径会保留下来。')}
      </p>

      <h4 className="sandbox-group">{t('参与引力计算')}</h4>
      {centreNote}
      {dynamical.map(control)}
      {!isCentre && (
        <p className="sandbox-note">
          {t('在此距离上，逃逸速度约为 {{value}} km/s。', {
            value: format(escape, 1, locale),
          })}
        </p>
      )}

      <h4 className="sandbox-group">{t('仅影响外观')}</h4>
      <p className="sandbox-note">
        {t('点质量模型中，自转与倾角不产生引力效应。')}
      </p>
      {appearance.map(control)}
      {spinIsSlowed(read('spinDays'), daysPerSecond) && (
        <p className="sandbox-note">
          {t(
            '当前时间流速下，真实自转已快过画面刷新，屏幕上的转动按比例放慢显示。',
          )}
        </p>
      )}

      <h4 className="sandbox-group">{t('实时读数')}</h4>
      <dl className="sandbox-readout">
        <div>
          <dt>{t('平均密度')}</dt>
          <dd>
            {format(density(spec.mass, spec.radius), 2, locale)} {t('g/cm³')}
          </dd>
        </div>
        <div>
          <dt>{t('赤道引力加速度')}</dt>
          <dd>
            {format(surfaceGravity(spec.mass, spec.radius), 2, locale)}{' '}
            {t('m/s²')}
          </dd>
        </div>
        <div>
          <dt>{t('逃逸速度')}</dt>
          <dd>
            {format(escapeVelocity(spec.mass, spec.radius), 2, locale)}{' '}
            {t('km/s')}
          </dd>
        </div>
        {orbit && (
          <>
            <div>
              <dt>{t('偏心率')}</dt>
              <dd>
                {/* Whether a body has left is the run's verdict, measured
                    against the whole system; this orbit is against the
                    central body alone and can open up without that. */}
                {run.escaped.has(selected)
                  ? t('已脱离')
                  : format(orbit.eccentricity, 3, locale)}
              </dd>
            </div>
            <div>
              <dt>{t('轨道周期')}</dt>
              <dd>
                {orbit.period === null
                  ? '—'
                  : t('{{value}} 年', {
                      value: format(orbit.period / 365.25, 2, locale),
                    })}
              </dd>
            </div>
            <div>
              <dt>{t('近日点 / 远日点')}</dt>
              <dd>
                {format(orbit.perihelion, 2, locale)} /{' '}
                {orbit.aphelion === null
                  ? '∞'
                  : format(orbit.aphelion, 2, locale)}{' '}
                {t('AU')}
              </dd>
            </div>
          </>
        )}
        {divergence !== null && (
          <div className="sandbox-divergence">
            <dt>{t('与原始轨迹偏离')}</dt>
            <dd>
              {divergence < kmToAu(1000)
                ? t('{{value}} km', {
                    value: format(auToKm(divergence), 0, locale),
                  })
                : t('{{value}} AU', { value: format(divergence, 3, locale) })}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
