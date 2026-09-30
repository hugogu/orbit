// Camera directions used to stage shots, as the OrbitControls azimuth and polar
// angle a share link's `c` parameter takes, in the scene's J2000 ecliptic axes.
//
//   node poses.mjs moon <iso>...        Earth's side of the Moon: the drawn
//                                       terminator then matches the phase card
//   node poses.mjs sun <Body> <iso>...  where the Sun lies seen from a planet,
//                                       to find its day side
import * as Astronomy from 'astronomy-engine';

const toEcliptic = Astronomy.Rotation_EQJ_ECL();
/** Scene axes: Y is ecliptic north, and the in-plane sine maps to negative Z. */
function scene(vector) {
  const e = Astronomy.RotateVector(toEcliptic, vector);
  return [e.x, e.z, -e.y];
}
function pose([x, y, z]) {
  const r = Math.hypot(x, y, z);
  return `azimuth ${Math.atan2(x, z).toFixed(4)} polar ${Math.acos(y / r).toFixed(4)}`;
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'moon') {
  for (const iso of args) {
    const time = Astronomy.MakeTime(new Date(iso));
    const toEarth = scene(Astronomy.GeoMoon(time)).map((c) => -c);
    const lit = Astronomy.Illumination(
      Astronomy.Body.Moon,
      time,
    ).phase_fraction;
    console.log(`${iso} lit ${(lit * 100).toFixed(1)}% ${pose(toEarth)}`);
  }
} else if (mode === 'sun' && args.length > 1) {
  const [body, ...times] = args;
  for (const iso of times) {
    const time = Astronomy.MakeTime(new Date(iso));
    const toSun = scene(Astronomy.HelioVector(Astronomy.Body[body], time)).map(
      (c) => -c,
    );
    console.log(`${body} ${iso} ${pose(toSun)}`);
  }
} else {
  console.error('usage: node poses.mjs moon <iso>... | sun <Body> <iso>...');
  process.exit(1);
}
