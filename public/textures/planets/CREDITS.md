# Planet surface-detail credits

ORBIT's optional real-surface setting uses 2K equirectangular tangent-space
normal maps for Mercury, Venus, Earth, and Mars. These maps add relief to
lighting; they do not displace the sphere mesh or change a planet's silhouette.

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

The maps are not preloaded. They are requested only when the setting is on and
the focused body is one of these four planets. Jupiter, Saturn, Uranus, and
Neptune have no solid surface; their cloud-top or atmospheric materials remain
unchanged.
