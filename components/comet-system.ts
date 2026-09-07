import * as THREE from 'three';
import {
  comets,
  cometActivity,
  cometPosition,
  cometOrbitPoint,
} from '../lib/comets';

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
  const tailGeometry = new THREE.ConeGeometry(1.2, 8, 24, 1, true);
  tailGeometry.rotateZ(Math.PI);
  tailGeometry.translate(0, 4, 0);
  const tail = new THREE.Mesh(
    tailGeometry,
    new THREE.MeshBasicMaterial({
      color: '#85d8f0',
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(tail);
  tail.name = 'ion-tail';
  const label = document.createElement('button');
  label.className = 'planet-label comet-label';
  labelLayer.appendChild(label);
  const position = new THREE.Vector3(),
    center = new THREE.Vector3(),
    projected = new THREE.Vector3(),
    north = new THREE.Vector3(0, 1, 0),
    direction = new THREE.Vector3();
  return {
    position,
    center,
    update(id: string | null, days: number, orbits: boolean) {
      const index = comets.findIndex((c) => c.id === id),
        comet = comets[index];
      group.visible = !!comet;
      if (!comet) {
        label.hidden = true;
        return;
      }
      paths.forEach((path, i) => {
        path.visible = i === index && orbits;
      });
      position.set(...cometPosition(comet, days));
      center
        .set(...cometOrbitPoint(comet, 0))
        .add(new THREE.Vector3(...cometOrbitPoint(comet, Math.PI)))
        .multiplyScalar(0.5);
      head.position.copy(position);
      nucleus.position.copy(position);
      nucleus.rotation.y = days * 2;
      nucleus.userData.id = comet.id;
      label.onclick = () => onSelect?.(comet.id);
      tail.position.copy(position);
      const activity = cometActivity(position.length() / 3.1);
      tail.visible = activity > 0;
      tail.scale.setScalar(activity);
      tail.quaternion.setFromUnitVectors(
        north,
        direction.copy(position).normalize(),
      );
      label.textContent = comet.name;
    },
    project(
      camera: THREE.Camera,
      width: number,
      height: number,
      show: boolean,
    ) {
      projected.copy(position).project(camera);
      label.hidden =
        !group.visible ||
        !show ||
        Math.abs(projected.x) > 0.97 ||
        Math.abs(projected.y) > 0.94 ||
        Math.abs(projected.z) > 1;
      label.style.transform = `translate(-50%,-150%) translate(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px)`;
    },
  };
}
