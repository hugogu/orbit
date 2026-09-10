/** Avoid layout/accessibility mutations for invisible or subpixel label motion. */
export function createSceneLabel(label: HTMLElement, offset = -100) {
  let previousDisplay = '';
  let previousTransform = '';
  let previousSelected: boolean | undefined;
  return (
    point: { x: number; y: number; z: number },
    width: number,
    height: number,
    enabled: boolean,
    selected = false,
  ) => {
    const visible =
      enabled &&
      Math.abs(point.z) < 1 &&
      Math.abs(point.x) < 0.97 &&
      Math.abs(point.y) < 0.94;
    const display = visible ? 'block' : 'none';
    if (display !== previousDisplay) {
      label.style.display = display;
      previousDisplay = display;
    }
    if (!visible) return;
    const x = ((point.x * 0.5 + 0.5) * width).toFixed(1);
    const y = ((-point.y * 0.5 + 0.5) * height).toFixed(1);
    const transform = `translate(-50%,${offset}%) translate(${x}px,${y}px)`;
    if (transform !== previousTransform) {
      label.style.transform = transform;
      previousTransform = transform;
    }
    if (selected !== previousSelected) {
      label.classList.toggle('selected', selected);
      previousSelected = selected;
    }
  };
}
