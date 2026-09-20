/**
 * Where a floating card sits relative to the corner its stylesheet pins it to.
 * A translation rather than absolute coordinates, so the card keeps whichever
 * anchor the current breakpoint gives it and survives rotation and resizing.
 */
export type DragOffset = { x: number; y: number };

export const noDragOffset: DragOffset = { x: 0, y: 0 };

/** A card's visible rectangle, as `getBoundingClientRect` reports it. */
export type DragBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** The offsets a card may hold while staying inside the viewport. */
export type DragBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** Room kept between the card and the edge of the screen. */
const defaultMargin = 8;

/**
 * Turn a measured card into the range of offsets that keep it on screen. The
 * box is where the card sits under `applied`, so each edge's room is measured
 * from that same offset instead of from an untranslated position that is never
 * rendered.
 */
export function dragBounds(
  box: DragBox,
  applied: DragOffset,
  viewport: { width: number; height: number },
  margin = defaultMargin,
): DragBounds {
  return {
    minX: margin - box.left + applied.x,
    maxX: viewport.width - margin - box.right + applied.x,
    minY: margin - box.top + applied.y,
    maxY: viewport.height - margin - box.bottom + applied.y,
  };
}

/**
 * Hold an offset inside its bounds. A card larger than the room left has no
 * valid range at all; it stays pinned to its start edge, which is where its
 * heading and controls are, rather than flipping to the far edge.
 */
export function clampDragOffset(
  offset: DragOffset,
  bounds: DragBounds,
): DragOffset {
  const axis = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));
  return {
    x: axis(offset.x, bounds.minX, bounds.maxX),
    y: axis(offset.y, bounds.minY, bounds.maxY),
  };
}

/** Whether two offsets describe the same position, to the pixel React renders. */
export function sameDragOffset(a: DragOffset, b: DragOffset) {
  return a.x === b.x && a.y === b.y;
}
