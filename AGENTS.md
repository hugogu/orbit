# ORBIT solar observatory

- Preserve the Sites project identifier and scaffold. Three.js scene is in `components/solar-scene.tsx`; educational parameters and Kepler solver are in `lib/solar.ts`.
- The displayed simulation has arbitrary teaching phases, approximate Kepler orbits, and exaggerated body sizes. Never describe it as live ephemerides. Outer region particles are schematic.
- Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` before publishing changes.
- In macOS sandboxed sessions, networking and preview listeners may require approved elevated execution. Use `node --import tsx --test` instead of the tsx CLI to avoid its unnecessary IPC socket.
- Lint excludes unmodified vendored `components/ui` and the scaffold's mobile hook; application files remain fully checked.
- Reuse the current development server and browser tab. Verify responsive behavior using browser viewport controls, then reset the override.
- All planet textures are local assets from Solar System Scope (CC BY 4.0). Preserve attribution in the model explanation and README.
