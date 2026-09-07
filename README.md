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

## Model limitations

Initial orbital phases are pedagogical, not an ephemeris for today's date. Orbital elements and rotational periods are approximate; no N-body integration or orbital precession. Illustrated mode compresses distances and enlarges bodies independently. Distance mode preserves orbital semimajor axis proportions while enlarging bodies. Outer populations use independent schematic scales; their individual orbits are not catalogued measurements. Moon distance/size and rings are illustrated. Not all satellites, dwarf planets or small bodies are individually rendered. High time speeds can cause apparent rotational aliasing.

## Sources and credits

- [NASA solar system](https://science.nasa.gov/solar-system/planets/)
- [NASA Kuiper belt](https://science.nasa.gov/solar-system/kuiper-belt/facts/)
- [NASA Oort cloud](https://science.nasa.gov/solar-system/oort-cloud/facts/)
- [JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL Keplerian elements](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- Textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source imagery includes enhanced colors and illustrative unmapped terrain.

## Verification

Seven automated tests check closed orbits, apsides, distance scaling, long-running finite positions, real-time units, state actions and invalid input isolation. Browser checks cover desktop and phone breakpoints, body selection/follow, time slider, pause, region navigation, visibility/scale switches, mobile knowledge sheet, and both WebMCP action contracts. Browser responsive checks are not physical-device performance certification.
