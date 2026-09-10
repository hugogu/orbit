import * as THREE from 'three';

const radians = Math.PI / 180;
const localNormal = new THREE.Vector3(0, 0, 1);

/** Convert WGS84 latitude/longitude into the Earth mesh's local frame. */
export function observerSurfacePoint(latitude: number, longitude: number) {
  const lat = latitude * radians;
  const lon = longitude * radians;
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  );
}

export function createObserverMarker(parent: THREE.Group) {
  const root = new THREE.Group();
  root.name = 'earth-observer-marker';
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffefbd,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  dot.renderOrder = 3;
  root.add(dot);
  const rings = [0, 1, 2].map((index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.026, 0.032, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd88a,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.userData.delay = index / 3;
    ring.renderOrder = 2;
    root.add(ring);
    return ring;
  });
  parent.add(root);
  const point = new THREE.Vector3();
  let lastLatitude = NaN;
  let lastLongitude = NaN;
  return {
    root,
    update(latitude: number, longitude: number, visible: boolean, now: number) {
      root.visible = visible;
      if (!visible) return;
      if (latitude !== lastLatitude || longitude !== lastLongitude) {
        point.copy(observerSurfacePoint(latitude, longitude));
        root.position.copy(point).multiplyScalar(1.012);
        root.quaternion.setFromUnitVectors(localNormal, point);
        lastLatitude = latitude;
        lastLongitude = longitude;
      }
      const cycle = (now / 1000 / 2.8) % 1;
      rings.forEach((ring) => {
        const progress = (cycle + ring.userData.delay) % 1;
        ring.scale.setScalar(0.45 + progress * 1.35);
        (ring.material as THREE.MeshBasicMaterial).opacity =
          (1 - progress) * 0.58;
      });
    },
    dispose() {
      root.removeFromParent();
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
    },
  };
}
