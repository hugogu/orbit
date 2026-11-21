import { useSyncExternalStore } from 'react';

// Match the breakpoints that hide .info-panel in globals.css.
const query =
  '(max-width: 900px), (orientation: landscape) and (max-height: 600px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

export function useBodyDetailsSheet() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
