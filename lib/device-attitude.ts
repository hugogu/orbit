import { Euler, Quaternion, Vector3 } from 'three';

export type AttitudeReading = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

/** W3C Z-X'-Y'' device angles, mapped from ENU into local east/up/south. */
export function deviceAttitude(
  reading: AttitudeReading,
  screenAngle: number,
  declination = 0,
  correction = 0,
) {
  const {
    alpha,
    beta,
    gamma,
    webkitCompassHeading: heading,
    webkitCompassAccuracy: accuracy,
  } = reading;
  if (
    ![alpha, beta, gamma, screenAngle, declination, correction].every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  )
    return null;
  const compass =
    typeof heading === 'number' &&
    Number.isFinite(heading) &&
    heading >= 0 &&
    heading < 360;
  if (
    compass &&
    accuracy !== undefined &&
    (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50)
  )
    return null;
  if (!compass && !reading.absolute) return null;
  const radians = Math.PI / 180;
  // Safari reports magnetic heading; absolute W3C events use the Earth frame.
  const yaw = (compass ? 360 - heading - declination : alpha!) - correction;
  return new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
    .multiply(
      new Quaternion().setFromEuler(
        new Euler(beta! * radians, gamma! * radians, yaw * radians, 'ZXY'),
      ),
    )
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        -screenAngle * radians,
      ),
    );
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
