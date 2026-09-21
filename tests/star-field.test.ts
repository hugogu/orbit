import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import sharp from 'sharp/lib/index.js';
import { Body, DefineStar, GeoVector } from 'astronomy-engine';
import { createStarField } from '../components/star-field';
import { sceneDirection } from '../lib/ephemeris';
import { constellationNames } from '../lib/constellations';
import {
  encodeStarCatalog,
  figureAnchor,
  galacticBasis,
  panoramaOrientation,
  panoramaPixel,
  parseConstellationFigures,
  parseStarCatalog,
  sceneBasis,
  starColor,
  starPointSize,
  starTemperature,
  type StarCatalog,
} from '../lib/star-catalog';

const degree = Math.PI / 180;
function loadCatalog() {
  const file = readFileSync('public/sky/bright-stars.bin');
  return parseStarCatalog(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  );
}
function loadFigures(catalog: StarCatalog) {
  return parseConstellationFigures(
    JSON.parse(readFileSync('public/sky/constellations.json', 'utf8')),
    catalog.magnitudes.length,
  );
}
function direction(catalog: StarCatalog, index: number) {
  return new THREE.Vector3(
    catalog.positions[index * 3],
    catalog.positions[index * 3 + 1],
    catalog.positions[index * 3 + 2],
  );
}
/** Angle between two unit vectors, in degrees. */
function separation(a: THREE.Vector3, b: THREE.Vector3) {
  return (Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI;
}

void test('the shipped catalog holds the published bright stars in EQJ', () => {
  const catalog = loadCatalog();
  assert.equal(catalog.magnitudes.length, 9096);
  // Brightest first, so a magnitude limit is a prefix of the table.
  for (let index = 1; index < catalog.magnitudes.length; index++)
    assert.ok(catalog.magnitudes[index] >= catalog.magnitudes[index - 1]);
  assert.ok(Math.abs(catalog.magnitudes[0] + 1.46) < 0.005);
  // Right ascension, declination and distance as the Bright Star Catalogue
  // and Hipparcos publish them; the reference vector is Astronomy Engine's.
  const published = [
    { name: 'Sirius', index: 0, ra: 6 + 45 / 60 + 8.9 / 3600, dec: -16.7161 },
    { name: 'Canopus', index: 1, ra: 6 + 23 / 60 + 57.1 / 3600, dec: -52.6958 },
    { name: 'Vega', index: 4, ra: 18 + 36 / 60 + 56.3 / 3600, dec: 38.7836 },
  ];
  for (const star of published) {
    DefineStar(Body.Star1, star.ra, star.dec, 100);
    const reference = GeoVector(
      Body.Star1,
      new Date(Date.UTC(2000, 0, 1)),
      false,
    );
    const expected = new THREE.Vector3(
      reference.x,
      reference.y,
      reference.z,
    ).normalize();
    assert.ok(
      separation(direction(catalog, star.index), expected) < 0.01,
      star.name,
    );
  }
});

void test('catalog encoding survives a round trip within its stated precision', () => {
  const source: StarCatalog = {
    positions: new Float32Array([1, 0, 0, 0, 0, -1]),
    motions: new Float32Array([0, 3.4e-5, 0, -1.2e-6, 0, 0]),
    magnitudes: new Float32Array([-1.46, 7.96]),
    colorIndices: new Float32Array([-0.33, 2.06]),
  };
  const parsed = parseStarCatalog(encodeStarCatalog(source));
  assert.deepEqual([...parsed.positions], [...source.positions]);
  assert.deepEqual([...parsed.magnitudes], [...source.magnitudes]);
  for (let index = 0; index < source.motions.length; index++)
    assert.ok(Math.abs(parsed.motions[index] - source.motions[index]) <= 5e-9);
  for (let index = 0; index < source.colorIndices.length; index++)
    assert.ok(
      Math.abs(parsed.colorIndices[index] - source.colorIndices[index]) <= 5e-4,
    );
  const truncated = encodeStarCatalog(source).slice(0, 20);
  assert.throws(() => parseStarCatalog(truncated), /truncated/);
});

void test('scene axes place the stars on the J2000 ecliptic the scene renders in', () => {
  // The celestial pole sits one obliquity away from the ecliptic pole, and
  // the vernal equinox is shared by both frames.
  const pole = new THREE.Vector3(...sceneDirection(0, 0, 1));
  assert.ok(Math.abs(Math.asin(pole.y) / degree - (90 - 23.4393)) < 0.01);
  const equinox = new THREE.Vector3(...sceneDirection(1, 0, 0));
  assert.ok(Math.abs(equinox.y) < 1e-9);
  assert.ok(Math.abs(equinox.x - 1) < 1e-9);
  // A catalogued star close to the ecliptic keeps its published latitude
  // once the same rotation the planets use has been applied to it.
  const catalog = loadCatalog();
  const eclipticLatitude = (index: number) => {
    const star = direction(catalog, index);
    return (
      Math.asin(
        new THREE.Vector3(...sceneDirection(star.x, star.y, star.z)).y,
      ) / degree
    );
  };
  // Regulus and Spica, the two brightest stars nearest the ecliptic.
  const regulus = catalog.magnitudes.findIndex(
    (magnitude) => Math.abs(magnitude - 1.35) < 0.005,
  );
  const spica = catalog.magnitudes.findIndex(
    (magnitude) => Math.abs(magnitude - 0.98) < 0.005,
  );
  assert.ok(Math.abs(eclipticLatitude(regulus) - 0.46) < 0.02, 'Regulus');
  assert.ok(Math.abs(eclipticLatitude(spica) + 2.06) < 0.02, 'Spica');
});

void test('proper motion carries a star across centuries without leaving the sphere', () => {
  const catalog = loadCatalog();
  let fastest = 0,
    index = 0;
  for (let i = 0; i < catalog.magnitudes.length; i++) {
    const speed = Math.hypot(
      catalog.motions[i * 3],
      catalog.motions[i * 3 + 1],
      catalog.motions[i * 3 + 2],
    );
    if (speed > fastest) {
      fastest = speed;
      index = i;
    }
  }
  // Groombridge 1830, the fastest star in the catalogue, moves 7.06"/yr.
  assert.ok(Math.abs((fastest / degree) * 3600 - 7.06) < 0.01);
  const start = direction(catalog, index);
  const motion = new THREE.Vector3(
    catalog.motions[index * 3],
    catalog.motions[index * 3 + 1],
    catalog.motions[index * 3 + 2],
  );
  const centuries = start.clone().addScaledVector(motion, 500);
  assert.ok(Math.abs(centuries.length() - 1) < 0.02);
  assert.ok(Math.abs(separation(start, centuries.normalize()) - 0.98) < 0.02);
  // A motion vector is a tangent, so it never pulls a star off the sphere.
  assert.ok(Math.abs(start.dot(motion)) < 1e-7);
});

void test('constellation figures join catalogued stars inside their own region', () => {
  const catalog = loadCatalog();
  const { constellations } = loadFigures(catalog);
  assert.equal(constellations.length, 89); // Serpens is drawn in two parts.
  assert.equal(
    new Set(constellations.map((figure) => figure.id)).size,
    Object.keys(constellationNames).length,
  );
  let segments = 0;
  for (const figure of constellations) {
    for (let index = 0; index < figure.lines.length; index += 2) {
      const from = direction(catalog, figure.lines[index]),
        to = direction(catalog, figure.lines[index + 1]);
      assert.notEqual(figure.lines[index], figure.lines[index + 1]);
      // A drawn line joins neighbouring stars of one figure, never two
      // stars on opposite sides of the sky.
      assert.ok(separation(from, to) < 45, `${figure.id} segment`);
      segments++;
    }
  }
  assert.ok(segments > 600);
  const orion = constellations.find((figure) => figure.id === 'Ori')!;
  const magnitudes = [...new Set(orion.lines)]
    .map((index) => catalog.magnitudes[index])
    .sort((a, b) => a - b);
  // Rigel and Betelgeuse anchor the figure; every drawn star is naked-eye.
  assert.ok(Math.abs(magnitudes[0] - 0.12) < 0.02);
  assert.ok(Math.abs(magnitudes[1] - 0.5) < 0.02);
  assert.ok(magnitudes[magnitudes.length - 1] < 5);
});

void test('every constellation the figures name has a translation key', () => {
  const catalog = loadCatalog();
  for (const figure of loadFigures(catalog).constellations)
    assert.ok(constellationNames[figure.id], figure.id);
});

void test('star colour and size follow the published magnitude and colour index', () => {
  // Hotter stars carry a lower B-V, and the drawn tint has to agree.
  assert.ok(starTemperature(-0.3) > 15000);
  assert.ok(starTemperature(1.6) < 4000);
  const [hotRed, , hotBlue] = starColor(-0.3);
  const [coolRed, , coolBlue] = starColor(1.6);
  assert.ok(hotBlue > hotRed);
  assert.ok(coolRed > coolBlue);
  // Every tint stays inside the displayable range and keeps some light.
  for (const index of [-0.4, 0, 0.6, 1.2, 2.2])
    for (const channel of starColor(index)) {
      assert.ok(channel > 0.2 && channel <= 1);
    }
  assert.ok(starPointSize(-1.46) > starPointSize(1));
  assert.ok(starPointSize(1) > starPointSize(6));
  // A star beyond the naked-eye limit still gets a drawable point.
  assert.ok(starPointSize(7.9) >= 1.5);
});

void test('the Milky Way panorama is turned to the frame it was photographed in', async () => {
  const orientation = panoramaOrientation();
  const toGalactic = new THREE.Matrix4()
    .multiplyMatrices(sceneBasis(), galacticBasis())
    .transpose();
  // Three.js writes equirectangular coordinates into its own sphere, so the
  // orientation is checked against those very vertices rather than against a
  // second copy of the mapping.
  const sphere = new THREE.SphereGeometry(1, 16, 8);
  const position = sphere.getAttribute('position'),
    uv = sphere.getAttribute('uv');
  const local = new THREE.Vector3(),
    galactic = new THREE.Vector3();
  for (let index = 0; index < position.count; index++) {
    local.fromBufferAttribute(position, index);
    if (Math.abs(local.y) > 0.999) continue; // The poles carry seam UVs.
    galactic.copy(local).applyQuaternion(orientation).applyMatrix4(toGalactic);
    const [column, row] = panoramaPixel(
      Math.atan2(galactic.y, galactic.x),
      Math.asin(galactic.z),
    );
    // An image row counts down from the texture's top, which is where the
    // renderer's flipped V coordinate starts.
    const expected = [uv.getX(index), 1 - uv.getY(index)];
    assert.ok(
      Math.abs(((column - expected[0] + 1.5) % 1) - 0.5) < 1e-4 &&
        Math.abs(row - expected[1]) < 1e-4,
      `vertex ${index}: ${column},${row} vs ${expected.join(',')}`,
    );
  }
  sphere.dispose();

  // The same mapping has to land on what the photograph actually shows.
  const { data, info } = await sharp('public/textures/2k_stars_milky_way.jpg')
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const brightness = (longitude: number, latitude: number) => {
    const [column, row] = panoramaPixel(longitude * degree, latitude * degree);
    const x = Math.round(column * info.width),
      y = Math.round(row * info.height);
    let total = 0,
      samples = 0;
    for (let dy = -8; dy <= 8; dy++)
      for (let dx = -8; dx <= 8; dx++) {
        const row = y + dy;
        if (row < 0 || row >= info.height) continue;
        total += data[row * info.width + ((x + dx + info.width) % info.width)];
        samples++;
      }
    return total / samples;
  };
  const empty = brightness(80, 35);
  assert.ok(brightness(0, 0) > 20 * empty, 'galactic centre');
  assert.ok(brightness(280.5, -32.9) > 6 * empty, 'Large Magellanic Cloud');
  assert.ok(brightness(302.8, -44.3) > 3 * empty, 'Small Magellanic Cloud');
});

void test('the sky is re-centred on the camera as it is drawn, not a frame late', () => {
  const scene = new THREE.Scene();
  const field = createStarField(
    scene,
    null as unknown as HTMLElement,
    () => {},
  );
  const sky = scene.children.find((child) => child.type === 'Group')!;
  const panorama = sky.children[0] as THREE.Mesh;
  const camera = new THREE.PerspectiveCamera();
  // Orbit damping moves the camera after every other update, so a centre
  // taken earlier in the frame swings the whole sky as the view is dragged.
  camera.position.set(-180, 62, 940);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld(true);
  panorama.onBeforeRender(
    null as never,
    scene,
    camera,
    null as never,
    null as never,
    null as never,
  );
  const centre = new THREE.Vector3().setFromMatrixPosition(
    panorama.matrixWorld,
  );
  assert.ok(centre.distanceTo(camera.position) < 1e-9);
  // Re-centring must not disturb the orientation the panorama was given.
  const turned = new THREE.Quaternion().setFromRotationMatrix(
    panorama.matrixWorld,
  );
  assert.ok(turned.angleTo(panoramaOrientation()) < 1e-6);
  field.dispose();
  assert.equal(scene.children.length, 0);
});

void test("a figure's name is written among its own stars, above their middle", () => {
  const catalog = loadCatalog();
  const { constellations } = loadFigures(catalog);
  const up = new THREE.Vector3(0, 1, 0);
  // Anchors are read in scene axes, which is where the label is projected.
  const scene = new Float32Array(catalog.positions.length);
  for (let index = 0; index < catalog.positions.length; index += 3)
    scene.set(
      sceneDirection(
        catalog.positions[index],
        catalog.positions[index + 1],
        catalog.positions[index + 2],
      ),
      index,
    );
  const at = (index: number) =>
    new THREE.Vector3(
      scene[index * 3],
      scene[index * 3 + 1],
      scene[index * 3 + 2],
    );
  for (const figure of constellations) {
    const stars = [...new Set(figure.lines)];
    const anchor = figureAnchor(scene, catalog.magnitudes, figure.lines, up);
    const distances = stars.map((index) => separation(anchor, at(index)));
    const middle = stars
      .map(at)
      .reduce((total, star) => total.add(star), new THREE.Vector3())
      .normalize();
    const extent = Math.max(
      ...stars.map((index) => separation(middle, at(index))),
    );
    // Inside the figure's own reach, never beyond the stars it joins, and
    // close to one of them — a sprawling figure such as Ophiuchus is mostly
    // empty in the middle, so how close scales with how large it is.
    assert.ok(separation(anchor, middle) < extent, `${figure.id} overshoots`);
    assert.ok(
      Math.min(...distances) <= Math.max(7, extent * 0.5),
      `${figure.id} is adrift`,
    );
  }
  // Orion is the worked example: the name belongs between the shoulders,
  // not above the raised club where the printed chart puts it.
  const orion = constellations.find((figure) => figure.id === 'Ori')!;
  const anchor = figureAnchor(scene, catalog.magnitudes, orion.lines, up);
  const star = (magnitude: number) =>
    at(
      [...new Set(orion.lines)].find(
        (index) => Math.abs(catalog.magnitudes[index] - magnitude) < 0.02,
      )!,
    );
  assert.ok(separation(anchor, star(1.64)) < 5, 'Bellatrix');
  assert.ok(separation(anchor, star(0.5)) < 9, 'Betelgeuse');
  assert.ok(separation(anchor, star(0.12)) > 12, 'Rigel');
});

void test("the name is lifted from the middle towards the figure's top star", () => {
  const corner = (x: number, y: number) =>
    new THREE.Vector3(
      Math.sin(x * degree),
      Math.sin(y * degree),
      1,
    ).normalize();
  const shape = [corner(-6, -3), corner(6, -3), corner(0, 7)];
  const positions = new Float32Array(shape.flatMap((star) => star.toArray()));
  const anchor = figureAnchor(
    positions,
    new Float32Array([3, 3, 3]),
    [0, 1, 1, 2, 2, 0],
    new THREE.Vector3(0, 1, 0),
  );
  const middle = shape
    .reduce((total, star) => total.add(star), new THREE.Vector3())
    .normalize();
  const top = shape[2];
  // A step along the arc towards a star the figure really has, so the name
  // is inside the shape however wide or flat that shape is.
  assert.ok(Math.abs(anchor.x) < 1e-9, "stays on the figure's axis");
  assert.ok(anchor.y > middle.y, 'lifted');
  assert.ok(
    Math.abs(middle.angleTo(anchor) - middle.angleTo(top) * 0.35) < 1e-7,
  );
  assert.ok(anchor.angleTo(top) < middle.angleTo(top), 'towards the top star');
  // A figure standing on the up axis has no up of its own and keeps its
  // middle rather than being pushed to a pole.
  const overhead = figureAnchor(
    new Float32Array([0, 1, 0, 0.02, 0.9998, 0]),
    new Float32Array([3, 3]),
    [0, 1],
    new THREE.Vector3(0, 1, 0),
  );
  assert.ok(overhead.angleTo(new THREE.Vector3(0, 1, 0)) < 0.02);
});
