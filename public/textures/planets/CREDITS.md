# Planet terrain data and rendering

The independent **Real terrain lighting** and **Real terrain geometry** settings
use the same public elevation data. Local maps are 2048×1024, north-up,
east-positive equirectangular images, with longitude −180° at the left edge and
0° at the center. Asset URLs carry `terrain-v2` to invalidate earlier maps.

| Body | Source | Source range (km) | Terms |
| --- | --- | --- | --- |
| Mercury | [USGS MESSENGER global DEM, 665 m](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m) | −10.764 to 8.994 | Public-domain NASA/USGS data |
| Venus | [USGS Magellan global topography, 4641 m](https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_Topography_Global_4641m_v02.tif) | −2.951 to 11.687 | Public-domain NASA/USGS data |
| Earth | [NOAA/NCEI ETOPO2v2, 2-minute gridline relief](https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2/ETOPO2v2-2006/ETOPO2v2g/raw_binary/) | −10.722 to 8.046 | Public-domain NOAA/NCEI data |
| Mars | [NASA PDS MGS MOLA MEGDR, 0.25°](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) | −8.068 to 21.134 | Public-domain NASA/PDS data |
| Moon | [NASA Goddard LOLA MOON_PA, 64 pixels per degree](https://pgda.gsfc.nasa.gov/products/95) | −9.125 to 10.766 | NASA Goddard dataset; cite Neumann (2024) |

Exact source URLs, file sizes and derivation versions are in
[`../source-manifest.json`](../source-manifest.json). Raw products are not bundled.
Regenerate from those downloads using:

```sh
node --import tsx scripts/generate-planet-terrain.ts <source-directory> [body ...]
```

The source directory contains `Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`,
`Venus_Magellan_Topography_Global_4641m_v02.tif`, `LDEM64_PA_pixel_202405.tif`,
`megt90n000cb.img`, and `ETOPO2v2g_i2_MSB.zip`. The generator reads GeoTIFF projection metadata: Mercury
and MOLA start at 0° longitude; Venus and ETOPO2 start at −180°. TIFF cells are
area-averaged, lower-resolution data interpolated, and ETOPO2's duplicate
gridline endpoints handled explicitly. Invalid samples are excluded from
averaging; completely unobserved cells fall back to datum height. Pass one or
more body names (for example, `moon`) to regenerate only those assets. Global
low-resolution data cannot reproduce every local peak.

`2k_*-height.png` packs a normalized 16-bit height into the red and green
channels: `(R * 256 + G) / 65535`. Decode it using the source min/max in
`lib/solar.ts`, never as an sRGB color or a single-channel displacement map.
The blue channel is unused. Geometry is rebuilt once when the selected map
loads, with 256×128 segments, recomputed normals, shared seam/pole normals,
updated bounds and CPU ray picking. Switching away restores the 96×64 base
mesh and releases the optional resources; no dense geometry is allocated while
the map is still loading or if loading fails.

`2k_*-normal.png` is an **object-space** normal map generated from the same
height field and radius convention. It replaces coarse geometry normals when
lighting detail is enabled, so the two options do not add the same slopes twice.
It supersedes the previous CelestiaContent normal-map derivatives. These are
data textures (`NoColorSpace`), wrapping at the longitude seam. They describe
local lighting, not terrain self-shadowing.

Both options use a documented **6× vertical exaggeration**. Earth's elevations
below sea level are displayed at sea level to retain ocean surfaces. Venus
uses a neutral illustrative base color without clouds whenever a terrain
option is active; its ground is not a visible-light photograph.

Base planet shapes preserve the catalog's volumetric mean radius while
applying flattening from the [NASA planetary fact sheets](https://nssdc.gsfc.nasa.gov/planetary/factsheet/).
Gas and ice giants have atmospheric appearances and no solid-terrain mode.
Eclipse calculations retain their independent physical-radius model and do
not include terrain or the visual exaggeration.
