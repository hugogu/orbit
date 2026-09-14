# Asteroid shape-model credits

Most `.bin` files in this directory are normalized, browser-oriented exports
of the corresponding binary CMOD files from the pinned
[CelestiaContent](https://github.com/CelestiaProject/CelestiaContent) revision
`51ceb06be30a4eeb91de691b4230aa9cdeac2b7a`.
The conversion keeps the observed vertices, normals, UVs, and triangle
indices; it does not generate or deform the shape.
`pallas.bin` and `psyche.bin` are exceptions: they are exported from the DAMIT
models paired with their surface-albedo data, so their triangles stay
index-compatible with the matching surface atlases.

| ORBIT asset | Source model | Attribution / source | Terms |
| --- | --- | --- | --- |
| `bennu.bin` | `bennu.cmod` | Barnouin, Daly, Espiritu; OSIRIS-REx Altimetry Working Group, SPOv54 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `eros.bin` | `eros.cmod` | Gaskell Eros Shape Model V1.0, NASA PDS | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `itokawa.bin` | `itokawa.cmod` | Gaskell Itokawa Shape Model V1.0, Hayabusa / NASA PDS | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `juno.bin` | `juno.cmod` | Vernazza et al. (2021), A&A 654 A56, VLT/SPHERE | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `pallas.bin` | DAMIT model 102 `shape.txt` | [DAMIT model 102](https://damit.cuni.cz/projects/damit/asteroid_models/view/102), referencing Carry et al. (2009) and Hanuš et al. (2017) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) as stated by DAMIT |
| `psyche.bin` | DAMIT model 1806 `shape.txt` | [DAMIT model 1806](https://damit.cuni.cz/projects/damit/asteroid_models/view/1806), with references to Viikinkoski et al. (2018) and Hanuš et al. (2017) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) as stated by DAMIT |
| `ryugu.bin` | `ryugu.cmod` | Watanabe et al. (2019), ISAS/JAXA | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `vesta.bin` | `vesta.cmod` | NASA Dawn Vesta shape model, PDS | See the NASA PDS source terms |

The original CMOD sidecar notices are retained beside the generated assets
where CelestiaContent provides them. The Pallas DAMIT export has 402 source
vertices and 800 triangles; the Psyche export has 678 source vertices and 1,352
triangles. Conversion metadata and source links are kept here because the
browser assets use a different file format.

DAMIT's Z-north coordinates are rotated to ORBIT's Y-north convention using
`(x, y, z) → (x, z, −y)`, for both vertices and normals; face ordering and atlas
correspondence are preserved. The scene scales each closed model to the
catalog's volumetric mean radius. Imported shapes load only for the focused
asteroid. Unfinished requests are cancelled on navigation, but loaded models
and standard surface maps remain attached until scene teardown, so visible
neighbors do not lose their shape or texture. Unfocused high-resolution maps
can downgrade to standard quality without showing an untextured frame.
Fallback ellipsoids are approximate and use the same mean-radius convention.
Detailed portraits and share cards rasterize these same models and UVs.
