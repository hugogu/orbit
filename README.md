# ORBIT · 太阳系漫游

A Chinese-language interactive 3D solar-system learning observatory built with Three.js, React, and Vinext.

## Explore

- Sun, eight planets, Pluto, an illustrative Moon orbit, and Saturn's rings.
- Asteroid belt, Kuiper belt, scattered disk, heliosphere, and hypothesized Oort cloud.
- Elliptical Kepler orbits, axial rotation, follow camera, top view, scale and visibility controls.
- Eight time presets from real time to ten years per second, plus pause.
- Mouse drag/orbit, wheel/zoom, right drag/pan. Touch: one finger/orbit, pinch/zoom, two fingers/pan.
- Keyboard: WASD/arrows pan, +/- zoom, Space pause, R overview, Esc stop following.

## Development

`npm install`, `npm run dev`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Vercel deployment

Import the repository with its root directory unchanged. `vercel.json` selects the static build and `dist/client` output automatically. `npm run build:vercel` enables Vinext static export and omits the Sites/Cloudflare Worker plugins. The output must include `dist/client/index.html`; publishing the normal Worker output as static files causes a root-page 404. Default `npm run build` continues to target Sites.

## Model limitations

Planet detail panels include expandable guides to 19 representative moons (including Charon); Mercury and Venus explicitly have no known moons. All 19 are selectable 3D bodies orbiting their moving parents, with approximate periods from JPL mean elements. Selecting a planet frames its satellite system; selecting a moon follows it. Shared playback controls drive planets, moons and the selected comet. Surface colors, sizes, spacing and orbital planes are schematic; Charon is modeled relative to Pluto, without mutual barycentric motion. NASA references accompany each entry. These are educational selections, not current satellite censuses.

The Comets tab includes Halley, Encke, 67P, and Hale–Bopp. It shares playback controls, offers orbit overview and follow views, and can restart a perihelion demonstration. Rounded JPL SBDB elements retrieved on 2026-09-07 drive fixed Kepler ellipses; periods depend on the osculating epoch, especially for Hale–Bopp. Initial phases and orbital longitudes are schematic, not current ephemerides. The enlarged nucleus marker and antisolar ion tail are illustrative; tail activity fades with distance. The solver uses bracketed Newton iteration for high eccentricities, and paths sample eccentric anomaly.

Initial orbital phases are pedagogical, not an ephemeris for today's date. Orbital elements and rotational periods are approximate; no N-body integration or orbital precession. Illustrated mode compresses distances and enlarges bodies independently. Distance mode preserves orbital semimajor axis proportions while enlarging bodies. Outer populations use independent schematic scales; their individual orbits are not catalogued measurements. Moon distance/size and rings are illustrated. Not all satellites, dwarf planets or small bodies are individually rendered. High time speeds can cause apparent rotational aliasing.

## Sources and credits

- [NASA solar system](https://science.nasa.gov/solar-system/planets/)
- [NASA Kuiper belt](https://science.nasa.gov/solar-system/kuiper-belt/facts/)
- [NASA Oort cloud](https://science.nasa.gov/solar-system/oort-cloud/facts/)
- [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL Keplerian elements](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source imagery includes enhanced colors and illustrative unmapped terrain.

## Verification

Twelve automated tests cover planet and comet orbital invariants, high-eccentricity stability, retrograde motion, satellite coverage, comet scene selection/reset/visibility, antisolar tails, and application action contracts. Both the Sites build and Vercel static export are checked. The original planet experience was browser-tested at desktop and phone breakpoints; the new moon panels and comet controls still need a browser pass because the host was locked during this change. Browser responsive checks are not physical-device performance certification.
