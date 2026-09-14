# Planet surface-detail and terrain credits

ORBIT's optional real-surface setting uses 2K equirectangular tangent-space
normal maps for Mercury, Venus, Earth, and Mars. These maps add relief to
lighting; they do not displace the mesh or change a planet's silhouette.

The separate **Real terrain geometry** setting uses the four local height maps
listed below. Each is a 2048×1024 equirectangular, 8-bit normalized derivative
of a published global elevation product. The source minimum and maximum are
kept in `lib/solar.ts` so the shader converts the normalized sample back into
the body's relative radius. The scene applies a documented 6× visual
exaggeration because literal relief is too small at the observatory scale.
Unknown samples are filled with the midpoint of the source range. The raw
source products are not redistributed in this repository.

The local files are downsampled derivatives of the pinned
[CelestiaContent](https://github.com/CelestiaProject/CelestiaContent) revision
`51ceb06be30a4eeb91de691b4230aa9cdeac2b7a`. ORBIT only downsamples the
published 4096×2048 source maps; the original source paths and URLs are kept in
[`../source-manifest.json`](../source-manifest.json).

| ORBIT map | Published source and derivation | Terms |
| --- | --- | --- |
| `2k_mercury-normal.png` | `textures/hires/mercury-normal.png`, derived from the USGS MESSENGER global DEM | Public-domain NASA/USGS source data; processed normal map by CelestiaContent |
| `2k_venus-normal.png` | `textures/hires/venus-normal.png`, derived from the USGS Magellan global topography | Public-domain NASA/USGS source data; processed normal map by CelestiaContent |
| `2k_earth-normal.png` | `textures/hires/earth-normal.png`, derived from the NASA Blue Marble Next Generation dataset | Public-domain NASA source data; processed normal map by CelestiaContent |
| `2k_mars-normal.png` | `textures/hires/mars-normal.png`, derived from the USGS MOLA global DEM | Public-domain NASA/USGS source data; processed normal map by CelestiaContent |

| ORBIT height map | Published source and conversion | Terms |
| --- | --- | --- |
| `2k_mercury-height.png` | [USGS MESSENGER Global DEM 665 m](https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m), downsampled and normalized to the source range −10.764 to 8.994 km | Public-domain NASA/USGS source data |
| `2k_venus-height.png` | [USGS Magellan global topography 4641 m](https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_Topography_Global_4641m_v02.tif), downsampled and normalized to −2.951 to 11.687 km | Public-domain NASA/USGS source data |
| `2k_earth-height.png` | [NOAA/NCEI ETOPO2v2 2-minute global relief](https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2/ETOPO2v2-2006/ETOPO2v2g/raw_binary/), downsampled and normalized to −10.722 to 8.046 km | Public-domain NOAA/NCEI source data |
| `2k_mars-height.png` | [NASA PDS MGS MOLA MEGDR 0.25° global topography](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img), resampled and normalized to −8.068 to 21.134 km | Public-domain NASA/PDS source data |

See the upstream [CelestiaContent README](https://github.com/CelestiaProject/CelestiaContent/blob/51ceb06be30a4eeb91de691b4230aa9cdeac2b7a/README)
for source derivation notes and [NASA/JPL's image policy](https://www.jpl.nasa.gov/imagepolicy/)
for NASA/JPL usage guidance. Mercury elevation data is also catalogued by
[NASA PDS](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MESS-H-MDIS-5-DEM-ELEVATION-V1.0);
Mars MOLA products are documented by the
[USGS/NASA Mars data archive](https://marsoweb.nas.nasa.gov/globalData/index.html);
and the [USGS Magellan Venus topography](https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_Topography_Global_4641m_v02.tif)
is the published Venus elevation source. Venus's visible color map remains an
atmospheric/cloud rendering, so its hidden surface relief is only a lighting
cue when the option is enabled.

The normal and height maps are not preloaded. They are requested only when the
corresponding setting is on and the focused body is one of these four planets.
The height map is attached to a 256×128 sphere only while that body is focused;
other bodies keep their 96×64 base mesh. Jupiter, Saturn, Uranus, and Neptune
have no solid surface; their cloud-top or atmospheric materials remain
unchanged. Planet flattening is a separate low-cost scale based on the physical
shape parameters in `lib/solar.ts`.
