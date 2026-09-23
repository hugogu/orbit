/**
 * Putting a run in a link.
 *
 * What travels is the recipe, never the computed path: the fork epoch already
 * carried by the share link's own moment, plus the changes and the elapsed
 * times they were made at. The recipient replays it and reaches the same
 * trajectory, which is both far smaller than a trajectory and the only form
 * that stays true if the integrator is ever improved.
 *
 * Everything here validates on the way back in. A hand-edited or truncated
 * link degrades to a plain unmodified run rather than breaking the scene, the
 * same contract `decodeShareView` keeps.
 */
import { bodies } from '../solar';
import { sandboxFields } from './edits';
import type { SandboxField } from './field-names';
import type {
  SandboxBodySpec,
  SandboxChange,
  SandboxScenario,
} from './scenario';
import type { Vec3 } from './physics';

/** Changes one link may carry, so a pasted URL cannot ask for unbounded work. */
export const MAX_SHARED_CHANGES = 40;
/** Bodies a link may add, for the same reason. */
export const MAX_SHARED_BODIES = 12;

const SEPARATOR = ';';
const FIELD = ',';
/**
 * A run with nothing changed yet. It still has to reopen as a run, and an
 * empty value would drop out of the link and leave the recipient in the
 * explorer instead. It reads back as no changes at all.
 */
const UNCHANGED = '-';

function number(value: number) {
  // `String` round-trips a double exactly, so a replay starts from the very
  // numbers the author's run did rather than from a rounded copy.
  return String(value);
}

function readNumber(value: string | undefined, limit = 1e32) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function readVector(parts: string[], from: number): Vec3 | null {
  const axes = [0, 1, 2].map((axis) => readNumber(parts[from + axis], 1e6));
  return axes.every((axis) => axis !== null) ? (axes as Vec3) : null;
}

function isField(value: string): value is SandboxField {
  return sandboxFields.some((field) => field.id === value);
}

/** Ids a change may name: the catalogue bodies plus anything the link adds. */
function knownIds(changes: SandboxChange[]) {
  return new Set([
    ...bodies.map((body) => body.id),
    ...changes.flatMap((change) =>
      change.kind === 'add' ? [change.body.id] : [],
    ),
  ]);
}

export function encodeSandbox(scenario: SandboxScenario) {
  const encoded = scenario.changes
    .slice(0, MAX_SHARED_CHANGES)
    .map((change) => {
      const at = number(change.at);
      if (change.kind === 'set')
        return ['s', at, change.id, change.field, number(change.value)].join(
          FIELD,
        );
      if (change.kind === 'remove') return ['r', at, change.id].join(FIELD);
      const body = change.body;
      return [
        'a',
        at,
        body.id,
        encodeURIComponent(body.name),
        body.color.replace('#', ''),
        number(body.mass),
        number(body.radius),
        number(body.spinDays),
        number(body.tilt),
        ...body.position.map(number),
        ...body.velocity.map(number),
      ].join(FIELD);
    })
    .join(SEPARATOR);
  return encoded || UNCHANGED;
}

/**
 * `decodeURIComponent` throws on a malformed escape such as a bare `%`, and
 * the text here arrives from whoever wrote the link. A name that cannot be
 * read falls back to the id rather than taking the page down with it.
 */
function readName(value: string | undefined, fallback: string) {
  try {
    return decodeURIComponent(value ?? '').slice(0, 40) || fallback;
  } catch {
    return fallback;
  }
}

function readAdd(parts: string[]): SandboxBodySpec | null {
  const [, , id, name, color] = parts;
  const mass = readNumber(parts[5]);
  const radius = readNumber(parts[6], 1e9);
  const spinDays = readNumber(parts[7], 1e6);
  const tilt = readNumber(parts[8], 360);
  const position = readVector(parts, 9);
  const velocity = readVector(parts, 12);
  if (
    !id ||
    !/^[a-z0-9-]{1,32}$/i.test(id) ||
    mass === null ||
    mass <= 0 ||
    radius === null ||
    radius <= 0 ||
    spinDays === null ||
    tilt === null ||
    !position ||
    !velocity
  )
    return null;
  return {
    id,
    sourceId: null,
    // A shared name is another person's text: it is shown, never resolved as
    // a translation key or written anywhere it could be read as markup.
    name: readName(name, id),
    color: /^[0-9a-f]{6}$/i.test(color ?? '') ? `#${color}` : '#ffffff',
    mass,
    radius,
    spinDays,
    tilt,
    position,
    velocity,
  };
}

export function decodeSandbox(
  value: string | null,
  epoch: number,
): SandboxScenario | null {
  if (!value) return null;
  const changes: SandboxChange[] = [];
  let added = 0;
  for (const entry of value.split(SEPARATOR).slice(0, MAX_SHARED_CHANGES)) {
    const parts = entry.split(FIELD);
    const at = readNumber(parts[1], 4e6);
    if (at === null || at < 0) continue;
    if (parts[0] === 's') {
      const field = parts[3] ?? '';
      const amount = readNumber(parts[4]);
      if (!parts[2] || !isField(field) || amount === null) continue;
      changes.push({ at, kind: 'set', id: parts[2], field, value: amount });
    } else if (parts[0] === 'r') {
      if (parts[2]) changes.push({ at, kind: 'remove', id: parts[2] });
    } else if (parts[0] === 'a' && added < MAX_SHARED_BODIES) {
      const body = readAdd(parts);
      if (body) {
        changes.push({ at, kind: 'add', body });
        added += 1;
      }
    }
  }
  // A change naming a body no link ever introduces would silently do nothing;
  // dropping it keeps the recipe a faithful description of the run.
  const ids = knownIds(changes);
  const kept = changes
    .filter((change) => change.kind === 'add' || ids.has(change.id))
    .sort((a, b) => a.at - b.at);
  return { epoch, changes: kept };
}
