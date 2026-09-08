# ORBIT · 太阳系漫游

A Chinese-language interactive 3D solar-system learning observatory built with Three.js, React, and Vinext.

## Explore

- Sun, eight planets, Pluto, 19 representative satellites, four famous comets, and Saturn's rings.
- Asteroid belt, Kuiper belt, scattered disk, heliosphere, and hypothesized Oort cloud.
- Date-driven positions and axial orientation, follow camera, top view, scale and visibility controls.
- UTC date/time selection (1700–2200), observer coordinates, local daily sunrise/sunset, next global solar/lunar eclipses and next locally visible solar eclipse.
- A visible “现在” button restores the device's current time and real-time playback. “使用当前位置” requests browser location permission and fills WGS84 coordinates; denial/timeouts preserve manual input. Coordinates stay in the page. UTC offset is initially inferred from the device timezone on the query date, not reverse-geocoded from coordinates; the user can correct it. Elevation remains manual.
- Expanded physical facts include mass, density, equatorial gravity, escape velocity, diameter, approximate orbital eccentricity/inclination and rotation direction, with JPL/NASA sources.
- Texture quality: automatic, standard 2K, or ultra (up to 8K). Automatic uses 2K on compact/touch devices and data-saving connections. Higher-resolution maps load only for the followed body and the Milky Way background, respecting the GPU texture-size limit; previous maps are disposed after replacement. Preferences are saved locally, and failed high-resolution loads fall back to 2K.
- Eight time presets from real time to ten years per second, plus pause.
- Mouse drag/orbit, wheel/zoom, right drag/pan. Touch: one finger/orbit, pinch/zoom, two fingers/pan.
- Keyboard: WASD/arrows pan, +/- zoom, Space pause, R overview, Esc stop following.

## Development

`npm install`, `npm run dev`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Vercel deployment

Import the repository with its root directory unchanged. `vercel.json` selects the static build and `dist/client` output automatically. `npm run build:vercel` enables Vinext static export and omits the Sites/Cloudflare Worker plugins. The output must include `dist/client/index.html`; publishing the normal Worker output as static files causes a root-page 404. Default `npm run build` continues to target Sites.

## Model limitations

One UTC clock drives every object. It starts at the current time; selecting another body or returning to overview preserves time. Applying a date pauses the simulation. Astronomy Engine 2.1.19 provides heliocentric geometric positions for the planets and Pluto, geocentric Moon position, and Galilean satellite positions. EQJ vectors are transformed to fixed J2000 ecliptic coordinates, then to scene axes (X, Z, -Y). IAU poles and prime meridians drive Sun/planet/Moon orientation; Earth's prime meridian comes from the Greenwich observer vector, incorporating precession and nutation. Surface map longitude registration is not uniformly calibrated and cloud textures are not live weather.

Planet detail panels include 19 selectable moons (including Charon); Mercury and Venus explicitly have none. The Moon and four Galilean satellites use Astronomy Engine's perturbed solutions. The other 14 use fixed JPL mean elements with epoch, mean anomaly, periapsis, node and reference-plane orientation. These omit precession, resonances and perturbations; accumulated phase error can be large far from the epoch. Their surface orientation is schematic and synchronous. Charon is modeled relative to Pluto, without mutual barycentric motion. These are educational selections, not current satellite censuses.

The unified navigation includes Halley, Encke, 67P and Hale–Bopp. Full-precision JPL SBDB snapshots retrieved 2026-09-07 retain epoch and orbital orientation. Fixed two-body propagation approximates TDB with TT and omits gravitational perturbations and outgassing, so it is not an accurate return forecast. Selecting a comet preserves the shared date; the perihelion button explicitly seeks to the next model perihelion within the supported date range. Its enlarged rotating nucleus and antisolar ion tail are illustrative. Orbit paths sample eccentric anomaly to remain smooth at high eccentricity.

Illustrated mode compresses heliocentric distances and enlarges bodies independently. Distance mode preserves heliocentric AU ratios, but still enlarges bodies and satellite distances. Orbit traces sample a revolution from the selected date. Outer populations use independent schematic scales; their individual positions are not measured. Not all satellites, dwarf planets or small bodies are individually rendered. High time speeds can cause rotational aliasing. Never infer eclipses from rendered overlaps.

Sky events are computed independently in a Web Worker. Sunrise/set searches use local midnight and the supplied fixed UTC offset (the user includes daylight saving), the solar upper limb and standard atmospheric refraction. Terrain and actual weather are omitted. Eclipse searches start at the selected simulation time; global results do not imply local visibility. The local solar search excludes events entirely below the horizon. Lunar results report Moon altitude at maximum, not visibility throughout every phase. Results beyond 2200 are omitted. Historical/future UTC has uncertainty from Earth rotation predictions.

## Sources and credits

- [NASA solar system](https://science.nasa.gov/solar-system/planets/)
- [NASA Kuiper belt](https://science.nasa.gov/solar-system/kuiper-belt/facts/)
- [NASA Oort cloud](https://science.nasa.gov/solar-system/oort-cloud/facts/)
- [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL Keplerian elements](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) (MIT)
- [JPL satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/)
- [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html)
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source imagery includes enhanced colors and illustrative unmapped terrain.
- Source files are used without pixel edits. Actual dimensions are recorded in `public/textures/source-manifest.json`: Earth, Mercury, Mars, Moon and Milky Way are 8192 pixels wide; Sun, Jupiter, Saturn and Venus are 4096 despite some source filenames saying 8K. Uranus/Neptune remain 2K; Pluto and other moons retain schematic materials. The galaxy panorama is an immersive background, not a calibrated live sky chart for the observer's location.

## Verification

Automated tests cover the UTC clock, supported boundaries, J2000 coordinates, Greenwich rotation and day/night orientation, dated satellite motion, known solar/lunar eclipse peaks against NASA catalogs, local date boundaries, polar day/night, invalid inputs, comet epochs, scene selection and application actions. Run both the Sites build and Vercel static export before publishing. Browser responsive checks are not physical-device performance certification.
