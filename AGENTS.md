# ORBIT solar observatory

- Preserve the Sites project identifier and scaffold. Three.js scene is in `components/solar-scene.tsx`; educational parameters and Kepler solver are in `lib/solar.ts`.
- The simulation clock is UTC (1700–2200). Astronomy Engine drives Sun/planet/Pluto/Moon positions and orientation plus Galilean satellite positions. Other satellites use fixed JPL mean elements; comets use epoch-aware two-body snapshots. Never describe those approximate trajectories as precision ephemerides. Body sizes, satellite distances and outer particles remain schematic; sky events are calculated separately from rendering.
- Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` before publishing changes.
- In macOS sandboxed sessions, networking and preview listeners may require approved elevated execution. Use `node --import tsx --test` instead of the tsx CLI to avoid its unnecessary IPC socket.
- Lint excludes unmodified vendored `components/ui` and the scaffold's mobile hook; application files remain fully checked.
- Reuse the current development server and browser tab. Verify responsive behavior using browser viewport controls, then reset the override.
- All planet textures are local assets from Solar System Scope (CC BY 4.0). Preserve attribution in the model explanation and README.

- With Y as north, map ecliptic in-plane sine to negative Z so prograde orbits and positive axial spins agree. The orbit orientation test protects this convention.
- This source host may reject chunked Git uploads with HTTP 400; per-command `http.postBuffer=157286400` and `http.version=HTTP/1.1` succeeded. Do not persist source tokens in Git configuration.
- Vinext static export can turn `new Worker(new URL(..., import.meta.url))` into an inaccessible file URL. Import the worker with Vite's `?worker` constructor, and verify an actual calculation in the exported browser build. Handle constructor failures as well as worker error events.
