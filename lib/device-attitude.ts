import { Euler, Quaternion, Vector3 } from 'three';

export type AttitudeReading = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

const radians = Math.PI / 180;
const up = new Vector3(0, 1, 0);
const enuToLocal = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -Math.PI / 2,
);

/** One reference frame per sensor session; Safari's Euler angles are relative. */
export class DeviceAttitudeTracker {
  private source: 'compass' | 'absolute' | null = null;
  private northOffset: number | null = null;

  read(
    reading: AttitudeReading,
    screenAngle: number,
    declination = 0,
    correction = 0,
  ) {
    const { alpha, beta, gamma, webkitCompassHeading: heading } = reading;
    if (
      ![alpha, beta, gamma, screenAngle, declination, correction].every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    )
      return null;
    const source =
      heading !== undefined ? 'compass' : reading.absolute ? 'absolute' : null;
    if (!source || (this.source && this.source !== source)) return null;

    // Preserve all three Z-X'-Y'' angles together, including their equivalent
    // branches at the horizon/zenith. Replacing alpha alone breaks that identity.
    const attitude = enuToLocal
      .clone()
      .multiply(
        new Quaternion().setFromEuler(
          new Euler(beta! * radians, gamma! * radians, alpha! * radians, 'ZXY'),
        ),
      );
    if (source === 'compass') {
      const accuracy = reading.webkitCompassAccuracy;
      const reliable =
        typeof heading === 'number' &&
        Number.isFinite(heading) &&
        heading >= 0 &&
        heading < 360 &&
        (accuracy === undefined ||
          (Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 50));
      if (this.northOffset === null) {
        if (!reliable) return null;
        // Safari's compass heading is the Earth-referenced counterpart of
        // Euler alpha, not the horizontal projection of the phone's top edge.
        // Their difference is a yaw offset at any tilt. Lock it once so later
        // magnetic noise cannot turn a stationary sky.
        this.northOffset = -(alpha! + heading) * radians;
      }
      if (this.northOffset === null) return null;
    }
    this.source = source;
    const north =
      source === 'compass' ? this.northOffset! - declination * radians : 0;
    return attitude
      .premultiply(
        new Quaternion().setFromAxisAngle(up, north - correction * radians),
      )
      .multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 0, 1),
          -screenAngle * radians,
        ),
      );
  }
}

/** Frame-rate independent damping on the full rotation, including its roll. */
export function smoothDeviceAttitude(
  current: Quaternion,
  target: Quaternion,
  seconds: number,
) {
  return current.slerp(target, -Math.expm1(-Math.max(0, seconds) / 0.04));
}

export type OrientationPermission = {
  requestPermission?: (absolute?: boolean) => Promise<string>;
};
export async function requestOrientationPermission(
  api: OrientationPermission | undefined,
  secure: boolean,
) {
  if (!secure) throw new Error('朝向感应需要 HTTPS 或本地预览地址。');
  if (!api) throw new Error('此设备不支持朝向感应，可拖动查看天空。');
  if (
    api.requestPermission &&
    (await api.requestPermission(true)) !== 'granted'
  )
    throw new Error('朝向权限被拒绝，请在浏览器设置中允许，或拖动查看天空。');
}
