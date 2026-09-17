'use client';
import { translator, type Locale } from '../lib/i18n';
import { useI18n } from '../lib/i18n/provider';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bodies, type ScaleMode } from '@/lib/solar';
import { planetPosition, bodyOrientation } from '@/lib/ephemeris';
import { DAY_MS, J2000_MS, advanceTime } from '@/lib/simulation-time';
import { comets } from '@/lib/comets';
import { asteroids } from '@/lib/asteroids';
import { createAsteroidSystem } from './asteroid-system';
import {
  ASTEROID_BELT_DISTANCE_RADII,
  ASTEROID_BELT_ILLUSTRATED_RADII,
  ASTEROID_BELT_MAX_RADIUS,
  createAsteroidBelt,
} from './asteroid-belt';
import { createCometSystem } from './comet-system';
import { createMoonSystem } from './moon-system';
import { moonTextureNames, orbitingMoons } from '@/lib/moon-orbits';
import { displayRadius, displaySystemExtent } from '@/lib/display-scale';
import { createTextureManager, type RegisterOptions } from './texture-manager';
import { registerPlanetSurface } from './planet-surface';
import { oblateScale } from '@/lib/planet-terrain';
import { createEclipseSystem } from './eclipse-system';
import { createSunEffects } from './sun-effects';
import { createObserverMarker } from './observer-marker';
import { createSceneLabel, createSceneLabelOcclusion } from './scene-label';
import type { TextureQuality } from '@/lib/texture-quality';
import type { SkyLocation } from '@/lib/sky-events';
import type { EclipseProgressEvent } from '@/lib/eclipse-progress';
import { createEclipsePath } from './eclipse-path';
import {
  createOrbitLine,
  isOrbitLine,
  ORBIT_PATH_SEGMENTS,
  setOrbitLineForeground,
  setOrbitLinePoints,
  setOrbitLineWidth,
  type OrbitLine,
} from './orbit-line';
export type SceneState = {
  locale: Locale;
  speed: number;
  paused: boolean;
  orbits: boolean;
  orbitLineWidth: number;
  labels: boolean;
  belts: boolean;
  scale: ScaleMode;
  selected: string | null;
  view: number;
  reset: number;
  top: boolean;
  cometId: string | null;
  cometClose: boolean;
  epoch: number | null;
  textureQuality: TextureQuality;
  shadows: boolean;
  shadowGuides: boolean;
  eclipseView: boolean;
  activeEclipse: EclipseProgressEvent | null;
  galaxy: boolean;
  solarActivity: boolean;
  cometTails: boolean;
  realSizes: boolean;
  realSurface: boolean;
  realTerrain: boolean;
  systemView: boolean;
  observerLocation: SkyLocation;
  observerLocationReady: boolean;
};
export default function SolarScene({
  state,
  onSelect,
  onTime,
  onAssetStatus,
}: {
  state: SceneState;
  onSelect: (id: string) => void;
  onTime: (days: number) => void;
  onAssetStatus: (message: string) => void;
}) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ state, onSelect, onTime, onAssetStatus });
  const [error, setError] = useState('');
  useEffect(() => {
    latest.current = { state, onSelect, onTime, onAssetStatus };
  }, [state, onSelect, onTime, onAssetStatus]);
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        stencil: true,
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
    const textureManager = createTextureManager(renderer, (message) =>
      latest.current.onAssetStatus(message),
    );
    const applyMap = (
      material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial,
      name: string,
      options: RegisterOptions & { mapColor?: number } = {},
    ) =>
      textureManager.register(
        name,
        (texture) => {
          material.map = texture;
          if (options.mapColor !== undefined)
            material.color.set(options.mapColor);
          material.needsUpdate = true;
        },
        options,
      );
    let galaxyTexture: THREE.Texture | null = null;
    const emptySky = new THREE.Color(0x020408);
    textureManager.register('stars_milky_way', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      galaxyTexture = texture;
    });
    scene.backgroundIntensity = 0.35;
    scene.backgroundRotation.x = -0.55;
    scene.backgroundRotation.y = Math.PI / 2;
    const roots = new Map<string, THREE.Group>(),
      meshes = new Map<string, THREE.Mesh>(),
      orbitLines = new Map<string, OrbitLine>(),
      labels = new Map<string, HTMLButtonElement>(),
      projectLabels = new Map<string, ReturnType<typeof createSceneLabel>>();
    const planetSurfaces: ReturnType<typeof registerPlanetSurface>[] = [];
    let sunEffects: ReturnType<typeof createSunEffects> | null = null,
      observerMarker: ReturnType<typeof createObserverMarker> | null = null,
      earthPivot: THREE.Group | null = null;
    const labelLayer = document.createElement('div');
    labelLayer.className = 'scene-labels';
    container.appendChild(labelLayer);
    const cometSystem = createCometSystem(
      scene,
      labelLayer,
      (id) => latest.current.onSelect(id),
      () =>
        latest.current.onAssetStatus('部分彗星模型加载失败，暂用近似形状。'),
    );
    for (const body of bodies) {
      const root = new THREE.Group();
      scene.add(root);
      roots.set(body.id, root);
      const pivot = new THREE.Group();
      pivot.rotation.z = (body.tilt * Math.PI) / 180;
      root.add(pivot);
      const material =
        body.id === 'sun'
          ? new THREE.MeshBasicMaterial({ color: 0xffe1ad })
          : new THREE.MeshStandardMaterial({
              color:
                body.texture && body.id !== 'uranus' ? 0xffffff : body.color,
              roughness: 1,
            });
      const baseGeometry = new THREE.SphereGeometry(body.size, 96, 64);
      const mesh = new THREE.Mesh(baseGeometry, material);
      mesh.scale.copy(oblateScale(body.flattening));
      if (material instanceof THREE.MeshStandardMaterial)
        planetSurfaces.push(
          registerPlanetSurface(
            body,
            mesh as THREE.Mesh<
              THREE.BufferGeometry,
              THREE.MeshStandardMaterial
            >,
            textureManager,
          ),
        );
      else if (body.texture) applyMap(material, body.texture);
      mesh.userData.id = body.id;
      pivot.add(mesh);
      meshes.set(body.id, mesh);
      if (body.id === 'sun') {
        sunEffects = createSunEffects(
          body.size,
          material as THREE.MeshBasicMaterial,
        );
        root.add(sunEffects.root);
      }
      if (body.id === 'saturn') {
        const geo = new THREE.RingGeometry(3.0, 5.6, 128);
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          uv.setXY(i, (r - 3) / 2.6, 0.5);
        }
        const ring = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88,
            roughness: 1,
            emissive: 0x8b7960,
            emissiveIntensity: 0.2,
          }),
        );
        applyMap(ring.material, 'saturn_ring_alpha');
        ring.rotation.x = -Math.PI / 2;
        pivot.add(ring);
      }
      if (body.id === 'earth') {
        earthPivot = pivot;
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
        const line = createOrbitLine(body.color, 0.2);
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
      projectLabels.set(body.id, createSceneLabel(label));
    }
    if (earthPivot) observerMarker = createObserverMarker(earthPivot);
    const moonSystem = createMoonSystem(
      scene,
      roots,
      meshes,
      labelLayer,
      (id) => latest.current.onSelect(id),
      null,
      textureManager,
    );
    for (const moon of orbitingMoons) {
      const material = meshes.get(moon.id)!
        .material as THREE.MeshStandardMaterial;
      const fallbackColor = material.color.getHex();
      applyMap(material, moonTextureNames[moon.en], {
        lazy: moon.en !== 'Moon',
        mapColor: 0xffffff,
        clear: () => {
          material.map = null;
          material.color.setHex(fallbackColor);
          material.needsUpdate = true;
        },
      });
    }
    const eclipseSystem = createEclipseSystem(meshes);
    const asteroidSystem = createAsteroidSystem(
      scene,
      roots,
      meshes,
      labelLayer,
      (id) => latest.current.onSelect(id),
      () =>
        latest.current.onAssetStatus('部分小行星模型加载失败，暂用近似形状。'),
    );
    for (const asteroid of asteroids) {
      if (asteroid.texture)
        textureManager.register(
          asteroid.texture,
          (texture) => asteroidSystem.setTexture(asteroid.id, texture),
          {
            // These are ordinary body materials, not opt-in terrain data.
            // Attach the local standard map even before an asteroid is focused;
            // the selected body can still upgrade to the high-resolution map.
            lazy: false,
            retainOnNavigation: true,
            clear: () => asteroidSystem.clearTexture(asteroid.id),
          },
        );
      if (asteroid.normalTexture)
        textureManager.register(
          asteroid.normalTexture,
          (texture) => asteroidSystem.setNormalTexture(asteroid.id, texture),
          {
            // Keep normal maps aligned with their body-specific color maps.
            lazy: false,
            retainOnNavigation: true,
            colorSpace: THREE.NoColorSpace,
            clear: () => asteroidSystem.clearNormalTexture(asteroid.id),
          },
        );
    }
    const labelOcclusion = createSceneLabelOcclusion(meshes);
    const eclipsePath = createEclipsePath(meshes.get('earth')!);
    const earthDisplayRadius = bodies.find((b) => b.id === 'earth')!.size;
    textureManager.register('earth_nightmap', (texture) =>
      eclipseSystem.setEarthNightMap(texture),
    );
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const texturePreload = idleWindow.requestIdleCallback
      ? {
          kind: 'idle' as const,
          handle: idleWindow.requestIdleCallback(
            () => textureManager.preload(),
            { timeout: 2500 },
          ),
        }
      : {
          kind: 'timeout' as const,
          handle: window.setTimeout(() => textureManager.preload(), 1800),
        };
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
      opacity = 0.55,
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
      const material = new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity,
        sizeAttenuation: true,
        depthWrite: false,
      });
      // Point sprites are square by default; a circular mask keeps distant
      // small-body populations from looking like a second pixelated starfield.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <output_fragment>',
          'if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;\n#include <output_fragment>',
        );
      };
      material.customProgramCacheKey = () => 'outer-points-round-v1';
      const cloud = new THREE.Points(geometry, material);
      scene.add(cloud);
      return cloud;
    }
    const belt = createAsteroidBelt(rand);
    scene.add(belt.root);
    const kuiper = points(2200, 99, 128, 8, 0xa7c5d6, 0.34, false, 0.8),
      scattered = points(750, 130, 166, 65, 0x9eb7ce, 0.3, false, 0.7),
      oort = points(3500, 190, 228, 0, 0xc1d8e6, 0.8, true, 0.78);
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
    let time = Date.now(),
      epoch: number | null = null,
      previous = performance.now(),
      frame = 0,
      lastReport = 0,
      lastReset = -1,
      lastView = -1,
      lastSelected: string | null | undefined = undefined,
      lastScale = '',
      lastCameraScale = '',
      lastRealSizes = false,
      lastSystemView = false,
      lastCameraAspect = 0,
      lastEclipseFraming = '',
      lastTop = false,
      lastComet = '',
      highResolutionReadyAt = 0,
      transition = 0;
    const navigationTextureGraceMs = 5000;
    let targetDistance = 205;
    let following: THREE.Vector3 | null = null;
    const projected = new THREE.Vector3(),
      newTarget = new THREE.Vector3(),
      desired = new THREE.Vector3();
    controls.addEventListener('start', () => {
      transition = 0;
      following = null;
    });
    const compactScreen = window.matchMedia(
      '(max-width: 700px), (pointer: coarse)',
    );
    // Dragging the window edge can flip this several times a second; only
    // adopt the new value once it holds steady, so a brief resize doesn't
    // reload the 8K galaxy background.
    const compactDebounceMs = 600;
    let compactSignal = compactScreen.matches,
      compactStable = compactSignal,
      compactChangedAt = -Infinity;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    let lastLocale: Locale | undefined;
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const s = latest.current.state,
        dt = Math.min((now - previous) / 1000, 0.08);
      previous = now;
      if (document.hidden) return;
      const compactEclipse =
        s.eclipseView && !!s.activeEclipse && width <= 600 && height < 720;
      const framingKey = `${compactEclipse}-${width}-${height}`;
      const framingChanged = framingKey !== lastEclipseFraming;
      if (framingChanged) {
        // On short portrait screens, frame the body between the collapsed
        // progress card and playback controls instead of behind the card.
        if (compactEclipse)
          camera.setViewOffset(width, height, 0, -63, width, height);
        else camera.clearViewOffset();
        lastEclipseFraming = framingKey;
      }
      const translate = translator(s.locale);
      if (s.locale !== lastLocale) {
        renderer.domElement.setAttribute(
          'aria-label',
          translate('太阳系三维场景，可拖动旋转、滚轮或双指缩放'),
        );
        for (const body of bodies) {
          const label = labels.get(body.id)!;
          label.textContent = translate(body.name);
          label.setAttribute(
            'aria-label',
            translate('探索{{name}}', { name: translate(body.name) }),
          );
        }
        moonSystem.localize(translate);
        asteroidSystem.localize(translate);
        lastLocale = s.locale;
      }
      const selectedMoon = orbitingMoons.find((m) => m.id === s.selected);
      const selectedAsteroid = asteroids.find((item) => item.id === s.selected);
      void asteroidSystem.setFocus(selectedAsteroid?.id ?? null);
      const selectedMoonTexture = selectedMoon?.texture ?? null;
      const selectedMoonSurface =
        s.realSurface ? (selectedMoon?.surfaceTexture ?? null) : null;
      const selectedMoonTerrain =
        s.realTerrain ? (selectedMoon?.heightTexture ?? null) : null;
      const selectedAsteroidTextures = selectedAsteroid
        ? [selectedAsteroid.texture, selectedAsteroid.normalTexture].filter(
            (name): name is string => !!name,
          )
        : [];
      const focusBody = bodies.find(
        (b) =>
          b.id ===
          (orbitingMoons.find((m) => m.id === s.selected)?.parentId ??
            s.selected),
      );
      const surfaceTexture =
        s.realSurface && !selectedMoon && !selectedAsteroid
          ? (focusBody?.surfaceTexture ?? null)
          : null;
      const terrainBody =
        s.realTerrain &&
        !selectedMoon &&
        !selectedAsteroid &&
        focusBody?.heightTexture
          ? focusBody
          : null;
      const terrainTexture = terrainBody?.heightTexture ?? null;
      const activeBodyTextures = [
        ...(selectedAsteroidTextures.length > 0
          ? selectedAsteroidTextures
          : selectedMoonTexture
            ? [selectedMoonTexture]
            : []),
        ...(surfaceTexture ? [surfaceTexture] : []),
        ...(terrainTexture ? [terrainTexture] : []),
        ...(selectedMoonSurface ? [selectedMoonSurface] : []),
        ...(selectedMoonTerrain ? [selectedMoonTerrain] : []),
      ];
      const navigationChanged =
        s.selected !== lastSelected || s.reset !== lastReset;
      if (navigationChanged)
        highResolutionReadyAt = now + navigationTextureGraceMs;
      const navigating = transition > 0 || now < highResolutionReadyAt;
      if (compactScreen.matches !== compactSignal) {
        compactSignal = compactScreen.matches;
        compactChangedAt = now;
      }
      if (now - compactChangedAt > compactDebounceMs)
        compactStable = compactSignal;
      textureManager.update(
        s.textureQuality,
        selectedAsteroid?.texture ??
          selectedMoonTexture ??
          focusBody?.texture ??
          null,
        compactStable,
        !!connection?.saveData,
        s.galaxy,
        activeBodyTextures,
        navigating,
      );
      scene.background = s.galaxy ? (galaxyTexture ?? emptySky) : emptySky;
      const seek = s.epoch !== epoch;
      if (seek) {
        epoch = s.epoch;
        time = s.epoch ?? Date.now();
      }
      time = advanceTime(time, dt, s.speed, s.paused);
      const days = (time - J2000_MS) / DAY_MS;
      if (s.scale !== lastScale || seek) {
        lastScale = s.scale;
        for (const body of bodies) {
          const line = orbitLines.get(body.id);
          if (line) {
            const pts = Array.from(
              { length: ORBIT_PATH_SEGMENTS + 1 },
              (_, i) =>
                new THREE.Vector3(
                  ...planetPosition(
                    body,
                    days + (i / ORBIT_PATH_SEGMENTS) * body.period,
                    s.scale,
                  ),
                ),
            );
            setOrbitLinePoints(line, pts);
          }
        }
      }
      for (const body of bodies) {
        const root = roots.get(body.id)!;
        root.position.set(...planetPosition(body, days, s.scale));
        root.scale.setScalar(
          displayRadius(body.id, s.scale, s.realSizes) / body.size,
        );
        meshes
          .get(body.id)!
          .parent!.quaternion.copy(bodyOrientation(body.id, days));
        const line = orbitLines.get(body.id);
        if (line) {
          line.visible = s.orbits;
          setOrbitLineForeground(line, s.realSizes && s.selected === body.id);
          setOrbitLineWidth(line, s.orbitLineWidth);
        }
      }
      observerMarker?.update(
        s.observerLocation.latitude,
        s.observerLocation.longitude,
        s.observerLocationReady && s.selected === 'earth',
        now,
      );
      moonSystem.update(
        days,
        s.scale,
        s.selected,
        s.orbits,
        s.realSizes,
        s.orbitLineWidth,
      );
      asteroidSystem.update(
        days,
        s.scale,
        s.realSizes,
        s.selected,
        s.orbits,
        s.orbitLineWidth,
      );
      eclipseSystem.update(
        days,
        s.selected,
        s.shadows,
        s.shadowGuides,
        seek,
        !!s.activeEclipse?.path,
      );
      eclipsePath.update(
        s.activeEclipse,
        time,
        s.shadows && s.shadowGuides && s.selected === 'earth',
        earthDisplayRadius,
      );
      belt.setRadiusRange(
        ...(s.scale === 'distance'
          ? ASTEROID_BELT_DISTANCE_RADII
          : ASTEROID_BELT_ILLUSTRATED_RADII),
      );
      belt.setSizeScale(
        s.realSizes
          ? (displayRadius('earth', s.scale, true) * 0.02) /
            ASTEROID_BELT_MAX_RADIUS
          : 1,
      );
      belt.root.visible = s.belts;
      kuiper.visible = s.belts;
      // Distance mode keeps the complete schematic outer population available
      // while the illustrated mode reveals farther layers as the view widens.
      scattered.visible = s.belts && (s.view >= 350 || s.scale === 'distance');
      oort.visible = s.belts && (s.view >= 400 || s.scale === 'distance');
      heliosphere.visible =
        s.belts && (s.view >= 400 || s.scale === 'distance');
      cometSystem.update(
        s.cometId,
        days,
        s.orbits,
        translate,
        s.cometClose,
        s.cometTails,
        s.orbitLineWidth,
      );
      const comet = comets.find((c) => c.id === s.cometId);
      const cometKey = `${s.cometId}/${s.cometClose}`;
      if (
        s.selected !== lastSelected ||
        s.reset !== lastReset ||
        s.view !== lastView ||
        s.top !== lastTop ||
        s.scale !== lastCameraScale ||
        s.realSizes !== lastRealSizes ||
        s.systemView !== lastSystemView ||
        camera.aspect !== lastCameraAspect ||
        framingChanged ||
        cometKey !== lastComet
      ) {
        const body = bodies.find((b) => b.id === s.selected);
        const selectedMoon = orbitingMoons.find((m) => m.id === s.selected);
        targetDistance = comet
          ? s.cometClose
            ? 3.2 / Math.min(1, Math.max(0.5, camera.aspect))
            : Math.max(35, comet.au * 3.1 * 3.4) / Math.min(1, camera.aspect)
          : selectedMoon
            ? 5 / Math.min(1, camera.aspect)
            : body
              ? Math.max(
                  body.size * (s.scale === 'distance' ? 0.32 : 1) * 9 + 3,
                  (displaySystemExtent(body.id, s.scale, s.realSizes) * 2.8) /
                    Math.min(1, camera.aspect),
                )
              : s.view;
        const radius = s.selected
          ? displayRadius(s.selected, s.scale, s.realSizes) *
            (selectedAsteroid
              ? meshes.get(selectedAsteroid.id)!.geometry.boundingSphere!.radius
              : 1)
          : 1;
        if (
          ((s.eclipseView || s.realSizes) && (body || selectedMoon)) ||
          selectedAsteroid
        ) {
          targetDistance =
            (radius * (s.eclipseView ? 4.5 : 6)) / Math.min(1, camera.aspect);
          if (compactEclipse) {
            const pixelRadius = Math.max(24, (height - 436) * 0.42);
            const focalLength =
              height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
            targetDistance = Math.max(
              targetDistance,
              radius * Math.hypot(1, focalLength / pixelRadius),
            );
          }
          if (s.systemView && body)
            targetDistance = Math.max(
              targetDistance,
              (displaySystemExtent(body.id, s.scale, s.realSizes) * 2.8) /
                Math.min(1, camera.aspect),
            );
        }
        controls.minDistance =
          (s.realSizes || selectedAsteroid) && s.selected ? radius * 1.2 : 1;
        camera.near =
          (s.realSizes || selectedAsteroid) && s.selected
            ? Math.max(1e-10, radius * 0.01)
            : 0.05;
        camera.updateProjectionMatrix();
        transition = 1;
        following = null;
        lastSelected = s.selected;
        lastReset = s.reset;
        lastView = s.view;
        lastTop = s.top;
        lastCameraScale = s.scale;
        lastRealSizes = s.realSizes;
        lastSystemView = s.systemView;
        lastCameraAspect = camera.aspect;
        lastComet = cometKey;
      }
      newTarget.copy(
        comet
          ? s.cometClose
            ? cometSystem.position
            : cometSystem.center
          : s.selected
            ? (roots.get(s.selected)?.position ?? new THREE.Vector3())
            : new THREE.Vector3(),
      );
      if (transition > 0) {
        controls.target.lerp(newTarget, 0.07);
        desired
          .copy(newTarget)
          .add(
            s.eclipseView && s.selected
              ? eclipseSystem
                  .focusDirection(s.selected)
                  .multiplyScalar(targetDistance)
              : s.top
                ? new THREE.Vector3(
                    targetDistance * 0.0001,
                    targetDistance,
                    targetDistance * 0.0001,
                  )
                : new THREE.Vector3(
                    0,
                    targetDistance * 0.52,
                    targetDistance * 0.85,
                  ),
          );
        camera.position.lerp(desired, 0.055);
        transition -= dt * 0.5;
        if (transition <= 0) {
          camera.position.copy(desired);
          controls.target.copy(newTarget);
          following = newTarget.clone();
        }
      } else if (s.selected || (comet && s.cometClose)) {
        if (following) {
          const delta = newTarget.clone().sub(following);
          camera.position.add(delta);
          controls.target.add(delta);
        }
        following = newTarget.clone();
      }
      controls.update();
      if (s.labels) labelOcclusion.update(camera);
      sunEffects?.update(
        days,
        camera,
        meshes.get('sun')!.parent!.quaternion,
        s.solarActivity,
      );
      belt.update(camera.position, days);
      renderer.render(scene, camera);
      asteroidSystem.project(
        camera,
        width,
        height,
        s.selected,
        s.labels,
        labelOcclusion.isOccluded,
      );
      cometSystem.project(
        camera,
        width,
        height,
        s.labels,
        s.labels ? labelOcclusion.isOccluded : undefined,
      );
      moonSystem.project(
        camera,
        width,
        height,
        s.selected,
        s.labels,
        s.labels ? labelOcclusion.isOccluded : undefined,
      );
      for (const body of bodies) {
        projected.copy(roots.get(body.id)!.position);
        projected.y += displayRadius(body.id, s.scale, s.realSizes) * 1.2;
        projected.project(camera);
        projectLabels.get(body.id)!(
          projected,
          width,
          height,
          s.labels,
          body.id === s.selected,
          s.labels
            ? labelOcclusion.isOccluded(body.id, roots.get(body.id)!.position)
            : false,
        );
      }
      if (now - lastReport > 350) {
        latest.current.onTime(time);
        lastReport = now;
      }
    };
    frame = requestAnimationFrame(animate);
    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frame);
      setError('3D 图形连接已中断，请刷新页面恢复。');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    return () => {
      cancelAnimationFrame(frame);
      if (texturePreload.kind === 'idle')
        idleWindow.cancelIdleCallback?.(texturePreload.handle);
      else window.clearTimeout(texturePreload.handle);
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      controls.dispose();
      eclipseSystem.dispose();
      eclipsePath.dispose();
      observerMarker?.dispose();
      belt.dispose();
      asteroidSystem.dispose();
      cometSystem.dispose();
      planetSurfaces.forEach((surface) => surface.dispose());
      moonSystem.dispose();
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points ||
          isOrbitLine(o)
        ) {
          if (o instanceof THREE.InstancedMesh) o.dispose();
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        } else if (o instanceof THREE.Sprite) o.material.dispose();
      });
      textureManager.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost,
      );
      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
    };
  }, []);
  return (
    <div className="scene" ref={host}>
      {error && (
        <div className="scene-error" role="alert">
          {t(error)}
        </div>
      )}
    </div>
  );
}
