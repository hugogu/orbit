import * as THREE from 'three';
import { attachEclipseMaterial, MAX_CASTERS } from './eclipse-material';
import {
  shadowFrame,
  possibleCasters,
  shadowBoundary,
  shadowAxisHit,
  shadowTrack,
  type BoundaryKind,
} from '../lib/eclipse-shadows';

export function createEclipseSystem(meshes: Map<string, THREE.Mesh>) {
  const entries = [...meshes]
    .filter(([id]) => id !== 'sun')
    .map(([id, mesh]) => ({
      id,
      mesh,
      material: attachEclipseMaterial(
        mesh.material as THREE.MeshStandardMaterial,
        id === 'earth',
      ),
    }));
  const guideRoot = new THREE.Group();
  guideRoot.name = 'eclipse-guides';
  const colors = { umbra: 0x98c9ff, penumbra: 0xf1ca7e, antumbra: 0xe99cff };
  const makeLine = (color: number, opacity = 0.9) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(192 * 6), 3),
    );
    geometry.setDrawRange(0, 0);
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    line.frustumCulled = false;
    line.raycast = () => {};
    guideRoot.add(line);
    return line;
  };
  const guides = Array.from({ length: MAX_CASTERS }, () => ({
    umbra: makeLine(colors.umbra),
    penumbra: makeLine(colors.penumbra),
    antumbra: makeLine(colors.antumbra),
    track: makeLine(0xbee8ed, 0.5),
  }));
  function draw(
    line: THREE.LineSegments,
    points: (THREE.Vector3 | null)[],
    scale: number,
  ) {
    const attr = line.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    let count = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (!a || !b) continue;
      attr.setXYZ(count++, a.x * scale, a.y * scale, a.z * scale);
      attr.setXYZ(count++, b.x * scale, b.y * scale, b.z * scale);
    }
    attr.needsUpdate = true;
    line.geometry.setDrawRange(0, count);
  }
  let lastGuideDay = NaN,
    lastTrackDay = NaN,
    lastSelected: string | null = null,
    lastCasterKey = '';
  let frame = shadowFrame(0);
  const trackCache = new Map<string, (THREE.Vector3 | null)[]>();
  return {
    guideRoot,
    setEarthNightMap(texture: THREE.Texture) {
      const earth = entries.find((e) => e.id === 'earth');
      if (!earth) return;
      earth.material.uniforms.earthNightMap.value = texture;
      earth.material.uniforms.earthNightReady.value = 1;
    },
    update(
      days: number,
      selected: string | null,
      enabled: boolean,
      showGuides: boolean,
    ) {
      frame = shadowFrame(days);
      const sun = frame.get('sun')!.position;
      for (const entry of entries) {
        const receiver = frame.get(entry.id)!;
        const rotation = entry.mesh
          .getWorldQuaternion(new THREE.Quaternion())
          .invert();
        entry.material.update(
          receiver,
          sun,
          enabled ? possibleCasters(receiver, frame) : [],
          rotation,
          enabled,
        );
      }
      guideRoot.visible =
        enabled &&
        showGuides &&
        !!selected &&
        frame.has(selected) &&
        selected !== 'sun';
      if (!guideRoot.visible) {
        lastGuideDay = NaN;
        return;
      }
      const target = frame.get(selected!)!,
        mesh = meshes.get(selected!)!;
      if (guideRoot.parent !== mesh) mesh.add(guideRoot);
      if (
        selected === lastSelected &&
        Number.isFinite(lastGuideDay) &&
        Math.abs(days - lastGuideDay) < 1 / 86400
      )
        return;
      const casters = possibleCasters(target, frame).slice(0, MAX_CASTERS);
      const key = casters.map((c) => c.id).join('/');
      const refreshTrack =
        selected !== lastSelected ||
        key !== lastCasterKey ||
        !Number.isFinite(lastTrackDay) ||
        Math.abs(days - lastTrackDay) > 1 / 1440 ||
        days < lastTrackDay;
      if (refreshTrack) {
        trackCache.clear();
        lastTrackDay = days;
      }
      const rotation = mesh.getWorldQuaternion(new THREE.Quaternion()).invert();
      guides.forEach((guide, i) => {
        const caster = casters[i];
        for (const kind of [
          'umbra',
          'penumbra',
          'antumbra',
        ] as BoundaryKind[]) {
          const points = caster
            ? shadowBoundary(target, sun, caster, kind).map(
                (p) =>
                  p?.applyQuaternion(rotation).divideScalar(target.radius) ??
                  null,
              )
            : [];
          draw(guide[kind], points, target.size * 1.002);
        }
        if (caster && refreshTrack)
          trackCache.set(caster.id, shadowTrack(target.id, caster.id, days));
        draw(
          guide.track,
          caster ? (trackCache.get(caster.id) ?? []) : [],
          target.size * 1.003,
        );
      });
      lastGuideDay = days;
      lastSelected = selected;
      lastCasterKey = key;
    },
    focusDirection(id: string) {
      const target = frame.get(id);
      if (!target) return new THREE.Vector3(0, 0.52, 0.85).normalize();
      const sun = frame.get('sun')!.position;
      for (const caster of possibleCasters(target, frame)) {
        const hit = shadowAxisHit(target, sun, caster);
        if (hit) return hit.normalize();
      }
      return sun.clone().sub(target.position).normalize();
    },
    dispose() {
      guideRoot.removeFromParent();
      guideRoot.traverse((o) => {
        if (o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    },
  };
}
