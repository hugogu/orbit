import { calculateEclipseList, type EclipseQuery } from '../lib/sky-events';
import { calculatePlanetEvents } from '../lib/planet-events';
self.onmessage = (event: MessageEvent<EclipseQuery>) => {
  try {
    self.postMessage({
      result: {
        ...calculateEclipseList(event.data),
        ...calculatePlanetEvents(event.data),
      },
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : '暂时无法计算，请调整日期后重试。',
    });
  }
};
