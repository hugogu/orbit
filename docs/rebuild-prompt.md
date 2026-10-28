# ORBIT — one-shot build spec

Build ORBIT, an educational 3D Solar System observatory, from an empty repo in one autonomous run (shell, network, headless Chrome available). First save this text verbatim as `SPEC.md`; re-read it at each milestone and after any context compaction. Follow §12's milestones, commit after each, and advance only when its gates pass. Ask nothing: choose the conventional option and log it in `DECISIONS.md`. Honesty: the UI states every model's sources and limits, and never calls an approximation precise or a model run a prediction.

## 0 Stack, gates

- TypeScript strict; React ≥19.3 (react, react-dom, react-server-dom-webpack on one release, test-enforced); Next.js App Router API on Vinext (Vite); Three.js; astronomy-engine; Tailwind 4, shadcn/Base UI, Lucide; i18next; Workbox; node:test via tsx; oxlint, oxfmt; Node 22/24; Apache-2.0.
- Outputs: Vercel static export + Cloudflare Workers build. `NEXT_PUBLIC_SITE_URL` (normalized HTTP(S) origin) → canonical/OG/sitemap; `NEXT_PUBLIC_GA_MEASUREMENT_ID` → GA4 only when set; Vercel Analytics.
- Gates: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; Playwright (headless Chrome) at 1440×900, 1000×800, 900×700, 375×812, 812×375 in zh-CN, en-US, ja-JP: zero console errors and hydration warnings, no overlapping panels, no truncated numbers; keep screenshots. Hidden tabs never fire rAF; render a canvas explicitly before reading it.

## 1 Bodies, frame, clock, scale

- 42 selectable, followable bodies: Sun; Mercury–Neptune; Pluto; moons Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan, Enceladus, Mimas, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Nereid, Charon; asteroids Ceres (dwarf planet), Pallas, Juno, Vesta, Psyche, Eros, Itokawa, Bennu, Ryugu; comets Halley, Encke, 67P, Hale–Bopp. Plus Saturn's rings and a schematic main belt, Kuiper belt, scattered disc, heliosphere, Oort cloud.
- Motion: Astronomy Engine for Sun, planets, Pluto, Moon (position + orientation) and Galilean moons; other moons fixed-epoch JPL mean elements (Kepler solver, tidally locked); comets/asteroids two-body from dated JPL SBDB snapshots. Planets: volumetric mean radius + observed flattening. Earth: terminator, night-side city lights, observer marker.
- Frame: fixed J2000 ecliptic, +Y north, ecliptic y → −Z so prograde orbits and positive spins agree (test). Rendered geometry uses `Rotation_EQJ_ECL`, never `Ecliptic()` (of date).
- Clock: UTC 1700–2200, starts now. Discrete speed slider, markers labelled in every language: real time, 1 min/s, 0.1, 1, 10, 30, 100 d/s, 1, 10 yr/s; pause, now, seek-to-date in the playback bar. Selection, locale, mode and dialogs never reset it. Status line: UTC + followed body's speed and ecliptic longitude by central difference of the drawn path (moons relative to their planet; none for the Sun); numbers never truncate, the name ellipsizes.
- Scale: true sizes and true distances are independent persisted toggles; both on ⇒ one physical scale from one module. Region bands authored at illustrated radii move, at true distances, to the AU their region cards quote; the Oort cloud stays illustrative. Tours may force a distance mode without overwriting the saved choice.

## 2 Explorer UI

- Modes: Explore, Structure (region tours with cards), Sandbox. Navigator: planets expand to moons; Asteroids and Comets are collapsible, crawlable groups that auto-expand for the selection; only the selected asteroid shows label and orbit.
- Camera: follow, overview, top-down, flights; mouse orbit/zoom/right-drag pan; touch orbit/pinch/two-finger pan; WASD/arrows, +/−, Space, R, Esc. Drag or wheel aborts a flight; a release within 5 px of its press is a pick.
- Info panel: profile, physical and orbital facts with sources, concept hints, a rotating "Did you know?" card — 30 per Sun/planet/Pluto/moon/comet (sourced editorial facts plus comparisons computed from the body's data), 6 per asteroid, opening card varies per visit. Comets: next-perihelion jump, close-up.
- Header: language picker, Share, GitHub. One action row: sky-event planner, event guide, body encyclopedia; an icon-only option keeps names as sr-only text + title.
- Settings tabs: Layout (true size, true distance, action labels), Environment (Milky Way, star field, constellations), Phenomena (eclipse shadows, shadow guides, solar activity, comet comae/tails), Textures (auto/2K/ultra ≤8K, terrain lighting, terrain geometry), Layers (orbits, line width, labels, belts), Controls, Model, Sources. One versioned, sanitized localStorage record; storage failure is harmless. Custom dialogs, never `alert()`.
- If `document.modelContext` exists, register WebMCP tools `focus_solar_body(id)` and `set_solar_simulation(speedIndex, paused)`.

## 3 Rendering

- Textures: Solar System Scope (CC BY 4.0) 2K/8K maps, Earth night lights, Saturn ring alpha, Milky Way; CelestiaContent moon maps. Quality by setting, device class, Save-Data and GPU texture limit; only the focused body upgrades; visited bodies keep standard maps and models; a downgrade never detaches the shown map; cancel queued loads on teardown.
- Colour maps are opaque: Celestia RGBA alpha is a specular mask — extract raw RGB before resizing (sharp premultiplies). Mirror-fill unmapped Voyager regions (Ariel, Miranda, Umbriel, Titania, Oberon, Triton); Nereid, Pluto, Charon get a labelled illustrative surface. Test every map: opaque, 2K mean colour ≈ full-size.
- Terrain (opt-in; Mercury, Venus, Earth, Mars, Moon; focused body only): 2K RG16 heights + object-space normals from public DEMs, 6× exaggeration, each source's own longitude origin. Geometry mode: 256×128 mesh with rebuilt normals, bounds and picking, closed poles/seams, mean radius kept. Earth keeps sea-level oceans; Venus shows cloud-free terrain. Landmark tests.
- Sun: glow/corona reach zero before the billboard edge; corona UVs in solar radii on a plane at the sphere's tangent circle. Solar activity (prominences, filaments, sunspots) is a deterministic function of UTC in the differentially rotating frame, with illustrative lifetimes.
- Orbits: screen-space wide lines, ≥2,048 segments per closed path, drawn after opaque bodies, depth-tested, opaque, no depth write.
- Main belt: 1,800 rocks, 6 instanced shapes, 20/80-triangle LODs; GPU orbit + spin from J2000 days split whole/fraction; Kepler rate from orbital (not display) radius; whole spin turns per day; culling bounds cover all phases.
- Small bodies: PDS, Hayabusa(2), OSIRIS-REx, Dawn and DAMIT shapes (DAMIT is Z-north: (x,y,z) → (x,z,−y)). Pallas: Carry et al. partial K-band albedo on DAMIT 102, mean-filled; Psyche: DAMIT 1806 facet albedo; Juno: measured albedo + spectral class only; Ceres: near-spherical, Dawn map + normals. Halley (Stooke/PDS) and 67P (ESA) meshes; Encke, Hale–Bopp labelled approximations; comae/tails illustrative.
- DOM labels: no writes for hidden or sub-pixel ones; a locale change renames them without rebuilding the scene.

## 4 Sky

- Yale BSC5 (9,096 stars): binary of J2000 unit vectors, annual proper-motion vectors, magnitude, B−V; a `years` uniform applies proper motion in the shader; no precession.
- 88 IAU figures (d3-celestial) as star-index pairs, each vertex snapped to the nearest catalogued star; the name sits 40% down the figure's own height, centred on its width, in a tangent frame whose vertical is scene up.
- Milky Way panorama mapped from galactic coordinates onto a camera-carried sphere, not `scene.background`; a test finds the Magellanic Clouds at catalogue positions.
- Sky objects re-centre on the camera in `onBeforeRender`; render order −2 panorama, −1 stars and lines; star shaders write premultiplied colour, alpha 1, additive, in the opaque pass.

## 5 Sky events (Web Worker)

- Worker via Vite `?worker`; handle constructor failure and error events; ticket every request; verify a real result in the exported build.
- Observer: lat, lon, height, UTC offset — typed, or geolocation (secure context, only on explicit Earth-location or ground-view actions); default Beijing; IANA zone from coordinates. An offset belongs to an instant: compute it at the simulated moment, never from `new Date().getTimezoneOffset()`; test every `Intl.supportedValuesOf('timeZone')` to the quarter hour. Edit the site beside Earth's sunrise card; read-only elsewhere.
- Sunrise, sunset, day length (upper limb, standard refraction).
- Planner tabs: solar, lunar, oppositions (Mars–Neptune), transits (Mercury, Venus); `?planner=<tab>` opens one. Actions focus Earth/Moon at maximum, or frame Sun, Earth and target from rendered positions and radii with room for rings and panels (sharing still measures zoom against the ordinary framing).
- Global and local solar eclipses are two ordered cursors (`SearchGlobalSolarEclipse`, `SearchLocalSolarEclipse`) matched within ½ day; never show a local peak as the global one; check the Sun's altitude (local visibility admits a sunrise mid-eclipse); find a site's next visible eclipse by its own search and pair it.
- Paging extends only the global run (the appended local eclipse is a preview); cursor = last event + 1 tick; step over a candidate before the start instead of ending; merge pages on peak; later pages skip the local hunt; loaded pages survive closing the dialog.
- Oppositions: bracket with `SearchRelativeLongitude(body, 0)`, then solve the 180° apparent geocentric longitude difference (test: Saturn 2026-10-04 12:25:47 UTC). Transit contacts are geocentric; the Sun's altitude at peak does not prove the whole transit visible.
- Result dialogs snapshot time and place on open, including a URL intent's shared time. Penumbral lunar eclipses never print 0% obscuration.
- Shadows from physical vectors and radii, never enlarged geometry, in receiver-radius units in each receiver's rotating frame, for every planet and moon receiver and its possible casters (asteroids and comets take no part): umbra, penumbra, full central path and limits (background job, Earth-fixed unit sphere, both sides of midnight, hidden when stale after a seek), else a 90-min shadow-axis trail. Swept footprints blend once per pixel (stencil). Lunar eclipses tint copper-red in space and ground views. Guides never intercept picks. Tests: the 2024-04-08 axis crosses Mexico; total/annular/hybrid classification; display-scale independence.
- Live eclipse progress card; on small screens it parks above the playback bar, grows upward, covers at most half the scene, and drags by a handle clamped to the viewport (tap vs drag decided on pointerup).

## 6 Moon

- Moon selected → a phase card heads the info column (disc, name, illumination, age, tonight's window), same height in every language; an eclipse card replaces it. It opens three tabs — Current: elongation, phase angle, distance, apparent diameter, alt/az, RA/Dec, tonight's window (Moon up between sunset and sunrise); Phases: next 12 principal phases; Calendar: a local month of phase, age, illumination, rise, transit, set, transit altitude, distance, diameter, principal phases badged, days may lack an event.
- Name phases by distance to the nearest quarter, not 45° sectors. Elongation (`MoonPhase`) sets name and shape; phase angle (`Illumination`) is labelled separately; lit fraction (1−cos)/2. Local values: shift the instant by the fixed offset and format as UTC; rows read at local noon. `useMemo`, snapshotted on open.
- Disc: the real Moon map, orthographic, linear albedo lit by the phase angle; elongation picks waxing/waning without mirroring the map; rotated 180° for southern observers; illustrative earthshine; one shared decoded texture; cancel stale draws.

## 7 Ground sky

- Telescope button beside Overview/Top-down: observer camera at the shared site (asks for a location if none is chosen); horizon, cardinal points, Sun, Moon, planets, stars, figures, ecliptic. Entering and leaving keep time, playback, speed.
- Local frame = `Rotation_HOR_EQJ`, then the scene's J2000 rotation; bodies from topocentric `Equator(…, false, true)`, never illustrated scene positions. Size (true / Sun and Moon ×10, planet minimum) and distance (true / compressed) change radii and depth, never directions. Ground bodies reuse the scene's textures with their own Sun-direction shading. Standard perspective for sky and horizon; fix off-axis roundness on body vertices only. Full sky below the horizon, no ground mask; stars by day; no refraction or weather. No sharing here.
- Attitude: W3C Z-X′-Y″ + screen-orientation roll; reject relative or invalid headings. Safari: align yaw once at the first reliable reading (`−alpha − webkitCompassHeading`) at whatever tilt, then follow the full relative quaternion with no further magnetic correction; WMM declination (geomagnetism) at the device's real date; damp the whole camera quaternion by frame time; manual heading trim. Request permission inside the entering tap; leaving's cleanup must not cancel it. Fallback: drag, arrow keys (canvas focused), pinch/scroll FOV. Tests: first-use east/west at several tilts, horizon and zenith sweeps, Euler branch changes, heading wrap, both orientations.

## 8 Sandbox (pure module, no DOM)

- Fork the current instant into Newtonian point masses (AU, days, M☉, Gaussian k): Sun, 8 planets (Earth = Earth–Moon barycentre), Pluto. Velocity Verlet, step = clamp(0.01·min√(r³/GM), 1e-4, 0.5) d, re-chosen every 32 steps; runs start at 1 d/s. An unedited year stays within ~1e-3 AU of `HelioVector` (test; model error, not integrator error).
- Edits: mass, orbital speed, distance, spin period/tilt (visual only), add/remove bodies; perfectly inelastic merges (mass and momentum conserved, volumes add). A ghost of the unedited fork runs on the same step. Live energy drift, rebased per change. One timeline logs collisions, escapes, captures, edits.
- A run is a recipe — fork epoch + changes stamped with elapsed time — so edits land mid-flight and a few-dozen-character link replays it identically. Whole steps only, cut only at a change, remainder banked; draw the last whole step carried through the banked time by the position half of the same Verlet step; clocks show that time; an edit first settles the run there with the cut a replay makes; position-dependent edits read the settled run.
- The fork's heliocentric inertial frame throughout; measure and place relative to the central body's current state. Leaving = receding from well outside every body with ≥1% of the mass, judged against the rest as one barycentric mass, only on step reviews.
- Trails: whole run, a point per 15° of heading, local 4-point spline, only the last span redrawn per frame; absorbed bodies keep theirs to the contact point.
- Moons (off by default; a leading `m` in links): the 13 moons >500 km radius, split from system barycentres about the same centre of mass; the step follows Io, so cap at 20 d/s. A moon is read and edited from its planet only while held; that relation never touches forces or stored positions. At illustrated sizes, map moons continuously outward from their original parent, fading to true distance as they leave — one map for body, ring, trail (each sample mapped with its parent's position at that sample), connector and camera target.
- Timeline reset replays the recipe; panel reset forks afresh and drops the link. During a run, ephemeris-only layers (other moons, comets, asteroids, belts, eclipses, observer marker, normal sharing) leave.
- Ground sky in a run: drawn Earth and bodies at the shown time, spherical-Earth observer, horizon from physical spin integrated across timed edits (never per frame), light from the drawn Sun, no ephemeris Moon, no sandbox ghosts or trails; losing Earth exits.
- Tests: frame invariance, replay determinism, display/trail continuity across a moon's departure.

## 9 Sharing

- Share renders a frame and reads the canvas in the same tick, then links moment, playback, speed, body (hash) and camera (distance ÷ body framing distance + two angles). The pose is reapplied on every reframe until the viewer grabs the controls; following another body clears it. Never observer coordinates or display preferences. Recognized by moment alone (unusable → current sky); applied once after the hash selects, then consumed keys stripped. Sandbox links carry the recipe.
- Image: body name, UTC moment, QR (uqr) dark on its own toned card, 4-module quiet zone, whole-pixel modules (tests decode via `BarcodeDetector`). Dialog: a second QR at device-pixel resolution. Coarse pointer: system share sheet with the image alone, previewed as a real `<img>`; fine pointer: download.
- `/<locale>/share[/<id>]?t=…`: the body's social card, forwarding to the explorer; no `og:url`, no canonical.

## 10 Site, SEO, i18n, PWA

- Routes: `/` (explorer; `?lang=`, `#body`); `/<locale>/bodies`, `/<locale>/bodies/<id>` (portrait, description, data table, facts, moons, sources, share, open in explorer); `/<locale>/events`, `/<locale>/events/<topic>`; dated editions `saturn-opposition-2026-10-04` (+2027, 2028: ephemeris distance, magnitude, ring tilt, local observing times, a build-rendered night-sky chart for a named reference site; linked from the matching planner card); `/<locale>/about`, `/<locale>/privacy`; 404. Route-group root layouts give each page its own `lang`; every dynamic route, bare `[locale]` included, exports `generateStaticParams`. Internal links carry no outbound arrow; source links do.
- Event guide, editorial (multi-year averages, links only to catalogued bodies, recurrence stated once): meteor showers (Quadrantids, Lyrids, η Aquariids, Perseids, Orionids, Leonids, Geminids, Ursids); planetary aspects (conjunction, opposition, elongation, transit, occultation); Moon (phases, supermoon, blue moon); eclipses (solar, lunar); Sun–Earth (equinoxes/solstices, perihelion/aphelion).
- Every page: localized title, description, canonical, reciprocal hreflang + x-default, OG/Twitter images (subject-first square, then a 1200×630 card; built with sharp, attribution embedded, bundled OFL font covering every localized name). The root's server HTML is English ("Orbits Observer"); the client swaps in the visitor's language. Metadata strings are separate from UI labels, with no decorative separators; convert units before formatting.
- JSON-LD: escape `<`, `>`, `&` (test `</script>`); breadcrumbs climb collection pages (moon → planet → bodies); a body is a `Place` with Wikidata `additionalType` + `sameAs` (resolved via its English Wikipedia article), figures as `PropertyValue` with UN/CEFACT codes restating printed values; no invented types, no FAQ markup; validate with validator.schema.org. Build-generated, git-ignored sitemap.xml and robots.txt. Export checks verify profiles, events, share pages and the absence of source maps in production output.
- 12 locales: zh-CN (default), en-US, ja-JP, ko-KR, de-DE, fr-FR, es-ES, it-IT, pt-BR, nl-NL, ru-RU, tr-TR; resolve `?lang` → saved → browser → zh-CN. Whole-sentence messages with placeholders and plurals; a per-locale glossary for body and event names; ids and data language-independent. Every string, fact, profile, guide topic, scene label and accessible name in every catalog; tests render every fact in every locale and compare placeholders. A locale switch keeps selection, paused time, camera. Check the longest strings (Japanese labels, comet names) near 900–1000 px and on phones.
- PWA: installable; Workbox worker built after the app; explorer HTML and chunks in one precache revision (app, workers, basic textures ≈ 9 MiB); capped runtime caches for profiles, textures, models; RSC and third-party requests bypass it; an offline fallback for unvisited localized profiles; a new worker waits for old clients, then cleans old caches. Test offline on the production build at its own origin.

## 11 Data, content

- Each asset: a source-manifest + CREDITS entry (URL, licence, retrieval date) surfaced in the app and README, and a regeneration script reading git-ignored downloads: Solar System Scope, CelestiaContent, NASA/USGS/NOAA DEMs, PDS/ESA/JAXA/NASA/DAMIT shapes, JPL SBDB, satellite elements and physical parameters, BSC5 (CDS V/50), d3-celestial, a redistributable Milky Way panorama, WMM. No non-commercial or unclear licences.
- Every fact, profile and guide statement cites NASA, JPL, ESA or peer-reviewed sources; numbers come from the data tables, never freehand.
- Docs: README in English and Simplified Chinese, deployment and localization guides, LICENSE.

## 12 Engineering, milestones

- Astronomy, sandbox, catalogues: pure, unit-tested modules; the scene only places their output. No side effects in setState updaters; async results guarded by a ticket and a live flag set on mount; client code never assumes `process`.
- Milestones: (1) frame, clock, bodies, camera; (2) textures, Sun, belts, labels, settings; (3) worker, sunrise, eclipses, planner; (4) Moon; (5) sky; (6) ground sky; (7) sandbox; (8) sharing; (9) site, SEO, PWA; (10) content, translations; then a full regression pass.
