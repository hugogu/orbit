'use client';
import { Compass } from 'lucide-react';
import { useI18n } from '../lib/i18n/provider';
import ObserverLocation from './observer-location';
import type {
  SkyLocation,
  ObserverLocationSource,
  ChosenLocationSource,
} from '../lib/sky-events';
import type { useDeviceAttitude } from './use-device-attitude';

export default function GroundControls({
  time,
  location,
  source,
  onChange,
  sensor,
  live,
  sandbox = false,
}: {
  time: number;
  location: SkyLocation;
  source: ObserverLocationSource;
  onChange: (location: SkyLocation, source: ChosenLocationSource) => void;
  sensor: ReturnType<typeof useDeviceAttitude>;
  live: boolean;
  sandbox?: boolean;
}) {
  const { t } = useI18n();
  return (
    <section className="ground-controls glass" aria-label={t('地表观星')}>
      <div className="ground-controls-heading">
        <strong>{t('地表观星')}</strong>
        <span>{t(sandbox ? '沙盘天空' : live ? '实时天空' : '模拟天空')}</span>
        <button
          className={`icon-button ${sensor.enabled ? 'active' : ''}`}
          aria-label={t(sensor.enabled ? '关闭朝向感应' : '开启朝向感应')}
          title={t(sensor.enabled ? '关闭朝向感应' : '开启朝向感应')}
          aria-pressed={sensor.enabled}
          onClick={() => (sensor.enabled ? sensor.stop() : void sensor.start())}
        >
          <Compass size={18} />
        </button>
      </div>
      <output className="little-note ground-sensor-status">
        {t(sensor.status)}
      </output>
      {sandbox && (
        <p className="little-note">
          {t('显示沙盘中的天体；返回总览可继续调整参数。')}
        </p>
      )}
      <details>
        <summary>
          {t(
            source === 'fallback' ? '参考位置 · 定位与朝向' : '观测位置与朝向',
          )}
        </summary>
        <ObserverLocation
          time={time}
          location={location}
          source={source}
          onChange={onChange}
        />
        {source === 'fallback' && (
          <p className="little-note">
            {t('当前为北京参考位置，请定位或设置实际观测地点。')}
          </p>
        )}
        {sensor.enabled && (
          <label className="ground-correction">
            {t('方位校正（度）')}
            <input
              type="number"
              min={-180}
              max={180}
              step={0.5}
              value={sensor.correction}
              onChange={(event) => {
                const n = Number(event.target.value);
                if (Number.isFinite(n) && Math.abs(n) <= 180)
                  sensor.setCorrection(n);
              }}
            />
          </label>
        )}
        <p className="little-note">
          {t(
            sandbox
              ? '天空随模拟地球的位置、自转和轴倾角变化，不对应真实星空。自转按模拟时间计算，高流速下可能快于屏幕刷新。'
              : '手机背面朝向要看的天空。可用已知星体微调方位；指南针精度受设备和周围磁场影响。拖动转向，双指或滚轮缩放。',
          )}
        </p>
        <p className="little-note">
          {t(
            '地平线以下不可见；星空保留教学显示，不模拟天气、光污染和大气折射。',
          )}
        </p>
      </details>
    </section>
  );
}
