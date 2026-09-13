import type { Translate } from '../lib/i18n';
import { createSceneLabel } from './scene-label';
import { createCometAtmosphere } from './comet-atmosphere';
import * as THREE from 'three';
import { comets, cometPosition, cometOrbitPoint } from '../lib/comets';
const untranslated: Translate = (key) => key;

export function createCometSystem(
  scene: THREE.Scene,
  labelLayer: HTMLElement,
  onSelect?: (id: string) => void,
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
  const nucleus = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.24, 1),
    new THREE.MeshStandardMaterial({ color: '#8c847b', roughness: 1 }),
  );
  nucleus.scale.set(1.5, 0.85, 1);
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
        return;
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
  };
}
