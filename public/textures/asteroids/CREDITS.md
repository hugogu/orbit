# Asteroid surface-map credits

These maps are body-specific source products from the pinned
[CelestiaContent](https://github.com/CelestiaProject/CelestiaContent) revision
`51ceb06be30a4eeb91de691b4230aa9cdeac2b7a`; they are not the shared
illustrative `asteroid.jpg` fallback used by some moons. Comet nuclei use the
body-specific models documented in `../../models/comets/CREDITS.md` and do not
use this fallback.
The Pallas and Psyche atlases are derived from the matching DAMIT shape models
rather than from CelestiaContent.

| ORBIT map                                                                    | Source / attribution                                                                                                                                                                                                                                                                                           | Terms                                                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `4k_ceres.jpg`, `2k_ceres.jpg`, `4k_ceres-normal.png`, `2k_ceres-normal.png` | NASA Dawn color-filter mosaic; normal map derived from USGS topography, as documented by CelestiaContent                                                                                                                                                                                                       | NASA PDS source terms; see [Ceres Dawn shape archive](https://sbn.psi.edu/pds/resource/dawn/dwncfcshape.html) |
| `4k_vesta.jpg`, `2k_vesta.jpg`                                               | NASA Dawn color-filter mosaic with USGS topography, as documented by CelestiaContent                                                                                                                                                                                                                           | NASA PDS source terms; see [Vesta Dawn shape archive](https://sbn.psi.edu/pds/resource/dawn/dwnvfcshape.html) |
| `4k_eros.jpg`, `2k_eros.jpg`                                                 | Phil Stooke / NEAR mission map, NASA PDS                                                                                                                                                                                                                                                                       | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)                                                     |
| `4k_itokawa.jpg`, `2k_itokawa.jpg`                                           | Phil Stooke Small Bodies Maps V3.0, NASA PDS                                                                                                                                                                                                                                                                   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                 |
| `4k_bennu.jpg`, `2k_bennu.jpg`                                               | USGS albedo map with polar fill, Lunar and Planetary Laboratory, University of Arizona                                                                                                                                                                                                                         | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)                                                     |
| `4k_ryugu.jpg`, `2k_ryugu.jpg`                                               | ISAS/JAXA color/albedo data; Yasuhiro Yokota et al. (2021)                                                                                                                                                                                                                                                     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)                                                     |
| `pallas-k-albedo.png`                                                        | [Carry et al. (2009)](https://arxiv.org/abs/0912.3626), Fig. 6-3 (`fig6-3.eps`), a published K-band relative-albedo map sampled at the face centers of matching [DAMIT model 102](https://damit.cuni.cz/projects/damit/asteroid_models/view/102); pure-white unobserved regions are filled with the mean value | Source publication; see the linked paper for attribution and reuse terms                                      |
| `psyche-albedo.png`                                                          | [DAMIT model 1806](https://damit.cuni.cz/projects/damit/asteroid_models/view/1806) `albedo` file ([source data](https://damit.cuni.cz/projects/damit/stored_files/open/105/albedo)); one relative value per triangle, encoded as a body-specific atlas and tinted with the catalog's X-type base color         | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) as stated by DAMIT                                  |

The 2K files are native-size derivatives made for the standard texture mode;
the 4K files preserve the source download resolution. The Pallas atlas is a
256×52 lookup texture, not a photograph or a fabricated high-resolution map;
its spatial variation comes from the published K-band map and matching DAMIT
face samples. Unobserved Pallas pixels are mean-filled only to keep the
body-specific model continuous. The Psyche atlas is a separate 256×88 lookup
texture whose spatial variation comes directly from DAMIT's relative facet
values. The source sidecar notices for Eros, Itokawa, Bennu, and Ryugu are
retained in `licenses/`.
