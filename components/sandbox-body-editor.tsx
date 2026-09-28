'use client';
import { useState } from 'react';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import { Slider } from '@/components/ui/slider';
import {
  centreOf,
  escapeSpeedAt,
  fieldPosition,
  fieldSpec,
  fieldValue,
  readField,
  referenceBody,
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
import { auToKm, kmToAu } from '@/lib/sandbox/scenario';
import { SOLAR_MASS_KG } from '@/lib/sandbox/physics';
import { AU_KM } from '@/lib/eclipse-shadows';
import type { SandboxRun } from '@/lib/sandbox/run';
import { formatReading as format } from '@/lib/sandbox/view';

/** Slider steps across a field's whole range. */
const STEPS = 1000;

export default function SandboxBodyEditor({
  run,
  selected,
  onChange,
  onReset,
  compact = false,
  onBack,
  onMore,
}: {
  run: SandboxRun;
  selected: string;
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
  // A moon is read from its planet while the planet holds it, and everything
  // else, a moon that has left included, from the heaviest body; the orbit
  // figures below are measured against the same one.
  const planet = run.planetOf(selected);
  const moon = !!planet;
  const centre = referenceBody(run.variant, planet);
  const point = run.variant.find((body) => body.id === selected);
  const shadow = run.baseline.find((body) => body.id === selected);
  const orbit =
    point && centre && point !== centre ? orbitState(point, centre) : null;
  const divergence =
    point && shadow
      ? Math.hypot(
          ...point.position.map((value, axis) => value - shadow.position[axis]),
        )
      : null;
  // Distance and speed are read from that body as it is now.
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
            {format(value * (field.scale ?? 1), field.precision, locale)}
            <small>{t(field.unit)}</small>
          </strong>
        </label>
        <Slider
          aria-label={t(field.label)}
          min={0}
          max={STEPS}
          step={1}
          value={[Math.round(fieldPosition(field, value) * STEPS)]}
          onValueChange={(next) => {
            setDraft({
              field: field.id,
              value: fieldValue(
                field,
                (Array.isArray(next) ? next[0] : next) / STEPS,
              ),
            });
          }}
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

  const dynamical = sandboxFields
    .filter((f) => f.kind === 'dynamical' && !(isCentre && f.fromCentre))
    .map((f) => fieldSpec(f.id, moon));
  const appearance = sandboxFields.filter((f) => f.kind === 'appearance');
  const escape = escapeSpeedAt(
    read('distance'),
    (centre?.mass ?? 1) * SOLAR_MASS_KG,
  );
  // The fields switch from a planet's terms to the Sun's the moment a moon is
  // no longer its planet's, which is worth saying where they change.
  const formerPlanet =
    spec.parentId && !planet
      ? run.facts.find((body) => body.id === spec.parentId)
      : undefined;
  const carriesMoons = run.variant.some(
    (body) => run.planetOf(body.id) === selected,
  );
  const centreNote = isCentre ? (
    <p className="sandbox-note">
      {t('其他天体的距离与速度都从中心天体量起，所以它自身没有这两项。')}
    </p>
  ) : formerPlanet ? (
    <p className="sandbox-note">
      {t('它已不再绕{{planet}}运行，距离与速度改从中心天体量起。', {
        planet: t(formerPlanet.name),
      })}
    </p>
  ) : carriesMoons ? (
    <p className="sandbox-note">
      {t('调整行星的轨道距离或速度时，仍绕它运行的卫星会一同移动。')}
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
                  : moon
                    ? t('{{value}} 天', {
                        value: format(orbit.period, 2, locale),
                      })
                    : t('{{value}} 年', {
                        value: format(orbit.period / 365.25, 2, locale),
                      })}
              </dd>
            </div>
            <div>
              <dt>{t(moon ? '近点 / 远点' : '近日点 / 远日点')}</dt>
              {/* A moon's orbit is thousands of kilometres across, which two
                  decimals of an AU would round away to nothing. */}
              <dd>
                {format(
                  orbit.perihelion * (moon ? AU_KM : 1),
                  moon ? 0 : 2,
                  locale,
                )}{' '}
                /{' '}
                {orbit.aphelion === null
                  ? '∞'
                  : format(
                      orbit.aphelion * (moon ? AU_KM : 1),
                      moon ? 0 : 2,
                      locale,
                    )}{' '}
                {t(moon ? 'km' : 'AU')}
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
