#!/usr/bin/env bash
# Renders the ORBIT promo into work/promo/out: a 16:9 master, a 9:16 cut and a
# sub-10 MB 16:9 copy for GitHub uploads. See README.md for prerequisites.
#
#   SKIP_BUILD=1    film the existing dist/client instead of rebuilding it
#   SKIP_CAPTURE=1  reuse the captured shots; re-mix and re-composite only
#   PYTHON=...      interpreter with numpy, scipy and soundfile (default:
#                   work/promo/.venv/bin/python when it exists, else python3)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
work=$root/work/promo
site_port=${PROMO_SITE_PORT:-4317}
asset_port=${PROMO_ASSET_PORT:-4318}
if [ -z "${PYTHON:-}" ]; then
  if [ -x "$work/.venv/bin/python" ]; then PYTHON=$work/.venv/bin/python; else PYTHON=python3; fi
fi
export PROMO_WORK=$work
export PROMO_SITE=http://127.0.0.1:$site_port/
export PROMO_ASSETS=http://127.0.0.1:$asset_port
shots="sun roam eclipse eclipseui moon lunar slider chaos plate"
mkdir -p "$work"

if [ "${SKIP_BUILD:-0}" != 1 ]; then
  echo "== building the static site"
  (cd "$root" && npm run prebuild:vercel && VERCEL=1 npx vinext build)
fi
[ -f "$root/dist/client/index.html" ] || { echo "no dist/client build; run without SKIP_BUILD" >&2; exit 1; }

# One server films the site; the other hands the compositor its pages and frames.
python3 -m http.server "$site_port" --bind 127.0.0.1 --directory "$root/dist/client" >/dev/null 2>&1 &
site_pid=$!
python3 -m http.server "$asset_port" --bind 127.0.0.1 --directory "$root" >/dev/null 2>&1 &
asset_pid=$!
trap 'kill "$site_pid" "$asset_pid" 2>/dev/null || true' EXIT
wait_for() {
  for _ in $(seq 50); do
    curl -fs -o /dev/null "$1" && return
    sleep 0.2
  done
  echo "nothing answered at $1" >&2
  exit 1
}
wait_for "$PROMO_SITE"
wait_for "$PROMO_ASSETS/scripts/promo-video/timeline.json"

if [ "${SKIP_CAPTURE:-0}" != 1 ]; then
  for shot in $shots; do
    echo "== capturing $shot"
    node "$here/capture/shots.mjs" "$shot" "$work/frames/$shot"
    rm -rf "$work/f30/$shot" && mkdir -p "$work/f30/$shot"
    # Each pair of 60 fps frames blends into one 30 fps frame: two-frame motion blur.
    ffmpeg -v error -y -framerate 60 -i "$work/frames/$shot/f%05d.jpg" \
      -vf "tmix=frames=2:weights='1 1',framestep=2" -q:v 2 -start_number 0 \
      "$work/f30/$shot/f%04d.jpg"
  done
fi

echo "== scoring and mixing"
"$PYTHON" "$here/audio/score.py" "$work/audio"
# Limit the peaks, then normalize to -14 LUFS and -1 dBTP in two passes.
ffmpeg -v error -y -i "$work/audio/mix.wav" \
  -af "aresample=192000,alimiter=limit=0.63:attack=2:release=80:level=disabled,aresample=48000" \
  -c:a pcm_s24le "$work/audio/limited.wav"
measured=$(ffmpeg -hide_banner -nostats -i "$work/audio/limited.wav" \
  -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 |
  sed -n '/^{/,/^}/p' |
  python3 -c 'import json, sys; d = json.load(sys.stdin); pairs = (("measured_I", "input_i"), ("measured_TP", "input_tp"), ("measured_LRA", "input_lra"), ("measured_thresh", "input_thresh"), ("offset", "target_offset")); print(":".join(name + "=" + d[key] for name, key in pairs))')
ffmpeg -v error -y -i "$work/audio/limited.wav" \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11:${measured}:linear=true,aresample=48000" \
  -c:a pcm_s24le "$work/audio/master.wav"

for layout in landscape vertical; do
  echo "== compositing $layout"
  rm -rf "$work/comp/$layout"
  node "$here/composite/render.mjs" "$layout" "$work/comp/$layout"
done

echo "== encoding"
mkdir -p "$work/out"
encode() { # frames output crf audio-bitrate [more x264 options]
  local frames=$1 output=$2 crf=$3 bitrate=$4
  shift 4
  # Chrome's JPEG frames are full-range BT.601; deliver limited-range BT.709.
  ffmpeg -v error -y -framerate 30 -i "$frames/c%04d.jpg" -i "$work/audio/master.wav" \
    -vf "scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p" \
    -c:v libx264 -preset slow -profile:v high -crf "$crf" -g 60 "$@" \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
    -c:a aac -b:a "$bitrate" -ar 48000 -shortest -movflags +faststart "$output"
}
encode "$work/comp/landscape" "$work/out/orbit-promo-16x9.mp4" 16 192k
encode "$work/comp/vertical" "$work/out/orbit-promo-9x16.mp4" 17 192k
# GitHub caps inline video uploads at 10 MB on free plans.
encode "$work/comp/landscape" "$work/out/orbit-promo-github.mp4" 23 128k -maxrate 3500k -bufsize 7000k
ls -l "$work/out"
