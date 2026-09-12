# Texture credits and redistribution notes

This directory contains texture files used by ORBIT. The license for each
source is part of the asset record; the ORBIT code license does not change any
of these terms. Every source listed below permits use in a commercial product
when its attribution and any share-alike requirement are followed.

## CelestiaContent sources

The following files originate from the pinned
[CelestiaContent](https://github.com/CelestiaProject/CelestiaContent) revision
`1993a082ee6307c0df7fdc0828eb117a0e8e9958`. Attribution text is retained in
`licenses/` sidecars and the source paths are recorded in
`../source-manifest.json`.

| ORBIT body | Files | Copyright / attribution | License | Notes |
| --- | --- | --- | --- | --- |
| Phobos | `4k_phobos.jpg`, `2k_phobos.jpg` | Askaniy Anpilogov; Stooke Small Bodies Maps V3.0, Phil Stooke / NASA PDS | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Attribution required |
| Deimos | `4k_deimos.jpg`, `2k_deimos.jpg` | Phil Stooke / NASA PDS | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | No attribution required; credit retained |
| Io | `4k_io.png`, `2k_io.png` | ItzImcool; NASA/JPL-Caltech/ASI/USGS; NASA/JPL/SwRI/MSSS contributors; AstroChara | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Attribution required |
| Ganymede | `4k_ganymede.jpg`, `2k_ganymede.jpg` | Askaniy Anpilogov; NASA/JPL-Caltech/ASI/USGS; Björn Jónsson; Brian Swift | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Attribution required |
| Titan | `4k_titan.png`, `2k_titan.png` | Askaniy Anpilogov; Pedro Garcia; AstroChara; Martonchik & Orton; Karkoschka et al.; Seignovert et al.; NASA/JPL-Caltech/ASI/USGS; Caltech-JPL/University of Arizona/LPG-University of Nantes-CNRS | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Radar/infrared-informed colors are not visible-light photography |
| Miranda, Ariel, Umbriel, Titania, Oberon | matching `4k_*.jpg` or `2k_*.jpg` | ItzImcool; Paul Schenk; NASA/JPL/Ted Stryk; Phil Stooke (Umbriel) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | ORBIT's `mirror-fill-v1` files are adaptations and remain CC BY-SA 4.0 |
| Triton | `4k_triton.jpg`, `2k_triton.jpg` | Askaniy Anpilogov; NASA/JPL-Caltech/ASI/USGS | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | ORBIT's `mirror-fill-v1` fill is identified in the manifest |

## Commercially safe illustrative fallback

The upstream files for Europa, Callisto, Enceladus, Mimas, and Iapetus did
not include a clear machine-readable redistribution license. Charon's former
file was CC BY-NC-SA 3.0. To keep the repository usable in a commercial
product, ORBIT replaced those pixels, plus the former Pluto teaching map, with
the openly licensed `asteroid.jpg` surface. The files keep their body-specific
names for stable application paths, but are explicitly illustrative and are
not cartographic maps of those bodies.

| Files | Source / attribution | License |
| --- | --- | --- |
| `4k_asteroid.jpg`, `2k_asteroid.jpg` and the body-named fallback copies for Europa, Callisto, Enceladus, Mimas, Iapetus, Charon, and Pluto | cubicApocalypse; source file from CelestiaContent revision above | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Nereid and comet nuclei also use this same surface as a schematic teaching
texture because complete global albedo maps are unavailable.

## Other bundled sources

Uranus uses `2k_uranus.jpg` from
[Solar System Scope Textures](https://www.solarsystemscope.com/textures/),
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It is a
representative atmospheric rendering, with enhanced colors; it is not a live
weather map. The previous CelestiaContent Uranus map was removed because its
sidecar license was CC BY-NC-SA 3.0.

The 2K and 4K planetary maps outside this directory are also from Solar
System Scope under CC BY 4.0. Their source URLs, dimensions, and hashes are
listed in `../source-manifest.json`.

## Attribution when distributing ORBIT

Keep this file, the `licenses/` sidecars, and the attribution links when
redistributing ORBIT or a product bundle that includes these textures. Do not
use NASA, JPL, ESA, or contributor names or marks to imply endorsement of
ORBIT. The CC BY-SA assets require adaptations to be offered under the same
license; this obligation applies to the adapted Uranian-moon files even when
they are bundled inside a larger application.

## Rendered profile and sharing images

The build creates `/media/v2/bodies/*.webp` (page portraits),
`/media/v2/bodies/*.jpg` (square previews), and
`/og/v2/{locale}/bodies/*.jpg` (landscape share cards). These are ORBIT
adaptations of the source textures listed above, using spherical or schematic
ellipsoidal projection, simulated lighting, and, for Saturn, the Solar System
Scope ring texture. They are illustrations, not current observations.

The rendered images of Miranda, Ariel, Umbriel, Titania, and Oberon remain
**CC BY-SA 4.0**. Other rendered images are offered under the same CC BY or
CC0 license as their source texture, as identified above. The ORBIT source
code's noncommercial license does **not** apply to these images. Planetary
renders use Solar System Scope's CC BY 4.0 material; the Sun's view and glow
are illustrative. Fallback body maps and comet shapes remain schematic.

Generated WebP and JPEG files embed XMP creator, source, adaptation, and
license information. Each profile also displays attribution and links to the
source license. Preserve that information when redistributing a downloaded
image; social platforms may strip embedded metadata. Avoid implying that
NASA, the texture contributors, or the Noto Project endorse ORBIT.

Landscape labels use an OFL-licensed, renamed Noto Sans CJK subset. See
[`scripts/assets/README.md`](https://github.com/hugogu/orbit/blob/main/scripts/assets/README.md)
for its source and license. Font glyphs rendered into images do not change
the images' license.
