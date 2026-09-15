export const MIN_ORBIT_LINE_WIDTH = 1;
export const MAX_ORBIT_LINE_WIDTH = 6;
export const ORBIT_LINE_WIDTH_STEP = 0.5;
export const DEFAULT_ORBIT_LINE_WIDTH = 1;

export function isOrbitLineWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_ORBIT_LINE_WIDTH &&
    value <= MAX_ORBIT_LINE_WIDTH &&
    Number.isInteger(value / ORBIT_LINE_WIDTH_STEP)
  );
}
