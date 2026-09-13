import * as THREE from 'three';

/** Avoid layout/accessibility mutations for invisible or subpixel label motion. */
export function createSceneLabel(label: HTMLElement, offset = -100) {
  let previousDisplay = '';
  let previousTransform = '';
  let previousSelected: boolean | undefined;
  return (
    point: { x: number; y: number; z: number },
    width: number,
    height: number,
    enabled: boolean,
    selected = false,
    occluded = false,
  ) => {
    const visible =
      enabled &&
      !occluded &&
      Math.abs(point.z) < 1 &&
      Math.abs(point.x) < 0.97 &&
      Math.abs(point.y) < 0.94;
    const display = visible ? 'block' : 'none';
    if (display !== previousDisplay) {
      label.style.display = display;
      previousDisplay = display;
    }
    if (!visible) return;
    const x = ((point.x * 0.5 + 0.5) * width).toFixed(1);
    const y = ((-point.y * 0.5 + 0.5) * height).toFixed(1);
    const transform = `translate(-50%,${offset}%) translate(${x}px,${y}px)`;
    if (transform !== previousTransform) {
      label.style.transform = transform;
      previousTransform = transform;
    }
    if (selected !== previousSelected) {
      label.classList.toggle('selected', selected);
      previousSelected = selected;
    }
  };
}

type LabelOccluder = {
  id: string;
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  localRadius: number;
  radius: number;
  visible: boolean;
};

/**
 * DOM labels do not participate in the WebGL depth buffer. Approximate each
 * rendered body with its world-space bounding sphere so labels disappear when
 * their body is behind another rendered body.
 */
export function createSceneLabelOcclusion(
  meshes: Map<string, THREE.Mesh>,
) {
  const cameraPosition = new THREE.Vector3();
  const viewDirection = new THREE.Vector3();
  const candidateToCamera = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const occluders: LabelOccluder[] = Array.from(meshes, ([id, mesh]) => {
    mesh.geometry.computeBoundingSphere();
    return {
      id,
      mesh,
      center: new THREE.Vector3(),
      localRadius: mesh.geometry.boundingSphere?.radius ?? 0,
      radius: 0,
      visible: false,
    };
  });

  return {
    update(camera: THREE.Camera) {
      camera.getWorldPosition(cameraPosition);
      for (const candidate of occluders) {
        candidate.mesh.getWorldPosition(candidate.center);
        candidate.mesh.getWorldScale(scale);
        candidate.radius =
          candidate.localRadius * Math.max(scale.x, scale.y, scale.z);
        candidate.visible = candidate.mesh.visible;
        for (
          let parent = candidate.mesh.parent;
          candidate.visible && parent;
          parent = parent.parent
        )
          candidate.visible = parent.visible;
      }
    },
    isOccluded: (targetId: string | null, targetCenter: THREE.Vector3) => {
      const targetDistance = cameraPosition.distanceTo(targetCenter);
      if (targetDistance <= 0) return false;

      viewDirection
        .copy(targetCenter)
        .sub(cameraPosition)
        .multiplyScalar(1 / targetDistance);
      const tolerance = Math.max(1e-5, targetDistance * 1e-5);
      for (const candidate of occluders) {
        if (
          candidate.id === targetId ||
          !candidate.visible ||
          candidate.radius <= 0
        )
          continue;
        candidateToCamera.copy(candidate.center).sub(cameraPosition);
        const alongRay = candidateToCamera.dot(viewDirection);
        if (alongRay <= 0 || alongRay >= targetDistance) continue;
        const perpendicularSquared =
          candidateToCamera.lengthSq() - alongRay * alongRay;
        const radiusSquared = candidate.radius * candidate.radius;
        if (perpendicularSquared >= radiusSquared) continue;
        const entryDistance =
          alongRay - Math.sqrt(radiusSquared - perpendicularSquared);
        if (entryDistance < targetDistance - tolerance) return true;
      }
      return false;
    },
  };
}
