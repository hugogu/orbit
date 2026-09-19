import { calculateEclipseList, type EclipseQuery } from '../lib/sky-events';
self.onmessage = (event: MessageEvent<EclipseQuery>) => {
  try {
    self.postMessage({ result: calculateEclipseList(event.data) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : '暂时无法计算，请调整日期后重试。',
    });
  }
};
