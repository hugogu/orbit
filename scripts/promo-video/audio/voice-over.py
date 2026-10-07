"""Synthesize the promo's voice-over lines into ./vo, with Kokoro.

Kokoro-82M (Apache-2.0 weights) runs locally through kokoro-onnx, with
kokoro-onnx, soundfile and numpy installed:

    python voice-over.py [model-dir]

The model is read from model-dir, else $KOKORO_MODELS, else the shared cache
~/.cache/kokoro-onnx. Its two files (kokoro-v1.0.onnx and voices-v1.0.bin,
about 350 MB) are downloaded there once if missing, so one machine keeps one copy.

Each line is trimmed of its leading and trailing silence, so it starts exactly
where ../timeline.json places it. The committed clips were made this way.
"""
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

import espeakng_loader
import numpy as np
import soundfile as sf
from phonemizer.backend.espeak.wrapper import EspeakWrapper

MODEL_FILES = ("kokoro-v1.0.onnx", "voices-v1.0.bin")
MODEL_RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
VOICE = "af_heart"
LINES = {  # clip: (text, speed)
    "vo1": ("Fly through the solar system, right in your browser.", 1.08),
    "vo2": ("Watch real eclipses sweep across the Earth.", 1.08),
    "vo3": ("Track every phase of the Moon.", 1.08),
    "vo4": ("What if Jupiter were a star? Find out in sandbox mode.", 1.08),
    # Spoken apart, so the end card gets a beat between the name and the line.
    "vo5a": ("Orbit.", 0.95),
    "vo5b": ("Free to explore.", 1.05),
}


def model_dir(argument: str | None) -> Path:
    """The model folder, downloading its files into it on first use."""
    default = Path.home() / ".cache" / "kokoro-onnx"
    folder = Path(argument or os.environ.get("KOKORO_MODELS") or default).resolve()
    folder.mkdir(parents=True, exist_ok=True)
    for name in MODEL_FILES:
        target = folder / name
        if target.exists():
            continue
        print(f"downloading {name} into {folder}")
        partial = target.with_suffix(target.suffix + ".part")
        urllib.request.urlretrieve(f"{MODEL_RELEASE}/{name}", partial)
        partial.rename(target)
    return folder


def use_short_espeak_path() -> None:
    """Point espeak-ng at its data through a short relative path.

    espeak-ng keeps the data path in a 160-byte buffer and silently falls back
    to its build machine's path when the real one is longer, as a deep
    virtualenv's is. A link in the (temporary) working directory stays short.
    """
    data = Path(espeakng_loader.get_data_path())
    if len(str(data)) < 150:
        return
    link = Path("espeak-ng-data")
    if not link.exists():
        link.symlink_to(data)
    EspeakWrapper.data_path = property(lambda self: link)


def main(argument: str | None) -> None:
    models = model_dir(argument)
    out = Path(__file__).resolve().parent / "vo"
    out.mkdir(exist_ok=True)
    os.chdir(tempfile.mkdtemp())
    use_short_espeak_path()
    # Imported only now: constructing Kokoro starts espeak with the path above.
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(*(str(models / name) for name in MODEL_FILES))
    for name, (text, speed) in LINES.items():
        samples, rate = kokoro.create(text, voice=VOICE, speed=speed, lang="en-us")
        loud = np.flatnonzero(np.abs(samples) > 0.01)
        start = max(0, loud[0] - int(0.02 * rate))
        end = min(len(samples), loud[-1] + int(0.06 * rate))
        sf.write(out / f"{name}.flac", samples[start:end], rate)
        print(f"{name}: {(end - start) / rate:.2f}s  {text}")


if __name__ == "__main__":
    if len(sys.argv) > 2:
        sys.exit("usage: python voice-over.py [model-dir]")
    main(sys.argv[1] if len(sys.argv) == 2 else None)
