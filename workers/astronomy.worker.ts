import { calculateSkyEvents, type SkyQuery } from '../lib/sky-events';
self.onmessage = (event: MessageEvent<SkyQuery>) => {
  try {
    self.postMessage({ result: calculateSkyEvents(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : '暂时无法计算，请调整日期后重试。',
    });
  }
};
