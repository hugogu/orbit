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
