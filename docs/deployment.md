# Deployment

ORBIT builds from one codebase to two independent targets:

| Target                    | Command                | Output                                 | Notes                                                     |
| ------------------------- | ---------------------- | -------------------------------------- | --------------------------------------------------------- |
| Vercel (static export)    | `npm run build:vercel` | `dist/client` (static HTML/JS/CSS)     | Sets `output: 'export'` via `VERCEL=1`; no server runtime |
| Sites / Cloudflare Worker | `npm run build`        | `dist/server` (Worker) + `dist/client` | Default target; served through `wrangler`                 |

Both run the same `vinext build`; only the entry command and resulting output differ. Publishing the Worker output as a Vercel static site results in a root-page 404 — always use `build:vercel` for Vercel.

## Deploy to Vercel

The repository root includes [`vercel.json`](../vercel.json), so importing the GitHub repository with the root directory unchanged picks up the correct settings automatically:

| Setting          | Value                  |
| ---------------- | ---------------------- |
| Build Command    | `npm run build:vercel` |
| Output Directory | `dist/client`          |
| Framework Preset | Other / unset          |
| Clean URLs       | Enabled                |

### First-time project setup

1. In Vercel, **Add New → Project** and import this GitHub repository. Keep the root directory as-is.
2. Confirm Build & Development Settings match the table above (they should be picked up from `vercel.json`; only override manually if Vercel shows something different).
3. Add the required `NEXT_PUBLIC_SITE_URL` and any optional environment variables — see [Environment variables](#environment-variables) below.
4. Deploy. The `cleanUrls` setting maps exported files such as `dist/client/zh-CN/bodies/sun.html` to `/zh-CN/bodies/sun`.

### Redeploying after an environment variable change

Environment variables such as `NEXT_PUBLIC_GA_MEASUREMENT_ID` are read at build time and inlined into the static output. Adding, changing, or removing one in Project Settings does **not** affect deployments that already exist — trigger a new build (push a commit, or use **Deployments → Redeploy**) for the change to take effect.

## Environment variables

| Variable                        | Required | Where it's read          | Purpose                                        |
| ------------------------------- | -------- | ------------------------ | ---------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Yes for public deployments | Build time | Canonical origin for metadata, sitemap, and robots URLs |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No       | Build time, both targets | Enables Google Analytics 4 when set; see below |

Set `NEXT_PUBLIC_SITE_URL` to the exact public origin, for example `https://orbits.observer`, without a path. Redeploy after changing it because static metadata and SEO files are generated during the build.

### Google Analytics (optional)

ORBIT can report page views to Google Analytics 4 through `gtag.js`. The script only loads when a Measurement ID is configured, so analytics stays off by default and the site remains fully static either way.

1. Get a GA4 **Measurement ID** (Google Analytics → Admin → Data Streams → your web stream), formatted like `G-XXXXXXXXXX`.
2. **Local development:** copy [`.env.example`](../.env.example) to `.env.local` and set `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
3. **Vercel:** add the same variable under Project Settings → Environment Variables. Scope it to Production only, unless you also want Preview deployments tracked.
4. Redeploy (see above) — the ID is baked into the build, not read at runtime.
5. Verify: open the deployed site, confirm a request to `googletagmanager.com/gtag/js?id=G-...` in the Network tab, or check the GA4 Realtime report.

Leave the variable unset to ship ORBIT without loading any analytics script.

## Sites / Cloudflare Worker build

`npm run build` (no `VERCEL` flag) produces the Worker target consumed by the Sites platform, using `dist/server/wrangler.json` with `wrangler`. This is the default target for local development (`npm run dev`) and requires no additional configuration beyond what's already in the repository.

## Progressive Web App (PWA)

Both production build commands generate the install manifest, PNG icons and localized offline pages, then bundle a self-contained [Workbox service worker](https://developer.chrome.com/docs/workbox/modules/workbox-precaching) at `dist/client/sw.js`. No CDN is needed for the worker. Generated files are ignored by Git; the icon source is the existing `public/favicon.svg`.

- Serve the site at the origin root over HTTPS (localhost also supports service workers). `vercel.json` and the Cloudflare `public/_headers` rules make the worker and manifest revalidate instead of remaining in a long-lived HTTP cache.
- The install cache contains the explorer HTML, all compiled scripts/styles (including astronomy workers), PWA assets, and the Earth, Sun, and Milky Way textures. The explorer uses that build's saved HTML so its chunks stay in sync. URL language, selection and observer parameters are still interpreted by the client.
- Full body-profile navigations try the network first, falling back to up to 48 visited pages. An unvisited profile shows an offline page in the route's language with a return link. RSC payloads, API requests, mutations and third-party requests are not cached.
- Moon and Mars textures preload when the browser is idle; other standard planet and moon textures load as their bodies enter the camera view, while optional terrain, models and profile images load when needed. Their runtime cache is capped at 80 entries for 30 days and is removed on a new build. Quota pressure can evict runtime caches; clearing browser storage removes all offline content. High-resolution textures retain the existing standard-quality fallback.
- Updates wait for all existing ORBIT clients to close before activation. There is no forced reload of a running simulation. `npm run dev` does not register a worker; use a different local origin/port from a production PWA preview so its saved worker cannot control development pages.

To verify a release, serve the **production output**, open the explorer online, and wait for the service worker to activate. Confirm the manifest, 192/512 PNG icons, Apple touch icon and theme color on both the explorer and localized profiles. Visit one profile, then stop the local server: reload that profile, return to the explorer with a `?lang=` query/hash, and calculate the next eclipses. An unvisited profile must show its localized offline fallback. Check portrait and landscape layouts, restore the connection, then verify a changed build waits until old tabs close before replacing its caches.
