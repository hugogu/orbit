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
  texture: THREE.Texture | null;
  version: number;
};
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
  let disposed = false,
    failed = new Set<string>();
  async function request(slot: Slot, path: string) {
    if (slot.path === path || disposed) return;
    slot.path = path;
    const version = ++slot.version;
    try {
      const texture = await loader.loadAsync(path);
      if (disposed || version !== slot.version) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        renderer.capabilities.getMaxAnisotropy(),
        8,
      );
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      slot.apply(texture);
      slot.texture?.dispose();
      slot.texture = texture;
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
    slot.version++;
    slot.path = '';
    slot.texture?.dispose();
    slot.texture = null;
    slot.clear?.();
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
        texture: null,
        version: 0,
      };
      slots.push(slot);
      if (!slot.lazy)
        void request(
          slot,
          texturePath(name, false, renderer.capabilities.maxTextureSize),
        );
    },
    update(
      quality: TextureQuality,
      focus: string | null,
      compact: boolean,
      saveData: boolean,
      galaxy = true,
      activeTextures: readonly string[] = [],
    ) {
      const high = shouldLoadHighResolution(quality, compact, saveData);
      for (const slot of slots) {
        if (
          slot.lazy &&
          !activeTextures.includes(slot.name) &&
          slot.name !== focus
        ) {
          release(slot);
          continue;
        }
        if (!slot.texture && slot.path) continue;
        const upgrade =
          high &&
          (slot.name === focus ||
            (slot.name === 'stars_milky_way' && galaxy) ||
            (slot.name === 'earth_nightmap' && focus === 'earth_daymap') ||
            (slot.name === 'saturn_ring_alpha' && focus === 'saturn'));
        let path = texturePath(
          slot.name,
          upgrade,
          renderer.capabilities.maxTextureSize,
        );
        if (failed.has(path))
          path = texturePath(
            slot.name,
            false,
            renderer.capabilities.maxTextureSize,
          );
        void request(slot, path);
      }
    },
    dispose() {
      disposed = true;
      slots.forEach((s) => {
        s.version++;
        s.texture?.dispose();
      });
      failed = new Set();
    },
  };
}
