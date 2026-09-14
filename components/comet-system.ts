import type { Translate } from '../lib/i18n';
import { createSceneLabel } from './scene-label';
import { createCometAtmosphere } from './comet-atmosphere';
import * as THREE from 'three';
import {
  comets,
  cometPosition,
  cometOrbitPoint,
  type Comet,
} from '../lib/comets';
import {
  asteroidModelScale,
  parseAsteroidModel,
  type AsteroidModelData,
} from '../lib/asteroid-model';
const untranslated: Translate = (key) => key;

function fallbackGeometry(comet: Comet) {
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const scale =
    comet.id === 'encke'
      ? [1.42, 0.8, 0.76]
      : comet.id === 'hale-bopp'
        ? [1.55, 0.94, 0.84]
        : comet.id === '67p'
          ? [1.3, 0.9, 0.8]
          : [1.4, 0.82, 0.72];
  geometry.scale(scale[0], scale[1], scale[2]);
  geometry.computeBoundingSphere();
  return geometry;
}

function modelGeometry(model: AsteroidModelData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(model.positions, 3),
  );
  geometry.setAttribute('normal', new THREE.BufferAttribute(model.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(model.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(model.indices, 1));
  // Keep the model's measured silhouette while normalizing its volume to one
  // mean radius, matching the display convention used by asteroid meshes.
  const scale = asteroidModelScale(model);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export function createCometSystem(
  scene: THREE.Scene,
  labelLayer: HTMLElement,
  onSelect?: (id: string) => void,
  onModelError: () => void = () => {},
) {
  const group = new THREE.Group();
  group.name = 'comet-system';
  scene.add(group);
  const paths = comets.map((comet) => {
    // Sample eccentric anomaly so even very elongated ellipses remain smooth.
    const points = Array.from(
      { length: 513 },
      (_, i) =>
        new THREE.Vector3(...cometOrbitPoint(comet, (i / 512) * Math.PI * 2)),
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: comet.color,
        transparent: true,
        opacity: 0.7,
      }),
    );
    group.add(line);
    return line;
  });
  const head = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader:
        'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=12.;}',
      fragmentShader:
        'void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.65,.94,1.,pow(1.-r,0.7));}',
    }),
  );
  group.add(head);
  head.name = 'comet-head';
  const nucleus = new THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >(
    fallbackGeometry(comets[0]),
    new THREE.MeshStandardMaterial({
      color: comets[0].surfaceColor,
      roughness: 0.98,
      metalness: 0,
    }),
  );
  nucleus.scale.setScalar(0.24);
  nucleus.name = 'comet-nucleus';
  group.add(nucleus);
  const atmosphere = createCometAtmosphere();
  group.add(atmosphere.group);
  const orbitFrames = comets.map((comet) => {
    const peri = new THREE.Vector3(...cometOrbitPoint(comet, 0));
    const opposite = new THREE.Vector3(...cometOrbitPoint(comet, Math.PI));
    const normal = peri
      .clone()
      .cross(new THREE.Vector3(...cometOrbitPoint(comet, Math.PI / 2)))
      .normalize();
    return { center: peri.add(opposite).multiplyScalar(0.5), normal };
  });
  const label = document.createElement('button');
  label.className = 'planet-label comet-label';
  labelLayer.appendChild(label);
  const projectLabel = createSceneLabel(label, -150);
  let lastComet: string | null = null;
  let lastTranslate: Translate | undefined;
  label.onclick = () => {
    if (lastComet) onSelect?.(lastComet);
  };
  const position = new THREE.Vector3(),
    center = new THREE.Vector3(),
    projected = new THREE.Vector3();
  const modelCache = new Map<string, THREE.BufferGeometry>();
  const fallbackCache = new Map<string, THREE.BufferGeometry>();
  const pendingModels = new Map<string, Promise<void>>();
  let activeId: string | null = null;
  let loadingId: string | null = null;
  let modelController: AbortController | null = null;
  let disposed = false;
  const setGeometry = (comet: Comet, geometry: THREE.BufferGeometry) => {
    if (activeId === comet.id) nucleus.geometry = geometry;
  };
  const getFallback = (comet: Comet) => {
    let geometry = fallbackCache.get(comet.id);
    if (!geometry) {
      geometry = fallbackGeometry(comet);
      fallbackCache.set(comet.id, geometry);
    }
    return geometry;
  };
  const ensureModel = (comet: Comet) => {
    const cached = modelCache.get(comet.id);
    if (cached) {
      setGeometry(comet, cached);
      return;
    }
    const pending = pendingModels.get(comet.id);
    if (pending) return;
    const controller = new AbortController();
    modelController = controller;
    loadingId = comet.id;
    const request = (async () => {
      try {
        const response = await fetch(
          `/models/comets/${encodeURIComponent(comet.shapeModel)}.bin?v=comet-shape-v1`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const model = parseAsteroidModel(await response.arrayBuffer());
        if (disposed || controller.signal.aborted) return;
        const geometry = modelGeometry(model);
        modelCache.set(comet.id, geometry);
        setGeometry(comet, geometry);
      } catch {
        if (!disposed && !controller.signal.aborted) {
          setGeometry(comet, getFallback(comet));
          onModelError();
        }
      }
    })();
    pendingModels.set(comet.id, request);
    void request.finally(() => {
      if (pendingModels.get(comet.id) === request)
        pendingModels.delete(comet.id);
      if (loadingId === comet.id) loadingId = null;
    });
  };
  return {
    position,
    center,
    update(
      id: string | null,
      days: number,
      orbits: boolean,
      t: Translate = untranslated,
      close = false,
      tails = true,
    ) {
      const index = comets.findIndex((c) => c.id === id),
        comet = comets[index];
      group.visible = !!comet;
      if (!comet) {
        activeId = null;
        return;
      }
      if (activeId !== comet.id) {
        modelController?.abort();
        if (loadingId) pendingModels.delete(loadingId);
        activeId = comet.id;
        nucleus.geometry = modelCache.get(comet.id) ?? getFallback(comet);
        ensureModel(comet);
      }
      paths.forEach((path, i) => {
        path.visible = i === index && orbits;
      });
      position.set(...cometPosition(comet, days));
      center.copy(orbitFrames[index].center);
      head.position.copy(position);
      head.visible = !close;
      nucleus.position.copy(position);
      nucleus.rotation.y = days * 2;
      (nucleus.material as THREE.MeshStandardMaterial).color.set(
        comet.surfaceColor,
      );
      nucleus.userData.id = comet.id;
      atmosphere.update(position, orbitFrames[index].normal, days, tails);
      if (lastComet !== comet.id || lastTranslate !== t) {
        label.textContent = t(comet.name);
        label.setAttribute(
          'aria-label',
          t('跟随{{name}}', { name: t(comet.name) }),
        );
        lastComet = comet.id;
        lastTranslate = t;
      }
    },
    nucleus,
    project(
      camera: THREE.Camera,
      width: number,
      height: number,
      show: boolean,
      isOccluded?: (id: string | null, center: THREE.Vector3) => boolean,
    ) {
      projected.copy(position).project(camera);
      projectLabel(
        projected,
        width,
        height,
        group.visible && show,
        false,
        isOccluded?.(null, position) ?? false,
      );
    },
    dispose() {
      disposed = true;
      modelController?.abort();
      const current = nucleus.geometry;
      for (const geometry of [
        ...modelCache.values(),
        ...fallbackCache.values(),
      ])
        if (geometry !== current) geometry.dispose();
      modelCache.clear();
      fallbackCache.clear();
    },
  };
}
