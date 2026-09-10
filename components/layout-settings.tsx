'use client';

import { useI18n } from '../lib/i18n/provider';
import type { ScaleMode } from '../lib/solar';
import { Switch } from './ui/switch';

export default function LayoutSettings({
  realSizes,
  scale,
  distanceLocked,
  onRealSizesChange,
  onScaleChange,
}: {
  realSizes: boolean;
  scale: ScaleMode;
  distanceLocked: boolean;
  onRealSizesChange: (value: boolean) => void;
  onScaleChange: (value: ScaleMode) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="setting-row">
        <label htmlFor="real-sizes">{t('天体按真实大小比例')}</label>
        <Switch
          id="real-sizes"
          checked={realSizes}
          onCheckedChange={onRealSizesChange}
        />
      </div>
      <div className="setting-row">
        <label htmlFor="scale">{t('距离按真实比例')}</label>
        <Switch
          id="scale"
          checked={scale === 'distance'}
          disabled={distanceLocked}
          onCheckedChange={(value) =>
            onScaleChange(value ? 'distance' : 'illustrated')
          }
        />
      </div>
      <p className="model-note layout-note">
        {t(
          '大小与距离可分别设置；同时开启真实大小和真实距离时，太阳、行星与卫星会使用同一物理尺度。彗核、彗尾和光晕仍为示意。',
        )}
      </p>
      {distanceLocked && (
        <p className="model-note layout-note">
          {t('当前专题使用固定距离模式；返回自由探索后恢复你的偏好。')}
        </p>
      )}
    </>
  );
}
