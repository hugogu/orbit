import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDragOffset,
  dragBounds,
  noDragOffset,
  sameDragOffset,
  settleDragOffset,
  type DragBox,
} from '../lib/drag-offset';

const viewport = { width: 375, height: 812 };
/** A collapsed card parked in the bottom-right corner of a phone. */
const parked: DragBox = { left: 111, top: 614, right: 363, bottom: 704 };

void test('a card measured where it sits keeps the room left on every side', () => {
  const bounds = dragBounds(parked, noDragOffset, viewport);
  assert.deepEqual(bounds, {
    minX: 8 - 111,
    maxX: 375 - 8 - 363,
    minY: 8 - 614,
    maxY: 812 - 8 - 704,
  });
  // Dragged one corner's worth to the left, the same card has that much more
  // room to its right and that much less to its left.
  const moved = dragBounds(
    { ...parked, left: 11, right: 263 },
    { x: -100, y: 0 },
    viewport,
  );
  assert.equal(moved.minX, bounds.minX);
  assert.equal(moved.maxX, bounds.maxX);
});

void test('a drag past the edge stops at the margin instead of leaving the screen', () => {
  const bounds = dragBounds(parked, noDragOffset, viewport);
  const held = clampDragOffset({ x: -400, y: -900 }, bounds);
  assert.deepEqual(held, { x: -103, y: -606 });
  // The card now sits exactly one margin from the top-left corner.
  assert.equal(parked.left + held.x, 8);
  assert.equal(parked.top + held.y, 8);
  const far = clampDragOffset({ x: 900, y: 900 }, bounds);
  assert.equal(parked.right + far.x, viewport.width - 8);
  assert.equal(parked.bottom + far.y, viewport.height - 8);
});

void test('a drag within reach is left exactly where it was put', () => {
  const bounds = dragBounds(parked, noDragOffset, viewport);
  assert.deepEqual(clampDragOffset({ x: -40, y: -200 }, bounds), {
    x: -40,
    y: -200,
  });
});

void test('a card taller than the screen pins its heading, not its foot', () => {
  const tall: DragBox = { left: 111, top: 20, right: 363, bottom: 900 };
  const bounds = dragBounds(tall, noDragOffset, { width: 375, height: 500 });
  assert.ok(bounds.minY > bounds.maxY, 'no offset can satisfy both edges');
  for (const y of [-900, 0, 900]) {
    const held = clampDragOffset({ x: 0, y }, bounds);
    assert.equal(tall.top + held.y, 8);
  }
});

void test('an offset that did not move is recognized, so a fit does not re-render', () => {
  assert.ok(sameDragOffset(noDragOffset, { x: 0, y: 0 }));
  assert.ok(!sameDragOffset({ x: 0, y: 1 }, { x: 0, y: 0 }));
  const bounds = dragBounds(parked, noDragOffset, viewport);
  assert.ok(
    sameDragOffset(clampDragOffset(noDragOffset, bounds), noDragOffset),
  );
});

void test('an offset that settles where it already was comes back unchanged', () => {
  const bounds = dragBounds(parked, noDragOffset, viewport);
  const corner = clampDragOffset({ x: -400, y: -900 }, bounds);
  // Pushing further into an edge the card already rests on hands back the very
  // offset React is holding, so the move costs no re-render.
  assert.equal(settleDragOffset(corner, { x: -900, y: -900 }, bounds), corner);
  assert.equal(
    settleDragOffset(noDragOffset, noDragOffset, bounds),
    noDragOffset,
  );
  // A move with room left is a new position, and says so by being a new object.
  const moved = settleDragOffset(noDragOffset, { x: -40, y: -200 }, bounds);
  assert.notEqual(moved, noDragOffset);
  assert.deepEqual(moved, { x: -40, y: -200 });
});
