'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bodies, orbitPosition, type ScaleMode } from '@/lib/solar';
import { comets } from '@/lib/comets';
import { createCometSystem } from './comet-system';
export type SceneState = {
  speed: number;
  paused: boolean;
  orbits: boolean;
  labels: boolean;
  belts: boolean;
  scale: ScaleMode;
  selected: string | null;
  view: number;
  reset: number;
  top: boolean;
  cometId: string | null;
  cometClose: boolean;
  cometRestart: number;
};
export default function SolarScene({
  state,
  onSelect,
  onTime,
}: {
  state: SceneState;
  onSelect: (id: string) => void;
  onTime: (days: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ state, onSelect, onTime });
  const [error, setError] = useState('');
  useEffect(() => {
    latest.current = { state, onSelect, onTime };
  }, [state, onSelect, onTime]);
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() =>
        setError(
          '当前浏览器无法启动 3D 显示。请启用硬件加速或换用支持 WebGL 2 的浏览器。天体知识仍可通过列表阅读。',
        ),
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      '太阳系三维场景，可拖动旋转、滚轮或双指缩放',
    );
    renderer.domElement.tabIndex = 0;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(47, 1, 0.05, 20000);
    camera.position.set(0, 115, 170);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.minDistance = 1;
    controls.maxDistance = 10000;
    controls.maxPolarAngle = Math.PI * 0.97;
    controls.enablePan = true;
    scene.add(new THREE.AmbientLight(0x8098c4, 0.65));
    const sunlight = new THREE.PointLight(0xffead0, 3.5, 0, 0);
    scene.add(sunlight);
    const textureLoader = new THREE.TextureLoader(),
      textures: THREE.Texture[] = [];
    const load = (name: string) => {
      const t = textureLoader.load('/textures/2k_' + name + '.jpg');
      t.colorSpace = THREE.SRGBColorSpace;
      textures.push(t);
      return t;
    };
    const roots = new Map<string, THREE.Group>(),
      meshes = new Map<string, THREE.Mesh>(),
      orbitLines = new Map<string, THREE.Line>(),
      labels = new Map<string, HTMLButtonElement>();
    const labelLayer = document.createElement('div');
    labelLayer.className = 'scene-labels';
    container.appendChild(labelLayer);
    const cometSystem = createCometSystem(scene, labelLayer);
    for (const body of bodies) {
      const root = new THREE.Group();
      scene.add(root);
      roots.set(body.id, root);
      const pivot = new THREE.Group();
      pivot.rotation.z = (body.tilt * Math.PI) / 180;
      root.add(pivot);
      const material =
        body.id === 'sun'
          ? new THREE.MeshBasicMaterial({ map: load('sun'), color: 0xffe1ad })
          : new THREE.MeshStandardMaterial({
              map: body.texture ? load(body.texture) : null,
              color: body.texture ? 0xffffff : body.color,
              roughness: 1,
            });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(body.size, 48, 32),
        material,
      );
      mesh.userData.id = body.id;
      pivot.add(mesh);
      meshes.set(body.id, mesh);
      if (body.id === 'sun') {
        const glow = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {},
            vertexShader:
              'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
            fragmentShader:
              'varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float a=pow(max(0.,1.-r),3.);gl_FragColor=vec4(1.,.38,.06,a*.8);}',
          }),
        );
        glow.scale.set(34, 34, 1);
        glow.name = 'sun-glow';
        root.add(glow);
      }
      if (body.id === 'saturn') {
        const geo = new THREE.RingGeometry(3.0, 5.6, 128);
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (r - 3) / 2.6, 0.5);
        }
        const t = textureLoader.load('/textures/2k_saturn_ring_alpha.png');
        t.colorSpace = THREE.SRGBColorSpace;
        textures.push(t);
        const ring = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            map: t,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
            roughness: 1,
            emissive: 0x8b7960,
            emissiveIntensity: 0.2,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        pivot.add(ring);
      }
      if (body.id === 'earth') {
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(1.04, 32, 24),
          new THREE.MeshBasicMaterial({
            color: 0x398eff,
            transparent: true,
            opacity: 0.09,
            side: THREE.BackSide,
          }),
        );
        root.add(atmosphere);
      }
      if (body.period) {
        const line = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: body.color,
            transparent: true,
            opacity: 0.2,
          }),
        );
        orbitLines.set(body.id, line);
        scene.add(line);
      }
      const label = document.createElement('button');
      label.className = 'planet-label';
      label.textContent = body.name;
      label.setAttribute('aria-label', '探索' + body.name);
      label.onclick = () => latest.current.onSelect(body.id);
      labelLayer.appendChild(label);
      labels.set(body.id, label);
    }
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 24, 16),
      new THREE.MeshStandardMaterial({ map: load('moon'), roughness: 1 }),
    );
    scene.add(moon);
    // Seeded distributions are conceptual populations, not measured asteroid positions.
    let seed = 71;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    function points(
      count: number,
      inner: number,
      outer: number,
      height: number,
      color: number,
      size: number,
      spherical = false,
    ) {
      const a = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = rand() * Math.PI * 2,
          r = inner + rand() * (outer - inner),
          y = spherical ? rand() * 2 - 1 : ((rand() - 0.5) * height) / r;
        const h = Math.sqrt(1 - y * y);
        a.set([Math.cos(theta) * r * h, y * r, Math.sin(theta) * r * h], i * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(a, 3));
      const cloud = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color,
          size,
          transparent: true,
          opacity: 0.55,
          sizeAttenuation: true,
          depthWrite: false,
        }),
      );
      scene.add(cloud);
      return cloud;
    }
    points(4200, 700, 2300, 0, 0xbccbe7, 2.2, true);
    const belt = points(1800, 35, 40, 2, 0xa89983, 0.13),
      kuiper = points(2200, 99, 128, 8, 0x6f899a, 0.18),
      scattered = points(750, 130, 166, 65, 0x8394b2, 0.2),
      oort = points(3500, 190, 228, 0, 0x7a92b5, 0.4, true);
    const heliosphere = new THREE.Mesh(
      new THREE.SphereGeometry(167, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x6aa2a4,
        wireframe: true,
        transparent: true,
        opacity: 0.028,
      }),
    );
    scene.add(heliosphere);
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...meshes.values()])[0];
      if (hit) latest.current.onSelect(hit.object.userData.id);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches('input,button,[role="slider"]') ||
          e.target.closest('[role="dialog"]'))
      )
        return;
      const step = camera.position.distanceTo(controls.target) * 0.04;
      const offset = camera.position.clone().sub(controls.target);
      const right = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrix, 0)
        .multiplyScalar(step);
      const forward = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrix, 1)
        .multiplyScalar(step);
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) {
        camera.position.sub(right);
        controls.target.sub(right);
      } else if (['ArrowRight', 'd', 'D'].includes(e.key)) {
        camera.position.add(right);
        controls.target.add(right);
      } else if (['ArrowUp', 'w', 'W'].includes(e.key)) {
        camera.position.add(forward);
        controls.target.add(forward);
      } else if (['ArrowDown', 's', 'S'].includes(e.key)) {
        camera.position.sub(forward);
        controls.target.sub(forward);
      } else if (e.key === '=' || e.key === '+')
        camera.position.copy(controls.target).add(offset.multiplyScalar(0.88));
      else if (e.key === '-')
        camera.position.copy(controls.target).add(offset.multiplyScalar(1.12));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    let width = 0,
      height = 0;
    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let days = 0,
      previous = performance.now(),
      frame = 0,
      lastReport = 0,
      lastReset = -1,
      lastView = -1,
      lastSelected: string | null | undefined = undefined,
      lastScale = '',
      lastTop = false,
      lastComet = '',
      transition = 0;
    let targetDistance = 205;
    let following: THREE.Vector3 | null = null;
    const projected = new THREE.Vector3(),
      newTarget = new THREE.Vector3(),
      desired = new THREE.Vector3();
    controls.addEventListener('start', () => {
      transition = 0;
      following = null;
    });
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const s = latest.current.state,
        dt = Math.min((now - previous) / 1000, 0.08);
      previous = now;
      if (document.hidden) return;
      if (!s.paused) days += dt * s.speed;
      if (s.scale !== lastScale) {
        lastScale = s.scale;
        for (const body of bodies) {
          const line = orbitLines.get(body.id);
          if (line) {
            const pts = Array.from(
              { length: 257 },
              (_, i) =>
                new THREE.Vector3(
                  ...orbitPosition(
                    body,
                    (((i / 256) * Math.PI * 2 - body.phase) / (Math.PI * 2)) *
                      body.period,
                    s.scale,
                  ),
                ),
            );
            line.geometry.dispose();
            line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
          }
        }
      }
      for (const body of bodies) {
        const root = roots.get(body.id)!;
        root.position.set(...orbitPosition(body, days, s.scale));
        root.scale.setScalar(
          s.scale === 'distance' ? (body.id === 'sun' ? 0.09 : 0.32) : 1,
        );
        meshes.get(body.id)!.rotation.y = (days / body.day) * Math.PI * 2;
        const line = orbitLines.get(body.id);
        if (line) line.visible = s.orbits;
      }
      const earth = roots.get('earth')!.position;
      const mr = s.scale === 'distance' ? 0.65 : 2;
      moon.position
        .copy(earth)
        .add(
          new THREE.Vector3(
            Math.cos((days / 27.322) * Math.PI * 2) * mr,
            0,
            -Math.sin((days / 27.322) * Math.PI * 2) * mr,
          ),
        );
      moon.rotation.y = (days / 27.322) * Math.PI * 2;
      moon.scale.setScalar(s.scale === 'distance' ? 0.32 : 1);
      belt.visible = s.belts && s.scale === 'illustrated';
      kuiper.visible = s.belts && s.scale === 'illustrated';
      scattered.visible = s.belts && s.view >= 350 && s.scale === 'illustrated';
      oort.visible = s.belts && s.view >= 400 && s.scale === 'illustrated';
      heliosphere.visible =
        s.belts && s.view >= 400 && s.scale === 'illustrated';
      cometSystem.update(s.cometId, s.cometRestart, days, s.orbits);
      const comet = comets.find((c) => c.id === s.cometId);
      const cometKey = `${s.cometId}/${s.cometClose}/${s.cometRestart}`;
      if (
        s.selected !== lastSelected ||
        s.reset !== lastReset ||
        s.view !== lastView ||
        s.top !== lastTop ||
        cometKey !== lastComet
      ) {
        const body = bodies.find((b) => b.id === s.selected);
        targetDistance = comet
          ? s.cometClose
            ? 22 / Math.min(1, Math.max(0.5, camera.aspect))
            : Math.max(35, comet.au * 3.1 * 3.4) / Math.min(1, camera.aspect)
          : body
            ? body.size * (s.scale === 'distance' ? 0.32 : 1) * 9 + 3
            : s.view;
        transition = 1;
        following = null;
        lastSelected = s.selected;
        lastReset = s.reset;
        lastView = s.view;
        lastTop = s.top;
        lastComet = cometKey;
      }
      newTarget.copy(
        comet
          ? s.cometClose
            ? cometSystem.position
            : cometSystem.center
          : s.selected
            ? roots.get(s.selected)!.position
            : new THREE.Vector3(),
      );
      if (transition > 0) {
        controls.target.lerp(newTarget, 0.07);
        desired
          .copy(newTarget)
          .add(
            s.top
              ? new THREE.Vector3(0.001, targetDistance, 0.001)
              : new THREE.Vector3(
                  0,
                  targetDistance * 0.52,
                  targetDistance * 0.85,
                ),
          );
        camera.position.lerp(desired, 0.055);
        transition -= dt * 0.5;
        if (transition <= 0) following = newTarget.clone();
      } else if (s.selected || (comet && s.cometClose)) {
        if (following) {
          const delta = newTarget.clone().sub(following);
          camera.position.add(delta);
          controls.target.add(delta);
        }
        following = newTarget.clone();
      }
      controls.update();
      scene.getObjectByName('sun-glow')?.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
      cometSystem.project(camera, width, height, s.labels);
      for (const body of bodies) {
        const label = labels.get(body.id)!;
        projected.copy(roots.get(body.id)!.position);
        projected.y += body.size * (s.scale === 'distance' ? 0.32 : 1) + 0.9;
        projected.project(camera);
        const show =
          s.labels &&
          projected.z < 1 &&
          projected.z > -1 &&
          Math.abs(projected.x) < 0.97 &&
          Math.abs(projected.y) < 0.94;
        label.style.display = show ? 'block' : 'none';
        label.style.transform = `translate(-50%,-100%) translate(${(projected.x * 0.5 + 0.5) * width}px,${(-projected.y * 0.5 + 0.5) * height}px)`;
        label.classList.toggle('selected', body.id === s.selected);
      }
      if (now - lastReport > 350) {
        latest.current.onTime(days);
        lastReport = now;
      }
    };
    frame = requestAnimationFrame(animate);
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setError('3D 图形连接已中断，请刷新页面恢复。');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      controls.dispose();
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points
        ) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        } else if (o instanceof THREE.Sprite) o.material.dispose();
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      container.replaceChildren();
    };
  }, []);
  return (
    <div className="scene" ref={host}>
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
