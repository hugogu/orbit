'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { model } from 'geomagnetism';
import type { Quaternion } from 'three';
import {
  deviceAttitude,
  requestOrientationPermission,
  type AttitudeReading,
  type OrientationPermission,
} from '../lib/device-attitude';
import type { SkyLocation } from '../lib/sky-events';

export function useDeviceAttitude(active: boolean, location: SkyLocation) {
  const attitude = useRef<Quaternion | null>(null);
  const [status, setStatus] = useState('拖动查看天空');
  const [enabled, setEnabled] = useState(false);
  const [correction, setCorrection] = useState(0);
  const settings = useRef({ location, correction });
  const cleanup = useRef<(() => void) | null>(null);
  const ticket = useRef(0);
  useEffect(() => {
    settings.current = { location, correction };
  }, [location, correction]);
  const stop = useCallback(() => {
    ticket.current++;
    cleanup.current?.();
    cleanup.current = null;
    attitude.current = null;
    setEnabled(false);
    setStatus('拖动查看天空');
  }, []);
  useEffect(() => {
    if (!active) queueMicrotask(stop);
  }, [active, stop]);
  useEffect(
    () => () => {
      ticket.current++;
      cleanup.current?.();
      cleanup.current = null;
      attitude.current = null;
    },
    [],
  );
  async function start() {
    stop();
    const pending = ++ticket.current;
    setStatus('等待朝向感应…');
    setEnabled(true);
    try {
      await requestOrientationPermission(
        window.DeviceOrientationEvent as OrientationPermission | undefined,
        window.isSecureContext,
      );
      if (pending !== ticket.current) return;
      let magnetic: ReturnType<typeof model> | null = null;
      try {
        magnetic = model(new Date());
      } catch {
        /* Expired models require manual heading correction. */
      }
      let lastLocation: SkyLocation | null = null,
        declination = 0,
        received = false;
      const read = (event: DeviceOrientationEvent) => {
        const { location: site, correction: adjustment } = settings.current;
        if (site !== lastLocation) {
          declination =
            magnetic?.point([site.latitude, site.longitude, site.height / 1000])
              .decl ?? 0;
          lastLocation = site;
        }
        const reading = event as DeviceOrientationEvent & AttitudeReading;
        const next = deviceAttitude(
          reading,
          window.screen.orientation?.angle ??
            Number(Reflect.get(window, 'orientation') ?? 0),
          declination,
          adjustment,
        );
        if (!next) return;
        attitude.current = next;
        if (!received) {
          received = true;
          setStatus(
            reading.webkitCompassHeading !== undefined && !magnetic
              ? '地磁模型已过期，请手动校正方位。'
              : '朝向感应已开启',
          );
        }
      };
      window.addEventListener('deviceorientationabsolute', read);
      window.addEventListener('deviceorientation', read);
      const timeout = window.setTimeout(() => {
        if (!received) {
          stop();
          setStatus(
            '未收到可靠的指南针朝向，请远离磁性物体后重试，或拖动查看天空。',
          );
        }
      }, 8000);
      cleanup.current = () => {
        window.clearTimeout(timeout);
        window.removeEventListener('deviceorientationabsolute', read);
        window.removeEventListener('deviceorientation', read);
      };
    } catch (error) {
      if (pending !== ticket.current) return;
      stop();
      setStatus(
        error instanceof Error
          ? error.message
          : '此设备不支持朝向感应，可拖动查看天空。',
      );
    }
  }
  return { attitude, status, enabled, correction, setCorrection, start, stop };
}
