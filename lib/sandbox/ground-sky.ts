import { Matrix4, Quaternion, Vector3 } from 'three';
import { bodyOrientation } from '../ephemeris';
import { bodies } from '../solar';
import type { SkyLocation } from '../sky-events';
import type { BodyFacts, SandboxRun } from './run';
import { auToKm, daysFromEpoch, kmToAu } from './scenario';

const north = new Vector3(0, 1, 0);
const radians = Math.PI / 180;

/** Physical spin follows simulated time, never the orbit view's slowed display spin. */
export function sandboxGroundOrientation(run: SandboxRun, fact: BodyFacts) {
  const catalogue = bodies.find((body) => body.id === fact.sourceId);
  const rotation = catalogue
    ? bodyOrientation(catalogue.id, daysFromEpoch(run.scenario.epoch))
    : new Quaternion();
  const pole = north.clone().applyQuaternion(rotation);
  const tiltAxis = north.clone().cross(pole);
  if (tiltAxis.lengthSq() < 1e-12) tiltAxis.set(0, 0, 1);
  rotation.premultiply(
    new Quaternion().setFromAxisAngle(
      tiltAxis.normalize(),
      (fact.tilt - (catalogue?.tilt ?? 0)) * radians,
    ),
  );
  const edits = run.events.filter(
    (event) =>
      event.kind === 'set' &&
      event.id === fact.id &&
      event.field === 'spinDays',
  );
  let period = edits[0]?.kind === 'set' ? edits[0].from : fact.spinDays;
  const added = run.events.find(
    (event) => event.kind === 'add' && event.id === fact.id,
  );
  let previous = added?.day ?? 0;
  let turns = 0;
  for (const edit of edits) {
    if (edit.kind !== 'set') continue;
    if (period) turns += (edit.day - previous) / period;
    period = edit.to;
    previous = edit.day;
  }
  // The horizon turns at the displayed moment, including time banked toward
  // the next physics step, just as the drawn body positions do.
  if (period) turns += (run.shownDays - previous) / period;
  return rotation.multiply(
    new Quaternion().setFromAxisAngle(north, (turns % 1) * 2 * Math.PI),
  );
}

/** The sandbox is spherical and geometric: no ephemeris, light-time or aberration. */
export function sandboxGroundSnapshot(run: SandboxRun, location: SkyLocation) {
  const earth = run.variant.find((point) => point.id === 'earth');
  const earthFacts = run.facts.find((fact) => fact.id === 'earth');
  if (!earth || !earthFacts) return null;
  const orientation = sandboxGroundOrientation(run, earthFacts);
  const latitude = location.latitude * radians,
    longitude = location.longitude * radians;
  const east = new Vector3(
    -Math.sin(longitude),
    0,
    -Math.cos(longitude),
  ).applyQuaternion(orientation);
  const up = new Vector3(
    Math.cos(latitude) * Math.cos(longitude),
    Math.sin(latitude),
    -Math.cos(latitude) * Math.sin(longitude),
  ).applyQuaternion(orientation);
  const south = east.clone().cross(up).normalize();
  const frame = {
    east,
    up,
    south,
    rotation: new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(east, up, south),
    ),
  };
  const observer = new Vector3(
    ...(run.drawn.get(earth.id) ?? earth.position),
  ).addScaledVector(
    up,
    Math.max(earth.radius + kmToAu(location.height / 1000), 0),
  );
  const facts = new Map(run.facts.map((fact) => [fact.id, fact]));
  return {
    frame,
    observer,
    bodies: run.variant
      .filter((point) => point.id !== 'earth')
      .map((point) => {
        const fact = facts.get(point.id)!;
        return {
          id: point.id,
          name: fact.name,
          color: fact.color,
          sourceId: fact.sourceId,
          radius: auToKm(point.radius),
          vector: new Vector3(
            ...(run.drawn.get(point.id) ?? point.position),
          ).sub(observer),
          orientation: sandboxGroundOrientation(run, fact),
        };
      }),
  };
}
