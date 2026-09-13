import { calculateEclipsesForDay } from '../lib/eclipse-progress';

self.onmessage = ({ data }: MessageEvent<{ day: number }>) => {
  try {
    const events = calculateEclipsesForDay(data.day);
    self.postMessage(
      { day: data.day, events },
      {
        transfer: events.flatMap((event) =>
          event.path ? [event.path.triangles.buffer] : [],
        ),
      },
    );
  } catch {
    self.postMessage({ day: data.day, error: true });
  }
};
