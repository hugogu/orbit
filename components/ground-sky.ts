import * as THREE from 'three';
import { bodyOrientation } from '../lib/ephemeris';
import { smoothDeviceAttitude } from '../lib/device-attitude';
import {
  groundBodies,
  groundBodyDisplay,
  groundBodyVector,
  horizonFrame,
} from '../lib/ground-sky';
import type { ScaleMode } from '../lib/solar';
import type { SkyLocation } from '../lib/sky-events';
import type { Translate } from '../lib/i18n';
import { createSceneLabel } from './scene-label';
import { sandboxGroundSnapshot } from '../lib/sandbox/ground-sky';
import type { SandboxRun } from '../lib/sandbox/run';
import { createOrbitLine, setOrbitLineWidth } from './orbit-line';
import { attachEclipseMaterial } from './eclipse-material';
import { shadowFrame, possibleCasters } from '../lib/eclipse-shadows';

const GROUND_BODY_SHAPE_PROJECTION = /* glsl */ `
vec4 groundBodyClipPosition(vec4 viewPosition, vec4 clipPosition) {
  vec4 centerViewPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 centerClipPosition = projectionMatrix * centerViewPosition;
  float centerDistance = length(centerViewPosition.xyz);
  if (centerClipPosition.w > 0.0 && centerDistance > 1e-6) {
    vec2 centerNdc = centerClipPosition.xy / centerClipPosition.w;
    vec2 projectionScale = vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
    vec2 centerScreen = centerNdc / projectionScale;
    float centerRadius = length(centerScreen);
    if (centerRadius > 1e-6) {
      vec2 radial = centerScreen / centerRadius;
      vec2 pointScreen = (clipPosition.xy / clipPosition.w) / projectionScale;
      vec2 offset = pointScreen - centerScreen;
      float radialOffset = dot(offset, radial);
      float viewCosine = clamp(-centerViewPosition.z / centerDistance, 0.0, 1.0);
      pointScreen += radial * radialOffset * (viewCosine - 1.0);
      clipPosition.xy = pointScreen * projectionScale * clipPosition.w;
    }
  }
  return clipPosition;
}
`;

/** Shares the star field and loaded textures, but never the illustrative orbit geometry. */
export function createGroundSky(
  scene: THREE.Scene,
  layer: HTMLElement,
  canvas: HTMLCanvasElement,
  sources: Map<string, THREE.Mesh>,
  onChange: () => void = () => {},
) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.00001, 20000);
  const labels = document.createElement('div');
  labels.className = 'ground-labels';
  labels.hidden = true;
  layer.appendChild(labels);
  const makeLabel = (className: string) => {
    const element = document.createElement('span');
    element.className = className;
    labels.appendChild(element);
    return { element, place: createSceneLabel(element) };
  };
  const sphere = new THREE.SphereGeometry(1, 64, 40);
  const makeEntry = (body: {
    id: string;
    name: string;
    color: string;
    sourceId: string | null;
  }) => {
    const material = new THREE.MeshBasicMaterial({
      color: body.id === 'sun' ? 0xffffff : body.color,
    });
    const sunDirection = { value: new THREE.Vector3() };
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${GROUND_BODY_SHAPE_PROJECTION}`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\ngl_Position = groundBodyClipPosition(mvPosition, gl_Position);',
      );
      if (body.id === 'sun') return;
      // Each planet has its own direction to the Sun. Camera light layers
      // cannot isolate one directional light per mesh in a single draw pass.
      shader.uniforms.groundSunDirection = sunDirection;
      shader.vertexShader =
        'varying vec3 groundNormal;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ngroundNormal = mat3(modelMatrix) * normal;',
        );
      shader.fragmentShader =
        'varying vec3 groundNormal; uniform vec3 groundSunDirection;\n' +
        shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          'outgoingLight *= 0.015 + max(0.0, dot(normalize(groundNormal), groundSunDirection));\n#include <opaque_fragment>',
        );
    };
    material.customProgramCacheKey = () =>
      body.id === 'sun' ? 'ground-body-shape-sun' : 'ground-body-shape-lit';
    const eclipse =
      body.id === 'moon-moon' ? attachEclipseMaterial(material) : null;
    const mesh = new THREE.Mesh(sphere, material);
    mesh.userData.id = body.id;
    root.add(mesh);
    return {
      body,
      mesh,
      sunDirection,
      eclipse,
      vector: new THREE.Vector3(),
      ...makeLabel('planet-label ground-body-label'),
    };
  };
  const entries = groundBodies.map((body) =>
    makeEntry({ ...body, sourceId: body.id }),
  );
  const guidePoints = Array.from({ length: 2049 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 2048;
    return new THREE.Vector3(
      3000 * Math.cos(angle),
      0,
      -3000 * Math.sin(angle),
    );
  });
  const makeGuide = (id: string, color: number) => {
    const line = createOrbitLine(color, 1, guidePoints);
    line.userData.id = id;
    line.renderOrder = -0.5;
    line.material.depthTest = false;
    line.frustumCulled = false;
    setOrbitLineWidth(line, 1.5);
    root.add(line);
    return line;
  };
  const horizon = makeGuide('horizon-guide', 0x70b6b4);
  const ecliptic = makeGuide('ecliptic-guide', 0xcaa46f);
  const cardinals = ['北', '东', '南', '西'].map((name, index) => ({
    name,
    direction: new THREE.Vector3(
      Math.sin((index * Math.PI) / 2),
      0.015,
      -Math.cos((index * Math.PI) / 2),
    ),
    ...makeLabel('horizon-label'),
  }));
  let active = false,
    controlled = false,
    azimuth = 0,
    altitude = 15,
    lastKey = '',
    lastLocale: Translate | null = null;
  let lastSandbox: SandboxRun | null = null;
  let frame = horizonFrame(0, {
    latitude: 0,
    longitude: 0,
    height: 0,
    utcOffset: 0,
  });
  const localCamera = new THREE.Quaternion(),
    projected = new THREE.Vector3();
  const pointers = new Map<number, { x: number; y: number }>();
  const pinchDistance = () => {
    const points = [...pointers.values()];
    return points.length === 2
      ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      : 0;
  };
  const down = (event: PointerEvent) => {
    if (!active) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!active || !previous) return;
    const previousDistance = pinchDistance();
    const factor = camera.fov / canvas.clientHeight;
    if (pointers.size === 1 && !controlled) {
      azimuth -= (event.clientX - previous.x) * factor;
      altitude = THREE.MathUtils.clamp(
        altitude + (event.clientY - previous.y) * factor,
        -89,
        89,
      );
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const distance = pinchDistance();
    if (distance && previousDistance)
      camera.fov = THREE.MathUtils.clamp(
        (camera.fov * previousDistance) / distance,
        15,
        100,
      );
    onChange();
  };
  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
  };
  const wheel = (event: WheelEvent) => {
    if (!active) return;
    event.preventDefault();
    camera.fov = THREE.MathUtils.clamp(
      camera.fov * Math.exp(event.deltaY * 0.001),
      15,
      100,
    );
    onChange();
  };
  const key = (event: KeyboardEvent) => {
    if (!active || controlled || event.target !== canvas) return;
    if (event.key === 'ArrowLeft') azimuth -= 5;
    else if (event.key === 'ArrowRight') azimuth += 5;
    else if (event.key === 'ArrowUp') altitude = Math.min(89, altitude + 5);
    else if (event.key === 'ArrowDown') altitude = Math.max(-89, altitude - 5);
    else return;
    event.preventDefault();
    onChange();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('keydown', key);
  return {
    camera,
    setActive(value: boolean) {
      if (value === active) return;
      active = value;
      root.visible = value;
      labels.hidden = !value;
      pointers.clear();
    },
    update(
      days: number,
      location: SkyLocation,
      scale: ScaleMode,
      realSizes: boolean,
      attitude: THREE.Quaternion | null,
      width: number,
      height: number,
      showLabels: boolean,
      translate: Translate,
      sandbox: SandboxRun | null = null,
      frameSeconds = 1 / 60,
      shadows = true,
    ) {
      // A 100 ms sky snapshot is far below sensor accuracy, including the Moon.
      const key = `${Math.floor(days * 864000)}:${location.latitude}:${location.longitude}:${location.height}:${scale}:${realSizes}:${shadows}`;
      if (sandbox || key !== lastKey || sandbox !== lastSandbox) {
        const snapshot = sandbox
          ? sandboxGroundSnapshot(sandbox, location)
          : null;
        if (sandbox && !snapshot) {
          root.visible = false;
          labels.hidden = true;
          return;
        }
        root.visible = active;
        labels.hidden = !active;
        frame = snapshot?.frame ?? horizonFrame(days, location);
        const skyBodies =
          snapshot?.bodies ??
          groundBodies.map((body) => ({
            ...body,
            sourceId: body.id,
            vector: groundBodyVector(body.id, days, location),
            orientation: bodyOrientation(body.id, days),
          }));
        const present = new Set(skyBodies.map((body) => body.id));
        for (let index = entries.length - 1; index >= 0; index--) {
          const entry = entries[index];
          if (present.has(entry.body.id)) continue;
          entry.mesh.removeFromParent();
          entry.mesh.material.dispose();
          entry.element.remove();
          entries.splice(index, 1);
        }
        const sun = skyBodies.find((body) => body.id === 'sun')?.vector;
        const lunarFrame = !sandbox
          ? shadowFrame(days, ['earth', 'moon-moon'])
          : null;
        for (const body of skyBodies) {
          let entry = entries.find((item) => item.body.id === body.id);
          if (!entry) {
            entry = makeEntry(body);
            entries.push(entry);
          }
          if (
            entry.body.name !== body.name ||
            lastLocale !== translate ||
            !entry.element.textContent
          )
            entry.element.textContent = translate(body.name);
          entry.body = body;
          if (!entry.mesh.material.map)
            entry.mesh.material.color.set(
              body.id === 'sun' ? '#ffffff' : body.color,
            );
          entry.vector.copy(body.vector);
          const display = groundBodyDisplay(
            entry.body.id,
            entry.vector,
            scale,
            realSizes,
            body.radius,
          );
          entry.mesh.position.copy(display.position);
          entry.mesh.scale.setScalar(display.radius);
          entry.mesh.quaternion.copy(body.orientation);
          if (entry.eclipse && lunarFrame) {
            const receiver = lunarFrame.get('moon-moon')!;
            entry.eclipse.update(
              receiver,
              lunarFrame.get('sun')!.position,
              possibleCasters(receiver, lunarFrame),
              entry.mesh.quaternion.clone().invert(),
              shadows,
            );
          } else if (entry.eclipse) {
            entry.eclipse.uniforms.eclipseCount.value = 0;
            entry.eclipse.uniforms.eclipseEarthIndex.value = -1;
          }
          if (sun)
            entry.sunDirection.value.copy(sun).sub(entry.vector).normalize();
          else entry.sunDirection.value.set(0, 0, 0);
        }
        horizon.quaternion.copy(frame.rotation);
        lastKey = key;
        lastSandbox = sandbox;
      }
      for (const entry of entries) {
        const material = sources.get(entry.body.sourceId ?? entry.body.id)
          ?.material as THREE.MeshStandardMaterial | undefined;
        if (material?.map && material.map !== entry.mesh.material.map) {
          entry.mesh.material.map = material.map;
          entry.mesh.material.color.set(0xffffff);
          entry.mesh.material.needsUpdate = true;
        }
      }
      if (lastLocale !== translate) {
        entries.forEach((entry) => {
          entry.element.textContent = translate(entry.body.name);
        });
        cardinals.forEach((entry) => {
          entry.element.textContent = translate(entry.name);
        });
        lastLocale = translate;
      }
      if (attitude) {
        if (controlled)
          smoothDeviceAttitude(localCamera, attitude, frameSeconds);
        else localCamera.copy(attitude);
        controlled = true;
      } else {
        if (controlled) {
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
            localCamera,
          );
          azimuth = THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z));
          altitude = THREE.MathUtils.radToDeg(
            Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)),
          );
          controlled = false;
        }
        localCamera.setFromEuler(
          new THREE.Euler(
            THREE.MathUtils.degToRad(altitude),
            -THREE.MathUtils.degToRad(azimuth),
            0,
            'YXZ',
          ),
        );
      }
      camera.quaternion.copy(frame.rotation).multiply(localCamera);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      for (const entry of entries) {
        projected
          .copy(entry.mesh.position)
          .addScaledVector(frame.up, entry.mesh.scale.x * 1.3)
          .project(camera);
        entry.place(projected, width, height, showLabels);
      }
      for (const entry of cardinals) {
        projected
          .copy(entry.direction)
          .applyQuaternion(frame.rotation)
          .project(camera);
        entry.place(projected, width, height, true);
      }
    },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', key);
      root.removeFromParent();
      labels.remove();
      sphere.dispose();
      for (const line of [horizon, ecliptic]) {
        line.geometry.dispose();
        line.material.dispose();
      }
      entries.forEach((entry) => entry.mesh.material.dispose());
    },
  };
}
