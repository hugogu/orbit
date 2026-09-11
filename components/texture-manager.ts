import * as THREE from 'three';
import {
  texturePath,
  shouldLoadHighResolution,
  type TextureQuality,
} from '../lib/texture-quality';
type Slot = {
  name: string;
  apply: (texture: THREE.Texture) => void;
  clear?: () => void;
  lazy: boolean;
  path: string;
  loadedPath: string;
  texture: THREE.Texture | null;
  version: number;
  downgradeTimer: ReturnType<typeof setTimeout> | null;
  navigationHold: boolean;
};
const navigationTextureHoldMs = 8000;
const preloadConcurrency = 2;
export type RegisterOptions = {
  /** Defer loading until this map is the selected/focused surface. */
  lazy?: boolean;
  /** Clear the material map when a lazy surface is released. */
  clear?: () => void;
};
export function createTextureManager(
  renderer: THREE.WebGLRenderer,
  onStatus: (message: string) => void,
) {
  const loader = new THREE.TextureLoader(),
    slots: Slot[] = [];
  const textureCache = new Map<string, THREE.Texture>(),
    cacheRequests = new Set<string>(),
    pendingLoads = new Map<string, Promise<THREE.Texture>>(),
    preloadQueue: string[] = [],
    queuedPreloads = new Set<string>();
  let disposed = false,
    failed = new Set<string>(),
    activePreloads = 0;
  const configure = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
  };
  const warm = (texture: THREE.Texture) => {
    const initTexture = (
      renderer as THREE.WebGLRenderer & {
        initTexture?: (value: THREE.Texture) => void;
      }
    ).initTexture;
    if (typeof initTexture !== 'function') return;
    try {
      initTexture.call(renderer, texture);
    } catch {
      // A lost context can make an idle prewarm fail; normal rendering retries it.
    }
  };
  function loadTexture(path: string, cache = false) {
    if (cache) cacheRequests.add(path);
    const cached = textureCache.get(path);
    if (cached) return Promise.resolve(cached);
    const pending = pendingLoads.get(path);
    if (pending) return pending;
    const promise = loader.loadAsync(path);
    pendingLoads.set(path, promise);
    void promise.then(
      (texture) => {
        if (disposed) {
          texture.dispose();
          if (pendingLoads.get(path) === promise) pendingLoads.delete(path);
          return;
        }
        if (cacheRequests.has(path)) {
          configure(texture);
          textureCache.set(path, texture);
          warm(texture);
        }
        if (pendingLoads.get(path) === promise) pendingLoads.delete(path);
      },
      () => {
        if (pendingLoads.get(path) === promise) pendingLoads.delete(path);
      },
    );
    return promise;
  }
  async function request(slot: Slot, path: string) {
    if (slot.path === path || disposed) return;
    if (slot.downgradeTimer) {
      clearTimeout(slot.downgradeTimer);
      slot.downgradeTimer = null;
    }
    const previousTexture = slot.texture,
      previousLoadedPath = slot.loadedPath;
    slot.path = path;
    const version = ++slot.version;
    try {
      const texture = await loadTexture(path);
      if (disposed || version !== slot.version) {
        if (!disposed && !textureCache.has(path)) texture.dispose();
        return;
      }
      configure(texture);
      if (cacheRequests.has(path)) {
        textureCache.set(path, texture);
        warm(texture);
      }
      slot.apply(texture);
      if (
        previousTexture &&
        previousTexture !== texture &&
        !textureCache.has(previousLoadedPath)
      )
        previousTexture.dispose();
      slot.texture = texture;
      slot.loadedPath = path;
    } catch {
      if (disposed || version !== slot.version) return;
      failed.add(path);
      const fallback = texturePath(
        slot.name,
        false,
        renderer.capabilities.maxTextureSize,
      );
      onStatus(
        path === fallback
          ? '部分材质加载失败，可刷新重试。'
          : '高清材质加载失败，已回退到标准画质。',
      );
      if (path !== fallback) void request(slot, fallback);
    }
  }
  function release(slot: Slot) {
    if (!slot.path && !slot.texture) return;
    if (slot.downgradeTimer) {
      clearTimeout(slot.downgradeTimer);
      slot.downgradeTimer = null;
    }
    slot.navigationHold = false;
    slot.version++;
    slot.path = '';
    if (slot.texture && !textureCache.has(slot.loadedPath))
      slot.texture.dispose();
    slot.texture = null;
    slot.loadedPath = '';
    slot.clear?.();
  }
  function pumpPreloads() {
    while (
      !disposed &&
      activePreloads < preloadConcurrency &&
      preloadQueue.length > 0
    ) {
      const path = preloadQueue.shift()!;
      queuedPreloads.delete(path);
      if (textureCache.has(path)) continue;
      if (pendingLoads.has(path)) {
        cacheRequests.add(path);
        continue;
      }
      activePreloads++;
      void loadTexture(path, true)
        .catch(() => {
          failed.add(path);
        })
        .finally(() => {
          activePreloads--;
          pumpPreloads();
        });
    }
  }
  return {
    register(
      name: string,
      apply: Slot['apply'],
      options: RegisterOptions = {},
    ) {
      const slot: Slot = {
        name,
        apply,
        clear: options.clear,
        lazy: !!options.lazy,
        path: '',
        loadedPath: '',
        texture: null,
        version: 0,
        downgradeTimer: null,
        navigationHold: false,
      };
      slots.push(slot);
      if (!slot.lazy)
        void request(
          slot,
          texturePath(name, false, renderer.capabilities.maxTextureSize),
        );
    },
    preload() {
      if (disposed) return;
      for (const slot of slots) {
        const path = texturePath(
          slot.name,
          false,
          renderer.capabilities.maxTextureSize,
        );
        if (slot.texture && slot.loadedPath === path) {
          textureCache.set(path, slot.texture);
          cacheRequests.add(path);
          warm(slot.texture);
          continue;
        }
        if (textureCache.has(path) || queuedPreloads.has(path)) continue;
        queuedPreloads.add(path);
        preloadQueue.push(path);
      }
      pumpPreloads();
    },
    update(
      quality: TextureQuality,
      focus: string | null,
      compact: boolean,
      saveData: boolean,
      galaxy = true,
      activeTextures: readonly string[] = [],
      deferHighResolution = false,
    ) {
      if (disposed) return;
      const high = shouldLoadHighResolution(quality, compact, saveData);
      // A texture already sitting at high resolution stays there through a
      // resize; `compact` only gates whether a *new* upgrade should start,
      // not whether an already-paid-for one gets discarded.
      const keepHigh = shouldLoadHighResolution(quality, false, saveData);
      for (const slot of slots) {
        const highPath = texturePath(
            slot.name,
            true,
            renderer.capabilities.maxTextureSize,
          ),
          standardPath = texturePath(
            slot.name,
            false,
            renderer.capabilities.maxTextureSize,
          );
        if (deferHighResolution) slot.navigationHold = true;
        if (
          slot.lazy &&
          !activeTextures.includes(slot.name) &&
          slot.name !== focus
        ) {
          if (!textureCache.has(standardPath)) {
            release(slot);
            continue;
          }
        }
        if (!slot.texture && slot.path) continue;
        const eligible =
          slot.name === focus ||
          (slot.name === 'stars_milky_way' && galaxy) ||
          (slot.name === 'earth_nightmap' && focus === 'earth_daymap') ||
          (slot.name === 'saturn_ring_alpha' && focus === 'saturn');
        const alreadyHigh =
          slot.path === highPath && highPath !== standardPath;
        const upgrade = eligible && (alreadyHigh ? keepHigh : high);
        if (
          !deferHighResolution &&
          (slot.navigationHold || !!slot.downgradeTimer) &&
          !upgrade &&
          high &&
          slot.path === highPath &&
          highPath !== standardPath
        ) {
          slot.navigationHold = false;
          if (!slot.downgradeTimer) {
            slot.downgradeTimer = setTimeout(() => {
              slot.downgradeTimer = null;
              void request(slot, standardPath);
            }, navigationTextureHoldMs);
          }
          continue;
        }
        if (upgrade && slot.downgradeTimer) {
          clearTimeout(slot.downgradeTimer);
          slot.downgradeTimer = null;
        }
        if (
          deferHighResolution &&
          high &&
          !upgrade &&
          slot.path === highPath &&
          highPath !== standardPath
        )
          continue;
        // `deferHighResolution` only exists to avoid eagerly fetching a
        // *newly*-eligible slot's high-res texture while the user might
        // still be navigating past it. A slot that was already high before
        // this navigation (e.g. the always-eligible galaxy background) has
        // nothing to do with the current selection and must not be forced
        // down and back up on every navigation.
        let path =
          upgrade && (alreadyHigh || !deferHighResolution)
            ? highPath
            : standardPath;
        if (failed.has(path)) path = standardPath;
        if (slot.path !== path) void request(slot, path);
      }
    },
    dispose() {
      disposed = true;
      preloadQueue.length = 0;
      queuedPreloads.clear();
      const textures = new Set(textureCache.values());
      slots.forEach((s) => {
        if (s.downgradeTimer) clearTimeout(s.downgradeTimer);
        if (s.texture) textures.add(s.texture);
        s.version++;
      });
      textures.forEach((texture) => texture.dispose());
      textureCache.clear();
      cacheRequests.clear();
      failed = new Set();
    },
  };
}
