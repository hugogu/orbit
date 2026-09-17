import * as THREE from 'three';

const COUNT = 1800;
const VARIANTS = 6;
const INNER_RADIUS = 35;
const OUTER_RADIUS = 40;
const MARKER_SIZE = 2.4;
const SPIN_TURNS_PER_DAY = [2, 3, 4, 6, 8, 12];
export const ASTEROID_BELT_ILLUSTRATED_RADII = [INNER_RADIUS, OUTER_RADIUS] as const;
export const ASTEROID_BELT_DISTANCE_RADII = [2.1 * 3.1, 3.3 * 3.1] as const;
// Conservative bound for the largest deformed unit rock at its maximum scale.
export const ASTEROID_BELT_MAX_RADIUS = 0.11;

const motionShader = `
  uniform vec2 beltTime;
  uniform vec2 beltRadii;
  uniform float beltSizeScale;
  attribute vec2 beltMotion;
  mat3 beltRotateY(float angle) {
    float c = cos(angle), s = sin(angle);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }
  mat4 beltInstanceMatrix() {
    float orbit = 6.28318530718 * (fract(beltTime.x * beltMotion.x) + beltTime.y * beltMotion.x);
    float spin = 6.28318530718 * fract(beltTime.y * beltMotion.y);
    mat3 orbitRotation = beltRotateY(orbit);
    mat3 orientation = mat3(instanceMatrix);
    vec3 size = vec3(length(orientation[0]), length(orientation[1]), length(orientation[2]));
    orientation[0] /= size.x;
    orientation[1] /= size.y;
    orientation[2] /= size.z;
    size *= beltSizeScale;
    // Rotate before applying the unequal axis scales, so there is no shear.
    mat3 basis = orbitRotation * orientation * beltRotateY(spin);
    vec3 center = instanceMatrix[3].xyz;
    float sourceRadius = max(length(center.xz), 0.0001);
    float radiusT = clamp(
      (sourceRadius - ${INNER_RADIUS.toFixed(1)}) / ${(
        OUTER_RADIUS - INNER_RADIUS
      ).toFixed(1)},
      0.0,
      1.0
    );
    float targetRadius = mix(beltRadii.x, beltRadii.y, radiusT);
    center.xz *= targetRadius / sourceRadius;
    return mat4(
      vec4(basis[0] * size.x, 0.0),
      vec4(basis[1] * size.y, 0.0),
      vec4(basis[2] * size.z, 0.0),
      vec4(orbitRotation * center, 1.0)
    );
  }
`;

function rockGeometry(variant: number, detail: number) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position');
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    // Deform by direction, not vertex index, so duplicated face/seam vertices
    // stay joined and both detail levels describe the same underlying rock.
    const radius =
      1 +
      0.16 * Math.sin(point.x * 3.7 + point.y * 2.3 + variant * 1.7) +
      0.12 * Math.cos(point.z * 4.1 - point.y * 3.2 + variant * 0.9);
    point.multiplyScalar(radius);
    positions.setXYZ(
      i,
      point.x * (1 + variant * 0.09),
      point.y * (0.72 + (variant % 3) * 0.12),
      point.z * (0.82 + (variant % 2) * 0.13),
    );
  }
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Decorative population in illustrated scene units, not measured bodies. */
export function createAsteroidBelt(positionRandom: () => number) {
  const root = new THREE.Group();
  root.name = 'asteroid-belt';
  const material = new THREE.MeshStandardMaterial({
    // A restrained fill keeps distant and shadowed rocks legible against the
    // dark sky without turning the schematic population into glowing points.
    emissive: 0x9a8d78,
    emissiveIntensity: 0.38,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    vertexColors: true,
  });
  // Split whole/fractional days so slow motion stays smooth across 1700–2200.
  // Integer spin turns/day make the fractional-day wrap continuous.
  const time = { value: new THREE.Vector2() };
  const beltRadii = {
    value: new THREE.Vector2(...ASTEROID_BELT_ILLUSTRATED_RADII),
  };
  const beltSizeScale = { value: 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.beltTime = time;
    shader.uniforms.beltRadii = beltRadii;
    shader.uniforms.beltSizeScale = beltSizeScale;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${motionShader}`)
      .replace(
        'void main() {',
        'void main() {\nmat4 beltMatrix = beltInstanceMatrix();',
      );
    // Keep positions, lighting normals, and world coordinates on one transform.
    for (const chunk of [
      'defaultnormal_vertex',
      'project_vertex',
      'worldpos_vertex',
    ] as const)
      shader.vertexShader = shader.vertexShader.replace(
        `#include <${chunk}>`,
        THREE.ShaderChunk[chunk].replaceAll('instanceMatrix', 'beltMatrix'),
      );
  };
  material.customProgramCacheKey = () => 'asteroid-belt-motion-v1';
  const markerGeometry = new THREE.BufferGeometry();
  const markerPositions = new Float32Array(COUNT * 3);
  const markerMotions = new Float32Array(COUNT * 2);
  const markerColors = new Float32Array(COUNT * 3);
  const markerSizes = new Float32Array(COUNT);
  const markerMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: MARKER_SIZE,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    vertexColors: true,
  });
  markerMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.beltTime = time;
    shader.uniforms.beltRadii = beltRadii;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec2 beltTime;
uniform vec2 beltRadii;
attribute vec2 beltMotion;
attribute float beltMarkerSize;
mat3 beltMarkerRotateY(float angle) {
  float c = cos(angle), s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = position;
float sourceRadius = max(length(transformed.xz), 0.0001);
float radiusT = clamp(
  (sourceRadius - ${INNER_RADIUS.toFixed(1)}) / ${(
    OUTER_RADIUS - INNER_RADIUS
  ).toFixed(1)},
  0.0,
  1.0
);
transformed.xz *= mix(beltRadii.x, beltRadii.y, radiusT) / sourceRadius;
float orbit = 6.28318530718 * (fract(beltTime.x * beltMotion.x) + beltTime.y * beltMotion.x);
transformed = beltMarkerRotateY(orbit) * transformed;`,
      )
      .replace('gl_PointSize = size;', 'gl_PointSize = size * beltMarkerSize;');
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float beltMarkerRadius = distance(gl_PointCoord, vec2(0.5));
if (beltMarkerRadius > 0.5) discard;
diffuseColor.a *= smoothstep(0.5, 0.18, beltMarkerRadius);
#include <opaque_fragment>`,
    );
  };
  markerMaterial.customProgramCacheKey = () => 'asteroid-belt-markers-v2';
  const markers = new THREE.Points(markerGeometry, markerMaterial);
  markers.name = 'asteroid-belt-subpixel-markers';
  markers.visible = false;
  root.add(markers);
  const shapes = Array.from({ length: VARIANTS }, (_, variant) => ({
    far: rockGeometry(variant, 0),
    near: rockGeometry(variant, 1),
  }));
  const meshes = shapes.map(({ far }, variant) => {
    const mesh = new THREE.InstancedMesh(far, material, COUNT / VARIANTS);
    mesh.name = `belt-rock-${variant}`;
    mesh.matrixAutoUpdate = false;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    const motion = new THREE.InstancedBufferAttribute(
      new Float32Array((COUNT / VARIANTS) * 2),
      2,
    );
    shapes[variant].far.setAttribute('beltMotion', motion);
    shapes[variant].near.setAttribute('beltMotion', motion);
    root.add(mesh);
    return mesh;
  });
  // Appearance has its own seed to preserve the outer populations' positions.
  let seed = 913;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const angle = positionRandom() * Math.PI * 2;
    const radius =
      INNER_RADIUS + positionRandom() * (OUTER_RADIUS - INNER_RADIUS);
    const y = (positionRandom() - 0.5) * 2;
    const planarRadius = Math.sqrt(radius * radius - y * y);
    transform.position.set(
      Math.cos(angle) * planarRadius,
      y,
      Math.sin(angle) * planarRadius,
    );
    // Many small fragments, a few larger silhouettes; all remain schematic.
    const size = 0.016 + 0.075 * random() ** 3;
    transform.scale.set(
      size * (0.8 + random() * 0.4),
      size * (0.8 + random() * 0.4),
      size * (0.8 + random() * 0.4),
    );
    transform.rotation.set(
      random() * Math.PI * 2,
      random() * Math.PI * 2,
      random() * Math.PI * 2,
    );
    transform.updateMatrix();
    markerPositions.set(transform.position.toArray(), i * 3);
    markerSizes[i] = 0.75 + ((size - 0.016) / 0.075) * 0.5;
    const mesh = meshes[i % VARIANTS];
    const index = Math.floor(i / VARIANTS);
    mesh.setMatrixAt(index, transform.matrix);
    const shade = 0.12 + random() * 0.2;
    const warmth = random();
    color.setRGB(
      shade * (1 + warmth * 0.16),
      shade,
      shade * (1 - warmth * 0.18),
    );
    mesh.setColorAt(index, color);
    markerColors.set(
      [0.48 + warmth * 0.08, 0.3 + shade * 0.25, 0.18 + shade * 0.16],
      i * 3,
    );
    // Map the schematic annulus to the main belt's approximate 2.1–3.3 AU.
    // Kepler's third law depends on orbital radius, not the rock's display size.
    const au =
      2.1 + ((radius - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS)) * 1.2;
    const spin =
      SPIN_TURNS_PER_DAY[Math.floor(random() * SPIN_TURNS_PER_DAY.length)];
    const orbitalRate = 1 / (365.256 * au ** 1.5);
    mesh.geometry.getAttribute('beltMotion').setXY(index, orbitalRate, spin);
    markerMotions.set([orbitalRate, spin], i * 2);
    const { near, far } = shapes[i % VARIANTS];
    const extent =
      Math.max(
        near.boundingSphere!.radius + near.boundingSphere!.center.length(),
        far.boundingSphere!.radius + far.boundingSphere!.center.length(),
      ) * Math.max(transform.scale.x, transform.scale.y, transform.scale.z);
    // Cover every future orbital/spin phase, not just the initial positions.
    mesh.boundingSphere!.radius = Math.max(
      mesh.boundingSphere!.radius,
      radius + extent,
    );
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  }
  markerGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(markerPositions, 3),
  );
  markerGeometry.setAttribute(
    'beltMotion',
    new THREE.BufferAttribute(markerMotions, 2),
  );
  markerGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(markerColors, 3),
  );
  markerGeometry.setAttribute(
    'beltMarkerSize',
    new THREE.BufferAttribute(markerSizes, 1),
  );
  markerGeometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    OUTER_RADIUS + ASTEROID_BELT_MAX_RADIUS,
  );
  let near = false;
  let currentInnerRadius = INNER_RADIUS;
  let currentOuterRadius = OUTER_RADIUS;
  return {
    root,
    setSizeScale(scale: number) {
      beltSizeScale.value = Math.max(0, scale);
      // Real-size rocks are far below one pixel in an overview. These markers
      // preserve the belt's location without enlarging its physical geometry.
      markers.visible = scale < 0.1;
    },
    setRadiusRange(inner: number, outer: number) {
      if (
        beltRadii.value.x === inner &&
        beltRadii.value.y === outer
      )
        return;
      beltRadii.value.set(inner, outer);
      currentInnerRadius = inner;
      currentOuterRadius = outer;
      near = false;
      for (const [index, mesh] of meshes.entries())
        mesh.geometry = shapes[index].far;
    },
    update(cameraPosition: THREE.Vector3, days: number) {
      if (!root.visible) return;
      const wholeDays = Math.floor(days);
      time.value.set(wholeDays, days - wholeDays);
      const radial = Math.hypot(cameraPosition.x, cameraPosition.z);
      const radialGap = Math.max(
        currentInnerRadius - radial,
        radial - currentOuterRadius,
        0,
      );
      const distance = Math.hypot(
        radialGap,
        Math.max(Math.abs(cameraPosition.y) - 1, 0),
      );
      // Hysteresis prevents rapid geometry swaps at the distance threshold.
      const nextNear = distance < (near ? 24 : 18);
      if (near === nextNear) return;
      near = nextNear;
      for (let i = 0; i < meshes.length; i++)
        meshes[i].geometry = near ? shapes[i].near : shapes[i].far;
    },
    dispose() {
      root.removeFromParent();
      meshes.forEach((mesh) => mesh.dispose());
      shapes.forEach(({ near, far }) => {
        near.dispose();
        far.dispose();
      });
      markerGeometry.dispose();
      markerMaterial.dispose();
      material.dispose();
      root.clear();
    },
  };
}
