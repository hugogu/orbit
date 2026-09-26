export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
};
export function currentLocation(
  geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined,
  secure: boolean,
): Promise<LocationFix> {
  if (!secure)
    return Promise.reject(
      new Error('定位需要 HTTPS 或本地预览地址，请使用安全连接。'),
    );
  if (!geolocation)
    return Promise.reject(new Error('此浏览器不支持定位，请手动填写经纬度。'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude, accuracy } = coords;
        if (
          ![latitude, longitude, accuracy].every(Number.isFinite) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180 ||
          accuracy < 0
        ) {
          reject(new Error('设备返回了无效位置，请手动填写经纬度。'));
          return;
        }
        resolve({ latitude, longitude, accuracy });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: '定位权限被拒绝，请在浏览器的网站权限中允许定位，或手动填写经纬度。',
          2: '暂时无法获取位置，请检查系统定位服务，或手动填写经纬度。',
          3: '定位超时，请重试或手动填写经纬度。',
        };
        reject(
          new Error(messages[error.code] ?? '定位失败，请手动填写经纬度。'),
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/**
 * The UTC offset, in hours, that `timeZone` is on at `time`. Daylight saving
 * makes this a property of the instant rather than of the place, so a summer
 * moment and a winter one differ by an hour wherever it applies. Returns
 * undefined when the zone cannot be read, so callers keep what they had.
 */
export function zoneOffsetHours(time: number, timeZone: string) {
  let label: string | undefined;
  try {
    label = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(time)
      .find((part) => part.type === 'timeZoneName')?.value;
  } catch {
    return undefined;
  }
  if (label === 'GMT') return 0;
  const parsed = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(label ?? '');
  if (!parsed) return undefined;
  const hours =
    Number(parsed[2]) + Number(parsed[3]) / 60 + Number(parsed[4] ?? 0) / 3600;
  // The zero the "+0" sign test reads must be positive, not a negated zero.
  return parsed[1] === '-' ? -hours + 0 : hours;
}
