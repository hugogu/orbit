import type { ScaleMode } from './solar';

type CameraNavigation = {
  selected: string | null;
  reset: number;
  view: number;
  top: boolean;
  scale: ScaleMode;
  realSizes: boolean;
  systemView: boolean;
};

/** Only navigation requests start a flight; viewport changes keep the pose. */
export function cameraNavigationChanged(
  previous: CameraNavigation | null,
  current: CameraNavigation,
): boolean {
  return (
    !previous ||
    current.selected !== previous.selected ||
    current.reset !== previous.reset ||
    current.view !== previous.view ||
    current.top !== previous.top ||
    current.scale !== previous.scale ||
    current.realSizes !== previous.realSizes ||
    current.systemView !== previous.systemView
  );
}
