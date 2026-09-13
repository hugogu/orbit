'use client';
import { useEffect, useState } from 'react';
// Vite's ?worker transform supplies the constructor at build time.
// oxlint-disable-next-line import/default
import EclipseWorker from '../workers/eclipse-progress.worker?worker';
import { DAY_MS } from '../lib/simulation-time';
import {
  eventAtTime,
  type EclipseProgressEvent,
} from '../lib/eclipse-progress';

export function useEclipseProgress(time: number | null) {
  const day = time === null ? null : Math.floor(time / DAY_MS) * DAY_MS;
  const [result, setResult] = useState<{
    day: number;
    events: EclipseProgressEvent[];
    error?: boolean;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (day === null) return;
    let worker: Worker | undefined;
    let disposed = false;
    const fail = () => {
      worker?.terminate();
      if (!disposed) setResult({ day, events: [], error: true });
    };
    // Debounce fast multi-day playback; calculations run off the rendering thread.
    const timer = window.setTimeout(() => {
      try {
        worker = new EclipseWorker();
        worker.onmessage = ({ data }) => {
          if (!disposed && day === data.day) setResult(data);
          worker?.terminate();
        };
        worker.onerror = fail;
        worker.postMessage({ day });
      } catch {
        fail();
      }
    }, 120);
    return () => {
      disposed = true;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [day, retry]);
  // An event may cross midnight. Keep its already-computed path while the next
  // day's worker is pending, but never show an old event after a time jump.
  const event = time === null ? null : eventAtTime(result?.events ?? [], time);
  return {
    event,
    error: result?.day === day && !!result.error,
    retry: () => setRetry((n) => n + 1),
  };
}
