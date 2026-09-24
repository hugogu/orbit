import * as THREE from 'three';
import type { Body } from '../lib/solar';
import {
  createTerrainGeometry,
  type HeightField,
  type TerrainParameters,
} from '../lib/planet-terrain';
import type { createTextureManager } from './texture-manager';
import { textureLoadingOptions } from '../lib/texture-quality';

export function readHeightField(texture: THREE.Texture): HeightField {
  const image = texture.image as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Terrain image decoding is unavailable');
  context.drawImage(image, 0, 0);
  return {
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
    channels: 4,
  };
}

export type TerrainSurface = TerrainParameters & {
  heightTexture: string;
  size: number;
};

/** Register a focused body's on-demand terrain geometry and its base restore. */
export function registerTerrainGeometry(
  body: TerrainSurface,
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
  textures: ReturnType<typeof createTextureManager>,
  decodeHeight: (texture: THREE.Texture) => HeightField = readHeightField,
) {
  const base = mesh.geometry;
  const restore = () => {
    if (mesh.geometry !== base) {
      mesh.geometry.dispose();
      mesh.geometry = base;
    }
  };
  textures.register(
    body.heightTexture,
    (texture) => {
      const geometry = createTerrainGeometry(
        decodeHeight(texture),
        body,
        body.size,
      );
      if (mesh.geometry !== base) mesh.geometry.dispose();
      mesh.geometry = geometry;
    },
    {
      lazy: true,
      preload: false,
      colorSpace: THREE.NoColorSpace,
      clear: restore,
    },
  );
  return { dispose: restore };
}

/** Own the base/terrain transition, including late color-map upgrades. */
export function registerPlanetSurface(
  body: Body,
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
  textures: ReturnType<typeof createTextureManager>,
  decodeHeight: (texture: THREE.Texture) => HeightField = readHeightField,
) {
  const base = mesh.geometry,
    material = mesh.material;
  let colorMap: THREE.Texture | null = null;
  const updateAppearance = () => {
    material.map = colorMap;
    material.color.set(
      body.texture && body.id !== 'uranus' ? '#ffffff' : body.color,
    );
    material.needsUpdate = true;
  };
  if (body.texture)
    textures.register(
      body.texture,
      (texture) => {
        colorMap = texture;
        updateAppearance();
      },
      textureLoadingOptions(body.texture),
    );
  if (body.surfaceTexture)
    textures.register(
      body.surfaceTexture,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        material.normalMap = texture;
        material.normalMapType = THREE.ObjectSpaceNormalMap;
        updateAppearance();
      },
      {
        lazy: true,
        preload: false,
        colorSpace: THREE.NoColorSpace,
        clear: () => {
          material.normalMap = null;
          updateAppearance();
        },
      },
    );
  const restoreGeometry = () => {
    if (mesh.geometry !== base) {
      mesh.geometry.dispose();
      mesh.geometry = base;
    }
    updateAppearance();
  };
  if (
    body.heightTexture &&
    body.terrainMinKm !== undefined &&
    body.terrainMaxKm !== undefined
  ) {
    const parameters = {
      id: body.id,
      radius: body.radius,
      terrainMinKm: body.terrainMinKm,
      terrainMaxKm: body.terrainMaxKm,
    };
    textures.register(
      body.heightTexture,
      (texture) => {
        const geometry = createTerrainGeometry(
          decodeHeight(texture),
          parameters,
          body.size,
        );
        if (mesh.geometry !== base) mesh.geometry.dispose();
        mesh.geometry = geometry;
        updateAppearance();
      },
      {
        lazy: true,
        preload: false,
        colorSpace: THREE.NoColorSpace,
        clear: restoreGeometry,
      },
    );
  }
  return { dispose: restoreGeometry };
}
