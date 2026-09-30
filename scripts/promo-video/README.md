# Promo video

Renders the 20-second promo of the explorer, with an English voice-over, into
`work/promo/out/`:

| File                     | Use                                            |
| ------------------------ | ---------------------------------------------- |
| `orbit-promo-16x9.mp4`   | 1920×1080 master for YouTube, X or Bilibili    |
| `orbit-promo-9x16.mp4`   | 1080×1920 cut for Reels, TikTok and Shorts     |
| `orbit-promo-github.mp4` | the 16:9 cut under GitHub's 10 MB upload limit |

Every frame of footage is recorded from the static production export; titles,
the replayed pointer, music and voice are added afterwards.

## Prerequisites

- Google Chrome, which drives the WebGL scene on the GPU.
- Playwright, which is deliberately not a project dependency:
  `npm install --no-save playwright-core`, or set `PLAYWRIGHT_MODULE` to the
  entry point of a copy you already have.
- `ffmpeg` built with libx264.
- Python 3 with numpy, scipy and soundfile. `render.sh` uses
  `work/promo/.venv` when it exists:

  ```sh
  python3 -m venv work/promo/.venv
  work/promo/.venv/bin/pip install numpy scipy soundfile
  ```

- The titles are set in Avenir Next, which ships with macOS; elsewhere they
  fall back to the system sans-serif.

## Rendering

```sh
scripts/promo-video/render.sh
```

It builds the static export, serves it on 127.0.0.1:4317, captures the nine
shots, mixes the audio, composites both layouts and encodes the three files.
`SKIP_BUILD=1` films the existing `dist/client`, and `SKIP_CAPTURE=1` reuses
the captured shots when only titles, framing or sound changed. Everything it
writes stays in the ignored `work/promo/`. The Sun, Jupiter and slider shots
leave their clocks running while the page loads, so they land slightly
differently from one run to the next; the audio is identical every time.

## How it fits together

- `timeline.json` is the edit: each clip's shot and in-point, the cut types,
  title and callout windows, the replayed clicks and drag, where each voice
  line and whoosh lands, and the end card. The audio and both layouts read it.
- `capture/shots.mjs` stages each shot through a share link (moment, body,
  camera pose, sandbox recipe) and records it at 60 fps.
  `node capture/shots.mjs <shot> <dir> --preview` saves every twelfth frame
  for a quick framing check. `capture/studio.mjs` replaces
  `requestAnimationFrame` and `performance.now` with one virtual clock stepped
  once per frame, so motion is smooth however slowly a frame is captured, and
  drives the camera with events dispatched on the canvas; AGENTS.md lists the
  traps this avoids. `capture/poses.mjs` computes the Moon and Sun directions
  the shots were staged with.
- `render.sh` blends each pair of 60 fps frames into one 30 fps frame, which
  gives two-frame motion blur.
- `composite/landscape.html` and `composite/vertical.html` render each output
  frame: the shot, a punch-in, cut transitions, titles, the pointer and the end
  card. What both layouts share lives in `composite/common.js`, and
  `composite/render.mjs` screenshots each frame.
- `audio/score.py` synthesizes the music and effects on a 120 BPM grid (cuts
  and whooshes stay on its half-second beats) and mixes the voice over them,
  ducking the music under it; `render.sh` then limits the peaks and normalizes
  to −14 LUFS.

## Voice-over

`audio/vo/` holds the six lines used in the video. They were synthesized
locally with Kokoro (Kokoro-82M, Apache-2.0 weights), voice `af_heart`, by
`audio/voice-over.py`; its docstring lists the model files it needs. Rerun it
to change the wording or the voice, then update the caption word timings in
`composite/vertical.html`.

## Rights

- The music and effects are synthesized from scratch, with no samples.
- The planet, Moon and Milky Way maps on screen are Solar System Scope's,
  under CC BY 4.0, and some moon maps are CelestiaContent's (CC BY / CC BY-SA):
  credit them wherever the video is published.
